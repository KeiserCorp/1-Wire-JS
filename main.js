//var permissionObj = {permissions: [{'usbDevices': [DEVICE_INFO] }]};
var oneWire = require('./ow.js');
var ow = oneWire();

var gotPermission = function (result) {
	requestButton.style.display = 'none';
	document.querySelector('#permission').innerText = 'Permission: Granted';
	console.log('App was granted the "usbDevices" permission.');
	//awaitDevices();
};

var failedPermission = function (result) {
	document.querySelector('#permission').innerText = 'Permission: Failed';
	console.log('App was not granted the "usbDevices" permission.');
	console.log(chrome.runtime.lastError);
};

var requestButton = document.getElementById("requestPermission");

window.onload = function () {
	ow.checkPermission(gotPermission);

	requestButton.addEventListener('click', function () {
		console.log('click');
		ow.requestPermission(gotPermission, failedPermission);
	});
};