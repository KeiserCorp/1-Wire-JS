"use strict";
var oneWire = require('../ow.js');
var ow = oneWire();

var gotPermission = function () {
	requestButton.style.display = 'none';
	document.querySelector('#permission').innerText = 'Permission: Granted';
	console.log('App was granted the "usbDevices" permission.');
	awaitDevice();
};

var failedPermission = function () {
	document.querySelector('#permission').innerText = 'Permission: Failed';
	console.log('App was not granted the "usbDevices" permission.');
	console.log(chrome.runtime.lastError);
};

var awaitDevice = function (e) {
	var deviceSearchTimeout = function () {
		chrome.usb.onDeviceAdded.addListener(function () {
			ow.openDevice().then(deviceFound);
		});
	};
	document.querySelector('#device').innerText = 'Device: Not Found';
	ow.openDevice().then(deviceFound, deviceSearchTimeout);
};

var deviceFound = function () {
	document.querySelector('#device').innerText = 'Device: Found';
	ow.onDeviceRemoved.addListener(awaitDevice);

	awaitKey();
};

var awaitKey = function () {
	var interruptTimeout = function (result) {
		if (result.ResultRegisters && result.ResultRegisters.DetectKey) {
			// Success - Key detected
			document.querySelector('#key').innerText = 'Key: Connected';
			//initializeCommunication(readChipData);
		} else {
			// Fail - No key found
			document.querySelector('#key').innerText = 'Key: Disconnected';
			awaitKey();
		}
	};
	// Loop every 100ms until a key is detected
	setTimeout(function () {
			ow.interrupt().then(interruptTimeout);
	}, 100);
};

var requestButton = document.getElementById("requestPermission");

window.onload = function () {
	ow.checkPermission().then(gotPermission);
	requestButton.addEventListener('click', function () {
		ow.requestPermission().then(gotPermission, failedPermission);
	});
};
