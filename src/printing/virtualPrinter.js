import { BrowserWindow } from "electron";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { VIRTUAL_PRINT_OPTIONS } from "../config/index.js";

export async function printVirtually(
	htmlContent,
	printerConfig,
	mainWindow,
	printerOptions = {}
) {
	const logPrefix = `VIRTUAL_PRINT [${printerConfig.name}]:`;
	console.log(`${logPrefix} Starting virtual print process.`);

	if (!mainWindow || mainWindow.isDestroyed()) {
		throw new Error("Main window not available for virtual printing.");
	}

	const tempHtmlPath = path.join(os.tmpdir(), `bridge_vp_${Date.now()}.html`);
	await fs.writeFile(tempHtmlPath, htmlContent, "utf8");

	// Use a new, temporary BrowserWindow for printing
	const vpWin = new BrowserWindow({
		show: false, // Keep it hidden
		webPreferences: { nodeIntegration: false, contextIsolation: true },
	});

	return new Promise(async (resolve, reject) => {
		vpWin.webContents.on("did-fail-load", (e, errCode, errDesc) => {
			console.error(`${logPrefix} VP window load fail:`, errDesc);
			if (!vpWin.isDestroyed()) vpWin.close();
			fs.unlink(tempHtmlPath).catch(() => {});
			reject(new Error(`Virtual print page load fail: ${errDesc}`));
		});

		try {
			await vpWin.loadFile(tempHtmlPath);
			console.log(
				`${logPrefix} Virtual print HTML loaded into temporary window.`
			);

			const electronPrintOptions = {
				silent:
					printerOptions.silent !== undefined
						? printerOptions.silent
						: VIRTUAL_PRINT_OPTIONS.silent,
				deviceName: printerConfig.osName || printerConfig.name,
				printBackground:
					printerOptions.printBackground !== undefined
						? printerOptions.printBackground
						: VIRTUAL_PRINT_OPTIONS.printBackground,
				color:
					printerOptions.color !== undefined
						? printerOptions.color
						: VIRTUAL_PRINT_OPTIONS.color,
				margins: printerOptions.margins || VIRTUAL_PRINT_OPTIONS.margins,
				...(printerOptions.electronSpecificOptions || {}),
			};

			vpWin.webContents.print(electronPrintOptions, (success, reason) => {
				if (!vpWin.isDestroyed()) vpWin.close();
				fs.unlink(tempHtmlPath).catch(() => {});

				if (success) {
					console.log(`${logPrefix} Successfully sent to virtual printer.`);
					resolve({
						success: true,
						message: `Sent to virtual printer ${printerConfig.name}`,
					});
				} else {
					console.error(`${logPrefix} Virtual print failed: ${reason}`);
					reject(new Error(`Virtual print failed: ${reason}`));
				}
			});
		} catch (vpErr) {
			console.error(`${logPrefix} VP setup error:`, vpErr);
			if (!vpWin.isDestroyed()) vpWin.close();
			if (
				await fs
					.access(tempHtmlPath)
					.then(() => true)
					.catch(() => false)
			) {
				await fs
					.unlink(tempHtmlPath)
					.catch((e) =>
						console.warn("Error unlinking temp html in VP error:", e)
					);
			}
			reject(new Error(`Virtual print preparation error: ${vpErr.message}`));
		}
	});
}

// // src/printing/virtualPrinter.js
// import { BrowserWindow } from "electron";
// import fs from "fs/promises";
// import path from "path";
// import os from "os";
// import { VIRTUAL_PRINT_OPTIONS } from "../config/index.js"; // Ensure this path is correct relative to this file

// // Function for printing HTML content (your existing or refined version)
// export async function printHtmlVirtually(
// 	htmlContent,
// 	printerConfig,
// 	mainWindow,
// 	printerOptions = {}
// ) {
// 	const logPrefix = `VIRTUAL_HTML_PRINT [${printerConfig.name}]:`;
// 	if (!mainWindow || mainWindow.isDestroyed())
// 		throw new Error("Main window unavailable for HTML virtual printing.");

// 	const tempHtmlPath = path.join(
// 		os.tmpdir(),
// 		`bridge_vp_html_${Date.now()}.html`
// 	);
// 	await fs.writeFile(tempHtmlPath, htmlContent, "utf8");

// 	const vpWin = new BrowserWindow({
// 		show: false,
// 		webPreferences: {
// 			nodeIntegration: false,
// 			contextIsolation: true,
// 			plugins: true, // Important for some rendering/printing capabilities
// 		},
// 	});

// 	return new Promise(async (resolve, reject) => {
// 		vpWin.webContents.on("did-fail-load", (e, errCode, errDesc) => {
// 			if (!vpWin.isDestroyed()) vpWin.close();
// 			fs.unlink(tempHtmlPath).catch(() => {});
// 			reject(new Error(`Virtual HTML print page load fail: ${errDesc}`));
// 		});
// 		try {
// 			await vpWin.loadFile(tempHtmlPath);
// 			const electronPrintOptions = {
// 				silent:
// 					printerOptions.silent !== undefined
// 						? printerOptions.silent
// 						: VIRTUAL_PRINT_OPTIONS.silent,
// 				deviceName: printerConfig.osName || printerConfig.name,
// 				printBackground:
// 					printerOptions.printBackground !== undefined
// 						? printerOptions.printBackground
// 						: VIRTUAL_PRINT_OPTIONS.printBackground,
// 				color:
// 					printerOptions.color !== undefined
// 						? printerOptions.color
// 						: VIRTUAL_PRINT_OPTIONS.color,
// 				margins: printerOptions.margins || VIRTUAL_PRINT_OPTIONS.margins, // Use configured margins
// 				...(printerOptions.electronSpecificOptions || {}),
// 			};
// 			vpWin.webContents.print(electronPrintOptions, (success, reason) => {
// 				if (!vpWin.isDestroyed()) vpWin.close();
// 				fs.unlink(tempHtmlPath).catch(() => {});
// 				if (success)
// 					resolve({
// 						success: true,
// 						message: `HTML sent to virtual printer ${printerConfig.name}`,
// 					});
// 				else reject(new Error(`Virtual HTML print failed: ${reason}`));
// 			});
// 		} catch (vpErr) {
// 			if (!vpWin.isDestroyed()) vpWin.close();
// 			try {
// 				await fs.unlink(tempHtmlPath);
// 			} catch (e) {
// 				console.warn("VP HTML temp unlink error:", e.message);
// 			}
// 			reject(new Error(`Virtual HTML print prep error: ${vpErr.message}`));
// 		}
// 	});
// }

// // New function for printing PDF files
// export async function printPdfVirtually(
// 	pdfPath,
// 	printerConfig,
// 	mainWindow,
// 	printerOptions = {}
// ) {
// 	const logPrefix = `VIRTUAL_PDF_PRINT [${printerConfig.name}]:`;
// 	if (!mainWindow || mainWindow.isDestroyed()) {
// 		throw new Error("Main window unavailable for PDF virtual printing.");
// 	}
// 	try {
// 		await fs.access(pdfPath); // Check if file exists
// 	} catch (e) {
// 		throw new Error(`PDF file not found at: ${pdfPath}`);
// 	}

// 	const pdfPrintWindow = new BrowserWindow({
// 		show: false,
// 		webPreferences: {
// 			nodeIntegration: false,
// 			contextIsolation: true,
// 			plugins: true, // Enable PDF viewer plugin
// 		},
// 	});

// 	return new Promise(async (resolve, reject) => {
// 		pdfPrintWindow.webContents.on(
// 			"did-fail-load",
// 			(event, errorCode, errorDescription) => {
// 				console.error(
// 					`${logPrefix} PDF print window failed to load: ${errorDescription}`
// 				);
// 				if (!pdfPrintWindow.isDestroyed()) pdfPrintWindow.close();
// 				reject(new Error(`PDF print window load failed: ${errorDescription}`));
// 			}
// 		);

// 		try {
// 			await pdfPrintWindow.loadFile(pdfPath); // Load the local PDF file
// 			console.log(`${logPrefix} PDF loaded into temporary window: ${pdfPath}`);

// 			// A small delay might be needed for the PDF viewer to fully render before printing
// 			// Adjust timeout as needed, or remove if not necessary.
// 			await new Promise((r) =>
// 				setTimeout(r, printerOptions.pdfRenderDelay || 500)
// 			);

// 			const electronPrintOptions = {
// 				silent:
// 					printerOptions.silent !== undefined
// 						? printerOptions.silent
// 						: VIRTUAL_PRINT_OPTIONS.silent,
// 				deviceName: printerConfig.osName || printerConfig.name,
// 				printBackground: true,
// 				color:
// 					printerOptions.color !== undefined ? printerOptions.color : false, // Usually false for receipts
// 				margins: printerOptions.margins || { marginType: "none" }, // Try to minimize margins for PDFs
// 				...(printerOptions.electronSpecificOptions || {}),
// 			};

// 			pdfPrintWindow.webContents.print(
// 				electronPrintOptions,
// 				(success, reason) => {
// 					if (!pdfPrintWindow.isDestroyed()) pdfPrintWindow.close();
// 					// Temp PDF file is deleted in printService.js after this promise resolves/rejects
// 					if (success) {
// 						resolve({
// 							success: true,
// 							message: `PDF sent to virtual printer ${printerConfig.name}`,
// 						});
// 					} else {
// 						reject(new Error(`Virtual PDF print failed: ${reason}`));
// 					}
// 				}
// 			);
// 		} catch (error) {
// 			console.error(
// 				`${logPrefix} Error during PDF virtual printing process:`,
// 				error
// 			);
// 			if (!pdfPrintWindow.isDestroyed()) pdfPrintWindow.close();
// 			reject(new Error(`PDF virtual printing setup error: ${error.message}`));
// 		}
// 	});
// }
