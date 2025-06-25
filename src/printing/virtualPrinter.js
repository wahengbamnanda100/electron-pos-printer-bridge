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

// /**
//  * Prints a local PDF file to a specified virtual or physical OS printer.
//  * @param {string} pdfPath - Absolute filesystem path to the local PDF file.
//  * @param {object} printerConfig - Configuration object for the target printer.
//  * @param {string} printerConfig.name - Display name of the printer.
//  * @param {string} [printerConfig.osName] - OS-specific name of the printer.
//  * @param {BrowserWindow} mainWindow - The main Electron BrowserWindow (used for context, printing happens in new window).
//  * @param {object} [printerOptions={}] - Optional printing parameters.
//  * @param {number} [printerOptions.pdfRenderDelay=500] - Delay in ms to wait for PDF to render before printing.
//  * @returns {Promise<{success: boolean, message: string}>}
//  */
// export async function printPdfVirtually(
// 	pdfPath,
// 	printerConfig,
// 	mainWindow,
// 	printerOptions = {}
// ) {
// 	const logPrefix = `VIRTUAL_PDF_PRINT [${printerConfig.name}]:`;
// 	if (!mainWindow || mainWindow.isDestroyed()) {
// 		console.warn(
// 			`${logPrefix} Main window was not available or destroyed at call time. Proceeding with new temp window for printing.`
// 		);
// 	}

// 	try {
// 		await fs.access(pdfPath); // Check if PDF file exists and is accessible
// 	} catch (e) {
// 		console.error(`${logPrefix} PDF file access error: ${pdfPath}`, e);
// 		throw new Error(
// 			`PDF file not found or inaccessible at: ${pdfPath}. Original error: ${e.message}`
// 		);
// 	}

// 	const pdfPrintWindow = new BrowserWindow({
// 		show: false, // Keep the printing window hidden
// 		webPreferences: {
// 			nodeIntegration: false, // Security best practice
// 			contextIsolation: true, // Security best practice
// 			plugins: true, // CRUCIAL: Enable PDF viewer plugin for Electron to load/render PDFs
// 		},
// 	});

// 	return new Promise(async (resolve, reject) => {
// 		pdfPrintWindow.webContents.on(
// 			"did-fail-load",
// 			(event, errorCode, errorDescription) => {
// 				console.error(
// 					`${logPrefix} PDF print window failed to load PDF file: ${errorDescription} (Code: ${errorCode})`
// 				);
// 				if (!pdfPrintWindow.isDestroyed()) pdfPrintWindow.close();
// 				reject(new Error(`PDF print window load failed: ${errorDescription}`));
// 			}
// 		);

// 		try {
// 			const fileUrl = `file://${pdfPath.replace(/\\/g, "/")}`;
// 			await pdfPrintWindow.loadURL(fileUrl);
// 			// await pdfPrintWindow.loadFile(pdfPath); // Load the local PDF file
// 			console.log(`${logPrefix} PDF loaded into temporary window: ${pdfPath}`);

// 			// A delay is often necessary for Electron's PDF viewer to fully render the PDF,
// 			// especially before a silent print command is issued.
// 			await new Promise((r) =>
// 				setTimeout(r, printerOptions.pdfRenderDelay || 3000)
// 			); // Default 500ms

// 			const electronPrintOptions = {
// 				silent:
// 					printerOptions.silent !== undefined
// 						? printerOptions.silent
// 						: VIRTUAL_PRINT_OPTIONS.silent, // Usually true for this workflow
// 				deviceName: printerConfig.osName || printerConfig.name, // Target the specified OS printer
// 				// printBackground:
// 				// 	printerOptions.printBackground !== undefined
// 				// 		? printerOptions.printBackground
// 				// 		: true, // Usually true for PDFs
// 				// color:
// 				// 	printerOptions.color !== undefined ? printerOptions.color : false, // Usually false for receipts/invoices
// 				// margins: printerOptions.margins || { marginType: "none" }, // Attempt to minimize added margins
// 				// Other options like 'pagesPerSheet', 'copies', 'collate', 'pageRanges', 'duplexMode', 'scaleFactor', 'dpi', 'pageSize'
// 				// can be added here if needed and supported by the OS print dialog / driver.
// 				// For thermal printers, 'pageSize' is tricky if the PDF already has a custom size.
// 				...(printerOptions.electronSpecificOptions || {}),
// 			};

// 			pdfPrintWindow.webContents.print(
// 				electronPrintOptions,
// 				(success, reason) => {
// 					if (!pdfPrintWindow.isDestroyed()) pdfPrintWindow.close();
// 					// Note: The temporary PDF file (from pdfPath) is typically deleted by the calling function
// 					// (e.g., handleDirectPdfPrintRequest in printService.js) after this promise resolves/rejects.

// 					if (success) {
// 						console.log(
// 							`${logPrefix} Successfully sent PDF to printer ${printerConfig.name}.`
// 						);
// 						resolve({
// 							success: true,
// 							message: `PDF sent to printer ${printerConfig.name}`,
// 						});
// 					} else {
// 						console.error(
// 							`${logPrefix} Virtual PDF print failed for ${printerConfig.name}: ${reason}`
// 						);
// 						reject(
// 							new Error(
// 								`Virtual PDF print failed for ${printerConfig.name}: ${reason}`
// 							)
// 						);
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

/**
 * Prints a local PDF file to a specified virtual or physical OS printer.
 * @param {string} pdfPath - Absolute filesystem path to the local PDF file.
 * @param {object} printerConfig - Configuration object for the target printer.
 * @param {string} printerConfig.name - Display name of the printer.
 * @param {string} [printerConfig.osName] - OS-specific name of the printer.
 * @param {BrowserWindow} mainWindow - The main Electron BrowserWindow (used for context, printing happens in new window).
 * @param {object} [printerOptions={}] - Optional printing parameters.
 * @param {number} [printerOptions.additionalDelay=0] - Additional delay in ms after dom-ready (if needed).
 * @param {number} [printerOptions.timeout=30000] - Timeout in ms for PDF loading (default 30 seconds).
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function printPdfVirtually(
	pdfPath,
	printerConfig,
	mainWindow,
	printerOptions = {}
) {
	const logPrefix = `VIRTUAL_PDF_PRINT [${printerConfig.name}]:`;
	if (!mainWindow || mainWindow.isDestroyed()) {
		console.warn(
			`${logPrefix} Main window was not available or destroyed at call time. Proceeding with new temp window for printing.`
		);
	}

	// Validate PDF file
	try {
		await fs.access(pdfPath);
		if (!pdfPath.toLowerCase().endsWith(".pdf")) {
			throw new Error("File is not a PDF");
		}
	} catch (e) {
		console.error(`${logPrefix} PDF file access error: ${pdfPath}`, e);
		throw new Error(
			`PDF file not found or inaccessible at: ${pdfPath}. Original error: ${e.message}`
		);
	}

	const pdfPrintWindow = new BrowserWindow({
		show: false, // Keep the printing window hidden
		webPreferences: {
			// nodeIntegration: false, // Security best practice
			// contextIsolation: true, // Security best practice
			plugins: true, // CRUCIAL: Enable PDF viewer plugin for Electron to load/render PDFs
		},
	});

	return new Promise(async (resolve, reject) => {
		const timeout = printerOptions.timeout || 30000; // 30 seconds default timeout
		let timeoutHandle;
		let isResolved = false;

		// Set up timeout to prevent hanging
		timeoutHandle = setTimeout(() => {
			if (!isResolved) {
				isResolved = true;
				console.error(`${logPrefix} PDF loading timeout after ${timeout}ms`);
				if (!pdfPrintWindow.isDestroyed()) pdfPrintWindow.close();
				reject(new Error(`PDF loading timeout after ${timeout}ms`));
			}
		}, timeout);

		// Handle load failures
		pdfPrintWindow.webContents.on(
			"did-fail-load",
			(event, errorCode, errorDescription) => {
				if (!isResolved) {
					isResolved = true;
					clearTimeout(timeoutHandle);
					console.error(
						`${logPrefix} PDF print window failed to load PDF file: ${errorDescription} (Code: ${errorCode})`
					);
					if (!pdfPrintWindow.isDestroyed()) pdfPrintWindow.close();
					reject(
						new Error(`PDF print window load failed: ${errorDescription}`)
					);
				}
			}
		);

		// Handle successful DOM ready - this is when PDF is fully loaded and ready
		pdfPrintWindow.webContents.once("dom-ready", async () => {
			if (isResolved) return; // Already handled by timeout or error

			console.log(`${logPrefix} PDF DOM ready, preparing to print...`);

			try {
				// Optional additional delay if needed for specific printers/systems
				const additionalDelay = printerOptions.additionalDelay || 0;
				if (additionalDelay > 0) {
					console.log(
						`${logPrefix} Waiting additional ${additionalDelay}ms before printing...`
					);
					await new Promise((resolve) => setTimeout(resolve, additionalDelay));
				}

				const electronPrintOptions = {
					silent:
						printerOptions.silent !== undefined
							? printerOptions.silent
							: VIRTUAL_PRINT_OPTIONS.silent,
					deviceName: printerConfig.osName || printerConfig.name,
					// printBackground:
					// 	printerOptions.printBackground !== undefined
					// 		? printerOptions.printBackground: true,
					// 		: true, // Usually true for PDFs
					// color:
					// 	printerOptions.color !== undefined ? printerOptions.color : true, // Default to color for PDFs
					// margins: printerOptions.margins || { marginType: "none" }, // Minimize margins for PDFs
					// scaleFactor: printerOptions.scaleFactor || 100, // Prevent unwanted scaling
					...(printerOptions.electronSpecificOptions || {}),
				};

				console.log(
					`${logPrefix} Initiating print with options:`,
					electronPrintOptions
				);

				pdfPrintWindow.webContents.print(
					electronPrintOptions,
					(success, reason) => {
						if (!isResolved) {
							isResolved = true;
							clearTimeout(timeoutHandle);

							if (!pdfPrintWindow.isDestroyed()) pdfPrintWindow.close();

							if (success) {
								console.log(
									`${logPrefix} Successfully sent PDF to printer ${printerConfig.name}.`
								);
								resolve({
									success: true,
									message: `PDF sent to printer ${printerConfig.name}`,
								});
							} else {
								console.error(
									`${logPrefix} Virtual PDF print failed for ${printerConfig.name}: ${reason}`
								);
								reject(
									new Error(
										`Virtual PDF print failed for ${printerConfig.name}: ${reason}`
									)
								);
							}
						}
					}
				);
			} catch (printError) {
				if (!isResolved) {
					isResolved = true;
					clearTimeout(timeoutHandle);
					console.error(`${logPrefix} Error during print setup:`, printError);
					if (!pdfPrintWindow.isDestroyed()) pdfPrintWindow.close();
					reject(new Error(`Print setup error: ${printError.message}`));
				}
			}
		});

		// Start loading the PDF
		try {
			console.log(`${logPrefix} Loading PDF: ${pdfPath}`);

			// Use file:// URL for better cross-platform compatibility
			const fileUrl = `file://${pdfPath.replace(/\\/g, "/")}`;
			await pdfPrintWindow.loadURL(fileUrl);

			console.log(`${logPrefix} PDF load initiated, waiting for DOM ready...`);
		} catch (loadError) {
			if (!isResolved) {
				isResolved = true;
				clearTimeout(timeoutHandle);
				console.error(`${logPrefix} Error loading PDF:`, loadError);
				if (!pdfPrintWindow.isDestroyed()) pdfPrintWindow.close();
				reject(new Error(`PDF loading error: ${loadError.message}`));
			}
		}
	});
}
