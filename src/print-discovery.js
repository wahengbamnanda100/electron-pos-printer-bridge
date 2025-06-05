import { createRequire } from "module";
const require = createRequire(import.meta.url);

let PosPrinter; // From @plick/electron-pos-printer
try {
	const plickLib = require("@plick/electron-pos-printer");
	PosPrinter = plickLib.PosPrinter;
	if (!PosPrinter) {
		throw new Error(
			"PosPrinter class not found in @plick/electron-pos-printer module."
		);
	}
	console.log(
		"Successfully loaded PosPrinter from @plick/electron-pos-printer for print-discovery (test connection)."
	);
} catch (e) {
	console.error(
		"FATAL: Failed to require or access PosPrinter from '@plick/electron-pos-printer' in print-discovery.js. Ensure it is installed.",
		e
	);
	PosPrinter = {
		print: async () => {
			throw new Error(
				"@plick/electron-pos-printer not loaded. Test connection unavailable."
			);
		},
	};
}

import Bonjour from "bonjour";
// NTP_Generator is not used here anymore for test payload with Plick.
// import { ThermalPrinter as NTP_Generator, PrinterTypes as NTP_Types } from "node-thermal-printer";

const bonjourService = Bonjour();

// webContents will be passed from electron-main.js (e.g., mainWindow.webContents)
export async function discoverOsPrinters(webContents) {
	const osPrinters = [];
	const logPrefix = "OS_PRINTER_DISCOVERY_ELECTRON:";
	console.log(`${logPrefix} Discovering OS-installed printers via Electron...`);

	if (!webContents || typeof webContents.getPrintersAsync !== "function") {
		console.error(
			`${logPrefix} webContents or getPrintersAsync is not available. Cannot discover OS printers.`
		);
		return osPrinters; // Return empty or throw error
	}

	try {
		const availablePrinters = await webContents.getPrintersAsync();

		if (availablePrinters && availablePrinters.length > 0) {
			availablePrinters.forEach((p) => {
				const nameLower = p.name?.toLowerCase() || "";
				const descriptionLower = p.description?.toLowerCase() || "";
				const displayName = p.displayName || p.name; // Electron provides displayName

				// Basic check for virtual printers based on common names
				const isVirtual =
					nameLower.includes("pdf") ||
					nameLower.includes("onenote") ||
					nameLower.includes("xps") ||
					nameLower.includes("microsoft print to pdf") ||
					nameLower.includes("save to onenote") ||
					nameLower.includes("xps document writer") ||
					descriptionLower.includes("pdf") ||
					(p.options &&
						p.options["printer-make-and-model"]
							?.toLowerCase()
							.includes("pdf")) ||
					p.options["printer-type"]?.includes("PRINT_TO_FILE");

				let appConnType = isVirtual ? "VIRTUAL" : "OS_PLICK"; // OS_PLICK indicates it's an OS printer intended for Plick EPP

				let currentStatus = "Unknown (Electron)";
				if (p.status !== undefined) {
					// Electron printer status codes: (Example mapping, check Electron docs for definitive list)
					// 0: Unknown (or Ready sometimes, varies by OS)
					// 3: Idle/Ready
					// 4: Printing
					// 5: Warn
					// 6: Error
					if (p.status === 3) currentStatus = "Ready (Electron)";
					else if (p.status === 4) currentStatus = "Printing (Electron)";
					else if (p.status === 0 && !isVirtual)
						currentStatus = "Ready/Idle (Electron)";
					// 0 can be idle for physical
					else currentStatus = `Electron Status Code: ${p.status}`;

					if (p.options && p.options["printer-state-message"]) {
						currentStatus += ` - ${p.options["printer-state-message"]}`;
					}
				}

				osPrinters.push({
					id: `electron_os-${(
						p.name || `UnknownOSPrinter${Date.now()}`
					).replace(/[^\w-]/g, "_")}`,
					name: displayName, // Use Electron's displayName
					osName: p.name, // This is the system name Electron uses, crucial for printing
					connectionType: appConnType,
					status: currentStatus,
					description: p.description || p.name,
					isDefault: p.isDefault || false,
					isVirtual: isVirtual,
					_electronOriginalData: p, // Store original Electron printer object if needed
				});
			});
		}
		console.log(
			`${logPrefix} Found ${osPrinters.length} OS-installed printers via Electron.`
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
		const discoveryDuration = 7000; // Reduced for faster cycling if needed
		console.log(
			`mDNS: Scanning LAN for various print services (approx ${
				discoveryDuration / 1000
			}s)...`
		);

		const handleService = (service, discoveryMethod) => {
			if (scanTimeoutOccurred) return;
			// Filter out services that are clearly not printers or don't have necessary info
			if (
				!service.name ||
				!service.port ||
				!service.addresses ||
				service.addresses.length === 0
			) {
				return;
			}
			// Prefer IPv4
			const ipAddress =
				service.addresses.find(
					(a) =>
						a.includes(".") &&
						!a.startsWith("fe80:") &&
						!a.startsWith("127.") &&
						!a.startsWith("169.254.") // Basic IPv4 check, ignore loopback/link-local unless nothing else
				) ||
				service.addresses.find(
					(a) => a.includes(".") && !a.startsWith("fe80:")
				) || // Wider IPv4 if specific filter failed
				service.addresses.find((a) => !a.startsWith("fe80:")) || // Any non-link-local IPv6
				service.addresses[0]; // Fallback to first address

			if (!ipAddress) return;

			// Some services might advertise on multiple IPs or interfaces.
			// The ID should be fairly unique to the device instance and service type.
			const printerId = `lan_mdns-${service.host?.replace(
				/\.$/,
				""
			)}-${ipAddress.replace(/[.:%]/g, "_")}-${
				service.port
			}-${discoveryMethod.replace(/[^\w]/g, "_")}`;

			if (!lanPrinters.some((pr) => pr.id === printerId)) {
				const printerName = `${service.name} (${discoveryMethod}) @ ${ipAddress}:${service.port}`;
				console.log(`mDNS Discovery: Found potential printer: ${printerName}`);
				lanPrinters.push({
					id: printerId,
					name: printerName,
					osName: null, // mDNS discovered printers usually don't have an OS name unless also found by OS discovery
					connectionType: "MDNS_LAN",
					ip: ipAddress,
					port: service.port,
					status: "Discovered (mDNS)",
					description: `Host: ${service.host}, Type: ${
						service.type
					}, Txt: ${JSON.stringify(service.txt || {})}`,
					host: service.host,
					txt: service.txt,
					discoveryMethod: discoveryMethod,
					isVirtual: false, // Assume physical unless txt records indicate otherwise
				});
			}
		};

		const serviceTypesToQuery = [
			{ type: "pdl-datastream", name: "PDL Stream" }, // Common for many network printers (port 9100 usually)
			{ type: "ipp", name: "IPP" }, // Internet Printing Protocol
			{ type: "ipps", name: "IPPS" }, // Secure IPP
			// { type: "socket", name: "Socket API" }, // Generic socket, often overlaps with pdl-datastream
			{ type: "printer", name: "LPR/LPD (Port 515)" }, // Legacy LPD service
			{ type: "airprint", name: "AirPrint", subtype: "ipp" }, // Apple AirPrint often uses IPP
			// Epson specific discovery types sometimes seen, though pdl-datastream usually covers it
			// { type: "epson-escpr", name: "Epson ESC/PR" },
			// { type: "epson-epcp", name: "Epson EPCP"}
		];

		const browsers = serviceTypesToQuery.map((st) => {
			console.log(`mDNS: Browsing for type '${st.type}'...`);
			const browser = bonjourService.find({ type: st.type }, (service) => {
				// Further filtering for specific ports if needed (e.g. LPD is usually 515, PDL 9100)
				if (st.type === "printer" && service.port !== 515) return; // LPD convention
				if (
					st.type === "pdl-datastream" &&
					!(
						service.port === 9100 ||
						service.port === 9101 ||
						service.port === 9102
					) &&
					service.name.toLowerCase().includes("printer")
				) {
					// PDL has conventional ports, but can be others. If name suggests printer, accept other ports too for pdl-datastream.
				} else if (
					st.type === "pdl-datastream" &&
					!(
						service.port === 9100 ||
						service.port === 9101 ||
						service.port === 9102
					)
				) {
					return; // Strict port check for pdl-datastream if name isn't obviously a printer
				}

				handleService(service, st.name);
			});
			browser.on("error", (err) =>
				console.error(`mDNS error for type ${st.type}:`, err)
			);
			return browser;
		});

		setTimeout(() => {
			if (scanTimeoutOccurred) return;
			scanTimeoutOccurred = true;
			browsers.forEach((b, index) => {
				try {
					if (b) b.stop();
					console.log(
						`mDNS: Stopped browsing for '${serviceTypesToQuery[index].type}'.`
					);
				} catch (e) {
					console.warn(
						`mDNS: Error stopping browser for '${serviceTypesToQuery[index].type}':`,
						e.message
					);
				}
			});
			// bonjourService.destroy(); // Destroying bonjour itself here might be too soon if other parts of app use it
			console.log(
				`mDNS: Scan complete. Found ${lanPrinters.length} potential LAN printers.`
			);
			resolve(lanPrinters);
		}, discoveryDuration);
	});
}

export async function testPrinterConnection(printerConfig) {
	const logPrefix = `TEST_CONN [${printerConfig.name} (${printerConfig.connectionType})]:`;
	if (!PosPrinter || typeof PosPrinter.print !== "function") {
		console.error(
			`${logPrefix} PosPrinter.print is not available. Test failed.`
		);
		return { ...printerConfig, status: "Error (Plick lib unavailable)" };
	}

	if (printerConfig.isVirtual || printerConfig.connectionType === "VIRTUAL") {
		console.log(`${logPrefix} Virtual printer, marking as Ready.`);
		return { ...printerConfig, status: "Ready (Virtual)" };
	}

	// For OS_PLICK or MDNS_LAN (if it has an osName and is thus OS-registered)
	// we use Plick EPP for testing.
	if (
		printerConfig.connectionType === "OS_PLICK" ||
		(printerConfig.connectionType === "MDNS_LAN" && printerConfig.osName)
	) {
		const testPrintPayloadForPlick = [
			{
				type: "text",
				value: "Connection Test",
				style: { fontSize: "10px", textAlign: "center" },
			},
			// Plick does not have an explicit 'cut: false' or 'beep: false' in data.
			// These are controlled by printer's defaults or possibly options in `PosPrinter.print`.
		];

		const plickOptions = {
			printerName: printerConfig.osName || printerConfig.name, // Crucial: Plick needs OS name
			silent: true,
			timeout: 5000, // Timeout for the print job itself in Plick EPP options (if available, check Plick docs)
			// Plick's options object keys: preview, margin, copies, printerName, timeOutPerLine, pageSize, etc.
			// It does NOT have a general 'timeout' for the operation like NTP does.
			// 'timeOutPerLine' could be relevant for very slow printers.
			preview: false,
			copies: 1,
			margin: "0 0 0 0",
			pageSize: printerConfig.options?.pageSize || "80mm", // Or a default
		};

		// Note: Plick EPP doesn't take IP/Port directly in print options.
		// It relies on the printer being set up in the OS with the given `printerName`.
		if (printerConfig.connectionType === "MDNS_LAN" && printerConfig.osName) {
			console.log(
				`${logPrefix} Testing MDNS_LAN printer '${printerConfig.name}' via its OS name '${plickOptions.printerName}' using Plick EPP.`
			);
		} else {
			console.log(
				`${logPrefix} Testing OS printer '${plickOptions.printerName}' using Plick EPP.`
			);
		}

		try {
			await PosPrinter.print(testPrintPayloadForPlick, plickOptions);
			console.log(
				`${logPrefix} Plick EPP .print test call succeeded for '${plickOptions.printerName}'.`
			);
			return { ...printerConfig, status: "Connected (Plick Test OK)" };
		} catch (error) {
			console.error(
				`${logPrefix} Plick EPP .print test EXCEPTION for '${plickOptions.printerName}': ${error.message}`,
				error
			);
			// Sanitize error message for status
			const errorMessage = error.message
				? error.message.substring(0, 60)
				: "Unknown Plick Error";
			return {
				...printerConfig,
				status: `Error (Plick Test: ${errorMessage})`,
			};
		}
	} else if (
		printerConfig.connectionType === "MDNS_LAN" &&
		printerConfig.ip &&
		printerConfig.port
	) {
		// For mDNS_LAN printers that are *not* OS registered (no osName), test with a quick TCP ping conceptually
		// For an actual print test, you'd use node-thermal-printer's TCP interface as in the old API path
		console.log(
			`${logPrefix} MDNS_LAN (no OS name) '${printerConfig.name}'. Test requires direct TCP/IP or manual check. Marking as 'Discovered'.`
		);
		return {
			...printerConfig,
			status: "Discovered (mDNS - Test via direct TCP needed)",
		};
	} else if (printerConfig.connectionType === "RAW_USB") {
		console.log(
			`${logPrefix} RAW_USB printer '${printerConfig.name}'. Test requires direct USB communication. Marking as 'Discovered'.`
		);
		return { ...printerConfig, status: "Discovered (RAW_USB - Test Manually)" };
	} else {
		console.log(
			`${logPrefix} No specific Plick test for connection type '${printerConfig.connectionType}'. Status unchanged.`
		);
		return {
			...printerConfig,
			status: printerConfig.status || "Unknown (Test Skipped)",
		}; // Keep existing status or mark as unknown
	}
}

export function destroyBonjour() {
	if (bonjourService) {
		try {
			console.log("Destroying Bonjour discovery service.");
			bonjourService.destroy();
		} catch (e) {
			console.error("Bonjour destroy error:", e);
		}
	}
}
