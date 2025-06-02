// renderer/renderer.js
const printerListUl = document.getElementById("printerList");
const refreshButton = document.getElementById("refreshButton");
const statusMessageEl = document.getElementById("statusMessage");
const apiUrlEl = document.getElementById("apiUrl");

// Assuming API URL is fixed for now, or will be set by main process.
// apiUrlEl.textContent = `http://localhost:${process.env.API_PORT || 3030}`;

// function updatePrinterList(printers) {
// 	printerListUl.innerHTML = ""; // Clear old list
// 	if (!printers || printers.length === 0) {
// 		const li = document.createElement("li");
// 		li.classList.add("no-printers-message"); // Uses the class from style.css
// 		li.textContent = "No printers found. Try refreshing or check connections.";
// 		printerListUl.appendChild(li);
// 		return;
// 	}
// 	printers.forEach((printer) => {
// 		const li = document.createElement("li");
// 		let statusClass = "";
// 		switch (printer.status?.toLowerCase()) {
// 			case "connected":
// 				statusClass = "status-connected";
// 				break;
// 			case "discovered":
// 			case "discovered (usb)":
// 			case "discovered (lan)":
// 				statusClass = "status-discovered";
// 				break;
// 			case "connection failed":
// 			case "connection failed (device not found by adapter)":
// 			case "connection failed (not found/driver)":
// 			case "error":
// 				statusClass = "status-failed";
// 				break;
// 			default:
// 				if (printer.status && printer.status.toLowerCase().includes("error")) {
// 					statusClass = "status-failed";
// 				} else {
// 					statusClass = "status-testing";
// 				}
// 		}
// 		li.innerHTML = `
//             <div class="details">
//                 <strong>${printer.name}</strong> (ID: ${printer.id})<br>
//                 Type: ${printer.type}
//             </div>
//             <span class="status ${statusClass}">${
// 			printer.status || "Unknown"
// 		}</span>`;
// 		printerListUl.appendChild(li);
// 	});
// }

function updatePrinterList(printers) {
	printerListUl.innerHTML = "";
	if (!printers || printers.length === 0) {
		const li = document.createElement("li");
		li.classList.add("no-printers-message");
		li.textContent = "No printers found. Try refreshing or check connections.";
		printerListUl.appendChild(li);
		return;
	}
	printers.forEach((printer) => {
		const li = document.createElement("li");
		let statusClass = "";
		switch (
			printer.status?.toLowerCase() /* ... (status class logic as before) ... */
		) {
			case "connected":
				statusClass = "status-connected";
				break;
			case "discovered":
				statusClass = "status-discovered";
				break;
			case "ready (virtual)":
				statusClass = "status-virtual";
				break; // New status for virtual
			case "connection failed":
				statusClass = "status-failed";
				break;
			default:
				if (printer.status && printer.status.toLowerCase().includes("error"))
					statusClass = "status-failed";
				else statusClass = "status-testing";
		}

		li.innerHTML = `
            <div class="details">
                <strong>${printer.name} ${
			printer.isVirtual ? "(Virtual)" : ""
		}</strong> (ID: ${printer.id})<br>
                Type: ${printer.type} ${printer.isVirtual ? "- Virtual" : ""}
            </div>
            <span class="status ${statusClass}">${
			printer.status || "Unknown"
		}</span>`;
		printerListUl.appendChild(li);
	});
}

refreshButton.addEventListener("click", () => {
	if (statusMessageEl)
		statusMessageEl.textContent = "⏳ Requesting printer refresh...";
	refreshButton.disabled = true;
	refreshButton.textContent = "Refreshing...";
	window.electronAPI
		.refreshPrinters()
		.catch((err) => {
			if (statusMessageEl)
				statusMessageEl.textContent = `❌ Error during refresh request: ${err.message}`;
			console.error("Refresh printer invoke error:", err);
		})
		.finally(() => {
			refreshButton.disabled = false;
			refreshButton.textContent = "Refresh Printer List";
		});
});

// --- Listener Setup and Cleanup ---
let cleanupPrintersUpdatedListener = () => {};
let cleanupPrintersStatusUpdateListener = () => {};

if (
	window.electronAPI &&
	typeof window.electronAPI.onPrintersUpdated === "function"
) {
	cleanupPrintersUpdatedListener = window.electronAPI.onPrintersUpdated(
		(printers) => {
			console.log("Renderer received 'printers-updated':", printers);
			updatePrinterList(printers);
		}
	);
} else {
	console.error(
		"Error: window.electronAPI.onPrintersUpdated is not available."
	);
	if (statusMessageEl)
		statusMessageEl.textContent =
			"CRITICAL ERROR: Cannot receive printer updates!";
}

if (
	window.electronAPI &&
	typeof window.electronAPI.onPrintersStatusUpdate === "function"
) {
	cleanupPrintersStatusUpdateListener =
		window.electronAPI.onPrintersStatusUpdate((message) => {
			console.log(
				"[DEBUG] Received 'printer-status-update' with message:",
				message
			);

			if (!statusMessageEl) {
				console.error(
					"[DEBUG] FATAL: statusMessageEl is NULL or UNDEFINED inside onPrintersStatusUpdate callback!"
				);
				return;
			}

			// Still useful to log what's happening, especially if issues persist.
			console.log("[DEBUG] statusMessageEl (before update):", statusMessageEl);
			console.log(
				"[DEBUG] Current textContent (before update):",
				`"${statusMessageEl.textContent}"`
			);
			// You can keep these style logs if helpful for diagnosing CSS issues
			// console.log("[DEBUG] Computed Style (display):", window.getComputedStyle(statusMessageEl).display);
			// console.log("[DEBUG] Computed Style (visibility):", window.getComputedStyle(statusMessageEl).visibility);
			// console.log("[DEBUG] Computed Style (opacity):", window.getComputedStyle(statusMessageEl).opacity);
			// console.log("[DEBUG] Computed Style (color):", window.getComputedStyle(statusMessageEl).color);

			// The "forced styles" have been removed.
			// Styles will now come purely from style.css.

			statusMessageEl.textContent = message; // The crucial line

			console.log(
				"[DEBUG] textContent (after update):",
				`"${statusMessageEl.textContent}"`
			);
			// console.log("[DEBUG] innerHTML (after update):", `"${statusMessageEl.innerHTML}"`);
		});
} else {
	console.error(
		"Error: window.electronAPI.onPrintersStatusUpdate is not available."
	);
	if (statusMessageEl)
		statusMessageEl.textContent =
			"CRITICAL ERROR: Cannot receive status messages!";
}

window.addEventListener("beforeunload", () => {
	console.log("Renderer: Cleaning up IPC listeners before unload.");
	cleanupPrintersUpdatedListener();
	cleanupPrintersStatusUpdateListener();
});

if (
	window.electronAPI &&
	typeof window.electronAPI.rendererReady === "function"
) {
	if (statusMessageEl)
		statusMessageEl.textContent =
			"✨ UI Initialized. Signaling main process..."; // This initial message should be visible
	window.electronAPI.rendererReady();
} else {
	if (statusMessageEl)
		statusMessageEl.textContent =
			"CRITICAL ERROR: Electron API bridge not found.";
	console.error(
		"CRITICAL ERROR: window.electronAPI or rendererReady not found."
	);
}
