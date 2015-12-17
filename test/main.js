'use strict';
var ow = require('../ow.js');

var requestButton = document.getElementById('requestPermission');
var permissionElement = document.getElementById('permission');
var deviceElement = document.getElementById('device');
var keyElement = document.getElementById('key');
var romElement = document.getElementById('rom');

var memorySection = document.getElementById('memorySection');
var memoryElement = document.getElementById('memoryDisplay');
var readMemoryButton = document.getElementById('readMemory');
var writeMemoryButton = document.getElementById('writeMemory');
var writeRandomMemoryButton = document.getElementById('writeRandomMemory');
var clearMemoryButton = document.getElementById('clearMemory');

var clearMemorySection = function () {
	memorySection.style.display = 'none';
	memoryElement.value = '';
	readMemoryButton.disabled = false;
	writeMemoryButton.disabled = false;
	writeRandomMemoryButton.disabled = false;
	clearMemoryButton.disabled = false;
	masterMemory = new Array(0);
};

var masterRom;
var masterMemory = new Array(0);

window.onload = function () {
	ow.checkPermission().then(gotPermission);
	requestButton.addEventListener('click', function () {
		ow.requestPermission().then(gotPermission, failedPermission);
	});

	ow.onDeviceAdded.addListener(deviceConnected);
	ow.onDeviceRemoved.addListener(deviceRemoved)

	readMemoryButton.addEventListener('click', function () {
		readMemoryButton.disabled = true;
		memoryElement.value = '';
		keyMonitor.add(function () {
			return getKeyMemory(masterRom);
		});
	});

	writeMemoryButton.addEventListener('click', function () {
		writeMemoryButton.disabled = true;
		keyMonitor.add(function () {
			return pushDiffKeyMemory(masterRom);
		});
	});

	writeRandomMemoryButton.addEventListener('click', function () {
		writeRandomMemoryButton.disabled = true;
		memoryElement.value = '';
		keyMonitor.add(function () {
			return pushRandomKeyMemory(masterRom);
		});
	});

	clearMemoryButton.addEventListener('click', function () {
		clearMemoryButton.disabled = true;
		memoryElement.value = '';
		keyMonitor.add(function () {
			return clearKeyMemory(masterRom);
		});
	});
};

var gotPermission = function () {
	requestButton.style.display = 'none';
	permissionElement.innerText = 'Permission: Granted';
	console.log('App was granted the \'usbDevices\' permission.');
	awaitDevice();
};

var failedPermission = function () {
	permissionElement.innerText = 'Permission: Failed';
	console.log('App was not granted the \'usbDevices\' permission.');
	console.log(chrome.runtime.lastError);
};

var awaitDevice = function () {
	deviceRemoved();
	ow.deviceOpen().then(deviceOpened);
};

var deviceConnected = function (device) {
	ow.deviceOpen().then(deviceOpened);
};

var deviceRemoved = function () {
	deviceElement.innerText = 'Device: Not Found';
	keyElement.innerText = 'Key:';
	romElement.innerText = 'ID:';
	clearMemorySection();
};

var deviceOpened = function () {
	deviceElement.innerText = 'Device: Found';
	keyElement.innerText = 'Key: Disconnected';
	ow.deviceReset().then(getKeyRom);
};

var getKeyRom = function () {
	return ow.keySearchFirst()
	.then(function (rom) {
		if (rom[0] === 0x0C) {
			keyElement.innerText = 'Key: Connected';
			romElement.innerText = 'ID: ' + rom.toHexString();
			memorySection.style.display = 'block';
			masterRom = rom;
			monitorKey();
		} else {
			awaitKey();
		}
	}, awaitKey);
};

var awaitKey = function () {
	var interruptTimeout = function (result) {
		if (result.ResultRegisters && result.ResultRegisters.DetectKey) {
			keyElement.innerText = 'Key: Detected';
			getKeyRom()
			.fail(function () {
				awaitKey();
			});
		} else {
			keyElement.innerText = 'Key: Disconnected';
			romElement.innerText = 'ID:';
			clearMemorySection();
			awaitKey();
		}
	};
	setTimeout(function () {
		ow.deviceInterruptTransfer()
		.then(interruptTimeout)
		.fail(function () {
			awaitKey();
		});
	}, 500);
};

var KeyMonitorController = function () {
	this.commands = [];
};

KeyMonitorController.prototype = {
	add : function (fn) {
		this.commands.push(fn);
	},
	runNext : function (nextCommand) {
		var fn = this.commands.shift();
		if (fn) {
			return fn.call().then(nextCommand);
		}
		return nextCommand.call();
	}
}

var keyMonitor = new KeyMonitorController();

var monitorKey = function () {
	setTimeout(function () {
		ow.keySearchFirst().then(function (rom) {
			if (rom.toHexString() === masterRom.toHexString()) {
				keyMonitor.runNext(monitorKey);
			} else {
				awaitKey();
			}
		}, awaitKey);
	}, 500);
};

var getKeyMemory = function (keyRom, retry) {
	console.log('Beginning Memory Read');
	var start = performance.now();
	return ow.keyReadAll(keyRom, !retry)
	.then(function (data) {
		var finish = performance.now();
		console.log('Overdrive Memory Read: ' + ((finish - start) / 1000).toFixed(2) + 's');
		masterMemory = data;
		updateKeyMemoryDisplay(data);
		readMemoryButton.disabled = false;
	}).fail(function (error) {
		if (retry) {
			console.log('Memory Read Error: ' + error.message + ' [Cancelled]');
		} else {
			console.log('Memory Read Error: ' + error.message + ' [Retrying]');
			return ow.deviceReset()
			.then(function () {
				return getKeyMemory(keyRom, true);
			});
		}
	});
};

var updateKeyMemoryDisplay = function (data) {
	var display = '';
	data.forEach(function (row) {
		row.forEach(function (column) {
			display += ('00' + column.toString(16)).substr(-2).toUpperCase() + ' ';
		});
		display += '\n';
	});
	memoryElement.value = display;
};

var pushDiffKeyMemory = function (keyRom, retry) {
	console.log('Beginning Memory Write');
	var rows = memoryElement.value.split('\n');
	var data = new Array(256);
	for (var x = 0; x < data.length; x++) {
		data[x] = new Uint8Array(32);
		for (var y = 0; y < data[x].length; y++) {
			data[x][y] = 0x55;
		}
		if ((rows[x] || new Array(0)).length > 0) {
			var tuples = rows[x].split(' ');
			for (var y = 0; y < tuples.length; y++) {
				data[x][y] = parseInt('0x' + tuples[y]);
			}
		}
	}
	var start = performance.now();
	return ow.keyWriteDiff(keyRom, data, masterMemory, true).then(function () {
		var finish = performance.now();
		console.log('Overdrive Memory Write: ' + ((finish - start) / 1000).toFixed(2) + 's');
		writeMemoryButton.disabled = false;
	});
};

var pushRandomKeyMemory = function (keyRom, retry) {
	console.log('Beginning Memory Write');
	var data = new Array(256);
	for (var x = 0; x < data.length; x++) {
		data[x] = new Uint8Array(32);
		for (var y = 0; y < data[x].length; y++) {
			data[x][y] = Math.floor(Math.random() * (256));
		}
	}
	var start = performance.now();
	return ow.keyWriteAll(keyRom, data, true).then(function () {
		var finish = performance.now();
		console.log('Overdrive Memory Write: ' + ((finish - start) / 1000).toFixed(2) + 's');
		keyMonitor.add(function () {
			return getKeyMemory(keyRom);
		});
		writeRandomMemoryButton.disabled = false;
	});
};

var clearKeyMemory = function (keyRom, retry) {
	console.log('Beginning Memory Write');
	var data = new Array(256);
	for (var x = 0; x < data.length; x++) {
		data[x] = new Uint8Array(32);
		for (var y = 0; y < data[x].length; y++) {
			data[x][y] = 0x55;
		}
	}
	var start = performance.now();
	return ow.keyWriteDiff(keyRom, data, masterMemory, true).then(function () {
		var finish = performance.now();
		console.log('Overdrive Memory Write: ' + ((finish - start) / 1000).toFixed(2) + 's');
		keyMonitor.add(function () {
			return getKeyMemory(keyRom);
		});
		clearMemoryButton.disabled = false;
	});
};
