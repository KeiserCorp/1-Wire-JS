module.exports = function (ow) {
	'use strict';
	var Q = require('q');
	var crc8 = require('./node_modules/crc/lib/crc8_1wire.js');
	var ow = (ow || {});

	const TRANSACTION_TIMEOUT = 10;
	var OverdriveEnabled = false;

	/*****************************************
	 *	Chrome Permissions
	 *****************************************/

	const DALLAS_VENDOR_ID = 0x04FA;
	const DALLAS_PRODUCT_ID = 0x2490;
	const DEVICE_INFO = {
		'vendorId' : DALLAS_VENDOR_ID,
		'productId' : DALLAS_PRODUCT_ID
	};

	const permissionObj = {
		permissions : [{
				'usbDevices' : [DEVICE_INFO]
			}
		]
	};

	ow.checkPermission = function () {
		var deferred = Q.defer();
		chrome.permissions.contains(permissionObj, function (result) {
			if (result) {
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
				deferred.resolve();
			} else {
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

	ow.deviceOpen = function () {
		var deferred = Q.defer();
		chrome.usb.getDevices(DEVICE_INFO, function (devices) {
			chrome.usb.findDevices(DEVICE_INFO, function (connections) {
				if (connections && connections.length > 0) {
					deviceConnection = connections[0];
					deviceObject = devices[0];
					chrome.usb.listInterfaces(deviceConnection, function (descriptors) {
						deviceInterface = descriptors[0];
						mapEndpoints();
						claimDeviceInterface().then(deferred.resolve);
					});
				} else {
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
		bulkIn : {},
		bulkOut : {}
	};

	var mapEndpoints = function () {
		deviceInterface.endpoints.forEach(function (endpoint) {
			if (endpoint.direction === 'in' && endpoint.type === 'interrupt') {
				deviceEndpoints.interrupt = endpoint;
			} else if (endpoint.direction === 'in' && endpoint.type === 'bulk') {
				deviceEndpoints.bulkIn = endpoint;
			} else if (endpoint.direction === 'out' && endpoint.type === 'bulk') {
				deviceEndpoints.bulkOut = endpoint;
			}
		});
	};

	/*****************************************
	 *	Device Added Monitoring
	 *****************************************/

	var DeviceAddedEvent = function () {
		this.handlers = [];
	};

	DeviceAddedEvent.prototype = {
		addListener : function (fn) {
			this.handlers.push(fn);
		},
		addedListener : function (fn) {
			this.handlers = this.handlers.filter(function (item) {
					if (item !== fn) {
						return item;
					}
				});
		},
		dispatch : function (o, thisObj) {
			var scope = thisObj;
			this.handlers.forEach(function (item) {
				item.call(scope, o);
			});
		}
	}

	ow.onDeviceAdded = new DeviceAddedEvent();

	chrome.usb.onDeviceAdded.addListener(function () {
		ow.onDeviceAdded.dispatch();
	});

	/*****************************************
	 *	Device Removed Monitoring
	 *****************************************/

	var DeviceRemovedEvent = function () {
		this.handlers = [];
	};

	DeviceRemovedEvent.prototype = {
		addListener : function (fn) {
			this.handlers.push(fn);
		},
		removeListener : function (fn) {
			this.handlers = this.handlers.filter(function (item) {
					if (item !== fn) {
						return item;
					}
				});
		},
		dispatch : function (o, thisObj) {
			var scope = thisObj;
			this.handlers.forEach(function (item) {
				item.call(scope, o);
			});
		}
	}

	ow.onDeviceRemoved = new DeviceRemovedEvent();

	chrome.usb.onDeviceRemoved.addListener(function (device) {
		if (device && device.device === deviceObject.device) {
			ow.onDeviceRemoved.dispatch();
		}
	});

	/*****************************************
	 *	Device Interrupt Transfer
	 *****************************************/

	ow.deviceInterruptTransfer = function () {
		var deferred = Q.defer();

		var transferInfo = {
			direction : deviceEndpoints.interrupt.direction,
			endpoint : deviceEndpoints.interrupt.address,
			length : 0x20,
			timeout : TRANSACTION_TIMEOUT
		};

		chrome.usb.interruptTransfer(deviceConnection, transferInfo, function (result) {
			if (!result.resultCode) {
				deferred.resolve(parseStateRegisters(result.data));
			} else {
				deferred.reject(chrome.runtime.lastError);
			}
		});

		return deferred.promise;
	};

	/*****************************************
	 *	Device Control Transfer
	 *****************************************/

	ow.deviceControlTransfer = function (transferInfo) {
		var deferred = Q.defer();

		transferInfo.timeout = TRANSACTION_TIMEOUT;
		chrome.usb.controlTransfer(deviceConnection, transferInfo, function (result) {
			if (!result.resultCode) {
				deferred.resolve(result);
			} else {
				deferred.reject(chrome.runtime.lastError);
			}
		});

		return deferred.promise;
	};

	/*****************************************
	 *	Device Bulk Transfer
	 *****************************************/

	ow.deviceBulkTransfer = function (transferInfo) {
		var deferred = Q.defer();

		transferInfo.timeout = TRANSACTION_TIMEOUT;
		chrome.usb.bulkTransfer(deviceConnection, transferInfo, function (result) {
			if (!result.resultCode) {
				deferred.resolve(result);
			} else {
				deferred.reject(chrome.runtime.lastError);
			}
		});

		return deferred.promise;
	};

	/*****************************************
	 *	Device Reset
	 *****************************************/

	ow.deviceReset = function () {
		var transferInfo = {
			direction : 'out',
			recipient : 'device',
			requestType : 'vendor',
			request : 0x00,
			value : 0x0000,
			index : 0x0000,
			data : new Uint8Array(0).buffer
		};
		return ow.deviceControlTransfer(transferInfo)
		.then(ow.wireDetectShort)
		.then(function (shorted) {
			if (shorted) {
				throw new Error("Reset Failed: Short Detected");
			}
		});
	};

	/*****************************************
	 *	Parse State Registers
	 *****************************************/

	var parseStateRegisters = function (responseBuffer) {
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
			stateRegisters.ResultRegisters.DetectKey = responseArray[16] === 165;
			if (responseArray[17] && responseArray[17] !== 165) {
				stateRegisters.ResultRegisters.EOS = (responseArray[17] >> 7) & 0x01;
				stateRegisters.ResultRegisters.RDP = (responseArray[17] >> 6) & 0x01;
				stateRegisters.ResultRegisters.CRC = (responseArray[17] >> 5) & 0x01;
				stateRegisters.ResultRegisters.CMP = (responseArray[17] >> 4) & 0x01;
				stateRegisters.ResultRegisters.APP = (responseArray[17] >> 2) & 0x01;
				stateRegisters.ResultRegisters.SH = (responseArray[17] >> 1) & 0x01;
				stateRegisters.ResultRegisters.NRS = responseArray[17] & 0x01;
			}
			stateRegisters.ResultRegisters.Data = responseArray.slice(16, responseArray.length);
		}

		return stateRegisters;
	};

	/*****************************************
	 *	1-Wire Get Status
	 *****************************************/

	ow.deviceGetStatus = function () {
		var transferInfo = {
			direction : deviceEndpoints.interrupt.direction,
			endpoint : deviceEndpoints.interrupt.address,
			length : 0x20
		};
		return ow.deviceBulkTransfer(transferInfo).then(function (result) {
			return parseStateRegisters(result.data);
		});
	};

	/*****************************************
	 *	1-Wire Detect Short
	 *****************************************/

	ow.wireDetectShort = function () {
		return ow.deviceGetStatus().then(function (status) {
			if (status.CommCommandBufferStatus !== 0) {
				return true;
			}

			if (
				status.ResultRegisters &&
				!status.ResultRegisters.DetectKey &&
				status.ResultRegisters.Data[0] & 0x01 === 1) {
				return true;
			}

			return false;
		});
	};

	/*****************************************
	 *	1-Wire Set Speed
	 *****************************************/

	ow.wireSetSpeed = function (overdrive) {
		var index = (overdrive) ? 0x0002 : 0x0001;
		var transferInfo = {
			direction : 'out',
			recipient : 'device',
			requestType : 'vendor',
			request : 0x02,
			value : 0x0002,
			index : index,
			data : new Uint8Array(0).buffer
		};
		return ow.deviceControlTransfer(transferInfo);
	};

	/*****************************************
	 *	1-Wire Reset
	 *****************************************/

	ow.wireReset = function () {
		var transferInfo = {
			direction : 'out',
			recipient : 'device',
			requestType : 'vendor',
			request : 0x01,
			value : 0x0C4B,
			index : 0x0001,
			data : new Uint8Array(0).buffer
		};

		return ow.deviceControlTransfer(transferInfo)
		.then(function () {
			var deferred = Q.defer();
			setTimeout(function () {
				ow.wireDetectShort().then(function (shorted) {
					if (shorted) {
						deferred.reject();
					} else {
						deferred.resolve();
					}
				});
			}, 5);
			return deferred.promise;
		}).fail(function () {
			return ow.deviceReset();
		}).fail(function () {
			throw new Error("Reset Failed: Unrecoverable short detected");
		});
	};

	/*****************************************
	 *	1-Wire Write
	 *****************************************/

	ow.wireWrite = function (data) {
		var bulkTransferInfo = {
			direction : deviceEndpoints.bulkOut.direction,
			endpoint : deviceEndpoints.bulkOut.address,
			data : new Uint8Array(data).buffer
		};

		var controlTransferInfo = {
			direction : 'out',
			recipient : 'device',
			requestType : 'vendor',
			request : 0x01,
			value : 0x1075,
			index : data.length,
			data : new Uint8Array(0).buffer,
			timeout : TRANSACTION_TIMEOUT
		};

		return ow.deviceBulkTransfer(bulkTransferInfo)
		.then(function () {
			return ow.deviceControlTransfer(controlTransferInfo);
		});
	};

	/*****************************************
	 *	1-Wire Write Bit
	 *****************************************/

	ow.wireWriteBit = function (bit) {
		var transferInfo = {
			direction : 'out',
			recipient : 'device',
			requestType : 'vendor',
			request : 0x01,
			value : 0x221 | (bit << 3),
			index : 0x00,
			data : new Uint8Array(0).buffer
		};

		return ow.deviceControlTransfer(transferInfo);
	};

	/*****************************************
	 *	1-Wire Read
	 *****************************************/

	ow.wireRead = function (byteCount) {
		var transferInfo = {
			direction : deviceEndpoints.bulkIn.direction,
			endpoint : deviceEndpoints.bulkIn.address,
			length : byteCount
		};

		return ow.deviceBulkTransfer(transferInfo)
		.then(function (result) {
			return new Uint8Array(result.data);
		});
	};

	/*****************************************
	 *	1-Wire Read Bit
	 *****************************************/

	ow.wireReadBit = function () {
		var transferInfo = {
			direction : 'out',
			recipient : 'device',
			requestType : 'vendor',
			request : 0x01,
			value : 0x29,
			index : 0x00,
			data : new Uint8Array(0).buffer
		};

		return ow.deviceControlTransfer(transferInfo)
		.then(function (result) {
			return ow.wireRead(1);
		})
		.then(function (data) {
			return data[0];
		});
	};

	/*****************************************
	 *	1-Wire Clear Byte
	 *****************************************/

	ow.wireClearByte = function () {
		return ow.wireRead(1);
	};

	/*****************************************
	 *	Key ROM Command
	 *****************************************/

	ow.keyRomCommand = function (match, keyRom, overdrive) {
		var index;
		var overdrive = (overdrive || false);
		var bulkTransferInfo = {
			direction : deviceEndpoints.bulkOut.direction,
			endpoint : deviceEndpoints.bulkOut.address,
			data : new Uint8Array(8).buffer
		};

		if (match) {
			bulkTransferInfo.data = new Uint8Array(keyRom).buffer;
			if (overdrive) {
				index = 0x0069;
			} else {
				index = 0x0055;
			}
		} else {
			if (overdrive) {
				index = 0x003C;
			} else {
				index = 0x00CC;
			}
		}

		var controlTransferInfo = {
			direction : 'out',
			recipient : 'device',
			requestType : 'vendor',
			request : 0x01,
			value : 0x0065,
			index : index,
			data : new Uint8Array(0).buffer
		};

		return ow.deviceControlTransfer(controlTransferInfo)
		.then(function () {
			OverdriveEnabled = overdrive;
			return ow.wireSetSpeed(overdrive);
		}).then(function () {
			return ow.deviceBulkTransfer(bulkTransferInfo)
		});
	};

	/*****************************************
	 *	Key ROM Match
	 *****************************************/

	ow.keyRomMatch = function (keyRom) {
		return ow.keyRomCommand(true, keyRom, false);
	};

	ow.keyRomMatchOverdrive = function (keyRom) {
		return ow.keyRomCommand(true, keyRom, true);
	};

	/*****************************************
	 *	Key ROM Skip
	 *****************************************/

	ow.keyRomSkip = function () {
		return ow.keyRomCommand(false, null, false);
	};

	ow.keyRomSkipOverdrive = function () {
		return ow.keyRomCommand(false, null, true);
	};

	/*****************************************
	 *	Key Search
	 *****************************************/

	var lastSearchParameters = {
		lastDiscrepancy : 0,
		lastDevice : false,
		keys : []
	};

	var keySearch = function (parameters) {
		var deferred = Q.defer();

		romSearch(parameters).then(function (results) {
			lastSearchParameters = results;
			if (results.keys && results.keys[0]) {
				var key = results.keys[0];
				key.toHexString = function () {
					return keyRomToHexString(this);
				};
				deferred.resolve(key);
			} else {
				deferred.reject();
			}
		});
		return deferred.promise;
	};

	ow.keySearchFirst = function () {
		var parameters = {
			lastDiscrepancy : 0,
			lastDevice : false,
			keys : []
		};

		return keySearch(parameters);
	};

	ow.keySearchNext = function (parameters) {
		return keySearch(lastSearchParameters);
	};

	var romSearch = function (parameters) {
		var searchObject = {
			idBitNumber : 1,
			lastZero : 0,
			romByteNumber : 0,
			romByteMask : 1,
			searchResult : false,
			idBit : 0,
			cmpIdBit : 0,
			searchDirection : 0,
			romId : new Uint8Array(8),
			lastDevice : false,
			lastDiscrepancy : parameters.lastDiscrepancy
		};

		return ow.wireSetSpeed(false)
		.then(ow.wireReset)
		.then(function () {
			return ow.wireWrite(new Uint8Array([0xF0]));
		}).then(ow.wireClearByte)
		.then(function () {
			return romSubSearch(searchObject);
		}).then(function (searchResultObject) {
			if (searchResultObject.searchResult) {
				parameters.keys.push(searchResultObject.romId)
			}
			parameters.lastDiscrepancy = searchResultObject.searchResultObject;
			parameters.lastDevice = searchResultObject.lastDevice;
			return parameters;
		});
	};

	var romSubSearch = function (searchObject) {
		return ow.wireReadBit()
		.then(function (idBit) {
			searchObject.idBit = idBit;
		})
		.then(function () {
			return ow.wireReadBit();
		})
		.then(function (cmpIdBit) {
			searchObject.cmpIdBit = cmpIdBit;
			if (searchObject.idBit !== 1 || searchObject.cmpIdBit !== 1) {
				if (searchObject.idBit != searchObject.cmpIdBit) {
					searchObject.searchDirection = searchObject.idBit;
				} else {
					if (searchObject.idBitNumber < searchObject.lastDiscrepancy) {
						searchObject.searchDirection = ((searchObject.romId[searchObject.romByteNumber] & searchObject.romByteMask) > 0) ? 1 : 0;
					} else {
						searchObject.searchDirection = (searchObject.idBitNumber == searchObject.lastDiscrepancy) ? 1 : 0;
					}
					if (searchObject.searchDirection === 0) {
						searchObject.lastZero = searchObject.idBitNumber;
					}
				}
				if (searchObject.searchDirection === 1) {
					searchObject.romId[searchObject.romByteNumber] |= searchObject.romByteMask;
				} else {
					searchObject.romId[searchObject.romByteNumber] &= ~searchObject.romByteMask;
				}
				return ow.wireWriteBit(searchObject.searchDirection)
				.then(function () {
					searchObject.idBitNumber++;
					searchObject.romByteMask <<= 1;
					if (searchObject.romByteMask >= 256) {
						searchObject.romByteNumber++;
						searchObject.romByteMask = 1;
					}
					if (searchObject.romByteNumber < 8) {
						return romSubSearch(searchObject);
					} else {
						if (searchObject.idBitNumber >= 65 && crc8(searchObject.romId) === 0) {
							searchObject.lastDiscrepancy = searchObject.lastZero;
							if (searchObject.lastDiscrepancy === 0) {
								searchObject.lastDevice = true;
							}
							searchObject.searchResult = true;
						}
						if (searchObject.searchResult === false || searchObject.romId[0] === 0) {
							searchObject.lastDiscrepancy = 0;
							searchObject.lastDevice = false;
							searchObject.searchResult = false;
						}
						return searchObject;
					}
				});
			} else {
				return searchObject;
			}
		});
	};

	/*****************************************
	 *	Key Read All Data
	 *****************************************/

	ow.keyReadAll = function (keyRom, overdrive) {
		return ow.wireSetSpeed(false)
		.then(ow.wireReset)
		.then(function () {
			if (overdrive) {
				return ow.keyRomMatchOverdrive(keyRom);
			} else {
				return ow.keyRomMatch(keyRom);
			}
		})
		.then(function () {
			var command = new Uint8Array([0xF0, 0x00, 0x00]);
			return ow.wireWrite(command);
		}).then(ow.wireClearByte)
		.then(ow.wireClearByte)
		.then(ow.wireClearByte)
		.then(function () {
			return keyReadMemory();
		});
	};

	var keyReadMemory = function (memory, pageIndex) {
		var pageIndex = (pageIndex || 0);
		var memory = (memory || new Array(256));
		memory[pageIndex] = new Uint8Array(32);
		var buffer = new Uint8Array(32);
		for (var x = 0; x < buffer.length; x++) {
			buffer[x] = 0xFF;
		}
		return ow.wireWrite(buffer)
		.then(function () {
			return keyReadPage(memory[pageIndex]);
		}).then(function () {
			if (pageIndex < memory.length - 1) {
				return keyReadMemory(memory, pageIndex + 1);
			}
			return memory;
		});
	}

	var keyReadPage = function (page, index) {
		var index = (index || 0);
		return ow.wireRead(16)
		.then(function (result) {
			result.forEach(function (entry) {
				page[index++] = entry;
			});
			if (index < page.length) {
				return keyReadPage(page, index);
			}
		});
	};

	/*****************************************
	 *	Key Write
	 *****************************************/

	ow.keyWrite = function (keyRom, offset, data, overdrive) {
		var offset = (offset || 0);
		var offsetMSB = (offset & 0xFF);
		var offsetLSB = (offset & 0xFF00) >> 8;
		var endingOffset = data.length - 1;
		var data = (data || new Uint8Array(0));

		return ow.wireSetSpeed(false)
		.then(function () {
			return writeToScratch(keyRom, offset, data, overdrive);
		})
		.then(ow.wireReset)
		.then(function () {
			if (overdrive) {
				return ow.keyRomMatchOverdrive(keyRom);
			} else {
				return ow.keyRomMatch(keyRom);
			}
		})
		.then(function () {
			var command = new Uint8Array([0x55, offsetMSB, offsetLSB, endingOffset]);
			return ow.wireWrite(command);
		}).then(ow.wireClearByte)
		.then(ow.wireClearByte)
		.then(ow.wireClearByte)
		.then(ow.wireClearByte)
	};

	var writeToScratch = function (keyRom, offset, data, overdrive) {
		var offset = (offset || 0);
		var offsetMSB = (offset & 0xFF);
		var offsetLSB = (offset & 0xFF00) >> 8;
		var endingOffset = data.length - 1;
		var data = (data || new Uint8Array(0));

		var returnedData;

		return ow.wireReset()
		.then(function () {
			if (overdrive) {
				return ow.keyRomMatchOverdrive(keyRom);
			} else {
				return ow.keyRomMatch(keyRom);
			}
		})
		.then(function () {
			var command = new Uint8Array([0x0F, offsetMSB, offsetLSB]);
			return ow.wireWrite(command);
		}).then(ow.wireClearByte)
		.then(ow.wireClearByte)
		.then(ow.wireClearByte)
		.then(function () {
			return writeData(data, 0);
		}).then(ow.wireReset)
		.then(function () {
			if (overdrive) {
				return ow.keyRomMatchOverdrive(keyRom);
			} else {
				return ow.keyRomMatch(keyRom);
			}
		})
		.then(function () {
			var command = new Uint8Array([0xAA]);
			return ow.wireWrite(command);
		})
		.then(function () {
			return ow.wireRead(data.length)
		}).then(function (data) {
			returnedData = data;
		})
		.then(ow.wireClearByte)
		.then(function () {
			if ((returnedData.length == data.length) && returnedData.every(function (element, index) {
					return element === data[index];
				})) {
				return;
			}
			return writeToScratch(keyRom, offset, data, overdrive);
		});
	};

	var writeData = function (data, offset) {
		var size = (data.length - offset > 16) ? 16 : data.length - offset;
		var sendData = new Uint8Array(size);
		for (var x = 0; x < size; x++) {
			sendData[x] = data[offset + x];
		}
		return ow.wireWrite(sendData).then(function () {
			if ((data.length - (offset + size)) > 0) {
				return writeData(data, offset + size);
			}
		});
	};

	/*****************************************
	 *	Key Write All Data
	 *****************************************/

	ow.keyWriteAll = function (keyRom, data, overdrive) {
		return keyWriteAllOffset(keyRom, data, 0, overdrive);
	};

	var keyWriteAllOffset = function (keyRom, data, page, overdrive) {
		var offset = page * 32;
		return ow.keyWrite(keyRom, offset, data[page], overdrive).then(function () {
			if (data.length > page + 1) {
				return keyWriteAllOffset(keyRom, data, page + 1, overdrive)
			}
		});
	};

	/*****************************************
	 *	Key Write Diff Data
	 *****************************************/

	ow.keyWriteDiff = function (keyRom, newData, oldData, overdrive) {
		if ((oldData || new Array(0)).length < newData.length) {
			return ow.keyReadAll(keyRom, overdrive).then(function (resultData) {
				return keyWriteDiffOffset(keyRom, newData, resultData, 0, overdrive);
			});
		}
		return keyWriteDiffOffset(keyRom, newData, oldData, 0, overdrive);
	};

	var keyWriteDiffOffset = function (keyRom, newData, oldData, page, overdrive) {
		var offset = page * 32;
		if ((newData[page].length === oldData[page].length) && newData[page].every(function (element, index) {
				return element === oldData[page][index];
			})) {
			if (newData.length > page + 1) {
				return keyWriteDiffOffset(keyRom, newData, oldData, page + 1, overdrive)
			}
		}
		return ow.keyWrite(keyRom, offset, newData[page], overdrive).then(function () {
			if (newData.length > page + 1) {
				return keyWriteDiffOffset(keyRom, newData, oldData, page + 1, overdrive)
			}
		});
	};

	/*****************************************
	 *	Key ROM Bytes to Hex String
	 *****************************************/
	var keyRomToHexString = function (key) {
		const hexChar = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
		var string = '';
		var clonedKey = Array.prototype.slice.call(key);
		clonedKey.reverse().map(function (dataByte) {
			string += hexChar[(dataByte >> 4) & 0x0F] + hexChar[dataByte & 0x0F];
		});
		return string;
	};

	return ow;
}();
