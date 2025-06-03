// src/print-discovery.js
import { PrinterTypes, ThermalPrinter } from "node-thermal-printer";
import Bonjour from "bonjour";
import os from "os";
import osPrinterDriver from "printer";

const bonjourService = Bonjour(); // Single instance for Bonjour service

export async function discoverOsPrinters() {
	const osPrinters = [];
	const logPrefix = "OS_DISCOVERY(printer_pkg):";
	console.log(`${logPrefix} Discovering OS-installed printers...`);
	try {
		const availablePrinters = osPrinterDriver.getPrinters();
		if (availablePrinters && availablePrinters.length > 0) {
			const defaultPrinterName = osPrinterDriver
				.getDefaultPrinterName()
				?.toLowerCase();

			availablePrinters.forEach((p) => {
				const nameLower = p.name.toLowerCase();
				const isVirtual =
					nameLower.includes("onenote") ||
					nameLower.includes("pdf") ||
					nameLower.includes("xps") ||
					nameLower.includes("fax") ||
					nameLower.includes("send to") ||
					nameLower.includes("microsoft print to") ||
					nameLower.includes("document writer");

				let printerAppType = isVirtual ? "os_virtual" : "os_physical_generic";
				if (!isVirtual) {
					if (
						p.portName?.toLowerCase().includes("usb") ||
						nameLower.includes("usb")
					)
						printerAppType = "os_usb_physical";
					else if (
						p.portName?.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/) ||
						nameLower.includes("network") ||
						nameLower.includes("lan")
					)
						printerAppType = "os_lan_physical";
				}

				osPrinters.push({
					id: `os_native-${p.name.replace(/[^\w-]/g, "_")}`, // Sanitize ID
					name: p.name,
					osName: p.name,
					type: printerAppType,
					status: p.status === 0 ? "Ready (OS)" : `OS Status: ${p.status}`,
					description:
						p.options?.["printer-make-and-model"] || p.driverName || "",
					isDefault: defaultPrinterName === p.name.toLowerCase(),
					isVirtual: isVirtual,
					attributes: p.attributes,
					optionsFromNodePrinter: p.options,
				});
			});
		}
		console.log(
			`${logPrefix} Found ${osPrinters.length} OS-installed printers.`
		);
	} catch (error) {
		console.error(`${logPrefix} Error: ${error.message}`, error.stack);
	}
	return osPrinters;
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

export async function testPrinterConnection(printerConfig) {
	// This function is now primarily called for physical printers, as electron-main.js
	// already sets the status for virtual printers.
	console.log(
		`TESTING PHYSICAL CONNECTION: '${printerConfig.name}' (Type: ${printerConfig.type})`
	);
	// console.log("Full printerConfig for testing:", JSON.stringify(printerConfig, null, 2)); // Uncomment for deep debug

	const logPrefix = `TEST_CONN_NTP_WITH_PRINTER_PKG [${printerConfig.name} (${printerConfig.type})]:`;

	let thermalPrinterInstance; // Use a distinct variable name
	let interfaceToTest = "N/A (Interface not determined before error)"; // Initialize for logging in catch

	try {
		console.log(
			"TESTING CONFIG: Starting connection test for printer:",
			JSON.stringify(printerConfig, null, 2)
		);
		// Determine driver type, defaulting to EPSON. This could be part of printerConfig if known.
		const printerDriverTypeForTest =
			printerConfig.driverType || PrinterTypes.EPSON;
		const connectionTimeout = printerConfig.timeout || 3500; // Milliseconds

		if (printerConfig.type === "electron_os" && !printerConfig.isVirtual) {
			// Only test physical OS printers
			if (!printerConfig.osName) {
				console.error(
					`TESTING ERROR (Physical OS): Printer '${printerConfig.name}' is missing 'osName'.`
				);
				return { ...printerConfig, status: "Config Error (Missing osName)" };
			}
			interfaceToTest = `printer:${printerConfig.osName}`;
		} else if (printerConfig.type === "lan_mdns") {
			// Assumed physical
			if (!printerConfig.ip || !printerConfig.port) {
				console.error(
					`TESTING ERROR (mDNS): Printer '${printerConfig.name}' is missing 'ip' or 'port'.`
				);
				return { ...printerConfig, status: "Config Error (Missing IP/Port)" };
			}
			interfaceToTest = `tcp://${printerConfig.ip}:${printerConfig.port}`;
		} else if (printerConfig.isVirtual) {
			// This case should not be reached if electron-main.js correctly filters
			console.log(
				`TESTING INFO: '${printerConfig.name}' is virtual. Connection test via node-thermal-printer skipped by design.`
			);
			return { ...printerConfig, status: "Ready (Virtual)" }; // Confirm its status
		} else {
			console.warn(
				`TESTING WARNING: Unsupported type '${printerConfig.type}' for physical connection test of '${printerConfig.name}'.`
			);
			return {
				...printerConfig,
				status: `Unsupported Type for Test (${printerConfig.type})`,
			};
		}

		console.log(
			`TESTING: Attempting node-thermal-printer connection for '${printerConfig.name}' using interface: '${interfaceToTest}', driver: '${printerDriverTypeForTest}'.`
		);

		const ntpOptions = {
			type: printerDriverTypeForTest,
			interface: interfaceToTest,
			timeout: connectionTimeout,
		};

		if (interfaceToTest.startsWith("printer:")) {
			console.log(
				`${logPrefix} Using OS printer queue. Setting 'driver: osPrinterDriver'.`
			);
			ntpOptions.driver = osPrinterDriver;
		}

		thermalPrinterInstance = new ThermalPrinter(ntpOptions);

		// isPrinterConnected() sends a basic status command to check reachability.
		const isConnected = await thermalPrinterInstance.isPrinterConnected();

		console.log(`${logPrefix} isPrinterConnected result: ${isConnected}`);

		if (isConnected) {
			console.log(
				`TESTING SUCCESS: 'isPrinterConnected' for '${printerConfig.name}' returned true.`
			);
			return { ...printerConfig, status: "Connected" };
		} else {
			console.log(
				`TESTING FAIL: 'isPrinterConnected' for '${printerConfig.name}' returned false. Printer might be offline, busy, or not responsive to status commands.`
			);
			return { ...printerConfig, status: "Connection Failed" };
		}
	} catch (error) {
		// Log the error with context.
		console.error(
			`TESTING EXCEPTION for '${printerConfig.name}' (Attempted Interface: '${interfaceToTest}'): ${error.message}`,
			error.stack
				? error.stack.split("\n").slice(0, 4).join("\n")
				: "(No stack trace)"
		); // Log first few lines of stack
		const briefErrorMsg = error.message
			? error.message.substring(0, 70)
			: "Unknown connection error";
		return { ...printerConfig, status: `Error (${briefErrorMsg})` };
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
