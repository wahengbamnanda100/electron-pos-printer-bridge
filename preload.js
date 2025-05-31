// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
	// For renderer to receive updates from main
	onPrintersUpdated: (callback) => {
		const listener = (event, printers) => callback(printers);
		ipcRenderer.on("printers-updated", listener);
		return () => ipcRenderer.removeListener("printers-updated", listener); // Return cleanup function
	},
	onPrintersStatusUpdate: (callback) => {
		// For general status messages
		const listener = (event, message) => callback(message);
		ipcRenderer.on("printer-status-update", listener);
		return () => ipcRenderer.removeListener("printer-status-update", listener); // Return cleanup function
	},

	// For renderer to send requests/invocations to main
	rendererReady: () => ipcRenderer.send("renderer-ready"),
	refreshPrinters: () => ipcRenderer.invoke("rediscover-printers"), // Changed from 'rediscover-printers' to 'refreshPrinters' for consistency with renderer code. Handler in main is 'rediscover-printers'
});
