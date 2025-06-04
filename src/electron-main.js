// src/electron-main.js
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";

import {
	discoverRawUsbDevicesWithNodeUsb, // Using 'npm i usb'
	discoverLanPrintersViaMDNS,
	testPrinterConnection,
	destroyBonjour,
} from "./print-discovery.js";
import { startApiServer } from "./bridge-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let discoveredPrinters = []; // This will hold unique printers with new connectionType
let apiServerInstance = null;

// --- Logging and Status Update Utilities ---
function logToMain(message, ...optionalParams) {
	console.log(message, ...(optionalParams.length > 0 ? optionalParams : [""]));
}

function updateRendererStatus(message) {
	logToMain(`Status => Renderer: ${message}`);
	if (
		mainWindow &&
		mainWindow.webContents &&
		!mainWindow.webContents.isDestroyed()
	) {
		try {
			mainWindow.webContents.send("printer-status-update", message);
		} catch (error) {
			console.error("Failed to send status update to renderer:", error);
		}
	}
}

// --- Electron Window Creation ---
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1000,
		height: 750,
		webPreferences: {
			preload: path.join(__dirname, "..", "preload.js"),
			nodeIntegration: false,
			contextIsolation: true,
		},
		show: true,
	});
	mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

// --- Printer Discovery and Testing Logic ---
async function performFullDiscoveryAndTest() {
	updateRendererStatus("🔄 Starting printer discovery cycle...");
	if (
		!mainWindow ||
		mainWindow.isDestroyed() ||
		!mainWindow.webContents ||
		mainWindow.webContents.isDestroyed()
	) {
		updateRendererStatus(
			"❌ Error: Main window or its webContents not available for printer discovery."
		);
		return;
	}

	let allFoundPrinters = []; // Temporary list to hold printers from all sources

	try {
		// --- Step 1: Discover OS-configured printers via Electron API ---
		updateRendererStatus("OS Printers: Discovering (Electron API)...");
		const rawElectronPrinters = await mainWindow.webContents.getPrintersAsync();

		if (rawElectronPrinters && rawElectronPrinters.length > 0) {
			rawElectronPrinters.forEach((p) => {
				const nameLower = p.name.toLowerCase();
				const descriptionLower = (p.description || "").toLowerCase();
				const optionsString = JSON.stringify(p.options || {}).toLowerCase();
				const portNameLower = (p.portName || "").toLowerCase();

				let connectionType = "OS_LOCAL"; // Default for OS printers
				let isVirtualPrinter = false;

				// Identify Virtual Printers
				if (
					nameLower.includes("onenote") ||
					nameLower.includes("pdf") ||
					nameLower.includes("xps") ||
					nameLower.includes("fax") ||
					nameLower.includes("send to") ||
					nameLower.includes("microsoft print to") ||
					nameLower.includes("document writer") ||
					descriptionLower.includes("onenote") ||
					descriptionLower.includes("pdf") ||
					descriptionLower.includes("xps") ||
					descriptionLower.includes("document writer")
				) {
					connectionType = "VIRTUAL";
					isVirtualPrinter = true;
				}
				// Identify Physical USB OS Printers (Heuristic)
				else if (
					nameLower.includes("usb") ||
					descriptionLower.includes("usb") ||
					portNameLower.includes("usb") ||
					optionsString.includes("usb")
				) {
					connectionType = "OS_USB";
				}
				// Identify Physical LAN/Network OS Printers (Heuristic)
				else if (
					nameLower.includes("network") ||
					nameLower.includes("lan") ||
					descriptionLower.includes("network") ||
					portNameLower.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/) ||
					portNameLower.includes("ip_") ||
					optionsString.includes("ip") ||
					optionsString.includes("network")
				) {
					connectionType = "OS_LAN";
				}

				allFoundPrinters.push({
					id: `os_electron-${p.name.replace(/[^\w-]/g, "_")}`,
					name: p.name,
					osName: p.name,
					connectionType: connectionType,
					legacyType: "electron_os", // For backward compatibility if needed by bridge-api's older paths
					status: p.status === 0 ? "Ready" : `OS Status: ${p.status}`,
					description: p.description,
					isDefault: p.isDefault || false,
					isVirtual: isVirtualPrinter,
					options: p.options,
				});
			});
			updateRendererStatus(
				`OS Printers: Found ${rawElectronPrinters.length} (physical & virtual).`
			);
		} else {
			updateRendererStatus("OS Printers: None found via Electron API.");
		}

		// --- Step 2: Discover Raw USB devices (using 'node-usb') ---
		updateRendererStatus("Raw USB: Discovering (node-usb)...");
		const rawUsbNodePrinters = await discoverRawUsbDevicesWithNodeUsb(); // From print-discovery.js
		if (rawUsbNodePrinters && rawUsbNodePrinters.length > 0) {
			allFoundPrinters.push(...rawUsbNodePrinters); // They already have connectionType: 'RAW_USB'
			updateRendererStatus(
				`Raw USB: Found ${rawUsbNodePrinters.length} potential devices.`
			);
		} else {
			updateRendererStatus("Raw USB: No devices found or discovery failed.");
		}

		// --- Step 3: Discover LAN printers via mDNS ---
		updateRendererStatus("mDNS LAN: Discovering...");
		const mDnsLanPrinters = await discoverLanPrintersViaMDNS(); // From print-discovery.js
		if (mDnsLanPrinters && mDnsLanPrinters.length > 0) {
			mDnsLanPrinters.forEach((p) =>
				allFoundPrinters.push({
					...p,
					connectionType: "MDNS_LAN",
					isVirtual: false,
				})
			);
			updateRendererStatus(
				`mDNS LAN: Found ${mDnsLanPrinters.length} printers.`
			);
		} else {
			updateRendererStatus("mDNS LAN: No printers found.");
		}

		// --- Step 4: Deduplicate printers ---
		const uniquePrintersMap = new Map();
		// Order of preference if multiple methods find "the same" printer:
		// 1. OS_USB / OS_LAN / OS_LOCAL (from Electron API)
		// 2. RAW_USB (if identifiable to an OS one, though hard without more info)
		// 3. MDNS_LAN
		for (const p of allFoundPrinters) {
			let key;
			// Keying strategy: Try to be as specific as possible.
			// For OS printers, name is usually unique on the system.
			// For RAW_USB, VID:PID is unique.
			// For MDNS_LAN, IP:Port is unique.
			if (p.connectionType.startsWith("OS_"))
				key = `os:${p.name.toLowerCase().trim()}`;
			else if (p.connectionType === "RAW_USB")
				key = `raw_usb:${p.vid}-${p.pid}`;
			else if (p.connectionType === "MDNS_LAN") key = `mdns:${p.ip}:${p.port}`;
			else key = p.id; // Fallback

			if (!uniquePrintersMap.has(key)) {
				uniquePrintersMap.set(key, p);
			} else {
				// Prioritization if key collision (e.g., an OS printer which is also raw USB)
				const existing = uniquePrintersMap.get(key);
				if (
					p.connectionType.startsWith("OS_") &&
					!existing.connectionType.startsWith("OS_")
				) {
					console.log(
						`Deduplication: Prioritizing OS-discovered '${p.name}' over previous entry of type '${existing.connectionType}'.`
					);
					uniquePrintersMap.set(key, p);
				}
				// Could add more sophisticated merging if needed, e.g. combining VID/PID from RAW_USB into an OS_USB entry.
			}
		}
		let currentPrintersList = Array.from(uniquePrintersMap.values());
		updateRendererStatus(
			`📊 Total ${currentPrintersList.length} unique printers identified.`
		);

		discoveredPrinters = currentPrintersList.map((p) => ({
			...p,
			status:
				p.connectionType === "VIRTUAL"
					? "Ready (Virtual)"
					: p.status || "Discovered",
		}));

		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("printers-updated", getPrintersForClient());
		}

		// --- Step 5: Test connections for non-virtual printers ---
		const physicalPrintersToTest = discoveredPrinters.filter(
			(p) => p.connectionType !== "VIRTUAL"
		);
		if (physicalPrintersToTest.length > 0) {
			updateRendererStatus(
				`🔗 Testing connections for ${physicalPrintersToTest.length} physical printer(s)...`
			);
			const testedPhysicalResults = await Promise.all(
				physicalPrintersToTest.map(async (printer) => {
					updateRendererStatus(
						`⏳ Testing: ${printer.name} (ConnType: ${printer.connectionType})...`
					);
					const result = await testPrinterConnection(printer); // testPrinterConnection from print-discovery.js
					updateRendererStatus(`  ${result.name}: ${result.status}`);
					return result;
				})
			);
			discoveredPrinters = discoveredPrinters.map((p) => {
				if (p.connectionType === "VIRTUAL") return p;
				const tested = testedPhysicalResults.find((tp) => tp.id === p.id);
				return tested || p;
			});
			updateRendererStatus("✅ Physical printer connection checks complete.");
		} else {
			updateRendererStatus("ℹ️ No physical printers found to test.");
		}
	} catch (error) {
		updateRendererStatus(
			`❌ Error during main discovery/testing cycle: ${error.message}`
		);
		console.error(
			"Main discovery/testing cycle error:",
			error.message,
			error.stack
		);
		discoveredPrinters = [];
	} finally {
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("printers-updated", getPrintersForClient());
		}
		updateRendererStatus("👍 Discovery cycle finished.");
	}
}

function getPrintersForApiServer() {
	return discoveredPrinters.map((p) => ({
		...p, // Pass all collected info, API can decide what it needs
		// Ensure 'osName' is correctly populated for relevant types used by API
		osName:
			p.connectionType && p.connectionType.startsWith("OS_")
				? p.name
				: p.osName,
		isVirtual: p.connectionType === "VIRTUAL", // Derived from connectionType
	}));
}
function getPrintersForClient() {
	return discoveredPrinters.map((p) => ({
		id: p.id,
		name: p.name,
		// type: p.type, // Old 'type' field might be less relevant now
		connectionType: p.connectionType, // Send new connection type
		status: p.status,
		description: p.description,
		isDefault: !!p.isDefault,
		isVirtual: p.connectionType === "VIRTUAL", // Derived
	}));
}

// --- Electron App Lifecycle ---
app.whenReady().then(async () => {
	logToMain("Electron App Ready.");
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
app.on("will-quit", () => {
	logToMain("Quitting. Cleaning up...");
	if (typeof destroyBonjour === "function") destroyBonjour();
	if (apiServerInstance && typeof apiServerInstance.close === "function") {
		apiServerInstance.close((err) =>
			logToMain(err ? `API close err: ${err.message}` : "API server closed.")
		);
	}
});

// --- IPC Handlers ---
ipcMain.handle("rediscover-printers", async () => {
	updateRendererStatus("🔄 UI Refresh Requested. Re-discovering printers...");
	await performFullDiscoveryAndTest();
	return getPrintersForClient();
});
ipcMain.on("renderer-ready", async () => {
	logToMain("Renderer Ready. Initiating discovery & server.");
	if (
		!mainWindow ||
		mainWindow.isDestroyed() ||
		!mainWindow.webContents ||
		mainWindow.webContents.isDestroyed()
	) {
		await new Promise((resolve) => setTimeout(resolve, 700)); // Slightly longer wait if init race
		if (
			!mainWindow ||
			mainWindow.isDestroyed() ||
			!mainWindow.webContents ||
			mainWindow.webContents.isDestroyed()
		) {
			updateRendererStatus(
				"FATAL: Main window not available for core functions. Please restart."
			);
			return;
		}
	}
	updateRendererStatus("🛠️ UI Ready. Initializing printer discovery...");
	await performFullDiscoveryAndTest();
	if (!apiServerInstance) {
		try {
			apiServerInstance = startApiServer(getPrintersForApiServer); // Pass getter function
			const port = process.env.API_PORT || 3030;
			updateRendererStatus(`✔️ API server started on port ${port}.`);
		} catch (e) {
			updateRendererStatus(`☠️ API server start FAILED: ${e.message}`);
			console.error("API Server start exception:", e);
		}
	} else {
		updateRendererStatus("ℹ️ API server already running.");
	}
});
