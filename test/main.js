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
	var start;
	var finish;
	var keyRom;
	return ow.keySearchFirst()
	.then(function (rom) {
		keyRom = rom;
		document.querySelector('#rom').innerText = 'ID: ' + keyRom.toHexString();
		start = performance.now();
		return ow.keyReadAll(keyRom);
	}).then(function (data) {
		finish = performance.now();
		console.log('Standard Memory Flush: ' + ((finish - start) / 1000).toFixed(2) + 's');
		console.log(data);
	}).then(function () {
		start = performance.now();
		return ow.keyReadAll(keyRom, true);
	}).then(function (data) {
		finish = performance.now();
		console.log('Overdrive Memory Flush: ' + ((finish - start) / 1000).toFixed(2) + 's');
		console.log(data);
	});
};

var requestButton = document.getElementById("requestPermission");

window.onload = function () {
	ow.checkPermission().then(gotPermission);
	requestButton.addEventListener('click', function () {
		ow.requestPermission().then(gotPermission, failedPermission);
	});
};
