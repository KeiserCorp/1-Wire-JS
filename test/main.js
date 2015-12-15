"use strict";
var oneWire = require('../ow.js');
var ow = oneWire();

var requestButton = document.getElementById("requestPermission");
var permissionElement = document.getElementById("permission");
var deviceElement = document.getElementById("device");
var keyElement = document.getElementById("key");
var romElement = document.getElementById("rom");

window.onload = function () {
	ow.checkPermission().then(gotPermission);
	requestButton.addEventListener('click', function () {
		ow.requestPermission().then(gotPermission, failedPermission);
	});
	
	ow.onDeviceAdded.addListener(deviceConnected);
	ow.onDeviceRemoved.addListener(deviceRemoved)
};

var gotPermission = function () {
	requestButton.style.display = 'none';
	permissionElement.innerText = 'Permission: Granted';
	console.log('App was granted the "usbDevices" permission.');
	awaitDevice();
};

var failedPermission = function () {
	permissionElement.innerText = 'Permission: Failed';
	console.log('App was not granted the "usbDevices" permission.');
	console.log(chrome.runtime.lastError);
};

var awaitDevice = function () {
	deviceRemoved();
	ow.openDevice().then(deviceOpened, function(e){console.log(e);});
};

var deviceConnected = function(device){
	ow.openDevice().then(deviceOpened);
};

var deviceRemoved = function(){
	deviceElement.innerText = 'Device: Not Found';
	keyElement.innerText = 'Key:';
	romElement.innerText = 'ID:';
};

var deviceOpened = function () {
	deviceElement.innerText = 'Device: Found';
	keyElement.innerText = 'Key: Disconnected';
	getKeyRom();
};

var getKeyRom = function () {
	return ow.keySearchFirst()
	.then(function (rom) {
		if (rom[0] === 0x0C) {
			document.querySelector('#key').innerText = 'Key: Connected';
			document.querySelector('#rom').innerText = 'ID: ' + rom.toHexString();
		} else {
			awaitKey();
		}
	}, awaitKey);
};

var awaitKey = function () {
	console.log('awaiting key');
	var interruptTimeout = function (result) {
		if (result.ResultRegisters && result.ResultRegisters.DetectKey) {
			document.querySelector('#key').innerText = 'Key: Detected';
			getKeyRom()
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
