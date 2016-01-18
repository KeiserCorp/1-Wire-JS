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
ow.permission.request().then(success, failure);
```

- [Permission](#permission)
- [Device](#device)
- [Transfer](#transfer)
- [Wire](#wire)
- [Key](#key)

### Permission
#### `permission.check()`
Checks Chrome for permission to access USB device.

```
ow.permission.check().then(gotPermission);
```

#### `permission.request()`
Requests Chrome for permission to access USB device.  Method must be activated by a user event (such as a button press).

```
ow.permission.request().then(gotPermission, failedPermission);
```

### Device
#### `device.open()`
Attempts to open the USB device.

```
ow.device.open().then(deviceOpened);
```

#### `device.close()`
Attempts to close the USB device.

```
ow.device.close().then(deviceClosed);
```

#### `device.onDeviceAdded`
Event listener which triggers upon the addition of a USB device.

`addListener(callback)` adds a callback to the event listener.

`removeListener(callback)` removes a callback from the event listener.

```
ow.device.onDeviceAdded.addListener(deviceConnected);
```

#### `device.onDeviceRemoved`
Event listener which triggers upon the removal of a USB device.

`addListener(callback)` adds a callback to the event listener.

`removeListener(callback)` removes a callback from the event listener.

```
ow.device.onDeviceRemoved.addListener(deviceRemoved);
```

#### `device.reset()`
Performs a device reset which resets device speed and cancels all actions.

```
ow.device.reset().then(deviceReady);
```

#### `device.getStatus()`
Passes device state registers object into callback.

```
ow.device.getStatus()
  .then(function (status) {
    if (status.ResultRegisters.DetectKey){
      console.log('Key Detected');
    }
  });
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

#### `device.interruptTransfer()`
Performs a device interrupt transfer.

```
ow.device.interruptTransfer().then(interruptTransferComplete);
```

#### `device.controlTransfer(transferInfo)`
Performs a device control transfer.

```
ow.device.controlTransfer(transferInfo).then(controlTransferComplete);
```

#### `device.bulkTransfer(transferInfo)`
Performs a device bulk transfer.

```
ow.device.bulkTransfer(transferInfo).then(bulkTransferComplete);
```

### Wire
#### `wire.detectShort()`
Detects short in the line and passes the result into callback.

```
ow.wire.detectShort()
  .then(function (shorted) {
    if (shorted) {
      throw new Error("Short Detected");
    }
  });
```

#### `wire.setSpeed(overdrive)`
Sets the speed to either normal or overdrive based on passed in boolean value `overdrive`;

```
ow.wire.setSpeed(true).then(speedSet);
```

#### `wire.rest()`
Sends a reset and then checks for a wire short.

```
ow.wire.rest().then(resetComplete);
```

#### `wire.write(data)`
Writes data onto the wire.

`data` must be type `Uint8Array` or data loss may occur.

```
ow.wire.write(data).then(writeComplete);
```

#### `wire.writeBit(bit)`
Writes a single bit onto the wire.

```
ow.wire.writeBit(bit).then(writeBitComplete);
```

#### `wire.read(byteCount)`
Read a length of data defined by `byteCount` from the wire and passes it to callback.

```
ow.wire.read(0x20)
  .then(function(data){
    storeData(data);
  });
```

#### `wire.readBit()`
Reads a single bit of data from the wire and passes it to callback.

```
ow.wire.readBit()
  .then(function(bitSet){
    test = bitSet;
  });
```

#### `wire.clearByte()`
Clears a single byte of data from the wire.

```
ow.wire.clearByte().then(wireCleared);
```

### Key
#### `key.romCommand(match, keyRom, overdrive)`
Performs a key ROM match operation on the network.

`match` determines if commands should target a specific key ROM (`true`) or if commands should target all devices (`false`).

`keyRom` should contain the ROM of the device being targeted if `match` is `true`.

`overdrive` should be set to `true` if commands should be performed in overdrive speed.

```
ow.key.romCommand(true, keyRom, true).then(keyRomMatched);
```

#### `key.romMatch(keyRom)`
Performs a key ROM match at normal speed.

_Alias for `ow.key.romCommand(true, keyRom, false)`_

```
ow.key.romMatch(keyRom).then(keyRomMatched);
```

#### `key.romMatchOverdrive(keyRom)`
Performs a key ROM match at overdrive speed.

_Alias for `ow.key.romCommand(true, keyRom, true)`_

```
ow.key.romMatch(keyRom).then(keyRomMatched);
```

#### `key.romSkip()`
Performs a key ROM skip at normal speed.

_Alias for `ow.key.romCommand(false, null, false)`_

```
ow.key.romSkip().then(keyRomSkipped);
```

#### `key.romSkipOverdrive()`
Performs a key ROM skip at overdrive speed.

_Alias for `ow.key.romCommand(false, null, true)`_

```
ow.key.romSkipOverdrive().then(keyRomSkipped);
```

#### `key.searchFirst()`
Searches network for keys and passes the first key ROM to the callback.

```
ow.key.searchFirst()
  .then(function(rom){
      keyROM = rom;
  });
```

#### `key.searchNext()`
Searches network for keys and passes the next key ROM to the callback.

_This method will loop through key ROMs_

```
ow.key.searchNext()
  .then(function(rom){
      keyRom = rom;
  });
```

#### `key.readAll(keyRom, overdrive)`
Reads all of the data from the key targeted by `keyRom` and passes the data to the callback.

`keyRom` is the target key ROM stored as `Uint8Array`.

`overdrive` is a boolean value determining operation speed. _(Default: false)_

```
ow.key.readAll(keyRom, true)
  .then(function(data){
      keyData = data;
  });
```

#### `key.write(keyRom, offset, data, overdrive)`
Writes `data` to the key targeted by `keyRom`.

`keyRom` is the target key ROM stored as `Uint8Array`.

`offset` is the memory offset where the data is to be written.

`data` is the data to be written to the key memory stored as `Uint8Array`.

`overdrive` is a boolean value determining operation speed. _(Default: false)_

```
ow.key.write(keyRom, 0x00, data, true).then(writeComplete);
```

#### `key.writeAll(keyRom, data, overdrive)`
Writes `data` to the key targeted by `keyRom` starting at the memory beginning.

`keyRom` is the target key ROM stored as `Uint8Array`.

`data` is the data to be written to the key memory stored as `Uint8Array`.

`overdrive` is a boolean value determining operation speed. _(Default: false)_

```
ow.key.writeAll(keyRom, data, true).then(writeComplete);
```

#### `key.writeDiff(keyRom, newData, oldData, overdrive)`
Writes `newData` to the key targeted by `keyRom` starting at the memory beginning using a diffing algorithm to speed up writes.

`keyRom` is the target key ROM stored as `Uint8Array`.

`newData` is the data to be written to the key memory stored as `Uint8Array`.

`oldData` is the current key memory stored as `Uint8Array`.

`overdrive` is a boolean value determining operation speed. _(Default: false)_

```
ow.key.writeAll(keyRom, newData, lastDump, true).then(writeComplete);
```

## Contributors
- [bayssmekanique](https://github.com/bayssmekanique)

## Copyright and License
Copyright [Keiser Corporation](http://keiser.com/) under the [MIT license](LICENSE.md).
