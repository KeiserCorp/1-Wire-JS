var DALLAS_VENDOR_ID = 1274; //0x04FA;
var DALLAS_PRODUCT_ID = 9360; //0x2490;
var DEVICE_INFO = {
	"vendorId" : DALLAS_VENDOR_ID,
	"productId" : DALLAS_PRODUCT_ID
};

var deviceConnection;
var deviceInterface;
var targetRomID;

var awaitDevices = function () {
	// Loop every 1s until a valid device is detected
	var deviceTimeout = function () {
		awaitDevices();
	};
	setTimeout(function () {
		openDevices(null, deviceTimeout);
	}, 1000);
};

function isFunction(functionToCheck) {
	var getType = {};
	return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

function runIfFunction(functionToCheck) {
	if (isFunction(functionToCheck)) {
		functionToCheck();
	}
}

function romIdToString(bytes) {
	var hexChar = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
	var string = "";
	bytes.reverse().map(function (byte) {
		string += hexChar[(byte >> 4) & 0x0f] + hexChar[byte & 0x0f];
	});
	return string;
}

var openDevices = function (success, failure) {
	chrome.usb.findDevices(DEVICE_INFO,
		function (deviceConnections) {
		if (!deviceConnections || !deviceConnections.length) {
			// Fail - Devices not found
			document.querySelector('#device').innerText = 'Device: Not Found';
			//console.log('device not found');
			runIfFunction(failure);
			return;
		}
		// Success - Devices Found
		document.querySelector('#device').innerText = 'Device: Found';
		//console.log('Found device: ' + deviceConnections[0].handle);
		deviceConnection = deviceConnections[0];
		chrome.usb.listInterfaces(deviceConnection, function (descriptors) {
			deviceInterface = descriptors[0];
			//console.log(deviceInterface);
			initializeInterface();
			runIfFunction(success);
		});
	});
};

var initializeInterface = function () {
	// Claim the interface using default configuration and then wait for key
	chrome.usb.claimInterface(deviceConnection, deviceInterface.interfaceNumber, awaitKey);
};

var awaitKey = function () {
	// Wait for key to be connected
	interruptLoop();
};

var interruptLoop = function () {
	var interruptTimeout = function (result) {
		if (result.ResultRegisters && result.ResultRegisters.DetectDevice) {
			// Success - Device detected
			initializeCommunication(readChipData);
		} else {
			// Fail - No device found
			interruptLoop();
		}
	};
	// Loop every 100ms until a key is detected
	setTimeout(function () {
		oneWireInterrupt(interruptTimeout);
	}, 100);
};

var initializeCommunication = function (success, failure) {
	//console.log("Initializing Communication");
	oneWireSearch(
		function (result) {
		document.querySelector('#key').innerText = 'Key: Connected - ' + romIdToString(targetRomID);
		runIfFunction(success);
	},
		function (result) {
		console.log("Failure: " + result);
		runIfFunction(failure);
	});
};

var readChipData = function (success, failure) {
	oneWireReset(function () {
		oneWireMatchRom(function () {
			var start = performance.now();
			var memory = new Array(256);
			console.log("Starting Chip Read");
			readPage(memory, 0, function () {
				var finish = performance.now();
				console.log("Finished: " + (finish - start));
				console.log(memory);
			});
		});
	});
};

var readPage = function (memory, pageIndex, success) {
	memory[pageIndex] = new Uint8Array(32);
	var command = new Uint8Array(35);
	for (var x = 0; x < command.length; x++) {
		command[x] = 0xff;
	}
	command[0] = 0xf0;
	command[1] = (pageIndex * 32);
	command[2] = (pageIndex * 32) >> 8;

	oneWireWrite(command, function () {
		readPageByteLoop(memory[pageIndex], 0, 3, function () {
			readPageLoop(memory, pageIndex + 1, success);
		});
	});
};

var readPageLoop = function (memory, pageIndex, success) {
	setTimeout(function () {
		memory[pageIndex] = new Uint8Array(32);
		var command = new Uint8Array(32);
		for (var x = 0; x < command.length; x++) {
			command[x] = 0xff;
		}
		oneWireWrite(command, function () {
			readPageByteLoop(memory[pageIndex], 0, 0, function () {
				if (pageIndex < memory.length - 1) {
					readPageLoop(memory, pageIndex + 1, success);
				} else {
					runIfFunction(success);
				}
			});
		});
	}, (pageIndex % 10 === 0) ? 10 : 0);
};

var readPageByteLoop = function (page, index, skip, success) {
	oneWireRead(1, function (result) {
		if (skip <= index) {
			page[index - skip] = result[0];
		}
		if (index - skip < page.length - 1) {
			readPageByteLoop(page, index + 1, skip, success);
		} else {
			runIfFunction(success);
		}
	});
};

var oneWireInterrupt = function (success, failure) {
	// Perform an Interrupt
	//console.log("Performing Interrupt");
	var interruptEndpoint = deviceInterface.endpoints[0];
	var stateRegisters;
	var transferInfo = {
		direction : interruptEndpoint.direction,
		endpoint : interruptEndpoint.address,
		length : interruptEndpoint.maximumPacketSize,
		timeout : interruptEndpoint.pollingInterval
	};
	chrome.usb.interruptTransfer(deviceConnection, transferInfo, function (result) {
		if (result.resultCode) {
			// Fail - Interrupt Failed
			console.log('Interrupt Error: ' + result.error);
			runIfFunction(failure);
		} else {
			// Success - Interrupt Successful
			stateRegisters = parseInterruptResponse(result.data);
			if (stateRegisters.ResultRegisters && stateRegisters.ResultRegisters.DetectDevice) {
				document.querySelector('#key').innerText = 'Key: Connected';
				//console.log('Key Connected');
				//console.log(stateRegisters);
			} else {
				document.querySelector('#key').innerText = 'Key: Disconnected';
			}
			if (isFunction(success)) {
				success(stateRegisters);
			}
		}
	});
};

var parseInterruptResponse = function (responseBuffer) {
	// Parse Interrupt Data in Mfg. Data Attributes
	responseArray = new Uint8Array(responseBuffer);
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
		//stateRegisters.ResultRegisters.Data = responseArray.slice(16, responseArray.length);
		stateRegisters.ResultRegisters.DetectDevice = responseArray[16] == 165;
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

var oneWireReset = function (success, failure) {
	// Perform 1-Wire Reset
	//console.log("Performing Reset");
	var transferInfo = {
		direction : 'out',
		recipient : 'device',
		requestType : 'vendor',
		request : 0x01,
		value : 0x0C4B,
		index : 0x0001,
		data : new Uint8Array(0).buffer,
		timeout : 0
	};
	chrome.usb.controlTransfer(deviceConnection, transferInfo, function (result) {
		if (result.resultCode) {
			// Fail - Reset Failed
			console.log('Reset Error: ' + result.error);
			runIfFunction(failure);
		} else {
			// Success - Reset Successful
			runIfFunction(success);
		}
	});
};

var oneWireMatchRom = function (success, failure) {
	// Perform 1-Wire Rom Match
	//console.log("Performing Rom Match");
	var bulkOutEndpoint = deviceInterface.endpoints[1];
	var transferInfo = {
		direction : bulkOutEndpoint.direction,
		endpoint : bulkOutEndpoint.address,
		data : new Uint8Array(targetRomID.reverse()).buffer
	};
	chrome.usb.bulkTransfer(deviceConnection, transferInfo, function () {
		var transferInfo = {
			direction : 'out',
			recipient : 'device',
			requestType : 'vendor',
			request : 0x01,
			value : 0x0065,
			index : 0x0055,
			data : new Uint8Array(0).buffer,
			timeout : 0
		};
		chrome.usb.controlTransfer(deviceConnection, transferInfo, function (result) {
			if (result.resultCode) {
				// Fail - Match Rom Failed
				console.log('Match Rom Error: ' + result.error);
				runIfFunction(failure);
			} else {
				// Success - Match Rom Successful
				runIfFunction(success);
			}
		});
	});
};

var oneWireWrite = function (data, success, failure) {
	// Perform 1-Wire Write
	//console.log("Performing Write");
	var bulkOutEndpoint = deviceInterface.endpoints[1];
	var transferInfo = {
		direction : bulkOutEndpoint.direction,
		endpoint : bulkOutEndpoint.address,
		data : new Uint8Array(data).buffer
	};
	chrome.usb.bulkTransfer(deviceConnection, transferInfo, function (result) {
		if (result && result.resultCode === 0) {
			// Success - Write was successful
			var transferInfo = {
				direction : 'out',
				recipient : 'device',
				requestType : 'vendor',
				request : 0x01,
				value : 0x1075,
				index : data.length,
				data : new Uint8Array(0).buffer,
				timeout : 0
			};
			chrome.usb.controlTransfer(deviceConnection, transferInfo, function (result) {
				if (result.resultCode) {
					// Fail - Write Failed
					console.log('Write Error: ' + result.error);
					runIfFunction(failure);
				} else {
					// Success - Write Successful
					runIfFunction(success);
				}
			});
		} else {
			// Fail - Write failed with error
			console.log("Write Error: " + result.error);
			runIfFunction(failure);
		}
	});
};

var oneWireWriteBit = function (bit, success, failure) {
	// Perform 1-Wire Write Bit
	//console.log("Performing Write Bit");
	var transferInfo = {
		direction : 'out',
		recipient : 'device',
		requestType : 'vendor',
		request : 0x01,
		value : 0x221 | (bit << 3),
		index : 0x00,
		data : new Uint8Array(0).buffer,
		timeout : 0
	};
	chrome.usb.controlTransfer(deviceConnection, transferInfo, function (result) {
		if (result.resultCode) {
			// Fail - Write Bit Failed
			console.log('Write Bit Error: ' + result.error);
			runIfFunction(failure);
		} else {
			// Success - Write Bit Successful
			runIfFunction(success);
		}
	});
};

var oneWireRead = function (byteCount, success, failure) {
	// Perform 1-Wire Read
	//console.log("Performing Read");
	var bulkInEndpoint = deviceInterface.endpoints[2];
	var transferInfo = {
		direction : bulkInEndpoint.direction,
		endpoint : bulkInEndpoint.address,
		length : byteCount
	};
	chrome.usb.bulkTransfer(deviceConnection, transferInfo, function (result) {
		if (result.resultCode) {
			// Fail - Read Failed
			console.log('Read Error: ' + result.error);
			runIfFunction(failure);
		} else {
			// Success - Read Successful
			if (isFunction(success)) {
				success(new Uint8Array(result.data));
			}
		}
	});
};

var oneWireReadBit = function (success, failure) {
	// Perform 1-Wire Read Bit
	//console.log("Performing Read Bit");
	var transferInfo = {
		direction : 'out',
		recipient : 'device',
		requestType : 'vendor',
		request : 0x01,
		value : 0x29,
		index : 0x00,
		data : new Uint8Array(0).buffer,
		timeout : 0
	};
	chrome.usb.controlTransfer(deviceConnection, transferInfo, function (result) {
		if (result.resultCode) {
			// Fail - Read Bit Failed
			console.log('Read Bit Error: ' + result.error);
			runIfFunction(failure);
		} else {
			// Success - Write Successful
			oneWireRead(1, function (result) {
				success(result[0]);
			}, function (result) {
				// Fail - Read Bit Failed
				console.log('Read Bit Error: ' + result.error);
				runIfFunction(failure);
			});
		}
	});
};

var LastDescrepancy, LastDeviceFlag = false;

var searchRomLoop = function (searchObject, callback) {
	// Read a bit and its complement
	oneWireReadBit(function (result) {
		searchObject.IdBit = result;
		oneWireReadBit(function (result) {
			searchObject.CmpIdBit = result;
			// Check for no devices on 1-Wire
			if (searchObject.IdBit !== 1 || searchObject.CmpIdBit !== 1) {
				// All devices coupled have 0 or 1
				if (searchObject.IdBit != searchObject.CmpIdBit) {
					// Bit write value for search
					searchObject.SearchDirection = searchObject.IdBit;
				} else {
					// If this discrepancy is before the Last Discrepancy
					// on a previous next then pick the same as last time
					if (searchObject.IdBitNumber < searchObject.LastDiscrepancy) {
						searchObject.SearchDirection = ((searchObject.RomID[searchObject.RomByteNumber] & searchObject.RomByteMask) > 0) ? 1 : 0;
					} else {
						// If equal to last pick 1, if not then pick 0
						searchObject.SearchDirection = (searchObject.IdBitNumber == searchObject.LastDiscrepancy) ? 1 : 0;
					}

					// If 0 was picked then record its position in LastZero
					if (searchObject.SearchDirection === 0) {
						searchObject.LastZero = searchObject.IdBitNumber;
					}

				}

				// Set or clear the bit in the ROM byte rom_byte_number
				// with mask rom_byte_mask
				if (searchObject.SearchDirection == 1) {
					searchObject.RomID[searchObject.RomByteNumber] |= searchObject.RomByteMask;
				} else {
					searchObject.RomID[searchObject.RomByteNumber] &= ~searchObject.RomByteMask;
				}

				// Serial number search direction write bit
				oneWireWriteBit(searchObject.SearchDirection, function (result) {
					// Increment the byte counter id_bit_number
					// and shift the mask rom_byte_mask
					searchObject.IdBitNumber++;
					searchObject.RomByteMask <<= 1;

					// If the mask is 0 then go to new SerialNum byte rom_byte_number and reset mask
					if (searchObject.RomByteMask >= 256) {
						searchObject.RomByteNumber++;
						searchObject.RomByteMask = 1;
					}

					if (searchObject.RomByteNumber < 8) {
						searchRomLoop(searchObject, callback);
					} else {
						// If the search was successful then
						if (searchObject.IdBitNumber >= 65) {
							// Search successful so set LastDiscrepancy,LastDeviceFlag,search_result
							LastDiscrepancy = searchObject.LastZero;

							// Check for last device
							if (LastDiscrepancy === 0) {
								LastDeviceFlag = true;
							}

							searchObject.SearchResult = true;
						}

						if (searchObject.SearchResult === false || searchObject.RomID[0] === 0) {
							LastDiscrepancy = 0;
							LastDeviceFlag = false;
							searchObject.SearchResult = false;
						}

						var returnObject = {
							RomFound : searchObject.SearchResult,
							RomID : searchObject.RomID
						};
						callback(returnObject);
					}
				});
			}
		});
	});
};

var oneWireSearch = function (success, failure) {
	// Perform 1-Wire Search
	var searchObject = {
		IdBitNumber : 1,
		LastZero : 0,
		RomByteNumber : 0,
		RomByteMask : 1,
		SearchResult : false,
		IdBit : 0,
		CmpIdBit : 0,
		SearchDirection : 0,
		RomID : new Uint8Array(8)
	};

	// Starting Search Algorithm
	if (!LastDeviceFlag) { // If the last call was not the last one
		oneWireReset(function (result) {
			oneWireWrite(new Uint8Array([0xF0]), function (result) {
				oneWireRead(1, function (result) {
					searchRomLoop(searchObject, function (result) {
						if (result.RomFound) {
							targetRomID = result.RomID;
							runIfFunction(success);
						} else {
							runIfFunction(failure);
						}
					});
				});
			});
		});
	}
};
