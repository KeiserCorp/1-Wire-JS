var DALLAS_VENDOR_ID = 1274; //0x04FA;
var DALLAS_PRODUCT_ID = 9360; //0x2490;
var DEVICE_INFO = {"vendorId": DALLAS_VENDOR_ID, "productId": DALLAS_PRODUCT_ID};

var deviceConnection;
var deviceInterface;

var openDevices = function(){
  chrome.usb.findDevices(DEVICE_INFO,
  function(deviceConnections) {
     if (!deviceConnections || !deviceConnections.length) {
       console.log('device not found');
       return;
     }
     console.log('Found device: ' + deviceConnections[0].handle);
     deviceConnection = deviceConnections[0];
     chrome.usb.listInterfaces(deviceConnection, function(descriptors) {
        deviceInterface = descriptors[0];
        console.log(deviceInterface);
        initializeInterface();
      });
  });
};

var initializeInterface = function(){
  chrome.usb.claimInterface(deviceConnection, deviceInterface.interfaceNumber, awaitKey);
};

var awaitKey = function() {
  interruptLoop(initializeCommunication); // Wait for key to be connected
};

var initializeCommunication = function () {
  console.log("Initializing Communication");
  // 1-Wire Reset
  oneWireReset(function(result){
    console.log(result);
    oneWireWrite(new Uint8Array([0xF0]), function(result){
      console.log(result);
      oneWireRead(1, function(result){
        console.log(new Uint8Array(result.data));
      });
    });
  });
};

var interruptLoop = function(callback)
{
  setTimeout(function(){
    oneWireInterrupt(function(interruptResult){    
      if (interruptResult && interruptResult.ResultRegisters.DetectDevice){
        callback();
        return;
      }
    });
    interruptLoop(callback);
  }, 100);
};

var oneWireInterrupt = function(callback)
{
  var interruptEndpoint = deviceInterface.endpoints[0];
  var stateRegisters;
  var transferInfo = {
    direction: interruptEndpoint.direction,
    endpoint: interruptEndpoint.address,
    length: interruptEndpoint.maximumPacketSize,
    timeout: interruptEndpoint.pollingInterval
  };
  chrome.usb.interruptTransfer(deviceConnection, transferInfo, function(transferResultInfo){
      if (transferResultInfo.resultCode) {
        //console.log('Interrupt Transfer Failed');
        callback();
      }
      //console.log('Interrupt Transfer Success');
      stateRegisters = parseInterruptResponse(transferResultInfo.data);
      if (stateRegisters.ResultRegisters && stateRegisters.ResultRegisters.DetectDevice)
      {
        console.log('Key Connected');
        //console.log(stateRegisters);
        callback(stateRegisters);
      }
  });
};


var parseInterruptResponse = function(responseBuffer){
  responseArray = new Uint8Array(responseBuffer);
  //console.log("Response Size: " + responseArray.length);
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
  
  if (responseArray[16])
  {
    stateRegisters.ResultRegisters = {};
    //stateRegisters.ResultRegisters.Data = responseArray.slice(16, responseArray.length);
    stateRegisters.ResultRegisters.DetectDevice = responseArray[16] == 165;
    if (responseArray[17] && responseArray[17] != 165)
    {
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

var oneWireReset = function(callback){
  console.log("Performing Reset");
  var transferInfo = {
    direction: 'out',
    recipient: 'device',
    requestType: 'vendor',
    request: 0x01,
    value: 0x0C4B,
    index: 0x0001,
    data: new Uint8Array(0).buffer,
    timeout: 0
  };
  chrome.usb.controlTransfer(deviceConnection, transferInfo, callback);
};

var oneWireWrite = function(data, callback){
  console.log("Performing Write");
  var bulkOutEndpoint = deviceInterface.endpoints[1];
  var transferInfo = {
    direction: bulkOutEndpoint.direction,
    endpoint: bulkOutEndpoint.address,
    data: new Uint8Array(data).buffer
  };
  chrome.usb.bulkTransfer(deviceConnection, transferInfo, function(result){
    console.log(result);
      var transferInfo = {
      direction: 'out',
      recipient: 'device',
      requestType: 'vendor',
      request: 0x01,
      value: 0x1075,
      index: data.length,
      data: new Uint8Array(0).buffer,
      timeout: 0
    };
    chrome.usb.controlTransfer(deviceConnection, transferInfo, callback);
  });
};

var oneWireRead = function(byteCount, callback){
  console.log("Performing Read");
  var bulkInEndpoint = deviceInterface.endpoints[2];
  var transferInfo = {
    direction: bulkInEndpoint.direction,
    endpoint: bulkInEndpoint.address,
    length: byteCount
  };
  chrome.usb.bulkTransfer(deviceConnection, transferInfo, callback);
};

// var genericTransferCallback = function(TransferResultInfo){
//   console.log(TransferResultInfo);
//   if (TransferResultInfo.resultCode) {
//     console.log("Error: " + TransferResultInfo.error);
//     //return;
//   }
// };