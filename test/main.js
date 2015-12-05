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
	document.querySelector('#key').innerText = 'Key: Disconnected';
	document.querySelector('#rom').innerText = 'ID:';
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
			document.querySelector('#key').innerText = 'Key: Connected';
			getKeyRom();
		} else {
			document.querySelector('#key').innerText = 'Key: Disconnected';
			document.querySelector('#rom').innerText = 'ID:';
			awaitKey();
		}
	};
	setTimeout(function () {
		ow.interruptTransfer().then(interruptTimeout);
	}, 500);
};

var getKeyRom = function () {
	var keyRom;
	ow.keySearchFirst().then(function (rom) {
		document.querySelector('#rom').innerText = 'ID: ' + rom.toHexString();
		keyRom = rom; // Needs to be rewritten to handle this cleaner
	}).then(function () {
		setTimeout(function () {
			ow.keyReadAll(keyRom).then(function (result) {
				console.log(result);
			});
		}, 500);
	});
};

var requestButton = document.getElementById("requestPermission");

window.onload = function () {
	ow.checkPermission().then(gotPermission);
	requestButton.addEventListener('click', function () {
		ow.requestPermission().then(gotPermission, failedPermission);
	});
};
