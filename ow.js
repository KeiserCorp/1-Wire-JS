"use strict";
module.exports = function (ow) {
	var Q = require('q');

	if (typeof ow == 'undefined') {
		var ow = {};
	}

	/*****************************************
	 *	Chrome Permissions
	 *****************************************/

	var DALLAS_VENDOR_ID = 1274; //0x04FA;
	var DALLAS_PRODUCT_ID = 9360; //0x2490;
	var DEVICE_INFO = {
		"vendorId" : DALLAS_VENDOR_ID,
		"productId" : DALLAS_PRODUCT_ID
	};

	var permissionObj = {
		permissions : [{
				'usbDevices' : [DEVICE_INFO]
			}
		]
	};

	ow.checkPermission = function () {
		var deferred = Q.defer();
		chrome.permissions.contains(permissionObj, function (result) {
			if (result) {
				// Success - Permission already granted
				deferred.resolve();
			} else {
				// Fail - Permission has not yet been granted
				deferred.reject();
			}
		});
		return deferred.promise;
	};

	ow.requestPermission = function () {
		var deferred = Q.defer();
		chrome.permissions.request(permissionObj, function (result) {
			if (result) {
				// Success - Permission granted
				deferred.resolve();
			} else {
				// Fail - Permission denied
				deferred.reject();
			}
		});
		return deferred.promise;
	};

	/*****************************************
	 *	USB Device Targeting
	 *****************************************/

	var deviceConnection;
	var deviceInterface;

	ow.openDevice = function () {
		var deferred = Q.defer();
		chrome.usb.findDevices(DEVICE_INFO, function (connections) {
			if (connections && connections.length > 0) {
				// Success - Devices Found
				deviceConnection = connections[0];
				chrome.usb.listInterfaces(deviceConnection, function (descriptors) {
					deviceInterface = descriptors[0];
					mapEndpoints();
					claimDeviceInterface().then(deferred.resolve);
				});
			} else {
				// Fail - Devices not found
				deferred.reject();
			}
		});
		return deferred.promise;
	};
	
	var claimDeviceInterface = function(){
		var deferred = Q.defer();
		chrome.usb.claimInterface(deviceConnection, deviceInterface.interfaceNumber, deferred.resolve);
		return deferred.promise;
	};

	/*****************************************
	 *	Device Endpoint Selection
	 *****************************************/

	var deviceEndpoints = {
		interrupt : {},
		in : {},
		out : {},
	};

	var mapEndpoints = function () {
		deviceInterface.endpoints.forEach(function (endpoint) {
			if (endpoint.direction == 'in' && endpoint.type == 'interrupt') {
				deviceEndpoints.interrupt = endpoint;
			} else if (endpoint.direction == 'in' && endpoint.type == 'bulk') {
				deviceEndpoints.in = endpoint;
			} else if (endpoint.direction == 'out' && endpoint.type == 'bulk') {
				deviceEndpoints.out = endpoint;
			}
		});
	};

	return ow;
};
