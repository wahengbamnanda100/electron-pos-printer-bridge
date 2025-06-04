// src/bridge-api.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { BrowserWindow } from "electron"; // Needed for creating hidden print window
import fs from "fs/promises"; // For async file operations
import path from "path"; // For path manipulation
import os from "os"; // For temporary directory

import { exec } from "child_process";
import usb from "usb";
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

async function generatePrintBufferNTP(printDataArray, printerOptions = {}) {
	const ntp = new ThermalPrinter({
		type:
			(printerOptions?.type &&
				PrinterTypes[printerOptions.type.toUpperCase()]) ||
			PrinterTypes.EPSON,
		characterSet:
			(printerOptions?.characterSet &&
				CharacterSet[printerOptions.characterSet.toUpperCase()]) ||
			CharacterSet.UTF_8,
		// No 'interface' as we only want the buffer
	});

	const resetStyles = () => {
		/* ... (define resetStyles using ntp.align, ntp.setTextNormal etc.) ... */
		ntp.align("LT");
		ntp.setTextNormal();
		ntp.bold(false);
		ntp.underline(false);
		ntp.underlineThick(false);
		ntp.invert(false);
	};
	if (printerOptions?.initialAlign)
		ntp.align(printerOptions.initialAlign.toUpperCase());

	for (const cmd of printDataArray) {
		if (
			cmd.type?.toLowerCase() !== "setstyles" &&
			cmd.type?.toLowerCase() !== "resetstyles"
		)
			resetStyles();
		const alignCmd = cmd.align ? cmd.align.toUpperCase() : "LT";
		switch (cmd.type?.toLowerCase()) {
			case "text":
			case "println":
				ntp.align(alignCmd);
				if (cmd.style) {
					if (cmd.style.includes("B")) ntp.bold(true);
					if (cmd.style.includes("U2")) ntp.underlineThick(true);
					else if (cmd.style.includes("U")) ntp.underline(true);
					if (cmd.style.includes("I")) ntp.invert(true);
				}
				if (cmd.size && Array.isArray(cmd.size) && cmd.size.length === 2) {
					ntp.setTextSize(
						Math.max(0, cmd.size[0] - 1),
						Math.max(0, cmd.size[1] - 1)
					);
				}
				ntp.println(String(cmd.content || cmd.text || ""));
				break;
			case "feed":
				ntp.feed(parseInt(cmd.lines, 10) || 1);
				break;
			case "cut":
				ntp.cut(cmd.mode === "FULL" ? BreakLine.FULL : BreakLine.PART);
				break;
			case "beep":
				ntp.beep(parseInt(cmd.n, 10) || 1, parseInt(cmd.t, 10) || 100);
				break;
			case "align":
				if (cmd.align) ntp.align(cmd.align.toUpperCase());
				break;
			case "setstyles":
				if (cmd.align) ntp.align(cmd.align.toUpperCase());
				if (cmd.style) {
					/* ... */
				}
				if (cmd.size) {
					/* ... */
				}
				break;
			case "resetstyles":
				resetStyles();
				break;
			case "barcode":
				ntp.align(alignCmd);
				ntp.printBarcode(
					String(cmd.content || cmd.value),
					parseInt(cmd.barcodeType, 10) || 73,
					{
						/* ... */
					}
				);
				break;
			case "qr":
				ntp.align(alignCmd);
				await ntp.printQR(String(cmd.content || cmd.value), {
					/* ... */
				});
				break;
			case "image":
				ntp.align(alignCmd);
				if (cmd.path) {
					try {
						await ntp.printImage(cmd.path);
					} catch (e) {
						ntp.println("[ImgErrP]");
					}
				} else {
					ntp.println("[NoImgPth]");
				}
				break;
			case "imagebuffer":
				ntp.align(alignCmd);
				if (cmd.buffer) {
					try {
						await ntp.printImageBuffer(Buffer.from(cmd.buffer, "base64"));
					} catch (e) {
						ntp.println("[ImgErrB]");
					}
				} else {
					ntp.println("[NoImgBf]");
				}
				break;
			case "drawline":
				ntp.drawLine();
				break;
			case "raw":
				ntp.raw(
					Buffer.isBuffer(cmd.content)
						? cmd.content
						: Buffer.from(String(cmd.content || ""), "hex")
				);
				break;
			case "tablecustom":
				if (cmd.data) {
					const opts = { ...cmd.options };
					/* ... process col styles for NTP table ... */ ntp.tableCustom(
						cmd.data,
						opts
					);
				}
				break;
			default:
				console.warn(`NTP Buffer Gen: Unhandled cmd type '${cmd.type}'.`);
		}
	}
	resetStyles();
	if (!printDataArray.some((cmd) => cmd.type?.toLowerCase() === "cut"))
		ntp.cut(BreakLine.PART);

	return ntp.getBuffer();
}

export function startApiServer(getDiscoveredPrinters) {
	// const app = express();
	// app.use(cors({ origin: "*" }));
	// app.use(bodyParser.json({ limit: "10mb" }));
	// app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

	// app.get("/api/printers", (req, res) => {
	// 	const printers = getDiscoveredPrinters();
	// 	if (!printers) {
	// 		console.warn(
	// 			"API /api/printers: getDiscoveredPrinters returned null/undefined."
	// 		);
	// 		return res.status(500).json({ error: "Printer list unavailable." });
	// 	}
	// 	res.json(printers.map(p => ({id:p.id, name:p.name, connectionType: p.connectionType, status:p.status, description: p.description, isDefault:p.isDefault, isVirtual:p.isVirtual})))
	// });
	// });

	// app.post("/api/print", async (req, res) => {
	// 	const { printerName, printData, printerOptions } = req.body;

	// 	if (!printerName)
	// 		return res.status(400).json({ error: "Missing 'printerName'." });
	// 	if (!printData || !Array.isArray(printData))
	// 		return res.status(400).json({ error: "Invalid 'printData'." });

	// 	const printers = getDiscoveredPrinters();
	// 	if (!printers)
	// 		return res.status(500).json({ error: "Printer config unavailable." });

	// 	const config = printers.find(
	// 		(p) => p.name.toLowerCase() === printerName.toLowerCase()
	// 	);
	// 	if (!config)
	// 		return res
	// 			.status(404)
	// 			.json({ error: `Printer named '${printerName}' not found.` });

	// 	console.log(
	// 		`API Print: Job for '${config.name}' (Virtual: ${config.isVirtual}, Type: ${config.type})`
	// 	);

	// 	let printDataArray;

	// if (config.isVirtual) {
	// 	// --- VIRTUAL PRINTER (Electron WebContents Print) ---
	// 	console.log(`API Print: Handling as VIRTUAL PRINTER: ${config.name}`);
	// 	try {
	// 		const htmlContent = commandsToSimpleHtml(
	// 			printData,
	// 			`Print Output for ${config.name}`
	// 		);
	// 		const tempHtmlPath = path.join(
	// 			os.tmpdir(),
	// 			`bridge_print_${Date.now()}.html`
	// 		);
	// 		await fs.writeFile(tempHtmlPath, htmlContent, "utf8");
	// 		console.log(`API Print: Temp HTML for virtual print: ${tempHtmlPath}`);

	// 		// Create a new, hidden browser window to load and print the HTML.
	// 		// This window is destroyed after printing.
	// 		const printJobWindow = new BrowserWindow({
	// 			show: false, // Keep it hidden
	// 			webPreferences: {
	// 				nodeIntegration: false,
	// 				contextIsolation: true,
	// 				// images: true, // Ensure images are enabled if your HTML has them
	// 				// offscreen: true, // Consider if truly offscreen rendering is better
	// 			},
	// 		});

	// 		await printJobWindow.loadFile(tempHtmlPath);
	// 		console.log(
	// 			`API Print: Content loaded into hidden print window for '${config.name}'.`
	// 		);

	// 		// webContents.print() is asynchronous, providing a callback
	// 		printJobWindow.webContents.print(
	// 			{
	// 				silent:
	// 					printerOptions?.silent !== undefined
	// 						? printerOptions.silent
	// 						: true, // Default to silent
	// 				deviceName: config.name, // Specify the target OS printer name
	// 				printBackground:
	// 					printerOptions?.printBackground !== undefined
	// 						? printerOptions.printBackground
	// 						: true,
	// 				color: printerOptions?.color || false, // Receipts usually monochrome
	// 				margins: printerOptions?.margins || { marginType: "printableArea" }, // 'default', 'none', 'printableArea', 'custom'
	// 				landscape: printerOptions?.landscape || false,
	// 				scaleFactor: printerOptions?.scaleFactor || 100,
	// 				pagesPerSheet: printerOptions?.pagesPerSheet || 1,
	// 				collate: printerOptions?.collate || false,
	// 				copies: printerOptions?.copies || 1,
	// 				pageRanges: printerOptions?.pageRanges || [], // [{from:0, to:0}] for first page
	// 				// header: printerOptions?.header, // Not usually used for this type of print
	// 				// footer: printerOptions?.footer,
	// 			},
	// 			(success, failureReason) => {
	// 				if (!printJobWindow.isDestroyed()) {
	// 					// Check if window still exists
	// 					printJobWindow.close(); // Ensure hidden window is closed
	// 				}
	// 				fs.unlink(tempHtmlPath).catch((err) =>
	// 					console.error("API Print: Error deleting temp HTML:", err)
	// 				); // Clean up

	// 				if (success) {
	// 					console.log(
	// 						`API Print: Successfully initiated print to virtual printer '${config.name}'.`
	// 					);
	// 					if (!res.headersSent)
	// 						res.json({
	// 							success: true,
	// 							message: `Content sent to virtual printer '${config.name}'.`,
	// 						});
	// 				} else {
	// 					console.error(
	// 						`API Print: Failed to print to virtual printer '${config.name}'. Reason: ${failureReason}`
	// 					);
	// 					if (!res.headersSent)
	// 						res.status(500).json({
	// 							error: `Print to '${config.name}' failed: ${failureReason}`,
	// 						});
	// 				}
	// 			}
	// 		);
	// 	} catch (virtualPrintError) {
	// 		console.error(
	// 			`API Print: Error setting up virtual print for '${config.name}': ${virtualPrintError.message}`,
	// 			virtualPrintError
	// 		);
	// 		if (!res.headersSent)
	// 			res.status(500).json({
	// 				error: `Failed to prepare print for '${config.name}': ${virtualPrintError.message}`,
	// 			});
	// 	}
	// } else {
	// 	// --- PHYSICAL PRINTER (node-thermal-printer) ---
	// 	console.log(`API Print: Handling as PHYSICAL PRINTER: ${config.name}`);
	// 	let thermalPrinterPhysical; // Use different variable name to avoid scope issues if thermalPrinter was global
	// 	try {
	// 		let interfaceOptPhysical;
	// 		const printerDriverTypePhysical =
	// 			printerOptions &&
	// 			printerOptions.type &&
	// 			PrinterTypes[printerOptions.type.toUpperCase()]
	// 				? PrinterTypes[printerOptions.type.toUpperCase()]
	// 				: PrinterTypes.EPSON;
	// 		const charSetPhysical =
	// 			printerOptions &&
	// 			printerOptions.characterSet &&
	// 			CharacterSet[printerOptions.characterSet.toUpperCase()]
	// 				? CharacterSet[printerOptions.characterSet.toUpperCase()]
	// 				: CharacterSet.UTF_8;
	// 		const timeoutPhysical = printerOptions?.timeout || 5000;

	// 		if (config.type === "electron_os") {
	// 			// Should be physical if not config.isVirtual
	// 			if (!config.osName)
	// 				throw new Error(
	// 					`Config error: 'osName' missing for OS printer '${config.name}'.`
	// 				);
	// 			interfaceOptPhysical = `printer:${config.osName}`;
	// 		} else if (config.type === "lan_mdns") {
	// 			if (!config.ip || !config.port)
	// 				throw new Error(
	// 					`Config error: 'ip'/'port' missing for mDNS LAN printer '${config.name}'.`
	// 				);
	// 			interfaceOptPhysical = `tcp://${config.ip}:${config.port}`;
	// 		} else {
	// 			// This fallback should ideally not be reached if types are well-managed
	// 			console.warn(
	// 				`API Print: Printer '${config.name}' (type '${config.type}') falling back to OS name interface.`
	// 			);
	// 			interfaceOptPhysical = `printer:${config.name}`;
	// 		}

	// 		const ntpInstance = {
	// 			type: printerDriverTypePhysical,
	// 			interface: interfaceOptPhysical,
	// 			characterSet: charSetPhysical,
	// 			removeSpecialCharacters:
	// 				printerOptions?.removeSpecialCharacters || false,
	// 			lineCharacter: printerOptions?.lineCharacter || "-",
	// 			timeout: timeoutPhysical,
	// 			driver: printerOptions?.driver || "printer",
	// 		};

	// 		console.log(
	// 			"API Print: ThermalPrinter config for physical:",
	// 			JSON.stringify(ntpInstance, null, 2)
	// 		);

	// 		console.log(
	// 			`API Print: Creating ThermalPrinter instance for physical '${config}' with interface '${interfaceOptPhysical}' and driver type '${printerDriverTypePhysical}'.`
	// 		);

	// 		thermalPrinterPhysical = new ThermalPrinter(ntpInstance);

	// 		const resetStylesPhysical = () => {
	// 			/* ... same resetStyles as previously defined, using thermalPrinterPhysical ... */
	// 			thermalPrinterPhysical.align("LT");
	// 			thermalPrinterPhysical.setTextNormal();
	// 			thermalPrinterPhysical.bold(false);
	// 			thermalPrinterPhysical.underline(false);
	// 			thermalPrinterPhysical.underlineThick(false);
	// 			thermalPrinterPhysical.invert(false);
	// 		};
	// 		if (printerOptions?.initialAlign)
	// 			thermalPrinterPhysical.align(
	// 				printerOptions.initialAlign.toUpperCase()
	// 			);

	// 		for (const cmd of printData) {
	// 			// Your extensive switch case for commands
	// 			resetStylesPhysical(); // Reset before most commands
	// 			const alignCmd = cmd.align ? cmd.align.toUpperCase() : "LT";
	// 			switch (cmd.type?.toLowerCase()) {
	// 				case "text":
	// 				case "println":
	// 					thermalPrinterPhysical.align(alignCmd);
	// 					if (cmd.style) {
	// 						if (cmd.style.includes("B")) thermalPrinterPhysical.bold(true);
	// 						if (cmd.style.includes("U2"))
	// 							thermalPrinterPhysical.underlineThick(true);
	// 						else if (cmd.style.includes("U"))
	// 							thermalPrinterPhysical.underline(true);
	// 						if (cmd.style.includes("I"))
	// 							thermalPrinterPhysical.invert(true);
	// 					}
	// 					if (
	// 						cmd.size &&
	// 						Array.isArray(cmd.size) &&
	// 						cmd.size.length === 2
	// 					) {
	// 						thermalPrinterPhysical.setTextSize(
	// 							Math.max(0, cmd.size[0] - 1),
	// 							Math.max(0, cmd.size[1] - 1)
	// 						);
	// 					}
	// 					thermalPrinterPhysical.println(
	// 						String(cmd.content || cmd.text || "")
	// 					);
	// 					break;
	// 				case "feed":
	// 					thermalPrinterPhysical.feed(parseInt(cmd.lines, 10) || 1);
	// 					break;
	// 				case "cut":
	// 					thermalPrinterPhysical.cut(
	// 						cmd.mode === "FULL" ? BreakLine.FULL : BreakLine.PART
	// 					);
	// 					break;
	// 				case "beep":
	// 					thermalPrinterPhysical.beep(
	// 						parseInt(cmd.n, 10) || 1,
	// 						parseInt(cmd.t, 10) || 100
	// 					);
	// 					break;
	// 				case "align":
	// 					if (cmd.align)
	// 						thermalPrinterPhysical.align(cmd.align.toUpperCase());
	// 					break;
	// 				case "setstyles":
	// 					if (cmd.align)
	// 						thermalPrinterPhysical.align(cmd.align.toUpperCase());
	// 					if (cmd.style) {
	// 						if (cmd.style.includes("B"))
	// 							thermalPrinterPhysical.bold(true); /* ... */
	// 					}
	// 					if (cmd.size) {
	// 						thermalPrinterPhysical.setTextSize(
	// 							Math.max(0, cmd.size[0] - 1),
	// 							Math.max(0, cmd.size[1] - 1)
	// 						);
	// 					}
	// 					break;
	// 				case "resetstyles":
	// 					resetStylesPhysical();
	// 					break;
	// 				case "barcode":
	// 					thermalPrinterPhysical.align(alignCmd);
	// 					thermalPrinterPhysical.printBarcode(
	// 						String(cmd.content || cmd.value),
	// 						cmd.barcodeType || 73,
	// 						{
	// 							height: cmd.height || 50,
	// 							width: cmd.width || 2,
	// 							hriPos: cmd.hriPos || 0,
	// 							hriFont: cmd.hriFont || 0,
	// 							...(cmd.options || {}),
	// 						}
	// 					);
	// 					break;
	// 				case "qr":
	// 					thermalPrinterPhysical.align(alignCmd);
	// 					await thermalPrinterPhysical.printQR(
	// 						String(cmd.content || cmd.value),
	// 						{
	// 							cellSize: cmd.cellSize || 3,
	// 							correction: cmd.correction || "M",
	// 							model: cmd.model || 2,
	// 						}
	// 					);
	// 					break;
	// 				case "image":
	// 					thermalPrinterPhysical.align(alignCmd);
	// 					if (cmd.path) {
	// 						try {
	// 							await thermalPrinterPhysical.printImage(cmd.path);
	// 						} catch (e) {
	// 							console.error("Img Path Err", e);
	// 							thermalPrinterPhysical.println("[ImgErr]");
	// 						}
	// 					} else {
	// 						thermalPrinterPhysical.println("[NoImgPth]");
	// 					}
	// 					break;
	// 				case "imagebuffer":
	// 					thermalPrinterPhysical.align(alignCmd);
	// 					if (cmd.buffer) {
	// 						try {
	// 							await thermalPrinterPhysical.printImageBuffer(
	// 								Buffer.from(cmd.buffer, "base64")
	// 							);
	// 						} catch (e) {
	// 							console.error("ImgBuffErr", e);
	// 							thermalPrinterPhysical.println("[ImgBuffErr]");
	// 						}
	// 					} else {
	// 						thermalPrinterPhysical.println("[NoImgBf]");
	// 					}
	// 					break;
	// 				case "drawline":
	// 					thermalPrinterPhysical.drawLine();
	// 					break;
	// 				case "raw":
	// 					thermalPrinterPhysical.raw(
	// 						Buffer.isBuffer(cmd.content)
	// 							? cmd.content
	// 							: Buffer.from(String(cmd.content || ""), "hex")
	// 					);
	// 					break;
	// 				default:
	// 					console.warn(
	// 						`API Print Physical: Unhandled cmd type '${cmd.type}'.`
	// 					);
	// 			}
	// 		}

	// 		resetStylesPhysical();
	// 		if (!printData.some((cmd) => cmd.type?.toLowerCase() === "cut")) {
	// 			thermalPrinterPhysical.cut(BreakLine.PART);
	// 		}

	// 		const executeResultPhysical = await thermalPrinterPhysical.execute();
	// 		console.log(
	// 			`API Print: Execute() for physical '${config.name}'. Result:`,
	// 			executeResultPhysical
	// 		);
	// 		if (!res.headersSent) {
	// 			res.json({
	// 				success: true,
	// 				message: `Print job sent to physical printer '${config.name}'.`,
	// 			});
	// 		}
	// 	} catch (physicalPrintError) {
	// 		console.error(
	// 			`API Print Error (Physical) for '${config.name}': ${physicalPrintError.message}`,
	// 			physicalPrintError.stack
	// 		);
	// 		if (!res.headersSent) {
	// 			res.status(500).json({
	// 				error: `Print failed for physical printer '${config.name}': ${physicalPrintError.message}`,
	// 			});
	// 		}
	// 	}
	// }
	// });

	const app = express();
	app.use(cors({ origin: "*" }));
	app.use(bodyParser.json({ limit: "10mb" }));
	app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

	app.get("/api/printers", (req, res) => {
		/* ... (same as before, ensure 'isVirtual' and 'connectionType' are sent) ... */
		const printers = getDiscoveredPrinters();
		if (!printers)
			return res.status(500).json({ error: "Printer list unavailable" });
		res.json(
			printers.map((p) => ({
				id: p.id,
				name: p.name,
				connectionType: p.connectionType,
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
		if (templateData === undefined)
			return res.status(400).json({ error: "Missing 'templateData'." });

		const printers = getDiscoveredPrinters();
		if (!printers)
			return res
				.status(500)
				.json({ error: "Printer configuration unavailable." });

		const config = printers.find(
			(p) => p.name.toLowerCase() === printerName.toLowerCase()
		);
		if (!config)
			return res
				.status(404)
				.json({ error: `Printer named '${printerName}' not found.` });

		let printDataArray;
		try {
			const templateFunction = templateGenerators[templateType.toUpperCase()];
			if (!templateFunction)
				throw new Error(`Template type '${templateType}' not found.`);
			printDataArray = templateFunction(templateData);
			if (!Array.isArray(printDataArray))
				throw new Error("Template did not return an array of commands.");
			console.log(
				`API Print: Generated ${printDataArray.length} commands via template '${templateType}'.`
			);
		} catch (templateError) {
			return res
				.status(500)
				.json({ error: `Template error: ${templateError.message}` });
		}

		console.log(
			`API Print: Job for '${config.name}' (ConnType: ${config.connectionType}, Virtual: ${config.isVirtual})`
		);

		if (config.connectionType === "VIRTUAL") {
			// --- VIRTUAL PRINTER (Electron WebContents Print) ---
			console.log(`API Print: Handling VIRTUAL printer '${config.name}'`);
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
								res.status(500).json({
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
					res.status(500).json({
						error: `Failed to prepare print for '${config.name}': ${virtualPrintError.message}`,
					});
			}
			// For brevity, assuming it's correctly placed here.
		} else if (config.connectionType === "RAW_USB") {
			// --- RAW USB PRINTER (using 'node-usb' package directly) ---
			const logPrefix = `API_PRINT_RAW_USB [${config.name}]:`;
			console.log(`${logPrefix} Handling printer.`);
			if (!config.vid || !config.pid)
				return res
					.status(400)
					.json({ error: "RAW_USB config missing VID/PID." });

			let usbDevice = null; // From 'usb' package
			try {
				const rawBuffer = await generatePrintBufferNTP(
					printDataArray,
					printerOptions
				);
				if (!rawBuffer || rawBuffer.length === 0)
					throw new Error("NTP generated empty buffer.");
				console.log(
					`${logPrefix} Generated ${rawBuffer.length} bytes for printing.`
				);

				usbDevice = usb.findByIds(config.vid, config.pid);
				if (!usbDevice)
					throw new Error(
						`Device VID:0x${config.vid.toString(
							16
						)} PID:0x${config.pid.toString(16)} not found. Disconnected?`
					);

				await new Promise((resolve, reject) => {
					usbDevice.open();
					setTimeout(resolve, 50);
				}); // Ensure open, small delay
				console.log(`${logPrefix} Device opened.`);

				let outEndpoint = null;
				if (!usbDevice.interfaces) {
					// Attempt reset if no interfaces visible (e.g. kernel driver)
					console.log(
						`${logPrefix} No interfaces visible, attempting reset...`
					);
					await new Promise((resolveReset, rejectReset) => {
						usbDevice.reset((error) =>
							error ? rejectReset(error) : setTimeout(resolveReset, 200)
						); // reset + delay
					});
					usbDevice = usb.findByIds(config.vid, config.pid); // Re-fetch device context
					if (!usbDevice || !usbDevice.interfaces)
						throw new Error("Could not get interfaces after reset.");
				}

				for (const iface of usbDevice.interfaces) {
					try {
						if (iface.isKernelDriverActive()) {
							console.log(
								`${logPrefix} Detaching kernel driver for interface ${iface.interfaceNumber}...`
							);
							await new Promise((resD, rejD) => {
								iface.detachKernelDriver();
								setTimeout(resD, 100);
							});
						}
						await new Promise((resC, rejC) => {
							iface.claim();
							setTimeout(resC, 50);
						});
						console.log(
							`${logPrefix} Claimed interface ${iface.interfaceNumber}.`
						);
						for (const endpoint of iface.endpoints) {
							if (endpoint.direction === "out") {
								outEndpoint = endpoint;
								break;
							}
						}
						if (outEndpoint) break;
						else iface.release(true, () => {}); // Release if no OUT endpoint
					} catch (claimErr) {
						console.warn(
							`${logPrefix} Could not claim IF ${iface.interfaceNumber}: ${claimErr.message}.`
						);
					}
				}
				if (!outEndpoint)
					throw new Error(
						"No suitable OUT endpoint found. Ensure printer is connected and driver allows access (e.g., Zadig for WinUSB on Windows if needed)."
					);
				console.log(`${logPrefix} Using OUT endpoint: ${outEndpoint.address}`);

				await new Promise((resolve, reject) => {
					// Promisify transfer
					outEndpoint.transfer(rawBuffer, (err) => {
						if (err)
							reject(new Error(`USB Transfer Error: ${err.message || err}`));
						else resolve();
					});
				});
				console.log(`${logPrefix} USB transfer complete.`);

				const ifaceToRelease = usbDevice.interfaces?.find(
					(i) => i.interfaceNumber === outEndpoint.interfaceNumber
				);
				if (ifaceToRelease && ifaceToRelease.claimed)
					await new Promise((r) => ifaceToRelease.release(true, r));

				if (!res.headersSent)
					res.json({
						success: true,
						message: `Job sent to RAW_USB printer '${config.name}'.`,
					});
			} catch (rawError) {
				console.error(
					`${logPrefix} Error: ${rawError.message}`,
					rawError.stack
				);
				if (!res.headersSent)
					res.status(500).json({
						error: `RAW_USB print failed for '${config.name}': ${rawError.message}`,
					});
			} finally {
				if (usbDevice && usbDevice.opened) {
					try {
						usbDevice.close();
					} catch (e) {
						console.error(`${logPrefix} Device close error:`, e);
					}
				}
			}
		} else if (config.connectionType === "MDNS_LAN") {
			// --- MDNS LAN PRINTER (node-thermal-printer via TCP) ---
			console.log(
				`API Print: Handling MDNS_LAN printer '${config.name}' via NTP/TCP.`
			);
			// ... (Full NTP logic for TCP connection, command processing, and execute as in the "Complete bridge-api code also" response) ...
		} else if (
			config.connectionType &&
			config.connectionType.startsWith("OS_")
		) {
			// --- OS-QUEUED PHYSICAL PRINTER (OS Command Line: Out-Printer / lp) ---
			console.log(
				`API Print: Handling OS_ printer '${config.name}' via OS command line.`
			);
			// ... (Full logic for generating NTP buffer and using child_process.exec with OS command as in the "can we use this package to get printers..." response, section about OS Command-Line Printing) ...
		} else {
			console.error(
				`API Print: Unhandled printer config for printing: ConnType='${config.connectionType}' for '${config.name}'`
			);
			if (!res.headersSent)
				res.status(400).json({
					error: `Cannot print: unhandled config for '${config.name}'.`,
				});
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
