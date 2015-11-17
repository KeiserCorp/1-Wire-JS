/*
 * UsbControllerActivity.java
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


import android.app.Activity;
import android.os.AsyncTask;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.Spinner;
import android.widget.TextView;

/**
 * (c) Neuxs-Computing GmbH Switzerland
 * (c) Maxim Integrated Products, Inc.
 * @author Manuel Di Cerbo, 02.02.2012
 * @author Maxim Integrated Products, 07.23.2013
 */
public class IButtonReaderActivity extends Activity {
	/** Called when the activity is first created. */
	private static final int VID = 0x04fa;
	private static final int PID = 0x2490;
	private static UsbDS9490RController sUsbController;
	private TextView textViewTemp;
	private Spinner romIDSpinner;

	String[] rom_ids;
	
	@Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main); // XML file for application layout
        if(sUsbController == null){
	        sUsbController = new UsbDS9490RController(this, mConnectionHandler, VID, PID);
        }
        ((Button)findViewById(R.id.buttonEnumerate)).setOnClickListener(new View.OnClickListener() {
			@Override
			public void onClick(View v) {
				if(sUsbController == null)
					sUsbController = new UsbDS9490RController(IButtonReaderActivity.this, mConnectionHandler, VID, PID);
				else{
					sUsbController.stop();
					sUsbController = new UsbDS9490RController(IButtonReaderActivity.this, mConnectionHandler, VID, PID);
				}
				
		        textViewTemp = (TextView) findViewById(R.id.temperatureCurrent);
		        romIDSpinner = (Spinner) findViewById(R.id.romIDSpinner);
		        
		        // Start a new Async Thread for initializing the USB and searching for 
		        // all ROM codes
		        new InitUsbEpTask().execute();
		        new GetAddressTask().execute();
		        
			}
		});
        
        ((Spinner)findViewById(R.id.romIDSpinner)).setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {

			@Override
			public void onItemSelected(AdapterView<?> parent, View view,
					int position, long id) {
				// Start a new AsyncTask Thread for getting the real time temperature
				new GetTemperatureTask().execute(position);
			}

			@Override
			public void onNothingSelected(AdapterView<?> parent) {
			}
        });
    }

	private final IUsbConnectionHandler mConnectionHandler = new IUsbConnectionHandler() {
		@Override
		public void onUsbStopped() {
			L.e("Usb stopped!");
		}
		
		@Override
		public void onErrorLooperRunningAlready() {
			L.e("Looper already running!");
		}
		
		@Override
		public void onDeviceNotFound() {
			if(sUsbController != null){
				sUsbController.stop();
				sUsbController = null;
			}
		}
	};
	
	// AsyncTask for initializing the USB DS2480.
	private class InitUsbEpTask extends AsyncTask<Void, Void, Void> {

		@Override
		protected Void doInBackground(Void... arg0) {
			sUsbController.initUsbDevice();
			return null;
		}
	}
	
	// AsyncTask for getting all the rom id of devices on the 1-Wire bus
	private class GetAddressTask extends AsyncTask<byte[], Void, byte[][]> {

		@Override
		protected byte[][] doInBackground(byte[]... romid) {
			sUsbController.getAddresses();
			return sUsbController.ROM_NO_LIST;
		}
		
		protected void onPostExecute(byte[][] result) {
			ArrayAdapter<String> spinnerArrayAdapter;
			rom_ids = new String[sUsbController.deviceCount];
			
			StringBuilder sb;
			
			for(int i = 0; i < rom_ids.length; i++) {
				 sb = new StringBuilder();
				for(byte b: result[i]) {
					sb.append(String.format("%02x ", b & 0xff));				
				}
				
				rom_ids[i] = sb.toString();
			}
			
			spinnerArrayAdapter = new ArrayAdapter<String> (getApplicationContext(), 
					R.layout.spinner_style, rom_ids);
			spinnerArrayAdapter.setDropDownViewResource(R.layout.spinner_item);
			
			romIDSpinner.setAdapter(spinnerArrayAdapter);
			
		}
	}
	
	// AsyncTask Thread for getting the real time temperature
	private class GetTemperatureTask extends AsyncTask<Integer, Void, Double> {

		@Override
		protected Double doInBackground(Integer... romidIdx) {
			return sUsbController.getTemperature(sUsbController.ROM_NO_LIST[romidIdx[0]]);
		}
		
		protected void onPostExecute(Double result) {
			textViewTemp.setText("Temp: " + result + "°C");
		}
		
	}
}