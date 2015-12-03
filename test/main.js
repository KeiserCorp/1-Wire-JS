"use strict";

var oneWire = require('../ow.js');
var ow = oneWire();

var gotPermission = function () {
	requestButton.style.display = 'none';
	document.querySelector('#permission').innerText = 'Permission: Granted';
	console.log('App was granted the "usbDevices" permission.');
	//awaitDevices();
};

var failedPermission = function () {
	document.querySelector('#permission').innerText = 'Permission: Failed';
	console.log('App was not granted the "usbDevices" permission.');
	console.log(chrome.runtime.lastError);
};

var requestButton = document.getElementById("requestPermission");

window.onload = function () {
	ow.checkPermission().then(gotPermission);

	requestButton.addEventListener('click', function () {
		ow.requestPermission().then(gotPermission, failedPermission);
	});
};
