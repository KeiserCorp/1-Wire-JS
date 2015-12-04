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

	var deviceObject;
	var deviceConnection;
	var deviceInterface;

	ow.openDevice = function () {
		var deferred = Q.defer();
		chrome.usb.getDevices(DEVICE_INFO, function (devices) {
			chrome.usb.findDevices(DEVICE_INFO, function (connections) {
				if (connections && connections.length > 0) {
					// Success - Devices Found
					deviceConnection = connections[0];
					deviceObject = devices[0];
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
		});
		return deferred.promise;
	};

	var claimDeviceInterface = function () {
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

	/*****************************************
	 *	Device Monitoring
	 *****************************************/

	var DeviceRemovedEvent = function () {
		this.handlers = [];
	};

	DeviceRemovedEvent.prototype = {
		addListener : function (fn) {
			this.handlers.push(fn);
		},
		removeListener : function (fn) {
			this.handlers = this.handlers.filter(
					function (item) {
					if (item !== fn) {
						return item;
					}
				});
		},
		dispatch : function (o, thisObj) {
			var scope = thisObj || window;
			this.handlers.forEach(function (item) {
				item.call(scope, o);
			});
		}
	}

	ow.onDeviceRemoved = new DeviceRemovedEvent();

	chrome.usb.onDeviceRemoved.addListener(function (device) {
		if (device.device == deviceObject.device) {
			ow.onDeviceRemoved.dispatch();
		}
	});

	/*****************************************
	 *	Device Interrupt
	 *****************************************/

	ow.interrupt = function () {
		var deferred = Q.defer();

		var transferInfo = {
			direction : deviceEndpoints.interrupt.direction,
			endpoint : deviceEndpoints.interrupt.address,
			length : 0x12 // 18
		};

		chrome.usb.interruptTransfer(deviceConnection, transferInfo, function (result) {
			if (result.resultCode) {
				// Fail - Interrupt Failed
				deferred.reject();
			} else {
				// Success - Interrupt Successful
				deferred.resolve(parseInterruptResponse(result.data));
			}
		});

		return deferred.promise;
	};

	var parseInterruptResponse = function (responseBuffer) {
		// Parse Interrupt Data in Mfg. Data Attributes
		var responseArray = new Uint8Array(responseBuffer);
		var stateRegisters = {};

		stateRegisters.SPUE = responseArray[0] & 0x01;
		stateRegisters.SPCE = (responseArray[0] >> 3) & 0x01;
		stateRegisters.Speed = responseArray[1];
		stateRegisters.PullupDuration = responseArray[2];
		stateRegisters.PulldownSlewRate = responseArray[4];
		stateRegisters.WriteLowTime = responseArray[5];
		stateRegisters.DataSampleOffset = responseArray[6];
		stateRegisters.SPUA = responseArray[8] & 0x01;
		stateRegisters.PMOD = (responseArray[8] >> 3) & 0x01;
		stateRegisters.HALT = (responseArray[8] >> 4) & 0x01;
		stateRegisters.IDLE = (responseArray[8] >> 5) & 0x01;
		stateRegisters.EP0F = (responseArray[8] >> 7) & 0x01;
		stateRegisters.CommCommand1 = responseArray[9];
		stateRegisters.CommCommand2 = responseArray[10];
		stateRegisters.CommCommandBufferStatus = responseArray[11];
		stateRegisters.DataOutBufferStatus = responseArray[12];
		stateRegisters.DataInBufferStatus = responseArray[13];

		if (responseArray[16]) {
			stateRegisters.ResultRegisters = {};
			stateRegisters.ResultRegisters.DetectKey = responseArray[16] == 165;
			if (responseArray[17] && responseArray[17] != 165) {
				stateRegisters.ResultRegisters.EOS = (responseArray[17] >> 7) & 0x01;
				stateRegisters.ResultRegisters.RDP = (responseArray[17] >> 6) & 0x01;
				stateRegisters.ResultRegisters.CRC = (responseArray[17] >> 5) & 0x01;
				stateRegisters.ResultRegisters.CMP = (responseArray[17] >> 4) & 0x01;
				stateRegisters.ResultRegisters.APP = (responseArray[17] >> 2) & 0x01;
				stateRegisters.ResultRegisters.SH = (responseArray[17] >> 1) & 0x01;
				stateRegisters.ResultRegisters.NRS = responseArray[17] & 0x01;
			}
		}

		return stateRegisters;
	};

	return ow;
};
