// src/print-discovery.js
import { PrinterTypes, ThermalPrinter } from "node-thermal-printer";
import Bonjour from "bonjour";
import usb from "usb"; // <-- Import the 'usb' package (npm i usb)
import os from "os"; // For OS specific logic if needed in test or print
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";

const bonjourService = Bonjour(); // Single instance for Bonjour service

const KNOWN_POS_PRINTER_VIDS = [
	0x04b8, // Epson
	0x0519, // Star Micronics
	0x0dd4, // Bixolon
	0x0483, // STMicroelectronics (some generic POS printers)
	0x1fc9, // NXP (often in generic USB devices)
	0x0fe6, // Zjiang / Xiamen
	// Add other VIDs
];

export async function discoverRawUsbDevicesWithNodeUsb() {
	const rawUsbPrinters = [];
	const logPrefix = "RAW_USB_NODEUSB:";
	console.log(`${logPrefix} Discovering raw USB devices with 'node-usb'...`);

	try {
		const devices = usb.getDeviceList();
		console.log(
			`${logPrefix} Found ${devices.length} total USB devices connected to the system.`
		);

		for (const device of devices) {
			const vid = device.deviceDescriptor.idVendor;
			const pid = device.deviceDescriptor.idProduct;
			let isLikelyPrinter = false;

			// Heuristic 1: Check against known POS Printer Vendor IDs
			if (KNOWN_POS_PRINTER_VIDS.includes(vid)) {
				isLikelyPrinter = true;
				console.log(
					`${logPrefix} Device VID ${vid.toString(16)} matched known POS VIDs.`
				);
			}

			// Heuristic 2: Check USB interface class (7 is Printer Class)
			// This requires opening the device, which can be problematic and might
			// interfere with other drivers or require exclusive access.
			// For discovery, it's safer to rely on VID/PID and descriptors first.
			// If needed, open/close briefly just for this check (handle errors carefully).
			/*
            if (!isLikelyPrinter) { // Only check interfaces if VID didn't match
                try {
                    device.open();
                    if (device.configDescriptor && device.configDescriptor.interfaces) {
                        for (const ifaceGroup of device.configDescriptor.interfaces) {
                            for (const iface of ifaceGroup) {
                                if (iface.bInterfaceClass === 7) { // 7 is USB Printer Class
                                    isLikelyPrinter = true;
                                    console.log(`${logPrefix} Device VID ${vid.toString(16)} has Printer Class interface.`);
                                    break;
                                }
                            }
                            if (isLikelyPrinter) break;
                        }
                    }
                    device.close();
                } catch (openErr) {
                    // console.warn(`${logPrefix} Could not open device VID ${vid.toString(16)} to check interfaces: ${openErr.message}. This is common for devices already claimed by OS drivers.`);
                }
            }
            */

			if (isLikelyPrinter) {
				let manufacturer = "Unknown";
				let product = `USB Printer (VID:0x${vid
					.toString(16)
					.padStart(4, "0")} PID:0x${pid.toString(16).padStart(4, "0")})`;
				let serial = "N/A";

				// Attempt to get string descriptors (can fail if device is claimed or doesn't support)
				try {
					device.open(); // Must open to get string descriptors
					// Ensure there's a way to handle device busy if it's already opened by OS printer queue

					// Promisify getStringDescriptor
					const getStringDesc = (index) => {
						return new Promise((resolve, reject) => {
							if (!index) return resolve(""); // No index means no descriptor
							device.getStringDescriptor(index, (error, data) => {
								if (error) reject(error);
								else resolve(data);
							});
						});
					};

					if (device.deviceDescriptor.iManufacturer) {
						manufacturer =
							(await getStringDesc(device.deviceDescriptor.iManufacturer)) ||
							manufacturer;
					}
					if (device.deviceDescriptor.iProduct) {
						product =
							(await getStringDesc(device.deviceDescriptor.iProduct)) ||
							product;
					}
					if (device.deviceDescriptor.iSerialNumber) {
						serial =
							(await getStringDesc(device.deviceDescriptor.iSerialNumber)) ||
							serial;
					}
					device.close(); // Close after getting descriptors
				} catch (descErr) {
					// console.warn(`${logPrefix} Could not get string descriptors for VID ${vid.toString(16)}: ${descErr.message}. Device might be in use by OS driver.`);
					if (device.opened) device.close(); // Ensure it's closed if open failed mid-way
				}

				rawUsbPrinters.push({
					id: `raw_usb_node-${vid.toString(16)}-${pid.toString(16)}`,
					name: `${product} (S/N: ${serial}, Manuf: ${manufacturer})`, // More descriptive name
					connectionType: "RAW_USB", // Distinct type for these printers
					status: "Discovered (Raw USB via node-usb)",
					vid: vid,
					pid: pid,
					manufacturer: manufacturer,
					product: product,
					serialNumber: serial,
					isVirtual: false,
					// No 'osName' because this isn't from the OS printer list
				});
			}
		}
		console.log(
			`${logPrefix} Found ${rawUsbPrinters.length} potential raw USB printers based on VIDs/heuristics.`
		);
	} catch (error) {
		console.error(
			`${logPrefix} General error during USB device scan: ${error.message}`,
			error.stack
		);
		if (
			os.platform() === "win32" &&
			error.message &&
			(error.message.toLowerCase().includes("libusb_error_not_supported") ||
				error.message.toLowerCase().includes("access denied"))
		) {
			console.warn(
				`${logPrefix} Windows specific error: Ensure the USB device either has a generic WinUSB driver (e.g., set via Zadig if you intend to use it with node-usb directly and bypass OS driver) or that it's not exclusively claimed by another process. Using this raw method often means the OS vendor driver should NOT be the one claiming the device if node-usb is to control it.`
			);
		}
	}
	return rawUsbPrinters;
}

export async function discoverLanPrintersViaMDNS() {
	return new Promise((resolve) => {
		const lanPrinters = [];
		let scanTimeoutOccurred = false;
		const discoveryDuration = 10000; // 10 seconds for discovery

		console.log(
			`mDNS: Scanning for LAN printers (approx ${discoveryDuration / 1000}s)...`
		);

		const handleService = (service, discoveryMethod) => {
			if (scanTimeoutOccurred) return; // Stop processing if scan duration is over

			if (
				service.addresses &&
				service.addresses.length > 0 &&
				service.port &&
				service.name
			) {
				// Prioritize IPv4, exclude link-local IPv6, then any other, then first as fallback
				const ipAddress =
					service.addresses.find(
						(addr) => addr.includes(".") && !addr.startsWith("fe80:")
					) ||
					service.addresses.find((addr) => !addr.startsWith("fe80:")) ||
					service.addresses[0];

				if (!ipAddress) {
					// Should be rare if service.addresses has items
					console.warn(
						`mDNS: Service '${
							service.name
						}' (Method: ${discoveryMethod}) found without a suitable IP. Addresses: ${service.addresses.join(
							", "
						)}`
					);
					return;
				}

				// Create a more robust ID, replacing potentially problematic characters for URLs/filenames
				const printerId = `lan_mdns-${ipAddress.replace(/[.:]/g, "_")}-${
					service.port
				}-${discoveryMethod.replace(/[^\w]/g, "_")}`;

				if (!lanPrinters.some((p) => p.id === printerId)) {
					// Avoid duplicates from same mDNS scan
					const newPrinter = {
						id: printerId,
						name: `${service.name} @ ${ipAddress}:${service.port}`,
						type: "lan_mdns", // Distinct type for mDNS discovered printers
						ip: ipAddress,
						port: service.port,
						status: "Discovered (mDNS)", // Initial status
						host: service.host, // Fully Qualified Domain Name (e.g., MyPrinter.local.)
						txt: service.txt, // TXT record data from Bonjour
						discoveryMethod: discoveryMethod, // Which Bonjour service type found it
					};
					lanPrinters.push(newPrinter);
					console.log(
						`mDNS: Discovered '${newPrinter.name}' via Bonjour service type '${discoveryMethod}'`
					);
				}
			}
		};

		// List of common Bonjour service types for printers
		const serviceTypesToQuery = [
			{ type: "pdl-datastream", name: "PDL Data Stream" }, // Raw Port, often 9100
			{ type: "ipp", name: "IPP/IPPS" }, // Internet Printing Protocol
			{ type: "ipps", name: "IPP/IPPS Secure" }, // Secure IPP
			{ type: "socket", name: "Socket API / JetDirect" }, // HP JetDirect or similar
			{ type: "printer", name: "LPR/LPD or Raw (Port 9100 specific)" }, // Generic printer, often LPR or raw, we filter for port 9100 for this
			{ type: "lpd", name: "LPD/LPR" }, // Line Printer Daemon
		];

		const browsers = serviceTypesToQuery.map((st) => {
			if (st.type === "printer") {
				// Special handling for generic 'printer' to filter by port 9100
				return bonjourService.find({ type: st.type }, (s) => {
					if (s.port === 9100) handleService(s, `${st.name} (Port ${s.port})`);
				});
			}
			return bonjourService.find({ type: st.type }, (s) =>
				handleService(s, st.name)
			);
		});

		setTimeout(() => {
			if (scanTimeoutOccurred) return; // Prevent multiple executions of this block
			scanTimeoutOccurred = true;

			console.log(
				"mDNS: Scan duration elapsed. Stopping Bonjour service browsers..."
			);
			browsers.forEach((browser, index) => {
				try {
					if (browser) browser.stop();
				} catch (e) {
					console.error(
						`mDNS: Error stopping browser for service type '${serviceTypesToQuery[index].type}':`,
						e.message
					);
				}
			});

			console.log(
				`mDNS: LAN printer scan complete. Discovered ${lanPrinters.length} potential printers.`
			);
			resolve(lanPrinters);
		}, discoveryDuration);
	});
}

// export async function testPrinterConnection(printerConfig) {
// 	// This function is now primarily called for physical printers, as electron-main.js
// 	// already sets the status for virtual printers.
// 	console.log(
// 		`TESTING PHYSICAL CONNECTION: '${printerConfig.name}' (Type: ${printerConfig.type})`
// 	);
// 	// console.log("Full printerConfig for testing:", JSON.stringify(printerConfig, null, 2)); // Uncomment for deep debug

// 	let thermalPrinterInstance; // Use a distinct variable name
// 	let interfaceToTest = "N/A (Interface not determined before error)"; // Initialize for logging in catch

// 	try {
// 		// Determine driver type, defaulting to EPSON. This could be part of printerConfig if known.
// 		const printerDriverTypeForTest =
// 			printerConfig.driverType || PrinterTypes.EPSON;
// 		const connectionTimeout = printerConfig.timeout || 3500; // Milliseconds

// 		if (printerConfig.type === "electron_os" && !printerConfig.isVirtual) {
// 			// Only test physical OS printers
// 			if (!printerConfig.osName) {
// 				console.error(
// 					`TESTING ERROR (Physical OS): Printer '${printerConfig.name}' is missing 'osName'.`
// 				);
// 				return { ...printerConfig, status: "Config Error (Missing osName)" };
// 			}
// 			interfaceToTest = `printer:${printerConfig.osName}`;
// 		} else if (printerConfig.type === "lan_mdns") {
// 			// Assumed physical
// 			if (!printerConfig.ip || !printerConfig.port) {
// 				console.error(
// 					`TESTING ERROR (mDNS): Printer '${printerConfig.name}' is missing 'ip' or 'port'.`
// 				);
// 				return { ...printerConfig, status: "Config Error (Missing IP/Port)" };
// 			}
// 			interfaceToTest = `tcp://${printerConfig.ip}:${printerConfig.port}`;
// 		} else if (printerConfig.isVirtual) {
// 			// This case should not be reached if electron-main.js correctly filters
// 			console.log(
// 				`TESTING INFO: '${printerConfig.name}' is virtual. Connection test via node-thermal-printer skipped by design.`
// 			);
// 			return { ...printerConfig, status: "Ready (Virtual)" }; // Confirm its status
// 		} else {
// 			console.warn(
// 				`TESTING WARNING: Unsupported type '${printerConfig.type}' for physical connection test of '${printerConfig.name}'.`
// 			);
// 			return {
// 				...printerConfig,
// 				status: `Unsupported Type for Test (${printerConfig.type})`,
// 			};
// 		}

// 		console.log(
// 			`TESTING: Attempting node-thermal-printer connection for '${printerConfig.name}' using interface: '${interfaceToTest}', driver: '${printerDriverTypeForTest}'.`
// 		);

// 		const tpiObj = {
// 			type: printerDriverTypeForTest,
// 			interface: interfaceToTest,
// 			timeout: connectionTimeout,
// 			driver: "", // Ensure driver is set
// 			// characterSet: CharacterSet.SLOVENIA, // Optional: can be set globally or per print job
// 		};
// 		console.log(
// 			"TESTING: ThermalPrinter object for connection:",
// 			JSON.stringify(tpiObj, null, 2)
// 		);

// 		console.log(
// 			`TESTING: Creating ThermalPrinter instance for ${JSON.stringify(
// 				printerConfig,
// 				null,
// 				2
// 			)} .`
// 		);

// 		thermalPrinterInstance = new ThermalPrinter(tpiObj);

// 		// isPrinterConnected() sends a basic status command to check reachability.
// 		const isConnected = await thermalPrinterInstance.isPrinterConnected();

// 		if (isConnected) {
// 			console.log(
// 				`TESTING SUCCESS: 'isPrinterConnected' for '${printerConfig.name}' returned true.`
// 			);
// 			return { ...printerConfig, status: "Connected" };
// 		} else {
// 			console.log(
// 				`TESTING FAIL: 'isPrinterConnected' for '${printerConfig.name}' returned false. Printer might be offline, busy, or not responsive to status commands.`
// 			);
// 			return { ...printerConfig, status: "Connection Failed" };
// 		}
// 	} catch (error) {
// 		// Log the error with context.
// 		console.error(
// 			`TESTING EXCEPTION for '${printerConfig.name}' (Attempted Interface: '${interfaceToTest}'): ${error.message}`,
// 			error.stack
// 				? error.stack.split("\n").slice(0, 4).join("\n")
// 				: "(No stack trace)"
// 		); // Log first few lines of stack
// 		const briefErrorMsg = error.message
// 			? error.message.substring(0, 70)
// 			: "Unknown connection error";
// 		return { ...printerConfig, status: `Error (${briefErrorMsg})` };
// 	}
// }

export async function testPrinterConnection(printerConfig) {
	const logPrefix = `TEST_CONN [${printerConfig.name} (${printerConfig.connectionType})]:`;
	console.log(`${logPrefix} Starting connection test.`);

	if (printerConfig.isVirtual || printerConfig.connectionType === "VIRTUAL") {
		// Updated check
		return { ...printerConfig, status: "Ready (Virtual)" };
	}

	let thermalPrinterTestInstance;
	let interfaceOpt = "N/A";

	try {
		const ntpTypeForTest = printerConfig.ntpType || PrinterTypes.EPSON; // Allow specific NTP type
		const timeoutForTest = printerConfig.ntpTimeout || 3500;

		if (printerConfig.connectionType === "RAW_USB") {
			if (!printerConfig.vid || !printerConfig.pid)
				return { ...printerConfig, status: "Config Error (No VID/PID)" };
			// For raw USB found by node-usb, node-thermal-printer can also try to use it if provided
			// with vid/pid or the device path (latter is Linux specific for NTP).
			// However, if bridge-api.js will use `escpos` with `new escpos.USB(vid,pid)`,
			// then testing here should mirror that for consistency.
			// For now, let's assume `node-thermal-printer` will try.
			// If node-thermal-printer *cannot* take VID/PID directly, this test path would need
			// to use escpos + escpos-usb to test, OR use the OS command test as fallback.
			// Many versions of NTP CAN use VID/PID, often as: `usb://VID_AS_HEX:PID_AS_HEX`
			// However, this format isn't universally listed in its primary interface options.
			// The safest way IF node-thermal-printer has to test raw USB here IS via escpos-usb style
			// and for that it relies on its `driver` being set to something that can use it.
			//
			// Simplification: If raw USB discovered via `node-usb`, the actual printing will use `node-usb` (via escpos/escpos-usb).
			// The "test" for node-usb discovered devices can be a simple device.open()/close().
			console.log(
				`${logPrefix} Testing RAW_USB VID:0x${printerConfig.vid.toString(
					16
				)}, PID:0x${printerConfig.pid.toString(
					16
				)} with node-usb direct open/close.`
			);
			let device = null;
			try {
				device = usb.findByIds(printerConfig.vid, printerConfig.pid);
				if (!device) {
					return {
						...printerConfig,
						status: "Error (Device Not Found by VID/PID)",
					};
				}
				device.open();
				// device.interfaces // you could iterate interfaces and try to claim if necessary
				console.log(
					`${logPrefix} Raw USB device opened successfully for test.`
				);
				device.close();
				console.log(`${logPrefix} Raw USB device closed successfully.`);
				return { ...printerConfig, status: "Connected (USB Open/Close OK)" };
			} catch (usbError) {
				console.error(
					`${logPrefix} Raw USB test open/close error:`,
					usbError.message
				);
				if (device && device.opened) device.close(); // Ensure close on error
				return {
					...printerConfig,
					status: `Error (USB: ${usbError.message.substring(0, 30)})`,
				};
			}
		} else if (printerConfig.connectionType === "MDNS_LAN") {
			if (!printerConfig.ip || !printerConfig.port)
				return { ...printerConfig, status: "Config Error (No IP/Port)" };
			interfaceOpt = `tcp://${printerConfig.ip}:${printerConfig.port}`;
		} else if (
			printerConfig.connectionType &&
			printerConfig.connectionType.startsWith("OS_")
		) {
			// OS_USB, OS_LAN, OS_LOCAL
			if (!printerConfig.osName)
				return { ...printerConfig, status: "Config Error (No osName)" };
			interfaceOpt = `printer:${printerConfig.osName}`;
		} else {
			return {
				...printerConfig,
				status: `Unsupported ConnType for Test (${printerConfig.connectionType})`,
			};
		}

		// This part is for MDNS_LAN and OS_ physical printers if test involves NTP
		console.log(
			`${logPrefix} Testing with NTP. Interface: '${interfaceOpt}', NTP Type: '${ntpTypeForTest}'.`
		);
		thermalPrinterTestInstance = new ThermalPrinter({
			type: ntpTypeForTest,
			interface: interfaceOpt,
			timeout: timeoutForTest,
			// No 'driver' here because this function does not import 'printer' package directly for this purpose anymore
			// The OS_ types might be better tested with the OS command line test (see prev. versions)
			// If interface: printer:NAME requires it, it must be set by Bridge API print path
		});

		const isConnected = await thermalPrinterTestInstance.isPrinterConnected();
		return {
			...printerConfig,
			status: isConnected ? "Connected" : "Connection Failed",
		};
	} catch (error) {
		const msg = error.message ? error.message.substring(0, 70) : "Unknown";
		console.error(
			`${logPrefix} EXCEPTION (Interface: '${interfaceOpt}'): ${msg}`,
			error.stack?.substring(0, 300)
		);
		return { ...printerConfig, status: `Error (${msg})` };
	}
}

export function destroyBonjour() {
	if (bonjourService) {
		try {
			// According to bonjour-service (which is what `bonjour` npm package might wrap or be similar to)
			// destroying the main instance should stop all browsers.
			bonjourService.destroy();
			console.log(
				"Bonjour service instance and all its browsers destroyed successfully."
			);
		} catch (e) {
			console.error(
				"Error occurred while trying to destroy Bonjour service instance:",
				e.message
			);
		}
	} else {
		console.log("No active Bonjour service instance to destroy.");
	}
}
