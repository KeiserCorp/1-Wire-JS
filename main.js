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

function requestPermission(){
  chrome.permissions.request(permissionObj, function(result) {
    if (result) {
      gotPermission();
    } else {
      failedPermission();
    }
  });
}
  
chrome.permissions.contains(permissionObj, function(result) {
  if (result) {
    gotPermission();
  }
});


var requestButton = document.getElementById("requestPermission");
requestButton.addEventListener('click', function() {
   requestPermission();
});

// window.onload = function() {
//   requestPermission();
// };