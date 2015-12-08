"use strict";
var oneWire = require('../ow.js');
var ow = oneWire();

var gotPermission = function () {
	requestButton.style.display = 'none';
	document.querySelector('#permission').innerText = 'Permission: Granted';
	console.log('App was granted the "usbDevices" permission.');
	awaitDevice()
	.fail(function (error) {
		console.log(error);
	});
};

var failedPermission = function () {
	document.querySelector('#permission').innerText = 'Permission: Failed';
	console.log('App was not granted the "usbDevices" permission.');
	console.log(chrome.runtime.lastError);
};

var awaitDevice = function () {
	var deviceSearchTimeout = function () {
		chrome.usb.onDeviceAdded.addListener(function () {
			ow.openDevice().then(deviceFound);
		});
	};
	document.querySelector('#device').innerText = 'Device: Not Found';
	document.querySelector('#key').innerText = 'Key: Disconnected';
	document.querySelector('#rom').innerText = 'ID:';
	return ow.openDevice().then(deviceFound, deviceSearchTimeout);
};

var deviceFound = function () {
	document.querySelector('#device').innerText = 'Device: Found';
	ow.onDeviceRemoved.addListener(awaitDevice)
	return awaitKey();
};

var awaitKey = function () {
	var interruptTimeout = function (result) {
		if (result.ResultRegisters && result.ResultRegisters.DetectKey) {
			document.querySelector('#key').innerText = 'Key: Detected';
			getKeyRom()
			.then(awaitKey)
			.fail(function () {
				awaitKey();
			});
		} else {
			document.querySelector('#key').innerText = 'Key: Disconnected';
			document.querySelector('#rom').innerText = 'ID:';
			awaitKey();
		}
	};
	setTimeout(function () {
		ow.interruptTransfer()
		.then(interruptTimeout)
		.fail(function () {
			awaitKey();
		});
	}, 500);
};

var getKeyRom = function () {
	return ow.keySearchFirst()
	.then(function (rom) {
		if (rom[0] === 0x0C) {
			document.querySelector('#key').innerText = 'Key: Connected';
			document.querySelector('#rom').innerText = 'ID: ' + rom.toHexString();
			return getKeyMemory(rom);
		}
		awaitKey();
	});
};

var getKeyMemory = function (keyRom) {
	var start = performance.now();
	var finish;
	console.log('Beginning Memory Flush');
	return ow.keyReadAll(keyRom)
	.then(function (data) {
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
	}).fail(function (error) {
		return ow.deviceReset()
		.then(function (keyRom) {
			return getKeyMemory(keyRom);
		});
	});
};

var monitorConnectionStatus = function (keyRom) {
	var monitorTimeout = function (result) {
		console.log(result);
		monitorConnectionStatus();
	};
	setTimeout(function () {
		ow.deviceGetStatus().then(monitorTimeout);
	}, 2000);
};

var requestButton = document.getElementById("requestPermission");

window.onload = function () {
	ow.checkPermission().then(gotPermission);
	requestButton.addEventListener('click', function () {
		ow.requestPermission().then(gotPermission, failedPermission);
	});
};
