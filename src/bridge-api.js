import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { BrowserWindow } from "electron";
import fs from "fs/promises";
import path from "path";
import os from "os";
import osPrinterDriver from "printer";

// Import from node-thermal-printer
import {
	ThermalPrinter,
	PrinterTypes,
	CharacterSet,
	BreakLine, // For cut modes
	// Align (string literals 'LT', 'CT', 'RT') and Style (boolean methods) are used directly
} from "node-thermal-printer";

// --- Import your template generators ---
// import { generateStandardReceipt } from "./templates/standardReceipt.js";
// import { generateKitchenOrderTicket } from "./templates/kitchenOrderTicket.js";
import { generateTwKitchenTakeawayTicket } from "./templates/kot-save-temp.js"; // Make sure this path is correct

const API_PORT = process.env.API_PORT || 3030;

// Mapping of template types to generator functions
const templateGenerators = {
	// STANDARD_RECEIPT: generateStandardReceipt,
	// KITCHEN_ORDER: generateKitchenOrderTicket,
	KOT_SAVE: generateTwKitchenTakeawayTicket,
	// Add more template identifiers and their corresponding functions here
};

// Helper function to convert our command objects to simple HTML for virtual printers
function commandsToSimpleHtml(
	printDataArray,
	documentTitle = "Print Document"
) {
	let htmlBody = "";
	let currentAlignment = "left"; // Default alignment

	printDataArray.forEach((cmd) => {
		let textContent = String(cmd.content || cmd.text || cmd.value || ""); // Ensure string for text based content
		let styleString = "";
		let tag = "div"; // Default block element

		// Determine current alignment based on command or previous align command
		if (cmd.type?.toLowerCase() === "align" && cmd.align) {
			currentAlignment =
				cmd.align.toLowerCase() === "ct" || cmd.align.toLowerCase() === "center"
					? "center"
					: cmd.align.toLowerCase() === "rt" ||
					  cmd.align.toLowerCase() === "right"
					? "right"
					: "left";
		}
		// Apply alignment for text-based elements if alignment is defined in the command itself or use current
		let effectiveAlign = currentAlignment;
		if (cmd.align) {
			effectiveAlign =
				cmd.align.toLowerCase() === "ct" || cmd.align.toLowerCase() === "center"
					? "center"
					: cmd.align.toLowerCase() === "rt" ||
					  cmd.align.toLowerCase() === "right"
					? "right"
					: "left";
		}
		styleString += `text-align: ${effectiveAlign};`;

		if (cmd.style) {
			if (cmd.style.includes("B")) styleString += "font-weight: bold;";
			if (cmd.style.includes("U")) styleString += "text-decoration: underline;";
			// 'I' (invert) can be simulated with CSS filter if important: filter: invert(1);
		}
		if (cmd.size && Array.isArray(cmd.size)) {
			const widthFactor = cmd.size[0] || 1;
			const heightFactor = cmd.size[1] || 1;
			if (widthFactor >= 2 || heightFactor >= 2) {
				if (widthFactor >= 3 || heightFactor >= 3)
					styleString +=
						"font-size: 2em; line-height:1.1; margin-bottom: 0.1em;";
				else
					styleString +=
						"font-size: 1.5em; line-height:1.1; margin-bottom: 0.05em;";
			} else {
				styleString += "font-size: 1em;";
			}
		} else {
			styleString += "font-size: 1em;";
		}

		switch (cmd.type?.toLowerCase()) {
			case "text":
			case "println":
				htmlBody += `<${tag} style="${styleString}"><pre>${textContent}</pre></${tag}>\n`;
				break;
			case "setstyles": // These modify current state, not directly print HTML, but alignment could be applied for following.
				if (cmd.align) currentAlignment = cmd.align.toLowerCase(); // Persist alignment from setStyles
				break;
			case "resetstyles":
				currentAlignment = "left"; // Reset alignment state
				break;
			case "feed":
				htmlBody += "<br>".repeat(parseInt(cmd.lines, 10) || 1);
				break;
			case "drawline":
				htmlBody +=
					'<hr style="border:none; border-top: 1px dashed #555; margin: 8px 0;">\n';
				break;
			case "barcode":
				htmlBody += `<div style="${styleString}">[BARCODE: ${textContent} (Type: ${
					cmd.barcodeType || "default"
				})]</div>\n`;
				break;
			case "qr":
				htmlBody += `<div style="${styleString}">[QR CODE: ${textContent}]</div>\n`;
				break;
			case "tablecustom": // Basic HTML table rendering
				htmlBody +=
					'<table border="1" style="width:100%; border-collapse: collapse; margin-bottom: 10px; font-size: 0.9em; border: none;">';
				// Assuming cmd.options.columns might hint at headers - simplified here
				if (cmd.data && Array.isArray(cmd.data)) {
					cmd.data.forEach((row) => {
						htmlBody += "<tr>";
						row.forEach((cell, cellIndex) => {
							let cellHtmlStyle = "";
							if (
								cmd.options &&
								cmd.options.columns &&
								cmd.options.columns[cellIndex]
							) {
								const colOpt = cmd.options.columns[cellIndex];
								if (colOpt.align === "RIGHT")
									cellHtmlStyle += "text-align:right;";
								else if (colOpt.align === "CENTER")
									cellHtmlStyle += "text-align:center;";
								else cellHtmlStyle += "text-align:left;";
								if (colOpt.style && colOpt.style.includes("B"))
									cellHtmlStyle += "font-weight:bold;";
								if (colOpt.size && colOpt.size[1] >= 2)
									cellHtmlStyle += "font-size:1.2em;";
							}
							htmlBody += `<td style="${cellHtmlStyle}">${String(cell)}</td>`;
						});
						htmlBody += "</tr>";
					});
				}
				htmlBody += "</tbody></table>\n";
				break;
			// cut, beep, raw, image, imageBuffer are generally physical printer commands.
			// For image/imageBuffer, you could convert base64 to an <img> tag if html generation needs it.
		}
	});

	return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${documentTitle}</title>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Courier New', Courier, monospace; margin: 10mm; font-size: 10pt; }
                pre { white-space: pre-wrap; margin: 0; padding: 0; line-height: 1.2; }
                div { margin-bottom: 1px; line-height: 1.2; }
                table td, table th { padding: 2px 4px; }
            </style>
        </head>
        <body>
            ${htmlBody}
        </body>
        </html>
    `;
}

export function startApiServer(getDiscoveredPrinters) {
	const app = express();
	app.use(cors({ origin: "*" }));
	app.use(bodyParser.json({ limit: "10mb" }));
	app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

	app.get("/api/printers", (req, res) => {
		const printers = getDiscoveredPrinters();
		if (!printers)
			return res.status(500).json({ error: "Printer list unavailable." });
		res.json(
			printers.map((p) => ({
				id: p.id,
				name: p.name,
				type: p.type,
				status: p.status,
				description: p.description,
				isDefault: p.isDefault,
				isVirtual: p.isVirtual,
			}))
		);
	});

	app.post("/api/print", async (req, res) => {
		const { printerName, templateType, templateData, printerOptions } =
			req.body;

		if (!printerName)
			return res.status(400).json({ error: "Missing 'printerName'." });
		if (!templateType)
			return res.status(400).json({ error: "Missing 'templateType'." });
		// templateData can be an empty object if the template is static
		if (templateData === undefined)
			return res
				.status(400)
				.json({ error: "Missing 'templateData' (can be an empty object {})." });

		const printers = getDiscoveredPrinters();
		if (!printers)
			return res
				.status(500)
				.json({ error: "Printer configuration not available." });

		const config = printers.find(
			(p) => p.name.toLowerCase() === printerName.toLowerCase()
		);
		if (!config)
			return res
				.status(404)
				.json({ error: `Printer named '${printerName}' not found.` });

		const generateTemplateFunction =
			templateGenerators[templateType.toUpperCase()];
		if (
			!generateTemplateFunction ||
			typeof generateTemplateFunction !== "function"
		) {
			return res
				.status(400)
				.json({ error: `Unknown or invalid templateType: '${templateType}'.` });
		}

		let printDataArray; // This will be the array of command objects
		try {
			printDataArray = generateTemplateFunction(templateData);
			if (!Array.isArray(printDataArray))
				throw new Error("Template did not return an array of commands.");
			console.log(
				`API Print: Generated ${printDataArray.length} commands using template '${templateType}' for '${config.name}'.`
			);
		} catch (templateError) {
			console.error(
				`API Print: Error generating template '${templateType}':`,
				templateError
			);
			return res.status(500).json({
				error: `Failed to generate print data from template '${templateType}': ${templateError.message}`,
			});
		}

		console.log(
			`API Print: Job for '${config.name}' (Virtual: ${config.isVirtual}, Type: ${config.type}) using template '${templateType}'.`
		);

		if (config.isVirtual) {
			// --- VIRTUAL PRINTER (Electron WebContents Print) ---
			console.log(`API Print: Handling as VIRTUAL PRINTER: ${config.name}`);
			try {
				const htmlContent = commandsToSimpleHtml(
					printDataArray,
					`Print Output for ${config.name} - ${templateType}`
				);
				const tempHtmlPath = path.join(
					os.tmpdir(),
					`bridge_print_${Date.now()}.html`
				);
				await fs.writeFile(tempHtmlPath, htmlContent, "utf8");
				console.log(`API Print: Temp HTML for virtual print: ${tempHtmlPath}`);

				const printJobWindow = new BrowserWindow({
					show: false,
					webPreferences: { nodeIntegration: false, contextIsolation: true },
				});

				printJobWindow.webContents.on(
					"did-fail-load",
					(event, errorCode, errorDescription) => {
						console.error(
							`API Print: Hidden print window failed to load '${tempHtmlPath}': ${errorDescription} (Code: ${errorCode})`
						);
						if (!printJobWindow.isDestroyed()) printJobWindow.close();
						fs.unlink(tempHtmlPath).catch((err) =>
							console.error(
								"API Print: Error deleting temp HTML on fail-load:",
								err
							)
						);
						if (!res.headersSent)
							res.status(500).json({
								error: `Failed to load content for virtual print: ${errorDescription}`,
							});
					}
				);

				await printJobWindow.loadFile(tempHtmlPath);
				console.log(
					`API Print: Content loaded into hidden print window for '${config.name}'. Initiating print...`
				);

				printJobWindow.webContents.print(
					{
						silent:
							printerOptions?.silent !== undefined
								? printerOptions.silent
								: true,
						deviceName: config.name,
						printBackground:
							printerOptions?.printBackground !== undefined
								? printerOptions.printBackground
								: true,
						color: printerOptions?.color || false,
						margins: printerOptions?.margins || { marginType: "printableArea" },
					},
					(success, failureReason) => {
						if (!printJobWindow.isDestroyed()) printJobWindow.close();
						fs.unlink(tempHtmlPath).catch((err) =>
							console.error(
								"API Print: Error deleting temp HTML post-print:",
								err
							)
						);

						if (success) {
							console.log(
								`API Print: Successfully initiated print to virtual printer '${config.name}'.`
							);
							if (!res.headersSent)
								res.json({
									success: true,
									message: `Content sent to virtual printer '${config.name}'.`,
								});
						} else {
							console.error(
								`API Print: Failed to print to virtual printer '${config.name}'. Reason: ${failureReason}`
							);
							if (!res.headersSent)
								res.status(500).json({
									error: `Print to '${config.name}' failed: ${failureReason}`,
								});
						}
					}
				);
			} catch (virtualPrintError) {
				console.error(
					`API Print: Error in virtual print process for '${config.name}': ${virtualPrintError.message}`,
					virtualPrintError
				);
				if (!res.headersSent)
					res.status(500).json({
						error: `Failed to prepare print for '${config.name}': ${virtualPrintError.message}`,
					});
			}
		} else {
			// --- PHYSICAL PRINTER (node-thermal-printer) ---
			console.log(`API Print: Handling as PHYSICAL PRINTER: ${config.name}`);
			let thermalPrinterInstance;
			try {
				let interfaceOptPhysical;
				const printerDriverTypePhysical =
					printerOptions &&
					printerOptions.type &&
					PrinterTypes[printerOptions.type.toUpperCase()]
						? PrinterTypes[printerOptions.type.toUpperCase()]
						: PrinterTypes.EPSON;
				const charSetPhysical =
					printerOptions &&
					printerOptions.characterSet &&
					CharacterSet[printerOptions.characterSet.toUpperCase()]
						? CharacterSet[printerOptions.characterSet.toUpperCase()]
						: CharacterSet.UTF_8;
				const timeoutPhysical = printerOptions?.timeout || 7000; // Increased for network stability

				if (config.type === "electron_os") {
					if (!config.osName)
						throw new Error(
							`Config error: 'osName' missing for OS printer '${config.name}'.`
						);
					interfaceOptPhysical = `printer:${config.osName}`;
				} else if (config.type === "lan_mdns") {
					if (!config.ip || !config.port)
						throw new Error(
							`Config error: 'ip'/'port' missing for mDNS LAN printer '${config.name}'.`
						);
					interfaceOptPhysical = `tcp://${config.ip}:${config.port}`;
				} else {
					console.warn(
						`API Print Physical: Printer '${config.name}' (type '${config.type}') has unrecognized type. Falling back to OS name interface.`
					);
					interfaceOptPhysical = `printer:${config.name}`;
				}

				console.log(
					`API Print Physical: Initializing with Interface: '${interfaceOptPhysical}', Type: '${printerDriverTypePhysical}', CharSet: '${charSetPhysical}'`
				);

				const thermalPrinterOptions = {
					type: printerDriverTypePhysical,
					interface: interfaceOptPhysical,
					characterSet: charSetPhysical,
					removeSpecialCharacters:
						printerOptions?.removeSpecialCharacters || false,
					lineCharacter: printerOptions?.lineCharacter || "-",
					timeout: timeoutPhysical,
				};

				// +++ EXPLICITLY ADD DRIVER for Windows OS printing +++
				if (
					os.platform() === "win32" &&
					(config.type === "electron_os" ||
						interfaceOptPhysical.startsWith("printer:"))
				) {
					console.log(
						"API Print Physical: Windows OS printer detected, explicitly setting 'driver' option."
					);
					thermalPrinterOptions.driver = osPrinterDriver; // Use the imported 'printer' package
				}
				// +++++++++++++++++++++++++++++++++++++++++++++++++++++++

				// thermalPrinterInstance = new ThermalPrinter({
				// 	type: printerDriverTypePhysical,
				// 	interface: interfaceOptPhysical,
				// 	characterSet: charSetPhysical,
				// 	removeSpecialCharacters:
				// 		printerOptions?.removeSpecialCharacters || false,
				// 	lineCharacter: printerOptions?.lineCharacter || "-",
				// 	timeout: timeoutPhysical,
				// });

				thermalPrinterInstance = new ThermalPrinter(thermalPrinterOptions);

				const resetStylesPhysical = () => {
					thermalPrinterInstance.align("LT");
					thermalPrinterInstance.setTextNormal();
					thermalPrinterInstance.bold(false);
					thermalPrinterInstance.underline(false);
					thermalPrinterInstance.underlineThick(false);
					thermalPrinterInstance.invert(false);
				};
				if (printerOptions?.initialAlign)
					thermalPrinterInstance.align(
						printerOptions.initialAlign.toUpperCase()
					);

				for (const cmd of printDataArray) {
					// Loop through generated command objects
					if (
						cmd.type?.toLowerCase() !== "setstyles" &&
						cmd.type?.toLowerCase() !== "resetstyles"
					) {
						resetStylesPhysical();
					}
					const alignCmd = cmd.align ? cmd.align.toUpperCase() : "LT";

					switch (cmd.type?.toLowerCase()) {
						case "text":
						case "println":
							thermalPrinterInstance.align(alignCmd);
							if (cmd.style) {
								if (cmd.style.includes("B")) thermalPrinterInstance.bold(true);
								if (cmd.style.includes("U2"))
									thermalPrinterInstance.underlineThick(true);
								else if (cmd.style.includes("U"))
									thermalPrinterInstance.underline(true);
								if (cmd.style.includes("I"))
									thermalPrinterInstance.invert(true);
							}
							if (
								cmd.size &&
								Array.isArray(cmd.size) &&
								cmd.size.length === 2
							) {
								thermalPrinterInstance.setTextSize(
									Math.max(0, cmd.size[0] - 1),
									Math.max(0, cmd.size[1] - 1)
								);
							}
							thermalPrinterInstance.println(
								String(cmd.content || cmd.text || "")
							);
							break;
						case "feed":
							thermalPrinterInstance.feed(parseInt(cmd.lines, 10) || 1);
							break;
						case "cut":
							thermalPrinterInstance.cut(
								cmd.mode === "FULL" ? BreakLine.FULL : BreakLine.PART
							);
							break;
						case "beep":
							thermalPrinterInstance.beep(
								parseInt(cmd.n, 10) || 1,
								parseInt(cmd.t, 10) || 100
							);
							break;
						case "align":
							if (cmd.align)
								thermalPrinterInstance.align(cmd.align.toUpperCase());
							break;
						case "setstyles":
							if (cmd.align)
								thermalPrinterInstance.align(cmd.align.toUpperCase());
							if (cmd.style) {
								if (cmd.style.includes("B")) thermalPrinterInstance.bold(true);
								if (cmd.style.includes("U2"))
									thermalPrinterInstance.underlineThick(true);
								else if (cmd.style.includes("U"))
									thermalPrinterInstance.underline(true);
								if (cmd.style.includes("I"))
									thermalPrinterInstance.invert(true);
							}
							if (
								cmd.size &&
								Array.isArray(cmd.size) &&
								cmd.size.length === 2
							) {
								thermalPrinterInstance.setTextSize(
									Math.max(0, cmd.size[0] - 1),
									Math.max(0, cmd.size[1] - 1)
								);
							}
							break;
						case "resetstyles":
							resetStylesPhysical();
							break;
						case "barcode":
							thermalPrinterInstance.align(alignCmd);
							thermalPrinterInstance.printBarcode(
								String(cmd.content || cmd.value),
								parseInt(cmd.barcodeType, 10) || 73,
								{
									height: parseInt(cmd.height, 10) || 50,
									width: parseInt(cmd.width, 10) || 2,
									hriPos: parseInt(cmd.hriPos, 10) || 0,
									hriFont: parseInt(cmd.hriFont, 10) || 0,
									...(cmd.options || {}),
								}
							);
							break;
						case "qr":
							thermalPrinterInstance.align(alignCmd);
							await thermalPrinterInstance.printQR(
								String(cmd.content || cmd.value),
								{
									cellSize: parseInt(cmd.cellSize, 10) || 3,
									correction: cmd.correction || "M",
									model: parseInt(cmd.model, 10) || 2,
								}
							);
							break;
						case "image":
							thermalPrinterInstance.align(alignCmd);
							if (cmd.path) {
								try {
									await thermalPrinterInstance.printImage(cmd.path);
								} catch (e) {
									console.error("Img Path Err for physical:", e);
									thermalPrinterInstance.println("[ImgErr]");
								}
							} else {
								thermalPrinterInstance.println("[NoImgPth]");
							}
							break;
						case "imagebuffer":
							thermalPrinterInstance.align(alignCmd);
							if (cmd.buffer) {
								try {
									await thermalPrinterInstance.printImageBuffer(
										Buffer.from(cmd.buffer, "base64")
									);
								} catch (e) {
									console.error("ImgBuffErr for physical:", e);
									thermalPrinterInstance.println("[ImgBuffErr]");
								}
							} else {
								thermalPrinterInstance.println("[NoImgBf]");
							}
							break;
						case "drawline":
							thermalPrinterInstance.drawLine();
							break; // Uses lineCharacter from constructor
						case "raw":
							thermalPrinterInstance.raw(
								Buffer.isBuffer(cmd.content)
									? cmd.content
									: Buffer.from(String(cmd.content || ""), "hex")
							);
							break;
						case "tablecustom": // Handle table for physical printers
							if (cmd.data && Array.isArray(cmd.data)) {
								try {
									const ntpTableOptions = { ...(cmd.options || {}) }; // Copy options
									if (
										ntpTableOptions.columns &&
										Array.isArray(ntpTableOptions.columns)
									) {
										ntpTableOptions.columns = ntpTableOptions.columns.map(
											(col) => {
												const newCol = { ...col };
												if (typeof col.style === "string") {
													// Convert string style to NTP boolean options
													newCol.bold = col.style.includes("B");
													newCol.underline = col.style.includes("U");
													newCol.underlineThick = col.style.includes("U2");
													newCol.invert = col.style.includes("I");
													delete newCol.style;
												}
												if (col.size && Array.isArray(col.size)) {
													// Convert size
													newCol.textSize = [
														Math.max(0, col.size[0] - 1),
														Math.max(0, col.size[1] - 1),
													];
													delete newCol.size;
												}
												return newCol;
											}
										);
									}
									thermalPrinterInstance.tableCustom(cmd.data, ntpTableOptions);
								} catch (tableErr) {
									console.error(
										"API Print Physical: Error processing tableCustom:",
										tableErr
									);
									thermalPrinterInstance.println("[Table Render Error]");
								}
							}
							break;
						default:
							console.warn(
								`API Print Physical: Unhandled cmd type '${cmd.type}'.`
							);
					}
				}

				resetStylesPhysical();
				if (!printDataArray.some((cmd) => cmd.type?.toLowerCase() === "cut")) {
					thermalPrinterInstance.cut(BreakLine.PART);
				}

				const executeResultPhysical = await thermalPrinterInstance.execute();
				console.log(
					`API Print: Execute() for physical '${config.name}'. Result:`,
					executeResultPhysical
				);
				if (!res.headersSent) {
					res.json({
						success: true,
						message: `Print job sent to physical printer '${config.name}'.`,
					});
				}
			} catch (physicalPrintError) {
				console.error(
					`API Print Error (Physical) for '${config.name}': ${physicalPrintError.message}`,
					physicalPrintError.stack
				);
				if (!res.headersSent) {
					res.status(500).json({
						error: `Print failed for physical printer '${config.name}': ${physicalPrintError.message}`,
					});
				}
			}
		}
	});

	const server = app.listen(API_PORT, "0.0.0.0", () => {
		console.log(
			`Bridge API Server (Templated, Virtual Print Enabled) listening.`
		);
		console.log(`  Local:            http://localhost:${API_PORT}`);
		console.log(
			`  On Your Network:  http://<your-local-ip>:${API_PORT} (approx)`
		);
	});
	server.on("error", (error) => {
		if (error.syscall !== "listen") {
			throw error;
		}
		const bind =
			typeof API_PORT === "string" ? "Pipe " + API_PORT : "Port " + API_PORT;
		switch (error.code) {
			case "EACCES":
				console.error(
					`API Server Critical Error: ${bind} requires elevated privileges/blocked.`
				);
				process.exit(1);
				break;
			case "EADDRINUSE":
				console.error(`API Server Critical Error: ${bind} already in use.`);
				process.exit(1);
				break;
			default:
				console.error(`API Server Critical Error: ${error.code}`, error);
				throw error;
		}
	});
	return server;
}
