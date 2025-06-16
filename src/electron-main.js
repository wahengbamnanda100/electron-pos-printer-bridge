import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";

import {
	discoverOsPrinters,
	discoverLanPrintersViaMDNS,
	testPrinterConnection,
	destroyBonjour,
} from "./print-discovery.js";
// import { startApiServer } from "./bridge-api.js";
import { startApiServer } from "./api/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let discoveredPrinters = [];
let apiServerInstance = null;

function logToMain(context, message, ...optionalParams) {
	const timestamp = new Date().toISOString();
	console.log(
		`[${timestamp}] [${context}] ${message}`,
		...(optionalParams.length > 0 ? optionalParams : [])
	);
}

function updateRendererStatus(message) {
	logToMain("STATUS_UPDATE", `Renderer msg: ${message}`);
	if (mainWindow?.webContents && !mainWindow.webContents.isDestroyed()) {
		try {
			mainWindow.webContents.send("printer-status-update", message);
		} catch (e) {
			logToMain(
				"RENDERER_COMM",
				"Error sending status to renderer:",
				e.message
			);
		}
	}
}

// --- Electron Window Creation ---
function createWindow() {
	logToMain("APP_LIFECYCLE", "Creating main window...");
	mainWindow = new BrowserWindow({
		width: 1000,
		height: 750,
		webPreferences: {
			preload: path.join(__dirname, "..", "preload.js"), // Adjusted path assuming 'dist' or 'build' for JS files
			nodeIntegration: false,
			contextIsolation: true,
			devTools: true, // Enable dev tools for easier debugging
		},
		show: false, // Show after ready-to-show
	});

	mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html")); // Adjusted path

	mainWindow.once("ready-to-show", () => {
		logToMain("WINDOW_MGMT", "Main window ready to show.");
		mainWindow.show();
	});

	mainWindow.on("closed", () => {
		logToMain("WINDOW_MGMT", "Main window closed.");
		mainWindow = null; // Important for cleanup
	});

	mainWindow.webContents.on(
		"did-fail-load",
		(event, errorCode, errorDescription) => {
			logToMain(
				"WINDOW_MGMT",
				`Main window failed to load: ${errorDescription} (Code: ${errorCode})`
			);
		}
	);
}

// --- Printer Discovery and Testing Logic ---
async function performFullDiscoveryAndTest() {
	updateRendererStatus("🔄 Starting full printer discovery & testing cycle...");
	let allFoundPrinters = [];

	try {
		// Discover OS Printers (via Electron)
		if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
			updateRendererStatus("OS Printers: Discovering (via Electron)...");
			// Pass mainWindow.webContents to discoverOsPrinters
			const osSystemPrinters = await discoverOsPrinters(mainWindow.webContents);
			if (osSystemPrinters?.length) {
				allFoundPrinters.push(...osSystemPrinters);
				const p = osSystemPrinters.filter((pr) => !pr.isVirtual).length;
				const v = osSystemPrinters.length - p;
				updateRendererStatus(
					`OS Electron: Found ${p} physical & ${v} virtual.`
				);
			} else {
				updateRendererStatus(
					"OS Electron: No printers found or webContents unavailable."
				);
			}
		} else {
			updateRendererStatus(
				"OS Printers: Skipping (mainWindow or webContents not ready)."
			);
		}

		// Discover LAN Printers (mDNS)
		updateRendererStatus("LAN Printers: Discovering (mDNS)...");
		const mDnsLanPrinters = await discoverLanPrintersViaMDNS();
		if (mDnsLanPrinters?.length) {
			mDnsLanPrinters.forEach((p) => {
				// Try to see if this mDNS printer is already known as an OS printer
				const existingOsPrinter = allFoundPrinters.find(
					(osP) =>
						osP.connectionType === "OS_PLICK" &&
						(osP.name
							.toLowerCase()
							.includes(p.name.split(" ")[0].toLowerCase()) || // Match by advertised name
							(p.txt &&
								p.txt.adminurl &&
								osP.description
									.toLowerCase()
									.includes(p.txt.adminurl.toLowerCase()))) // Match by admin URL if available
				);
				if (existingOsPrinter) {
					logToMain(
						"DISCOVERY",
						`mDNS printer ${p.name} seems to be OS printer ${existingOsPrinter.name}. Merging info.`
					);
					existingOsPrinter.ip = existingOsPrinter.ip || p.ip;
					existingOsPrinter.port = existingOsPrinter.port || p.port;
					existingOsPrinter.host = existingOsPrinter.host || p.host;
					existingOsPrinter.txt = existingOsPrinter.txt || p.txt;
					existingOsPrinter.discoveryMethod = existingOsPrinter.discoveryMethod
						? `${existingOsPrinter.discoveryMethod}, ${p.discoveryMethod}`
						: p.discoveryMethod;
				} else {
					allFoundPrinters.push({ ...p, isVirtual: false }); // Assume physical if not matched
				}
			});
			updateRendererStatus(
				`LAN mDNS: Found ${mDnsLanPrinters.length} potential services.`
			);
		} else {
			updateRendererStatus("LAN mDNS: No printers found.");
		}

		// De-duplicate printers
		const uniquePrintersMap = new Map();
		for (const p of allFoundPrinters) {
			// Use a robust key. For OS printers, 'osName' is the system identifier.
			// For LAN, a combo of host/ip and port.
			let key;
			if (p.connectionType === "OS_PLICK" || p.connectionType === "VIRTUAL") {
				// OS_PLICK now from Electron
				key = `os:${(p.osName || p.name).toLowerCase().trim()}`;
			} else if (p.connectionType === "MDNS_LAN") {
				key = `mdns:${p.host?.toLowerCase() || p.ip}:${p.port}`;
			} else {
				key = p.id; // Fallback
			}

			if (!uniquePrintersMap.has(key)) {
				uniquePrintersMap.set(key, p);
			} else {
				// If an OS printer version already exists, potentially enrich it with mDNS info
				const existing = uniquePrintersMap.get(key);
				if (
					(existing.connectionType === "OS_PLICK" ||
						existing.connectionType === "VIRTUAL") &&
					p.connectionType === "MDNS_LAN"
				) {
					existing.ip = existing.ip || p.ip;
					existing.port = existing.port || p.port;
					existing.host = existing.host || p.host;
					existing.txt = existing.txt || p.txt;
					logToMain(
						"DISCOVERY_DEDUP",
						`Merged mDNS info for ${p.name} into OS printer ${existing.name}`
					);
				} else if (
					existing.connectionType === "MDNS_LAN" &&
					(p.connectionType === "OS_PLICK" || p.connectionType === "VIRTUAL")
				) {
					// if mDNS was first, but now we found an OS version, prioritize OS version with mDNS details.
					p.ip = p.ip || existing.ip;
					p.port = p.port || existing.port;
					p.host = p.host || existing.host;
					p.txt = p.txt || existing.txt;
					uniquePrintersMap.set(key, p); // Replace with the OS version (which is 'p' here)
					logToMain(
						"DISCOVERY_DEDUP",
						`Replaced mDNS printer ${existing.name} with OS version ${p.name}`
					);
				}
			}
		}
		let currentPrintersList = Array.from(uniquePrintersMap.values());
		updateRendererStatus(
			`📊 Total ${currentPrintersList.length} unique printers identified after de-duplication.`
		);

		// Initialize status before testing
		discoveredPrinters = currentPrintersList.map((p) => ({
			...p,
			status: p.isVirtual ? "Ready (Virtual)" : p.status || "Discovered", // Keep existing status if any
		}));

		if (mainWindow && !mainWindow.isDestroyed())
			mainWindow.webContents.send("printers-updated", getPrintersForClient());

		// Test physical printers
		const physicalPrintersToTest = discoveredPrinters.filter(
			(p) => !p.isVirtual
		);

		if (physicalPrintersToTest.length > 0) {
			updateRendererStatus(
				`🔗 Testing connections for ${physicalPrintersToTest.length} physical printers (using Plick EPP for OS, others TBD)...`
			);

			const testedResults = [];
			for (const printer of physicalPrintersToTest) {
				// Test one by one to see updates
				updateRendererStatus(
					`⏳ Testing: ${printer.name} (${printer.connectionType})...`
				);
				const result = await testPrinterConnection(printer);
				updateRendererStatus(`  => ${result.name}: ${result.status}`);
				testedResults.push(result);
				// Update list incrementally for renderer
				discoveredPrinters = discoveredPrinters.map((dp) =>
					dp.id === result.id ? result : dp
				);
				if (mainWindow && !mainWindow.isDestroyed()) {
					mainWindow.webContents.send(
						"printers-updated",
						getPrintersForClient()
					);
				}
			}

			updateRendererStatus(
				"✅ All physical printer connection checks complete."
			);
		} else {
			updateRendererStatus("ℹ️ No physical printers to test.");
		}
	} catch (error) {
		updateRendererStatus(`❌ Discovery/Test Error: ${error.message}`);
		logToMain("DISCOVERY_ERROR", "Full Discovery or Test Error:", error);
		discoveredPrinters = []; // Reset on major error
	} finally {
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("printers-updated", getPrintersForClient());
		}
		updateRendererStatus("👍 Discovery cycle finished.");
		logToMain("DISCOVERY_CYCLE", "Discovery and testing cycle ended.");
	}
}

// Format printer list for API (more details might be needed by backend consumers)
function getPrintersForApiServer() {
	return discoveredPrinters.map((p) => ({
		id: p.id,
		name: p.name,
		osName: p.osName, // Crucial for printing by OS name
		connectionType: p.connectionType,
		status: p.status,
		description: p.description,
		isDefault: !!p.isDefault,
		isVirtual: !!p.isVirtual,
		ip: p.ip, // Include if available
		port: p.port, // Include if available
		vid: p.vid, // Include for RAW_USB
		pid: p.pid, // Include for RAW_USB
		// _electronOriginalData and _plickOriginalData might be too large/complex for API, selectively pass if needed
	}));
}
// Format printer list for Renderer Client (UI)
function getPrintersForClient() {
	return discoveredPrinters.map((p) => ({
		id: p.id,
		name: p.name,
		osName: p.osName,
		connectionType: p.connectionType,
		status: p.status,
		description: p.description,
		isDefault: !!p.isDefault,
		isVirtual: !!p.isVirtual,
	}));
}

app.whenReady().then(async () => {
	logToMain("APP_LIFECYCLE", "App is ready.");
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			logToMain("APP_LIFECYCLE", "App activated, creating window.");
			createWindow();
		}
	});
});

app.on("window-all-closed", () => {
	logToMain("APP_LIFECYCLE", "All windows closed.");
	if (process.platform !== "darwin") {
		logToMain("APP_LIFECYCLE", "Quitting app (not macOS).");
		app.quit();
	}
});

app.on("will-quit", () => {
	logToMain("APP_LIFECYCLE", "App will quit. Cleaning up...");
	if (destroyBonjour) destroyBonjour();
	if (apiServerInstance?.close) {
		apiServerInstance.close((err) => {
			if (err) logToMain("API_SERVER", "Error closing API server:", err);
			else logToMain("API_SERVER", "API server closed.");
		});
	}
});

ipcMain.handle("rediscover-printers", async () => {
	logToMain("IPC_HANDLER", "Received 'rediscover-printers' request.");
	await performFullDiscoveryAndTest();
	return getPrintersForClient();
});

ipcMain.on("renderer-ready", async () => {
	logToMain("IPC_HANDLER", "Received 'renderer-ready' signal.");
	if (
		!mainWindow ||
		mainWindow.isDestroyed() ||
		(mainWindow.webContents && mainWindow.webContents.isDestroyed()) // check webContents too
	) {
		logToMain(
			"RENDERER_INIT",
			"Renderer ready, but main window is not available. Waiting briefly..."
		);
		await new Promise((resolve) => setTimeout(resolve, 1000)); // Increased wait
		if (
			!mainWindow ||
			mainWindow.isDestroyed() ||
			(mainWindow.webContents && mainWindow.webContents.isDestroyed())
		) {
			updateRendererStatus(
				"FATAL: Main window could not be initialized for printer setup."
			);
			logToMain("RENDERER_INIT", "Main window still not available after wait.");
			return;
		}
	}

	updateRendererStatus("🛠️ UI ready. Initializing printers and API server...");
	await performFullDiscoveryAndTest(); // Initial discovery

	if (!apiServerInstance) {
		try {
			const port = process.env.API_PORT || 3030;
			// Pass mainwindow to apiserver if it needs it for virtual printing
			apiServerInstance = startApiServer(getPrintersForApiServer, mainWindow);
			updateRendererStatus(`✔️ API server started on port ${port}.`);
			logToMain("API_SERVER", `API server listening on port ${port}.`);
		} catch (e) {
			updateRendererStatus(`☠️ API server start FAILED: ${e.message}`);
			logToMain("API_SERVER", "API server start error:", e);
		}
	} else {
		logToMain("API_SERVER", "API server already running.");
	}
});
