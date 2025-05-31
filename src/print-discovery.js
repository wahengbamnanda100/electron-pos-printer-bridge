// src/print-discovery.js
import { PrinterTypes, ThermalPrinter } from "node-thermal-printer";
import Bonjour from "bonjour";

const bonjourService = Bonjour(); // Create a single instance

// ... (discoverLanPrintersViaMDNS function as before) ...
export async function discoverLanPrintersViaMDNS() {
	return new Promise((resolve) => {
		const lanPrinters = [];
		let scanTimeoutOccurred = false;
		const discoveryDuration = 10000;

		console.log(
			`mDNS: Scanning for LAN printers (approx ${discoveryDuration / 1000}s)...`
		);

		const handleService = (service, discoveryMethod) => {
			if (scanTimeoutOccurred) return;
			if (
				service.addresses &&
				service.addresses.length > 0 &&
				service.port &&
				service.name
			) {
				const ipAddress =
					service.addresses.find(
						(addr) => addr.includes(".") && !addr.startsWith("fe80:")
					) ||
					service.addresses.find((addr) => !addr.startsWith("fe80:")) ||
					service.addresses[0];
				if (!ipAddress) {
					console.warn(
						`mDNS: Service '${
							service.name
						}' found without a suitable IP address. Addresses: ${service.addresses.join(
							", "
						)}`
					);
					return;
				}
				const printerId = `lan_mdns-${ipAddress.replace(/[.:]/g, "_")}-${
					service.port
				}`;
				if (!lanPrinters.some((p) => p.id === printerId)) {
					const newPrinter = {
						id: printerId,
						name: `${service.name} @ ${ipAddress}:${service.port}`,
						type: "lan_mdns",
						ip: ipAddress,
						port: service.port,
						status: "Discovered (mDNS)",
						host: service.host,
						txt: service.txt,
						discoveryMethod: discoveryMethod,
					};
					lanPrinters.push(newPrinter);
					console.log(
						`mDNS: Discovered '${newPrinter.name}' via ${discoveryMethod}`
					);
				}
			}
		};

		const pdlBrowser = bonjourService.find({ type: "pdl-datastream" }, (s) =>
			handleService(s, "pdl-datastream")
		);
		const ippBrowser = bonjourService.find({ type: "ipp" }, (s) =>
			handleService(s, "ipp")
		);
		const socketBrowser = bonjourService.find({ type: "socket" }, (s) =>
			handleService(s, "socket")
		);
		const rawPortPrinterBrowser = bonjourService.find(
			{ type: "printer" },
			(s) => {
				if (s.port === 9100) handleService(s, "raw-9100-printer-type");
			}
		);
		const lpdBrowser = bonjourService.find({ type: "lpd" }, (s) =>
			handleService(s, "lpd")
		);

		setTimeout(() => {
			if (scanTimeoutOccurred) return;
			scanTimeoutOccurred = true;
			console.log("mDNS: Stopping service browsers...");
			try {
				if (pdlBrowser) pdlBrowser.stop();
				if (ippBrowser) ippBrowser.stop();
				if (socketBrowser) socketBrowser.stop();
				if (rawPortPrinterBrowser) rawPortPrinterBrowser.stop();
				if (lpdBrowser) lpdBrowser.stop();
			} catch (e) {
				console.error("mDNS: Error stopping browsers:", e);
			}
			console.log(
				`mDNS: LAN printer scan complete. Found ${lanPrinters.length} printers.`
			);
			resolve(lanPrinters);
		}, discoveryDuration);
	});
}

export async function testPrinterConnection(printerConfig) {
	console.log(
		`TESTING CONNECTION: '${printerConfig.name}' (Type: ${printerConfig.type})`
	);
	console.log(JSON.stringify(printerConfig, null, 2));
	let thermalPrinter;
	let interfaceOpt = "N/A (not determined before error)"; // Initialize to a default string

	try {
		const printerDriverType = printerConfig.driverType || PrinterTypes.EPSON;
		const timeout = printerConfig.timeout || 3500;

		if (printerConfig.type === "electron_os") {
			if (!printerConfig.osName) {
				console.error(
					`TESTING ERROR: Printer '${printerConfig.name}' is type 'electron_os' but missing 'osName'.`
				);
				return { ...printerConfig, status: "Config Error (No osName)" };
			}
			interfaceOpt = `printer:${printerConfig.osName}`; // interfaceOpt is assigned
		} else if (printerConfig.type === "lan_mdns") {
			if (!printerConfig.ip || !printerConfig.port) {
				console.error(
					`TESTING ERROR: Printer '${printerConfig.name}' is type 'lan_mdns' but missing 'ip' or 'port'.`
				);
				return { ...printerConfig, status: "Config Error (No IP/Port)" };
			}
			interfaceOpt = `tcp://${printerConfig.ip}:${printerConfig.port}`; // interfaceOpt is assigned
		} else {
			console.warn(
				`TESTING WARNING: Unsupported or unknown printer type '${printerConfig.type}' for '${printerConfig.name}'. Cannot test connection reliably.`
			);
			// In this 'else' case, if it directly returns, interfaceOpt remains 'N/A...'
			// and won't cause a ReferenceError in the catch block IF the error happens *after* this point.
			// But if the error happened *before* this if/else if structure, then interfaceOpt would be undefined.
			return {
				...printerConfig,
				status: `Unsupported Type (${printerConfig.type})`,
			};
		}

		console.log(
			`TESTING: Attempting to connect to '${printerConfig.name}' using interface: '${interfaceOpt}' with type '${printerDriverType}'.`
		);

		thermalPrinter = new ThermalPrinter({
			type: printerDriverType,
			interface: interfaceOpt, // Now interfaceOpt is guaranteed to have a value when used here
			timeout: timeout,
		});

		const isConnected = await thermalPrinter.isPrinterConnected();

		if (isConnected) {
			console.log(
				`TESTING SUCCESS: 'isPrinterConnected' returned true for '${printerConfig.name}'.`
			);
			return { ...printerConfig, status: "Connected" };
		} else {
			console.log(
				`TESTING FAIL: 'isPrinterConnected' returned false for '${printerConfig.name}'. Potential connection issue or printer status response.`
			);
			return { ...printerConfig, status: "Connection Failed" };
		}
	} catch (error) {
		// Now, 'interfaceOpt' will have the value it had when the error occurred, or 'N/A...' if it wasn't set in the try.
		console.error(
			`TESTING EXCEPTION for '${printerConfig.name}' (attempted interface: '${interfaceOpt}'): ${error.message}`,
			error.stack ? error.stack.split("\n").slice(0, 3).join("\n") : ""
		);
		const errorMsg = error.message || "Unknown connection error";
		return { ...printerConfig, status: `Error (${errorMsg.substring(0, 60)})` };
	}
}

export function destroyBonjour() {
	if (bonjourService) {
		try {
			bonjourService.destroy();
			console.log("Bonjour service instance destroyed successfully.");
		} catch (e) {
			console.error(
				"Error occurred while trying to destroy Bonjour service:",
				e
			);
		}
	} else {
		console.log("No active Bonjour service instance to destroy.");
	}
}
