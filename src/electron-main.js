// src/electron-main.js
import { app, BrowserWindow, ipcMain, dialog } from "electron"; // Added dialog (though not directly used in this file currently, good to have if bridge API evolves)
import path from "path";
import { fileURLToPath } from "url";
// fs and os are no longer directly needed in electron-main.js as HTML generation is in bridge-api.js
// import fs from 'fs';
// import os from 'os';

import {
	discoverLanPrintersViaMDNS,
	testPrinterConnection, // This will now be aware of virtual printers from print-discovery.js
	destroyBonjour,
} from "./print-discovery.js";
import { startApiServer } from "./bridge-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let discoveredPrinters = []; // This will hold unique printers, now with an 'isVirtual' flag
let apiServerInstance = null;

// --- Logging and Status Update Utilities ---
function logToMain(message, ...optionalParams) {
	console.log(message, ...(optionalParams.length > 0 ? optionalParams : [""]));
}

function updateRendererStatus(message) {
	logToMain(`Status Update to Renderer: ${message}`);
	if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
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
			nodeIntegration: false, // Best practice
			contextIsolation: true, // Best practice
			// sandbox: false, // Usually not needed for this setup unless webContents.print has issues
		},
		show: true,
	});

	mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

	// mainWindow.webContents.openDevTools(); // Uncomment for debugging renderer

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
		console.error(
			"Main window/webContents not available for getPrintersAsync."
		);
		return; // Cannot proceed without webContents for Electron printer discovery
	}

	let allFoundPrinters = [];

	try {
		// --- Step 1: Use Electron's built-in API to get OS printers ---
		updateRendererStatus(
			"🔍 Discovering OS-configured printers (via Electron API)..."
		);
		const rawElectronPrinters = await mainWindow.webContents.getPrintersAsync();
		let physicalOsPrinterCount = 0;
		let virtualOsPrinterCount = 0;

		if (rawElectronPrinters && rawElectronPrinters.length > 0) {
			rawElectronPrinters.forEach((p) => {
				const nameLower = p.name.toLowerCase();
				const descriptionLower = (p.description || "").toLowerCase();
				// Enhanced list of keywords for virtual printers
				const isVirtual =
					nameLower.includes("onenote") ||
					nameLower.includes("pdf") ||
					nameLower.includes("xps") ||
					nameLower.includes("fax") ||
					nameLower.includes("send to") || // General "send to"
					nameLower.includes("microsoft print to") ||
					nameLower.includes("document writer") ||
					descriptionLower.includes("onenote") ||
					descriptionLower.includes("pdf") ||
					descriptionLower.includes("xps") ||
					descriptionLower.includes("document writer") ||
					descriptionLower.includes("fax");

				if (isVirtual) {
					console.log(`SYSTEM: Identified virtual printer: ${p.name}`);
					// updateRendererStatus(`ℹ️ Found virtual printer: ${p.name}`); // This can be verbose, maybe only log to main
					virtualOsPrinterCount++;
				} else {
					physicalOsPrinterCount++;
				}

				allFoundPrinters.push({
					id: `electron_os-${p.name.replace(/[^\w-]/g, "_")}`, // Sanitize ID
					name: p.name,
					osName: p.name, // Crucial for connecting via 'printer:NAME'
					type: "electron_os",
					status: p.status === 0 ? "Ready" : `OS Status: ${p.status}`, // Interpret Electron's status
					description: p.description,
					isDefault: p.isDefault || false,
					options: p.options,
					isVirtual: isVirtual, // Flag to indicate if it's likely a virtual printer
				});
			});
			updateRendererStatus(
				`💻 Electron API: Found ${physicalOsPrinterCount} physical OS printers and ${virtualOsPrinterCount} virtual OS printers.`
			);
		} else {
			updateRendererStatus(
				"💻 No OS-configured printers found via Electron API."
			);
		}

		// --- Step 2: Discover LAN printers via mDNS (these are assumed physical for now) ---
		updateRendererStatus("📡 Discovering LAN printers via mDNS...");
		const mDnsLanPrinters = await discoverLanPrintersViaMDNS(); // From print-discovery.js
		mDnsLanPrinters.forEach((p) => {
			allFoundPrinters.push({
				...p, // Spread properties from mDNS discovery
				osName: null, // mDNS printers don't have an OS name in this context
				description: p.description || p.name,
				isDefault: false,
				isVirtual: false, // Assume mDNS printers are physical
			});
		});
		updateRendererStatus(
			`🌐 mDNS scan: Found ${mDnsLanPrinters.length} LAN printers.`
		);

		// --- Step 3: Deduplicate printers ---
		const uniquePrintersMap = new Map();
		for (const p of allFoundPrinters) {
			let key;
			// Create a unique key for deduplication
			if (p.type === "electron_os") key = `os:${p.name.toLowerCase().trim()}`;
			else if (p.type === "lan_mdns")
				key = `mdns:${p.ip}:${p.port}`; // IP+Port for mDNS
			else key = p.id; // Fallback (should be rare with defined types)

			// Prefer Electron OS printers if a name/key collision occurs
			if (
				!uniquePrintersMap.has(key) ||
				(p.type === "electron_os" &&
					uniquePrintersMap.get(key).type !== "electron_os")
			) {
				uniquePrintersMap.set(key, p);
			}
		}
		let currentPrintersList = Array.from(uniquePrintersMap.values());
		updateRendererStatus(
			`📊 Total ${currentPrintersList.length} unique printers identified (after deduplication).`
		);

		// Assign initial status before testing, especially for virtual printers
		discoveredPrinters = currentPrintersList.map((p) => ({
			...p,
			status: p.isVirtual ? "Ready (Virtual)" : p.status || "Discovered",
		}));

		// Send preliminary list to UI
		if (
			mainWindow &&
			mainWindow.webContents &&
			!mainWindow.webContents.isDestroyed()
		) {
			mainWindow.webContents.send("printers-updated", getPrintersForClient());
		}

		// --- Step 4: Test connections for physical printers ---
		const physicalPrintersToTest = currentPrintersList.filter(
			(p) => !p.isVirtual
		);
		if (physicalPrintersToTest.length > 0) {
			updateRendererStatus(
				`🔗 Testing connections for ${physicalPrintersToTest.length} physical printer(s)...`
			);
			const testedPhysicalResults = await Promise.all(
				physicalPrintersToTest.map(async (printer) => {
					updateRendererStatus(`⏳ Testing physical: ${printer.name}...`);
					const result = await testPrinterConnection(printer); // from print-discovery.js
					updateRendererStatus(`  ${result.name}: ${result.status}`);
					return result;
				})
			);
			// Update statuses of tested physical printers, keep virtual ones as they are
			discoveredPrinters = discoveredPrinters.map((p) => {
				if (p.isVirtual) return p;
				const tested = testedPhysicalResults.find((tp) => tp.id === p.id);
				return tested || p; // Use tested result or original if something went wrong
			});
			updateRendererStatus(
				"✅ Physical printer connection/status checks complete."
			);
		} else {
			updateRendererStatus(
				"ℹ️ No physical printers found to test connection for."
			);
		}
	} catch (error) {
		updateRendererStatus(`❌ Error during discovery/testing: ${error.message}`);
		console.error("Discovery/testing phase error:", error.message, error.stack);
		discoveredPrinters = []; // Clear on major error to reflect uncertainty
	} finally {
		// Send final updated list to UI
		if (
			mainWindow &&
			mainWindow.webContents &&
			!mainWindow.webContents.isDestroyed()
		) {
			mainWindow.webContents.send("printers-updated", getPrintersForClient());
		}
		updateRendererStatus("👍 Discovery cycle finished.");
	}
}

// --- Data Accessors for API and Client ---
function getPrintersForApiServer() {
	// The API needs the full config including osName and isVirtual
	return discoveredPrinters.map((p) => ({
		...p,
		osName: p.type === "electron_os" ? p.name : p.osName, // Ensure osName is correct for electron_os types
		isVirtual: !!p.isVirtual, // Ensure boolean
	}));
}

function getPrintersForClient() {
	// Client needs enough info for display and selection
	return discoveredPrinters.map((p) => ({
		id: p.id,
		name: p.name,
		type: p.type,
		status: p.status,
		description: p.description,
		isDefault: !!p.isDefault,
		isVirtual: !!p.isVirtual, // Send this flag to the renderer
	}));
}

// --- Electron App Lifecycle ---
app.whenReady().then(async () => {
	logToMain("Electron application is ready.");
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("will-quit", () => {
	logToMain("Application is preparing to quit. Cleaning up...");
	if (typeof destroyBonjour === "function") {
		destroyBonjour(); // From print-discovery.js
		logToMain("Bonjour services cleanup initiated.");
	}

	if (apiServerInstance && typeof apiServerInstance.close === "function") {
		logToMain("Closing API server...");
		apiServerInstance.close((err) => {
			if (err) {
				logToMain("Error closing API server:", err.message);
			} else {
				logToMain("API server closed successfully.");
			}
			apiServerInstance = null;
		});
	}
});

// --- IPC Handlers ---
ipcMain.handle("rediscover-printers", async () => {
	updateRendererStatus(
		"🔄 Refresh requested by UI. Restarting discovery cycle..."
	);
	await performFullDiscoveryAndTest();
	return getPrintersForClient(); // Send updated list back to renderer
});

ipcMain.on("renderer-ready", async () => {
	logToMain("Renderer process has signaled it is ready.");

	// Ensure main window and its webContents are fully ready
	if (
		!mainWindow ||
		mainWindow.isDestroyed() ||
		!mainWindow.webContents ||
		mainWindow.webContents.isDestroyed()
	) {
		logToMain(
			"Window/webContents not ready during 'renderer-ready'. Waiting briefly."
		);
		await new Promise((resolve) => setTimeout(resolve, 500)); // Increased wait time slightly
		if (
			!mainWindow ||
			mainWindow.isDestroyed() ||
			!mainWindow.webContents ||
			mainWindow.webContents.isDestroyed()
		) {
			updateRendererStatus(
				"Error: Main window failed to initialize fully. Discovery might be impacted. Please restart."
			);
			return;
		}
	}

	updateRendererStatus("🛠️ UI ready. Starting initial printer discovery...");
	await performFullDiscoveryAndTest(); // Perform initial scan now that window is confirmed ready

	if (!apiServerInstance) {
		logToMain("Starting the API server after initial discovery...");
		try {
			apiServerInstance = startApiServer(getPrintersForApiServer); // Pass the function reference
			const apiPort = process.env.API_PORT || 3030; // Should match bridge-api.js
			updateRendererStatus(
				`✔️ API server started on port ${apiPort}. Bridge is active.`
			);
		} catch (error) {
			updateRendererStatus(
				`☠️ CRITICAL: Failed to start API server: ${error.message}`
			);
			console.error("API Server startup error:", error.stack || error);
		}
	} else {
		updateRendererStatus("ℹ️ API server was already running.");
	}
});
