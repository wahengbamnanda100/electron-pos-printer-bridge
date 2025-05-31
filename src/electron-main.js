// src/electron-main.js
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";

import {
	discoverLanPrintersViaMDNS,
	testPrinterConnection,
	destroyBonjour,
} from "./print-discovery.js"; // Note: discoverSystemPrinters is no longer used from here
import { startApiServer } from "./bridge-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let discoveredPrinters = [];
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
	// mainWindow.webContents.openDevTools();
	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

async function performFullDiscoveryAndTest() {
	updateRendererStatus("🔄 Starting printer discovery cycle...");
	if (!mainWindow || mainWindow.isDestroyed()) {
		updateRendererStatus(
			"❌ Error: Main window not available for printer discovery."
		);
		console.error("Main window is not available to get printers.");
		return;
	}
	let allFoundPrinters = [];
	try {
		updateRendererStatus(
			"🔍 Discovering OS-configured printers (via Electron API)..."
		);
		const electronPrinters = await mainWindow.webContents.getPrintersAsync();
		if (electronPrinters && electronPrinters.length > 0) {
			electronPrinters.forEach((p) => {
				allFoundPrinters.push({
					id: `electron_os-${p.name.replace(/[^\w-]/g, "_")}`,
					name: p.name,
					osName: p.name,
					type: "electron_os",
					status: p.status === 0 ? "Ready" : `OS Status: ${p.status}`,
					description: p.description,
					isDefault: p.isDefault || false,
					options: p.options,
				});
			});
			updateRendererStatus(
				`💻 Found ${electronPrinters.length} OS-configured printers via Electron API.`
			);
		} else {
			updateRendererStatus(
				"💻 No OS-configured printers found via Electron API."
			);
		}
		updateRendererStatus("📡 Discovering additional LAN printers via mDNS...");
		const mDnsLanPrinters = await discoverLanPrintersViaMDNS();
		mDnsLanPrinters.forEach((p) => {
			allFoundPrinters.push({
				...p,
				osName: null,
				description: p.description || p.name,
				isDefault: false,
			});
		});
		updateRendererStatus(
			`🌐 mDNS scan complete. Found ${mDnsLanPrinters.length} mDNS LAN printers.`
		);
		const uniquePrintersMap = new Map();
		for (const p of allFoundPrinters) {
			let key;
			if (p.type === "electron_os") {
				key = `os:${p.name.toLowerCase().trim()}`;
			} else if (p.type === "lan_mdns") {
				key = `mdns:${p.ip}:${p.port}`;
			} else {
				key = p.id;
			}
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
			`📊 Total ${currentPrintersList.length} unique printers after de-duplication.`
		);
		discoveredPrinters = currentPrintersList.map((p) => ({
			...p,
			status: p.status || "Discovered",
		}));
		if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("printers-updated", getPrintersForClient());
		}
		if (currentPrintersList.length > 0) {
			updateRendererStatus(
				`🔗 Testing connections for ${currentPrintersList.length} printer(s)...`
			);
			const testedPrinterResults = await Promise.all(
				currentPrintersList.map(async (printer) => {
					updateRendererStatus(`⏳ Testing: ${printer.name}...`);
					const result = await testPrinterConnection(printer);
					updateRendererStatus(`  ${result.name}: ${result.status}`);
					return result;
				})
			);
			discoveredPrinters = testedPrinterResults;
			updateRendererStatus("✅ Printer connection testing complete.");
		} else {
			updateRendererStatus("ℹ️ No printers found to test.");
			discoveredPrinters = [];
		}
	} catch (error) {
		updateRendererStatus(`❌ Error during discovery/testing: ${error.message}`);
		console.error("Discovery/testing phase error:", error.message, error.stack);
	} finally {
		if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("printers-updated", getPrintersForClient());
		}
		updateRendererStatus("👍 Discovery cycle finished. Ready.");
	}
}

function getPrintersForApiServer() {
	return discoveredPrinters.map((p) => ({
		...p,
		osName: p.type === "electron_os" ? p.name : p.osName,
	}));
}

function getPrintersForClient() {
	return discoveredPrinters.map((p) => ({
		id: p.id,
		name: p.name,
		type: p.type,
		status: p.status,
		description: p.description,
		isDefault: p.isDefault,
	}));
}

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
		destroyBonjour();
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

ipcMain.handle("rediscover-printers", async () => {
	updateRendererStatus(
		"🔄 Refresh requested by UI. Restarting discovery cycle..."
	);
	await performFullDiscoveryAndTest();
	return getPrintersForClient();
});

ipcMain.on("renderer-ready", async () => {
	logToMain("Renderer process has signaled it is ready.");
	if (
		!mainWindow ||
		mainWindow.isDestroyed() ||
		!mainWindow.webContents ||
		mainWindow.webContents.isDestroyed()
	) {
		logToMain(
			"Window not ready during 'renderer-ready'. Waiting briefly or re-checking."
		);
		await new Promise((resolve) => setTimeout(resolve, 500));
		if (
			!mainWindow ||
			mainWindow.isDestroyed() ||
			!mainWindow.webContents ||
			mainWindow.webContents.isDestroyed()
		) {
			updateRendererStatus(
				"Error: Main window failed to initialize fully. Discovery might be impacted."
			);
			return;
		}
	}
	updateRendererStatus("🛠️ UI ready. Starting initial printer discovery...");
	await performFullDiscoveryAndTest();
	if (!apiServerInstance) {
		logToMain("Starting the API server after initial discovery...");
		try {
			apiServerInstance = startApiServer(getPrintersForApiServer);
			const apiPort = process.env.API_PORT || 3030;
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
