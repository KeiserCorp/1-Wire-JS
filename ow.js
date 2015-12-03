module.exports = function (ow) {
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

	ow.checkPermission = function (success, failure) {
		chrome.permissions.contains(permissionObj, function (result) {
			if (result) {
				permissionStatus = true;
				success();
			} else {
				failure();
			}
		});
	};

	ow.requestPermission = function (success, failure) {
		chrome.permissions.request(permissionObj, function (result) {
			if (result) {
				permissionStatus = true;
				success();
			} else {
				failure();
			}
		});
	};

	return ow;
};
