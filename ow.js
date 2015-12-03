"use strict";

module.exports = function (ow) {
	var Q = require('q');

	if (typeof ow == 'undefined') {
		var ow = {};
	}

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

	var permissionStatus = false;

	ow.checkPermission = function () {
		var deferred = Q.defer();
		chrome.permissions.contains(permissionObj, function (result) {
			if (result) {
				permissionStatus = true;
				deferred.resolve();
			} else {
				deferred.reject();
			}
		});
		return deferred.promise;
	};

	ow.requestPermission = function () {
		var deferred = Q.defer();
		chrome.permissions.request(permissionObj, function (result) {
			if (result) {
				permissionStatus = true;
				deferred.resolve();
			} else {
				deferred.reject();
			}
		});
		return deferred.promise;
	};

	return ow;
};
