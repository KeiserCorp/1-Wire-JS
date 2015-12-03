(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"./ow.js":2}],2:[function(require,module,exports){
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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6L1VzZXJzL1phY2hhcnkvQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIm1haW4uanMiLCJvdy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy92YXIgcGVybWlzc2lvbk9iaiA9IHtwZXJtaXNzaW9uczogW3sndXNiRGV2aWNlcyc6IFtERVZJQ0VfSU5GT10gfV19O1xyXG52YXIgb25lV2lyZSA9IHJlcXVpcmUoJy4vb3cuanMnKTtcclxudmFyIG93ID0gb25lV2lyZSgpO1xyXG5cclxudmFyIGdvdFBlcm1pc3Npb24gPSBmdW5jdGlvbiAocmVzdWx0KSB7XHJcblx0cmVxdWVzdEJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG5cdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNwZXJtaXNzaW9uJykuaW5uZXJUZXh0ID0gJ1Blcm1pc3Npb246IEdyYW50ZWQnO1xyXG5cdGNvbnNvbGUubG9nKCdBcHAgd2FzIGdyYW50ZWQgdGhlIFwidXNiRGV2aWNlc1wiIHBlcm1pc3Npb24uJyk7XHJcblx0Ly9hd2FpdERldmljZXMoKTtcclxufTtcclxuXHJcbnZhciBmYWlsZWRQZXJtaXNzaW9uID0gZnVuY3Rpb24gKHJlc3VsdCkge1xyXG5cdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNwZXJtaXNzaW9uJykuaW5uZXJUZXh0ID0gJ1Blcm1pc3Npb246IEZhaWxlZCc7XHJcblx0Y29uc29sZS5sb2coJ0FwcCB3YXMgbm90IGdyYW50ZWQgdGhlIFwidXNiRGV2aWNlc1wiIHBlcm1pc3Npb24uJyk7XHJcblx0Y29uc29sZS5sb2coY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcclxufTtcclxuXHJcbnZhciByZXF1ZXN0QnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJyZXF1ZXN0UGVybWlzc2lvblwiKTtcclxuXHJcbndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XHJcblx0b3cuY2hlY2tQZXJtaXNzaW9uKGdvdFBlcm1pc3Npb24pO1xyXG5cclxuXHRyZXF1ZXN0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0Y29uc29sZS5sb2coJ2NsaWNrJyk7XHJcblx0XHRvdy5yZXF1ZXN0UGVybWlzc2lvbihnb3RQZXJtaXNzaW9uLCBmYWlsZWRQZXJtaXNzaW9uKTtcclxuXHR9KTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvdykge1xyXG5cdGlmICh0eXBlb2Ygb3cgPT0gJ3VuZGVmaW5lZCcpIHtcclxuXHRcdHZhciBvdyA9IHt9O1xyXG5cdH1cclxuXHJcblx0dmFyIERBTExBU19WRU5ET1JfSUQgPSAxMjc0OyAvLzB4MDRGQTtcclxuXHR2YXIgREFMTEFTX1BST0RVQ1RfSUQgPSA5MzYwOyAvLzB4MjQ5MDtcclxuXHR2YXIgREVWSUNFX0lORk8gPSB7XHJcblx0XHRcInZlbmRvcklkXCIgOiBEQUxMQVNfVkVORE9SX0lELFxyXG5cdFx0XCJwcm9kdWN0SWRcIiA6IERBTExBU19QUk9EVUNUX0lEXHJcblx0fTtcclxuXHJcblx0dmFyIHBlcm1pc3Npb25PYmogPSB7XHJcblx0XHRwZXJtaXNzaW9ucyA6IFt7XHJcblx0XHRcdFx0J3VzYkRldmljZXMnIDogW0RFVklDRV9JTkZPXVxyXG5cdFx0XHR9XHJcblx0XHRdXHJcblx0fTtcclxuXHRcclxuXHR2YXIgcGVybWlzc2lvblN0YXR1cyA9IGZhbHNlO1xyXG5cclxuXHRvdy5jaGVja1Blcm1pc3Npb24gPSBmdW5jdGlvbiAoc3VjY2VzcywgZmFpbHVyZSkge1xyXG5cdFx0Y2hyb21lLnBlcm1pc3Npb25zLmNvbnRhaW5zKHBlcm1pc3Npb25PYmosIGZ1bmN0aW9uIChyZXN1bHQpIHtcclxuXHRcdFx0aWYgKHJlc3VsdCkge1xyXG5cdFx0XHRcdHBlcm1pc3Npb25TdGF0dXMgPSB0cnVlO1xyXG5cdFx0XHRcdHN1Y2Nlc3MoKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRmYWlsdXJlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH07XHJcblxyXG5cdG93LnJlcXVlc3RQZXJtaXNzaW9uID0gZnVuY3Rpb24gKHN1Y2Nlc3MsIGZhaWx1cmUpIHtcclxuXHRcdGNocm9tZS5wZXJtaXNzaW9ucy5yZXF1ZXN0KHBlcm1pc3Npb25PYmosIGZ1bmN0aW9uIChyZXN1bHQpIHtcclxuXHRcdFx0aWYgKHJlc3VsdCkge1xyXG5cdFx0XHRcdHBlcm1pc3Npb25TdGF0dXMgPSB0cnVlO1xyXG5cdFx0XHRcdHN1Y2Nlc3MoKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRmYWlsdXJlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH07XHJcblxyXG5cdHJldHVybiBvdztcclxufTtcclxuIl19
