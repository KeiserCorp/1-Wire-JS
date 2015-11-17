/*
 * UsbDS9490RController.java
 * This file is part of UsbController
 *
 * Copyright (C) 2012 - Manuel Di Cerbo
 * Copyright (C) 2013 - Maxim Integrated Products, Inc.
 *
 * UsbController is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * UsbController is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with UsbDS9490RController. If not, see <http://www.gnu.org/licenses/>.
 */
package com.maximintegrated.ibuttonreader;

import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.Iterator;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.hardware.usb.UsbRequest;
import android.util.Log;

/**
 * (c) Neuxs-Computing GmbH Switzerland
 * (c) Maxim Integrated Products, Inc.
 * 
 * @author Manuel Di Cerbo, 02.02.2012
 * @author Maxim Integrated Products 07.2013
 *
 */
public class UsbDS9490RController {

	private final Context mApplicationContext;
	private final UsbManager mUsbManager;
	private final IUsbConnectionHandler mConnectionHandler;
	private final int VID;
	private final int PID;
	protected static final String ACTION_USB_PERMISSION = "com.maximintegrated.ibuttonreader.USB";
	
	private final UsbRequest mUsbRequest;
		
	private final byte FC_1921G = 0x21; // DS1921G Family Code
	private final byte FC_1922_23 = 0x41; // DS1922/DS1923 Family Code
	
	private DeviceCommands mDevice;
	
	byte[][] ROM_NO_LIST = new byte[10][8];
	int deviceCount = 0;

	/**
	 * Activity is needed for onResult
	 * 
	 * @param parentActivity
	 */
	public UsbDS9490RController(Activity parentActivity,
			IUsbConnectionHandler connectionHandler, int vid, int pid) {
		mApplicationContext = parentActivity.getApplicationContext();
		mConnectionHandler = connectionHandler;
		mUsbManager = (UsbManager) mApplicationContext
				.getSystemService(Context.USB_SERVICE);
		VID = vid;
		PID = pid;
		
		mUsbRequest = new UsbRequest(); 
				
		init();
	}

	private void init() {
		enumerate(new IPermissionListener() {
			@Override
			public void onPermissionDenied(UsbDevice d) {
				UsbManager usbman = (UsbManager) mApplicationContext
						.getSystemService(Context.USB_SERVICE);
				PendingIntent pi = PendingIntent.getBroadcast(
						mApplicationContext, 0, new Intent(
								ACTION_USB_PERMISSION), 0);
				mApplicationContext.registerReceiver(mPermissionReceiver,
						new IntentFilter(ACTION_USB_PERMISSION));
				usbman.requestPermission(d, pi);
			}
		});
		
	}

	public void stop() {
		//mStop = true;
		synchronized (sSendLock) {
			sSendLock.notify();
		}

		mDevice = null;

		try{
			mApplicationContext.unregisterReceiver(mPermissionReceiver);
		}catch(IllegalArgumentException e){};//bravo
	}

	/*
	 * Initialize the DS2490 USB for use
	 */
	public void initUsbDevice() {
		mDevice.openUsbEP();
	}
	
	/*
	 * Converts and gets the real time temperature from an iButton.
	 * 
	 * @param romid Byte array containing the iButton ROM code
	 * @return Real time temperature read
	 */
	public double getTemperature(byte[] romid) {
		return mDevice.cmdRealTimeTemperature(romid);
	}
	
	/*
	 * Finds the ROM codes available on the 1-Wire bus.
	 * 
	 * @return Number of devices found
	 */
	public int getAddresses() {
		mDevice.cmdSearchAddress();
		return deviceCount;
	}

	private void enumerate(IPermissionListener listener) {
		l("enumerating");
		HashMap<String, UsbDevice> devlist = mUsbManager.getDeviceList();
		Iterator<UsbDevice> deviter = devlist.values().iterator();
		while (deviter.hasNext()) {
			UsbDevice d = deviter.next();
			l("Found device: "
					+ String.format("%04X:%04X", d.getVendorId(),
							d.getProductId()));
			if (d.getVendorId() == VID && d.getProductId() == PID) {
				l("Device under: " + d.getDeviceName());
				if (!mUsbManager.hasPermission(d))
					listener.onPermissionDenied(d);
				else{
					mDevice = new DeviceCommands(d);
					return;
				}
				break;
			}
		}
		l("no more devices found");
		mConnectionHandler.onDeviceNotFound();
	}

	
	private class PermissionReceiver extends BroadcastReceiver {
		private final IPermissionListener mPermissionListener;

		public PermissionReceiver(IPermissionListener permissionListener) {
			mPermissionListener = permissionListener;
		}

		@Override
		public void onReceive(Context context, Intent intent) {
			mApplicationContext.unregisterReceiver(this);
			if (intent.getAction().equals(ACTION_USB_PERMISSION)) {
				if (!intent.getBooleanExtra(
						UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
					mPermissionListener.onPermissionDenied((UsbDevice) intent
							.getParcelableExtra(UsbManager.EXTRA_DEVICE));
				} else {
					l("Permission granted");
					UsbDevice dev = (UsbDevice) intent
							.getParcelableExtra(UsbManager.EXTRA_DEVICE);
					if (dev != null) {
						if (dev.getVendorId() == VID
								&& dev.getProductId() == PID) {
							mDevice = new DeviceCommands(dev);
						}
					} else {
						e("device not present!");
					}
				}
			}
		}
	}

	private static final Object[] sSendLock = new Object[]{};//learned this trick from some google example :)
	//basically an empty array is lighter than an  actual new Object()...

	/**
	 * The DeviceCommands inner class contains the private 1-Wire read/write commands specific
	 * to the DS2480 (DS9490R). 
	 * 
	 * The public methods combine raw read/write commands to preform an action such as rom code
	 * search, and reading the real time temperature.
	 * 
	 * @author Wilson.Tang
	 *
	 */
	private class DeviceCommands { // Runs in its own thread
		private final UsbDevice mDevice;
		
		private UsbEndpoint epIN;
		private UsbEndpoint epOUT;
		private UsbEndpoint epINT;
		
		private UsbDeviceConnection conn;
		
		// 1-Wire search
		byte[] ROM_NO = new byte[8];
		int LastDiscrepancy;
		boolean LastDeviceFlag;
		
		/* 
		 * DeviceCommands constructor 
		 */
		public DeviceCommands(UsbDevice dev) {
			mDevice = dev;
			
			epIN = null;
			epOUT = null;
			epINT = null;
		}
		
		/* 
		 * Opens the USB device and connects the USB endpoints.
		 * 
		 * Endpoints 2, 3, and interrupt.
		 */
		public void openUsbEP() {
			conn = mUsbManager.openDevice(mDevice);
			if (!conn.claimInterface(mDevice.getInterface(1), true)) {
				return;
			}
	
			UsbInterface usbIf = mDevice.getInterface(1);
			for (int i = 0; i < usbIf.getEndpointCount(); i++) {
				if (usbIf.getEndpoint(i).getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
					if (usbIf.getEndpoint(i).getDirection() == UsbConstants.USB_DIR_IN)
						epIN = usbIf.getEndpoint(i);
					else
						epOUT = usbIf.getEndpoint(i);
				} else if (usbIf.getEndpoint(i).getType() == UsbConstants.USB_ENDPOINT_XFER_INT) {
					epINT = usbIf.getEndpoint(i);
				}
			}
			
			
			mUsbRequest.initialize(conn, epINT); // Interrupt USB Endpoint Receive data asynchronously
			l("USB Endpoints setup");
			
			/*while(true) {
			// TODO
			conn.bulkTransfer(epOUT, new byte[] {0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}, 8, 0);
			conn.controlTransfer(0x40, 0x01, 0x00f4 | 0x4809, 0x0af0, null, 0, 0);
			
			android.os.SystemClock.sleep(1000);
			ByteBuffer reg = oneWireStateRegisters();
			byte[] buffer = oneWireRead(reg.get(0x0d));
			
			buffer.toString();
			}*/
		}
		
		/*
		 * Performs 1-Wire address search. There is a limit of 10 devices. Resulting
		 * ROM codes stored in ROM_NO_LIST. 
		 *		 
		 */
		public void cmdSearchAddress() {
			while (oneWireSearch()) {		
				// copy newly found ROM_NO to the array of all known devices ROM_NO_LIST
				for(int i = 0; i < ROM_NO_LIST[deviceCount].length; i++)
					ROM_NO_LIST[deviceCount][i] = ROM_NO[i];
				deviceCount++;				
			}
		}
	
		/*
		 * Real Time Temperature. Performs the temperature conversion, 
		 * reads the result from registers, and calculates the resulting
		 * temperature value. Supports DS1921, DS1922, and DS1923.
		 * 
		 * @param romid ROM code of iButton for temperature measurement
		 * @return Temperature measured
		 */
		public double cmdRealTimeTemperature(byte[] romid) {
			double temperature = 0;
			
			if((romid[0] != FC_1921G) && (romid[0] != FC_1922_23)) // Not a known family code
				return 0;
			
			// 1-Wire Real Time Temperature Convert Command Sequence
			oneWireReset(); 
			oneWireMatchRom(romid);
			convertTemperature(romid);

			// Sleep 600ms for temperature conversion time
			android.os.SystemClock.sleep(600);
			
			// 1-Wire Read of converted temperature
			oneWireReset();
			oneWireMatchRom(romid);
						
			if (romid[0] == FC_1921G)
				readMemory(romid, 0x211, 2);
			else if (romid[0] == FC_1922_23)
				readMemory(romid, 0x20c, 2);
			
			android.os.SystemClock.sleep(100);
			
			// Read interrupt input for number of return bytes in the receive FIFO
			ByteBuffer regdata = oneWireStateRegisters();
												
			int readLength = regdata.get(0x0d);
			byte[] tempdata = oneWireRead(readLength);
						
			if(readLength != 0) { 
				// First few data bytes is the command echoed back
				// Conversion equation is located in the iButton's respective datasheet
				if (romid[0] == FC_1921G) {
					temperature = (int)(tempdata[4] & 0xff)/2.0 - 40;
				}
				else if (romid[0] == FC_1922_23) {
					temperature = (int)(tempdata[14] & 0xff)/2.0 + (int)(tempdata[13] & 0xff)/512.0 - 41;
					int temp_l = (int)(tempdata[13] & 0xff);
					int temp_h = (int)(tempdata[14] & 0xff);
					l("temp: " + temperature + " " + temp_l + " " + temp_h);
				}
			}
			
			return temperature;
		}
	
		/*
		 * DS2480 1-Wire Reset Command. Sends reset pulse to 1-Wire bus.
		 * 
		 */
		private void oneWireReset() {
			conn.controlTransfer(0x40, 0x01, 0x0C4B, 0x0001, null, 0x0000, 0);
			
			// TODO: read state register to see if device found on bus. 
		}
		
		/* 
		 * DS2490 1-Wire Match ROM command
		 * 
		 * @param romid Byte array containing the ROM code match the device to be
		 *              accessed
		 */
		private void oneWireMatchRom(byte[] romid) {
			conn.bulkTransfer(epOUT, romid, 8, 0);
			conn.controlTransfer(0x40, 0x01, 0x0065, 0x55, null, 0, 0);
		}
		
		/* 
		 * DS2490 1-Wire Bulk Write
		 * 
		 * @param data Byte array of data to be written to the 1-Wire bus
		 */
		private void oneWireWrite(byte[] data) {
			conn.bulkTransfer(epOUT, data, data.length, 0); 
			conn.controlTransfer(0x40, 0x01, 0x1075, data.length, null, 0, 0); 
		}
		
		/* 
		 * DS2490 1-Wire Bulk Read
		 * 
		 * @param byteCount Number of bytes to read
		 * @return Byte array read from the 1-Wire bus
		 */
		private byte[] oneWireRead(int byteCount) {
			byte[] tempdata = new byte[byteCount];
						
			conn.bulkTransfer(epIN, tempdata, byteCount, 0);
			
			return tempdata;
		}
		
		/*
		 * DS2490 1-Wire Write Bit
		 * 
		 * @param bit Writes bit to 1-Wire bus
		 */
		private void oneWireWriteBit(int bit) {
			conn.controlTransfer(0x40, 0x01, 0x221 | (bit<<3), 0x00, null, 0, 0);
		}
		
		/*
		 * DS2490 1-Wire Read Bit
		 * 
		 * @return Bit read from 1-Wire bus
		 */
		private int oneWireReadBit() {
			byte[] tempdata = null;
			
			conn.controlTransfer(0x40, 0x01, 0x29, 0x00, null, 0, 0);
			tempdata = oneWireRead(1);
						
			return tempdata[0];
		}
		
		/* 
		 * Reads the state registers of the DS2490 from 0x00 to 0x1F
		 * 
		 * @return Byte array of register contents
		 */
		private ByteBuffer oneWireStateRegisters() {
			ByteBuffer regdata = ByteBuffer.allocate(32);
			mUsbRequest.queue(regdata, 32);
			conn.requestWait();
			
			return regdata;
		}
		
		/*
		 * 1-Wire Search Algorithm as described in application note 187
		 * http://www.maximintegrated.com/an187
		 * 
		 * @return true New ROM code found, ROM_NO contains the new ROM code
		 * @return false No new ROM code found
		 */
		private boolean oneWireSearch() {
			int id_bit_number;
			int last_zero, rom_byte_number;
			boolean search_result;
			int id_bit, cmp_id_bit;
			
			byte rom_byte_mask;
			int search_direction;
			
			// initialize for search
			id_bit_number = 1;
			last_zero = 0;
			rom_byte_number = 0;
			rom_byte_mask = 1;
			search_result = false;

			// if the last call was not the last one
			if (!LastDeviceFlag) {
			   // 1-Wire reset
			   oneWireReset();
			   
			   oneWireWrite(new byte[] { (byte)0xF0 });
			   oneWireRead(1); // clear the receive buffer
			   
			   do {
				   // read a bit and its complement
				   id_bit = oneWireReadBit();
				   cmp_id_bit = oneWireReadBit();
				   
				   // check for no devices on 1-Wire
				   if ((id_bit == 1) && (cmp_id_bit == 1))
					   break;
				   else {
					   // all devices coupled have 0 or 1
					   if (id_bit != cmp_id_bit)
						   search_direction = id_bit; // bit write value for search
					   else {
						   	// if this discrepancy if before the Last Discrepancy
			               	// on a previous next then pick the same as last time
			               	if (id_bit_number < LastDiscrepancy)
			               		search_direction = ((ROM_NO[rom_byte_number] & rom_byte_mask) > 0) ? 1 : 0;
			               	else
			               		// if equal to last pick 1, if not then pick 0
			               		search_direction = (id_bit_number == LastDiscrepancy) ? 1 : 0;
			               	
			                // if 0 was picked then record its position in LastZero
			                if (search_direction == 0) {
			                	last_zero = id_bit_number;

			                	// check for Last discrepancy in family
			                	if (last_zero < 9) {
								}
			                }
					   }
					   
					   // set or clear the bit in the ROM byte rom_byte_number
			           // with mask rom_byte_mask
			           if (search_direction == 1)
			        	   ROM_NO[rom_byte_number] |= rom_byte_mask;
			           else
			        	   ROM_NO[rom_byte_number] &= ~rom_byte_mask;
			           
			           // serial number search direction write bit
			           oneWireWriteBit(search_direction);

			           // increment the byte counter id_bit_number
			           // and shift the mask rom_byte_mask
			           id_bit_number++;
			           rom_byte_mask <<= 1;

			           // if the mask is 0 then go to new SerialNum byte rom_byte_number and reset mask
			           if (rom_byte_mask == 0) {
			                rom_byte_number++;
			                rom_byte_mask = 1;
			            }
				   }
			   }
			   while(rom_byte_number < 8);  // loop until through all ROM bytes 0-7
					
		      // if the search was successful then
		      if (!(id_bit_number < 65))
		      {
		         // search successful so set LastDiscrepancy,LastDeviceFlag,search_result
		         LastDiscrepancy = last_zero;

		         // check for last device
		         if (LastDiscrepancy == 0)
		            LastDeviceFlag = true;

		         search_result = true;
		      }
		   }

		   // if no device found then reset counters so next 'search' will be like a first
		   if (search_result == false || ROM_NO[0] == 0)
		   {
		      LastDiscrepancy = 0;
		      LastDeviceFlag = false;
		      search_result = false;
		   }

		   return search_result;
		}
		
		/*
		 * Sends iButton convert temperature command to the 1-Wire bus.
		 * Supports DS1921, DS1922, DS1923 family.
		 * 
		 * @param romid ROM code of iButton.
		 * @return none
		 */
		private void convertTemperature(byte[] romid) {		
			if (romid[0] == FC_1921G) { // DS1921G
				oneWireWrite(new byte[]{0x44});
			} else if (romid[0] == FC_1922_23) { // DS1922/DS1923
				oneWireWrite(new byte[] {0x55, (byte)0xFF});
			}
		}
		
		/* 
		 * Read iButton internal register memory
		 * 
		 * @param romid ROM code of iButton
		 * @param register iButton memory register
		 * @parm byteCount Number of bytes to read
		 */
		private void readMemory(byte[] romid, int register, int byteCount) {
			byte TA1 = (byte) (register & 0xFF);
			byte TA2 = (byte)((register & 0xFF00) >> 8);
			
			byte[] command = null;
			byte[] tempdata;
			
			byte[] dummyData = new byte[byteCount];
			
			for(int i = 0; i < byteCount; i++) {
				dummyData[i] = (byte)0xFF; 
			}
			
			if (romid[0] == FC_1921G) { // DS1921G
				command = new byte[] {(byte)0xf0, TA1, TA2};
			} else if (romid[0] == FC_1922_23) { // DS1922/DS1923
				command = new byte[] {(byte) 0x69, TA1, TA2, 
						(byte)0xff, (byte)0xff, (byte)0xff, (byte)0xff, // 8 bytes for dummy password 
						(byte)0xff, (byte)0xff, (byte)0xff, (byte)0xff, 
						(byte)0xff, (byte)0xff, (byte)0xff, (byte)0xff};
			}
			
			tempdata = new byte[command.length + dummyData.length];
			for(int i = 0; i < tempdata.length; i++) {
				if (i < command.length) {
					tempdata[i] = command[i];
				} else {
					tempdata[i] = dummyData[i - command.length];
				}
			}
			
			oneWireWrite(tempdata);
		}
	}

	// END MAIN LOOP
	private BroadcastReceiver mPermissionReceiver = new PermissionReceiver(
			new IPermissionListener() {
				@Override
				public void onPermissionDenied(UsbDevice d) {
					l("Permission denied on " + d.getDeviceId());
				}
			});

	private static interface IPermissionListener {
		void onPermissionDenied(UsbDevice d);
	}

	public final static String TAG = "USBController";

	private void l(Object msg) {
		Log.d(TAG, ">==< " + msg.toString() + " >==<");
	}

	private void e(Object msg) {
		Log.e(TAG, ">==< " + msg.toString() + " >==<");
	}
}
