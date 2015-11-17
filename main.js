var permissionObj = {permissions: [{'usbDevices': [DEVICE_INFO] }]};

var gotPermission = function(result) {
  requestButton.style.display = 'none';
  document.querySelector('#permission').innerText = 'Permission: Granted'; 
  //console.log('App was granted the "usbDevices" permission.');
  awaitDevices();
};

var failedPermission = function(result){
  document.querySelector('#permission').innerText = 'Permission: Failed'; 
  console.log('App was not granted the "usbDevices" permission.');
  console.log(chrome.runtime.lastError);
};

var requestPermission = function(){
  chrome.permissions.request(permissionObj, function(result) {
    if (result) {
      gotPermission();
    } else {
      failedPermission();
    }
  });
};

function sendInitialMessage(e) {
  e.target.contentWindow.postMessage("Initialize", "http://devxer.com/1w/external/");
}

var requestButton = document.getElementById("requestPermission");
var webView=document.getElementById('webView');
  
window.onload = function() {  
  chrome.permissions.contains(permissionObj, function(result) {
    if (result) {
      gotPermission();
    }
  });
  
  requestButton.addEventListener('click', function() {
     requestPermission();
  });
  
  window.addEventListener('message', function(e) {
    console.log("Message Received: ", e.data);
  });
  
  webView.addEventListener('loadstop', sendInitialMessage);
};