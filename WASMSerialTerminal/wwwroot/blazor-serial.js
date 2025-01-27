﻿var keepReading = false;
var reader;
var closePromise;

async function callOnDataReceived(data, serialService) {
	try {
		await serialService.invokeMethodAsync("OnDataReceived", data);
	}
	catch (ex) {
		console.log("Error calling .NET method OnDataReceived: " + ex.message);
	}
}

async function readUntilClosed(port, serialService) {
	// If a non-fatal error is encountered (i.e. port.readable still true), we just loop again, get a new reader and continue to read
	while (port.readable && keepReading) {
		reader = port.readable.getReader();
		try {
			while (true) {
				let { value, done } = await reader.read();
				if (done) break;
				await callOnDataReceived(value, serialService);
			}
		}
		catch (error) {
			console.log("Serial error: " + error.message);
		}
		finally {
			reader.releaseLock();
		}
	}

	await port.close();

	// If keepReading is true and we are here, then port.readable must have been false which means the port threw a fatal error
	if (keepReading)
		serialService.invokeMethodAsync("OnSerialError")
}

window.openPortSelectionDialog = async (serialService, baudRate, bufferSize, dataBits, flowControl, parity, stopBits) => {
	try {
		// C# code will detect if navigator.serial is not supported - we want to write as little JS as possible
		let port = await navigator.serial.requestPort();
		await port.open({ baudRate: baudRate, bufferSize: bufferSize, dataBits: dataBits, flowControl: flowControl, parity: parity, stopBits: stopBits });
		keepReading = true;
		closePromise = readUntilClosed(port, serialService);
		return 1;
	}
	catch (ex) {
		if (ex.name == "SECURITY_ERR")
			return 2;
		else if (ex.name == "INVALID_STATE_ERR")
			return 3;
		else if (ex.name == "NETWORK_ERR")
			return 4;
		return 0;
	}
}

window.closePort = async () => {
	keepReading = false;
	reader.cancel(); // Will cause done = true so the while loop will break, and keepreading = false so the function exits
	await closePromise; // Wait for the loop to break
}