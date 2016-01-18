# 1-Wire® for Javascript
## Project
1-Wire® Communication implemented in Javascript for Chrome using `chrome.udb`.

## Getting Started
You have following options to get started:
- Download the [latest release](https://github.com/KeiserCorp/1-Wire-JS/releases/latest)
- Clone the repo: `git clone git://github.com/KeiserCorp/1-Wire-JS.git`
- Install with [NPM](https://www.npmjs.com/): `npm install 1-wire-js`

## Loading
Each release includes a minified distribution version of the library which can be loaded with a module loader, or as a stand alone library.

Module load the library with [CommonJS](http://www.commonjs.org/):

```
var ow = require('1-wire-js');
```

Including the library as a stand-alone library:

```
<script src="ow.min.js"></script>
```

```
var ow = window.ow;
```

## API
All APIs utilize the `Q` promise library, so most functions return a promise which has a `.then()` method. `.then()` methods accept two callbacks.  The first callback is called on success, and the second is called on failure.

```
ow.requestPermission().then(success, failure);
```

- [Permission](#permission)
- [Device](#device)
- [Transfer](#transfer)
- [Device Control](#device-control)
- [1-Wire](#1-wire)
- [Key](#keye)

### Permission
#### `checkPermission()`
Checks Chrome for permission to access USB device.

```
ow.checkPermission().then(gotPermission);
```

#### `requestPermission()`
Requests Chrome for permission to access USB device.  Method must be activated by a user event (such as a button press).

```
ow.requestPermission().then(gotPermission, failedPermission);
```

### Device
#### `deviceOpen()`
Attempts to open the USB device.

```
ow.deviceOpen().then(deviceOpened);
```

#### `deviceClose()`
Attempts to close the USB device.

```
ow.deviceClose().then(deviceClosed);
```

#### `onDeviceAdded`
Event listener which triggers upon the addition of a USB device.

`addListener(callback)` adds a callback to the event listener.

`removeListener(callback)` removes a callback from the event listener.

```
ow.onDeviceAdded.addListener(deviceConnected);
```

#### `onDeviceRemoved`
Event listener which triggers upon the removal of a USB device.

`addListener(callback)` adds a callback to the event listener.

`removeListener(callback)` removes a callback from the event listener.

```
ow.onDeviceRemoved.addListener(deviceRemoved);
```

### Transfer
#### `transferInfo`
A generic transfer object passed to some transfer methods.

`direction` is the transfer direction (`"in"` or `"out"`).

`endpoint` is the target endpoint address.

`length` _(optional)_ is the amount of data to receive (required only by input transfers).

`data` _(optional)_ is the data to transmit (required only by output transfers).

```
var transferInfo = {
  "direction": "in",
  "endpoint": 1,
  "length": 0x20
};
```

#### `deviceInterruptTransfer()`
Performs a device interrupt transfer.

```
ow.deviceInterruptTransfer().then(interruptTransferComplete);
```

#### `deviceControlTransfer(transferInfo)`
Performs a device control transfer.

```
ow.deviceControlTransfer(transferInfo).then(controlTransferComplete);
```

#### `deviceBulkTransfer(transferInfo)`
Performs a device bulk transfer.

```
ow.deviceBulkTransfer(transferInfo).then(bulkTransferComplete);
```

### Device Control
#### `deviceReset()`
Performs a device reset which resets device speed and cancels all actions.

```
ow.deviceReset().then(deviceReady);
```

#### `deviceGetStatus()`
Passes device state registers object into callback.

```
ow.deviceGetStatus()
  .then(function (status) {
    if (status.ResultRegisters.DetectKey){
      console.log('Key Detected');
    }
  });
```

### 1-Wire
#### `wireDetectShort()`
Detects short in the line and passes the result into callback.

```
ow.wireDetectShort()
  .then(function (shorted) {
    if (shorted) {
      throw new Error("Short Detected");
    }
  });
```

#### `wireSetSpeed(overdrive)`
Sets the speed to either normal or overdrive based on passed in boolean value `overdrive`;

```
ow.wireSetSpeed(true).then(speedSet);
```

#### `wireReset()`
Sends a reset and then checks for a wire short.

```
ow.wireReset().then(resetComplete);
```

#### `wireWrite(data)`
Writes data onto the wire.

`data` must be type `Uint8Array` or data loss may occur.

```
ow.wireWrite(data).then(writeComplete);
```

#### `wireWriteBit(bit)`
Writes a single bit onto the wire.

```
ow.wireWriteBit(bit).then(writeBitComplete);
```

#### `wireRead(byteCount)`
Read a length of data defined by `byteCount` from the wire and passes it to callback.

```
ow.wireRead(0x20)
  .then(function(data){
    storeData(data);
  });
```

#### `wireReadBit()`
Reads a single bit of data from the wire and passes it to callback.

```
ow.wireReadBit()
  .then(function(bitSet){
    test = bitSet;
  });
```

#### `wireClearByte()`
Clears a single byte of data from the wire.

```
ow.wireClearByte().then(wireCleared);
```
### Key
#### `keyRomCommand(match, keyRom, overdrive)`
Performs a key ROM match operation on the network.

`match` determines if commands should target a specific key ROM (`true`) or if commands should target all devices (`false`).

`keyRom` should contain the ROM of the device being targeted if `match` is `true`.

`overdrive` should be set to `true` if commands should be performed in overdrive speed.

```
ow.keyRomCommand(true, keyRom, true).then(keyRomMatched);
```

#### `keyRomMatch(keyRom)`
Performs a key ROM match at normal speed.

*Alias for `ow.keyRomCommand(true, keyRom, false)`*

```
ow.keyRomMatch(keyRom).then(keyRomMatched);
```

#### `keyRomMatchOverdrive(keyRom)`
Performs a key ROM match at overdrive speed.

*Alias for `ow.keyRomCommand(true, keyRom, true)`*

```
ow.keyRomMatch(keyRom).then(keyRomMatched);
```

#### `keyRomSkip()`
Performs a key ROM skip at normal speed.

*Alias for `ow.keyRomCommand(false, null, false)`*

```
ow.keyRomSkip().then(keyRomSkipped);
```

#### `keyRomSkipOverdrive()`
Performs a key ROM skip at overdrive speed.

*Alias for `ow.keyRomCommand(false, null, true)`*

```
ow.keyRomSkipOverdrive().then(keyRomSkipped);
```

## Contributors
- [bayssmekanique](https://github.com/bayssmekanique)

## Copyright and License
Copyright [Keiser Corporation](http://keiser.com/) under the [MIT license](LICENSE.md).
