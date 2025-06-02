// src/bridge-api.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { BrowserWindow } from "electron"; // Needed for creating hidden print window
import fs from "fs/promises"; // For async file operations
import path from "path"; // For path manipulation
import os from "os"; // For temporary directory

// Import from node-thermal-printer only what's needed for physical printers
import {
	ThermalPrinter,
	PrinterTypes,
	CharacterSet,
	BreakLine, // For cut modes
	// Align and Style are used as string literals for their methods
} from "node-thermal-printer";

const API_PORT = process.env.API_PORT || 3030;

// Helper function to convert react-thermal-printer like commands to simple HTML
// This needs to be robust enough for the content you want on virtual printer outputs.
function commandsToSimpleHtml(
	printDataArray,
	documentTitle = "Print Document"
) {
	let htmlBody = "";
	let currentAlignment = "left"; // Default alignment

	printDataArray.forEach((cmd) => {
		let textContent = String(cmd.content || cmd.text || "");
		let styleString = "";
		let tag = "div"; // Default block element

		if (cmd.align) {
			currentAlignment =
				cmd.align.toLowerCase() === "ct" || cmd.align.toLowerCase() === "center"
					? "center"
					: cmd.align.toLowerCase() === "rt" ||
					  cmd.align.toLowerCase() === "right"
					? "right"
					: "left";
		}
		styleString += `text-align: ${currentAlignment};`;

		if (cmd.style) {
			if (cmd.style.includes("B")) styleString += "font-weight: bold;";
			if (cmd.style.includes("U")) styleString += "text-decoration: underline;";
			// 'I' (invert) is tricky for HTML, could use CSS filter or specific classes
		}
		if (cmd.size && Array.isArray(cmd.size)) {
			const widthFactor = cmd.size[0] || 1;
			const heightFactor = cmd.size[1] || 1;
			if (widthFactor >= 2 || heightFactor >= 2) {
				// Consider anything >= 2x as "larger"
				if (widthFactor >= 3 || heightFactor >= 3)
					styleString += "font-size: 2em; line-height:1.1;"; // XL
				else styleString += "font-size: 1.5em; line-height:1.1;"; // Large
			} else {
				styleString += "font-size: 1em;"; // Normal
			}
		} else {
			styleString += "font-size: 1em;";
		}

		switch (cmd.type?.toLowerCase()) {
			case "text":
			case "println":
				// Using <pre> to respect multiple spaces and line breaks within content if any
				htmlBody += `<${tag} style="${styleString}"><pre>${textContent}</pre></${tag}>\n`;
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
			// image, imagebuffer, cut, beep, raw, setstyles, resetstyles are primarily for physical thermal printers
			// and don't have direct simple HTML equivalents from this function's scope.
		}
	});

	return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${documentTitle}</title>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Courier New', Courier, monospace; margin: 15mm; font-size: 10pt; }
                pre { white-space: pre-wrap; margin: 0; padding: 0; line-height: 1.3; }
                div { margin-bottom: 2px; }
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
		if (!printers) {
			console.warn(
				"API /api/printers: getDiscoveredPrinters returned null/undefined."
			);
			return res.status(500).json({ error: "Printer list unavailable." });
		}
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
		const { printerName, printData, printerOptions } = req.body;

		if (!printerName)
			return res.status(400).json({ error: "Missing 'printerName'." });
		if (!printData || !Array.isArray(printData))
			return res.status(400).json({ error: "Invalid 'printData'." });

		const printers = getDiscoveredPrinters();
		if (!printers)
			return res.status(500).json({ error: "Printer config unavailable." });

		const config = printers.find(
			(p) => p.name.toLowerCase() === printerName.toLowerCase()
		);
		if (!config)
			return res
				.status(404)
				.json({ error: `Printer named '${printerName}' not found.` });

		console.log(
			`API Print: Job for '${config.name}' (Virtual: ${config.isVirtual}, Type: ${config.type})`
		);

		if (config.isVirtual) {
			// --- VIRTUAL PRINTER (Electron WebContents Print) ---
			console.log(`API Print: Handling as VIRTUAL PRINTER: ${config.name}`);
			try {
				const htmlContent = commandsToSimpleHtml(
					printData,
					`Print Output for ${config.name}`
				);
				const tempHtmlPath = path.join(
					os.tmpdir(),
					`bridge_print_${Date.now()}.html`
				);
				await fs.writeFile(tempHtmlPath, htmlContent, "utf8");
				console.log(`API Print: Temp HTML for virtual print: ${tempHtmlPath}`);

				// Create a new, hidden browser window to load and print the HTML.
				// This window is destroyed after printing.
				const printJobWindow = new BrowserWindow({
					show: false, // Keep it hidden
					webPreferences: {
						nodeIntegration: false,
						contextIsolation: true,
						// images: true, // Ensure images are enabled if your HTML has them
						// offscreen: true, // Consider if truly offscreen rendering is better
					},
				});

				await printJobWindow.loadFile(tempHtmlPath);
				console.log(
					`API Print: Content loaded into hidden print window for '${config.name}'.`
				);

				// webContents.print() is asynchronous, providing a callback
				printJobWindow.webContents.print(
					{
						silent:
							printerOptions?.silent !== undefined
								? printerOptions.silent
								: true, // Default to silent
						deviceName: config.name, // Specify the target OS printer name
						printBackground:
							printerOptions?.printBackground !== undefined
								? printerOptions.printBackground
								: true,
						color: printerOptions?.color || false, // Receipts usually monochrome
						margins: printerOptions?.margins || { marginType: "printableArea" }, // 'default', 'none', 'printableArea', 'custom'
						landscape: printerOptions?.landscape || false,
						scaleFactor: printerOptions?.scaleFactor || 100,
						pagesPerSheet: printerOptions?.pagesPerSheet || 1,
						collate: printerOptions?.collate || false,
						copies: printerOptions?.copies || 1,
						pageRanges: printerOptions?.pageRanges || [], // [{from:0, to:0}] for first page
						// header: printerOptions?.header, // Not usually used for this type of print
						// footer: printerOptions?.footer,
					},
					(success, failureReason) => {
						if (!printJobWindow.isDestroyed()) {
							// Check if window still exists
							printJobWindow.close(); // Ensure hidden window is closed
						}
						fs.unlink(tempHtmlPath).catch((err) =>
							console.error("API Print: Error deleting temp HTML:", err)
						); // Clean up

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
								res
									.status(500)
									.json({
										error: `Print to '${config.name}' failed: ${failureReason}`,
									});
						}
					}
				);
			} catch (virtualPrintError) {
				console.error(
					`API Print: Error setting up virtual print for '${config.name}': ${virtualPrintError.message}`,
					virtualPrintError
				);
				if (!res.headersSent)
					res
						.status(500)
						.json({
							error: `Failed to prepare print for '${config.name}': ${virtualPrintError.message}`,
						});
			}
		} else {
			// --- PHYSICAL PRINTER (node-thermal-printer) ---
			console.log(`API Print: Handling as PHYSICAL PRINTER: ${config.name}`);
			let thermalPrinterPhysical; // Use different variable name to avoid scope issues if thermalPrinter was global
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
				const timeoutPhysical = printerOptions?.timeout || 5000;

				if (config.type === "electron_os") {
					// Should be physical if not config.isVirtual
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
					// This fallback should ideally not be reached if types are well-managed
					console.warn(
						`API Print: Printer '${config.name}' (type '${config.type}') falling back to OS name interface.`
					);
					interfaceOptPhysical = `printer:${config.name}`;
				}

				thermalPrinterPhysical = new ThermalPrinter({
					type: printerDriverTypePhysical,
					interface: interfaceOptPhysical,
					characterSet: charSetPhysical,
					removeSpecialCharacters:
						printerOptions?.removeSpecialCharacters || false,
					lineCharacter: printerOptions?.lineCharacter || "-",
					timeout: timeoutPhysical,
				});

				const resetStylesPhysical = () => {
					/* ... same resetStyles as previously defined, using thermalPrinterPhysical ... */
					thermalPrinterPhysical.align("LT");
					thermalPrinterPhysical.setTextNormal();
					thermalPrinterPhysical.bold(false);
					thermalPrinterPhysical.underline(false);
					thermalPrinterPhysical.underlineThick(false);
					thermalPrinterPhysical.invert(false);
				};
				if (printerOptions?.initialAlign)
					thermalPrinterPhysical.align(
						printerOptions.initialAlign.toUpperCase()
					);

				for (const cmd of printData) {
					// Your extensive switch case for commands
					resetStylesPhysical(); // Reset before most commands
					const alignCmd = cmd.align ? cmd.align.toUpperCase() : "LT";
					switch (cmd.type?.toLowerCase()) {
						case "text":
						case "println":
							thermalPrinterPhysical.align(alignCmd);
							if (cmd.style) {
								if (cmd.style.includes("B")) thermalPrinterPhysical.bold(true);
								if (cmd.style.includes("U2"))
									thermalPrinterPhysical.underlineThick(true);
								else if (cmd.style.includes("U"))
									thermalPrinterPhysical.underline(true);
								if (cmd.style.includes("I"))
									thermalPrinterPhysical.invert(true);
							}
							if (
								cmd.size &&
								Array.isArray(cmd.size) &&
								cmd.size.length === 2
							) {
								thermalPrinterPhysical.setTextSize(
									Math.max(0, cmd.size[0] - 1),
									Math.max(0, cmd.size[1] - 1)
								);
							}
							thermalPrinterPhysical.println(
								String(cmd.content || cmd.text || "")
							);
							break;
						case "feed":
							thermalPrinterPhysical.feed(parseInt(cmd.lines, 10) || 1);
							break;
						case "cut":
							thermalPrinterPhysical.cut(
								cmd.mode === "FULL" ? BreakLine.FULL : BreakLine.PART
							);
							break;
						case "beep":
							thermalPrinterPhysical.beep(
								parseInt(cmd.n, 10) || 1,
								parseInt(cmd.t, 10) || 100
							);
							break;
						case "align":
							if (cmd.align)
								thermalPrinterPhysical.align(cmd.align.toUpperCase());
							break;
						case "setstyles":
							if (cmd.align)
								thermalPrinterPhysical.align(cmd.align.toUpperCase());
							if (cmd.style) {
								if (cmd.style.includes("B"))
									thermalPrinterPhysical.bold(true); /* ... */
							}
							if (cmd.size) {
								thermalPrinterPhysical.setTextSize(
									Math.max(0, cmd.size[0] - 1),
									Math.max(0, cmd.size[1] - 1)
								);
							}
							break;
						case "resetstyles":
							resetStylesPhysical();
							break;
						case "barcode":
							thermalPrinterPhysical.align(alignCmd);
							thermalPrinterPhysical.printBarcode(
								String(cmd.content || cmd.value),
								cmd.barcodeType || 73,
								{
									height: cmd.height || 50,
									width: cmd.width || 2,
									hriPos: cmd.hriPos || 0,
									hriFont: cmd.hriFont || 0,
									...(cmd.options || {}),
								}
							);
							break;
						case "qr":
							thermalPrinterPhysical.align(alignCmd);
							await thermalPrinterPhysical.printQR(
								String(cmd.content || cmd.value),
								{
									cellSize: cmd.cellSize || 3,
									correction: cmd.correction || "M",
									model: cmd.model || 2,
								}
							);
							break;
						case "image":
							thermalPrinterPhysical.align(alignCmd);
							if (cmd.path) {
								try {
									await thermalPrinterPhysical.printImage(cmd.path);
								} catch (e) {
									console.error("Img Path Err", e);
									thermalPrinterPhysical.println("[ImgErr]");
								}
							} else {
								thermalPrinterPhysical.println("[NoImgPth]");
							}
							break;
						case "imagebuffer":
							thermalPrinterPhysical.align(alignCmd);
							if (cmd.buffer) {
								try {
									await thermalPrinterPhysical.printImageBuffer(
										Buffer.from(cmd.buffer, "base64")
									);
								} catch (e) {
									console.error("ImgBuffErr", e);
									thermalPrinterPhysical.println("[ImgBuffErr]");
								}
							} else {
								thermalPrinterPhysical.println("[NoImgBf]");
							}
							break;
						case "drawline":
							thermalPrinterPhysical.drawLine();
							break;
						case "raw":
							thermalPrinterPhysical.raw(
								Buffer.isBuffer(cmd.content)
									? cmd.content
									: Buffer.from(String(cmd.content || ""), "hex")
							);
							break;
						default:
							console.warn(
								`API Print Physical: Unhandled cmd type '${cmd.type}'.`
							);
					}
				}

				resetStylesPhysical();
				if (!printData.some((cmd) => cmd.type?.toLowerCase() === "cut")) {
					thermalPrinterPhysical.cut(BreakLine.PART);
				}

				const executeResultPhysical = await thermalPrinterPhysical.execute();
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
					res
						.status(500)
						.json({
							error: `Print failed for physical printer '${config.name}': ${physicalPrintError.message}`,
						});
				}
			}
		}
	});

	const server = app.listen(API_PORT, "0.0.0.0", () => {
		console.log(`Bridge API Server (Virtual Print Enabled) listening.`);
		console.log(`  Local: http://localhost:${API_PORT}`);
	});
	server.on("error", (error) => {
		/* ... (server error handling) ... */
	});
	return server;
}
