import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { BrowserWindow } from "electron"; // For virtual printing
import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process"; // For OS command line printing

import {
	ThermalPrinter,
	PrinterTypes,
	CharacterSet,
	BreakLine,
} from "node-thermal-printer";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

let PosPrinter; // From @plick/electron-pos-printer
try {
	const plickLib = require("@plick/electron-pos-printer");
	PosPrinter = plickLib.PosPrinter;
	if (!PosPrinter) {
		throw new Error(
			"PosPrinter class not found in @plick/electron-pos-printer module."
		);
	}
	console.log(
		"Successfully loaded PosPrinter from @plick/electron-pos-printer"
	);
} catch (e) {
	console.error(
		"FATAL: Failed to require or access PosPrinter from '@plick/electron-pos-printer'. Ensure it is installed and compiled correctly.",
		e
	);
	PosPrinter = {
		print: async () => {
			throw new Error(
				"@plick/electron-pos-printer not loaded. Printing unavailable."
			);
		},
	}; // Stub to prevent further crashes if library is missing
}

// --- Import your template generators ---
// import { generateStandardReceipt } from "./templates/standardReceipt.js";
// import { generateKitchenOrderTicket } from "./templates/kitchenOrderTicket.js";
import { generateTwKitchenTakeawayTicket } from "./templates/kot_save_recipt.js";

const API_PORT = process.env.API_PORT || 3030;

const templateGenerators = {
	KOT_SAVE: generateTwKitchenTakeawayTicket,
	// Add more template identifiers and their corresponding functions here
};

// Helper to convert NTP-style command objects to Plick EPP's PosPrintData[] format
function mapNTPCommandsToPlickData(ntpCommands, printerOptions = {}) {
	const plickData = [];
	if (!Array.isArray(ntpCommands)) {
		console.error(
			"mapNTPCommandsToPlickData: input ntpCommands is not an array"
		);
		return [{ type: "text", value: "[Error: Invalid commands input]" }];
	}

	console.log(
		`mapNTPCommandsToPlickData: Converting ${ntpCommands.length} NTP commands to Plick format.`
	);

	for (const cmd of ntpCommands) {
		// Basic mapping, extend this based on your NTP command set and Plick's capabilities
		switch (cmd.type?.toLowerCase()) {
			case "text":
			case "println":
				plickData.push({
					type: "text",
					value: String(cmd.content || cmd.text || ""),
					style: {
						// Approximate style conversion - Plick uses CSS-like styles
						fontWeight: cmd.style?.includes("B") ? "bold" : "normal",
						textDecoration: cmd.style?.includes("U") ? "underline" : "none",
						textAlign:
							cmd.align?.toLowerCase() === "ct" ||
							cmd.align?.toLowerCase() === "center"
								? "center"
								: cmd.align?.toLowerCase() === "rt" ||
								  cmd.align?.toLowerCase() === "right"
								? "right"
								: "left",
						fontSize:
							cmd.size && cmd.size[0] >= 2 && cmd.size[1] >= 2
								? "20px"
								: cmd.size && (cmd.size[0] >= 1 || cmd.size[1] >= 1)
								? "16px"
								: "12px", // Example sizing
					},
				});
				break;
			case "feed":
				// Plick doesn't have a direct "feed" command. Simulate with newlines or styled margins.
				// Or, often, feeds are handled by ensuring each 'text' is a new line.
				// If you need explicit empty lines, send text entries with spaces or rely on default line breaks.
				const lines = parseInt(cmd.lines, 10) || 1;
				for (let i = 0; i < lines; i++) {
					plickData.push({ type: "text", value: " " }); // Adding a space, Plick might optimize empty values
				}
				break;
			case "cut":
				// Plick EPP handles cutting automatically or based on its own internal logic/options.
				// No direct mapping command type 'cut'. It might be an option in PosPrinter.print options for some printers.
				console.warn(
					"mapNTPCommandsToPlickData: 'cut' command has no direct Plick EPP data equivalent. Cutting is usually automatic."
				);
				break;
			case "barcode":
				plickData.push({
					type: "barCode", // Note: Plick's documentation shows 'barCode' (camelCase)
					value: String(cmd.content || cmd.value),
					height: parseInt(cmd.height, 10) || 40,
					width: parseInt(cmd.width, 10) || 2,
					displayValue: cmd.hriPos !== undefined ? cmd.hriPos > 0 : true, // Approximation
					// Plick uses 'fontSize' for displayValue, NTP uses hriFont
				});
				break;
			case "qr":
				plickData.push({
					type: "qrCode", // Note: Plick's documentation shows 'qrCode' (camelCase)
					value: String(cmd.content || cmd.value),
					height: parseInt(cmd.cellSize, 10) * 20 || 60, // Approximate conversion
					width: parseInt(cmd.cellSize, 10) * 20 || 60, // Plick uses overall width/height for QR
				});
				break;
			case "image":
				if (cmd.path) {
					plickData.push({
						type: "image",
						path: cmd.path, // Plick supports 'path' for local files
						position:
							cmd.align?.toLowerCase() === "ct" ||
							cmd.align?.toLowerCase() === "center"
								? "center"
								: cmd.align?.toLowerCase() === "rt" ||
								  cmd.align?.toLowerCase() === "right"
								? "right"
								: "left",
						// width: 'auto', // Plick has default image sizing or you can specify
						// height: 'auto',
					});
				} else {
					plickData.push({ type: "text", value: "[No Img Path]" });
				}
				break;
			case "imagebuffer":
				if (cmd.buffer) {
					// Plick expects a URL or path. For base64, use 'url' field.
					const base64Image = Buffer.from(cmd.buffer, "base64").toString(
						"base64"
					);
					plickData.push({
						type: "image",
						url: `data:image/png;base64,${base64Image}`, // Assuming PNG, adjust if needed
						position: "center",
					});
				} else {
					plickData.push({ type: "text", value: "[No ImgBufferData]" });
				}
				break;
			case "drawline": // NTP's drawLine is typically a line of dashes
				plickData.push({ type: "divider" }); // Plick's 'divider' type
				break;
			// tableCustom: This is complex. NTP's tableCustom is very different from Plick's 'table' type.
			// Plick's table has tableHeader, tableBody, tableFooter with structured {type: 'text', value: ...} cells.
			// A full mapping for tableCustom would be extensive. For now, a placeholder:
			case "tablecustom":
				plickData.push({
					type: "text",
					value:
						"[Table rendering via Plick requires specific Plick table format - mapping not fully implemented]",
				});
				console.warn(
					"mapNTPCommandsToPlickData: 'tablecustom' requires manual conversion to Plick's table structure."
				);
				break;

			// Styles, Align, Raw: These are generally not 1:1 or are handled differently.
			case "align": // Alignment should be part of the style of individual elements for Plick.
			case "setstyles":
			case "resetstyles":
				// These affect subsequent commands in NTP. Plick applies styles per element.
				// The mapping for text/println already tries to handle alignment/style from current cmd.
				break;
			case "raw":
				plickData.push({
					type: "text",
					value: "[RAW command not supported by Plick EPP via this mapping]",
				});
				console.warn(
					"mapNTPCommandsToPlickData: 'raw' command type is not directly mappable to Plick EPP's structured data."
				);
				break;
			default:
				console.warn(
					`mapNTPCommandsToPlickData: Unhandled NTP command type '${cmd.type}'.`
				);
				plickData.push({
					type: "text",
					value: `[Unsupported NTP command: ${cmd.type}]`,
				});
		}
	}
	if (plickData.length === 0 && ntpCommands.length > 0) {
		plickData.push({
			type: "text",
			value:
				"[Warning: No mappable Plick commands generated from NTP template]",
		});
	} else if (plickData.length === 0 && ntpCommands.length === 0) {
		plickData.push({ type: "text", value: "[Info: Empty template processed]" });
	}

	return plickData;
}

// Helper function to convert our command objects to simple HTML for virtual printers
function commandsToSimpleHtml(
	printDataArray,
	documentTitle = "Print Document"
) {
	let htmlBody = "";
	let currentAlignment = "left";

	printDataArray.forEach((cmd) => {
		let textContent = String(cmd.content || cmd.text || cmd.value || "");
		let styleString = "";
		let tag = "div";

		const cmdAlign = cmd.align?.toLowerCase();
		if (cmd.type?.toLowerCase() === "align" && cmdAlign) {
			currentAlignment =
				cmdAlign === "ct" || cmdAlign === "center"
					? "center"
					: cmdAlign === "rt" || cmdAlign === "right"
					? "right"
					: "left";
		}
		let effectiveAlign = cmd.align
			? cmd.align.toLowerCase() === "ct" || cmd.align.toLowerCase() === "center"
				? "center"
				: cmd.align.toLowerCase() === "rt" ||
				  cmd.align.toLowerCase() === "right"
				? "right"
				: "left"
			: currentAlignment;
		styleString += `text-align: ${effectiveAlign};`;

		if (cmd.style) {
			if (cmd.style.includes("B")) styleString += "font-weight: bold;";
			if (cmd.style.includes("U")) styleString += "text-decoration: underline;";
		}
		if (cmd.size && Array.isArray(cmd.size)) {
			const widthFactor = cmd.size[0] || 1;
			const heightFactor = cmd.size[1] || 1;
			if (widthFactor >= 3 || heightFactor >= 3)
				styleString += "font-size: 2em; line-height:1.1; margin-bottom: 0.1em;";
			else if (widthFactor >= 2 || heightFactor >= 2)
				styleString +=
					"font-size: 1.5em; line-height:1.1; margin-bottom: 0.05em;";
			else styleString += "font-size: 1em;";
		} else {
			styleString += "font-size: 1em;";
		}

		switch (cmd.type?.toLowerCase()) {
			case "text":
			case "println":
				htmlBody += `<${tag} style="${styleString}"><pre>${textContent}</pre></${tag}>\n`;
				break;
			case "setstyles":
				if (cmd.align) currentAlignment = cmd.align.toLowerCase();
				break;
			case "resetstyles":
				currentAlignment = "left";
				break;
			case "feed":
				htmlBody += "<br>".repeat(parseInt(cmd.lines, 10) || 1);
				break;
			case "drawline":
				htmlBody +=
					'<hr style="border:none; border-top: 1px dashed #555; margin: 8px 0;">\n';
				break;
			case "barcode":
				htmlBody += `<div style="${styleString}">[BARCODE: ${textContent}]</div>\n`;
				break;
			case "qr":
				htmlBody += `<div style="${styleString}">[QR CODE: ${textContent}]</div>\n`;
				break;
			case "tablecustom":
				htmlBody +=
					'<table border="0" style="width:100%; border-collapse: collapse; margin-bottom: 10px; font-size: 0.9em;"><tbody>';
				if (cmd.data && Array.isArray(cmd.data)) {
					cmd.data.forEach((row) => {
						htmlBody += "<tr>";
						row.forEach((cell, cellIndex) => {
							let cellHtmlStyle = "padding: 1px 2px; border: none;";
							if (cmd.options?.columns?.[cellIndex]) {
								const colOpt = cmd.options.columns[cellIndex];
								if (colOpt.align === "RIGHT")
									cellHtmlStyle += "text-align:right;";
								else if (colOpt.align === "CENTER")
									cellHtmlStyle += "text-align:center;";
								else cellHtmlStyle += "text-align:left;";
								if (colOpt.style?.includes("B"))
									cellHtmlStyle += "font-weight:bold;";
								if (colOpt.size?.[1] >= 2) cellHtmlStyle += "font-size:1.4em;"; // Example mapping
							}
							htmlBody += `<td style="${cellHtmlStyle}">${String(cell)}</td>`;
						});
						htmlBody += "</tr>";
					});
				}
				htmlBody += "</tbody></table>\n";
				break;
		}
	});
	return `<!DOCTYPE html><html><head><title>${documentTitle}</title><meta charset="UTF-8"><style>body{font-family:'Courier New',Courier,monospace;margin:10mm;font-size:10pt}pre{white-space:pre-wrap;margin:0;padding:0;line-height:1.2}div{margin-bottom:1px;line-height:1.2}table,th,td{border:none!important}</style></head><body>${htmlBody}</body></html>`;
}

// Helper to generate raw ESC/POS buffer using node-thermal-printer (for RAW_USB and OS_CMD paths)
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
	});

	const resetStylesNTP = () => {
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
			resetStylesNTP();
		const alignCmdNTP = cmd.align ? cmd.align.toUpperCase() : "LT";
		switch (cmd.type?.toLowerCase()) {
			case "text":
			case "println":
				ntp.align(alignCmdNTP);
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
					if (cmd.style.includes("B")) ntp.bold(true); /* etc */
				}
				if (cmd.size) {
					ntp.setTextSize(
						Math.max(0, cmd.size[0] - 1),
						Math.max(0, cmd.size[1] - 1)
					);
				}
				break;
			case "resetstyles":
				resetStylesNTP();
				break;
			case "barcode":
				ntp.align(alignCmdNTP);
				ntp.printBarcode(
					String(cmd.content || cmd.value),
					parseInt(cmd.barcodeType, 10) || 73, // Code128
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
				ntp.align(alignCmdNTP);
				await ntp.printQR(String(cmd.content || cmd.value), {
					cellSize: parseInt(cmd.cellSize, 10) || 3,
					correction: cmd.correction || "M",
					model: parseInt(cmd.model, 10) || 2,
				});
				break;
			case "image":
				ntp.align(alignCmdNTP);
				if (cmd.path) {
					try {
						await ntp.printImage(cmd.path);
					} catch (e) {
						console.error("NTP printImage error:", e);
						ntp.println("[ImgPathErr]");
					}
				} else {
					ntp.println("[NoImgPath]");
				}
				break;
			case "imagebuffer":
				ntp.align(alignCmdNTP);
				if (cmd.buffer) {
					try {
						await ntp.printImageBuffer(Buffer.from(cmd.buffer, "base64"));
					} catch (e) {
						console.error("NTP printImageBuffer error:", e);
						ntp.println("[ImgBuffErr]");
					}
				} else {
					ntp.println("[NoImgBuff]");
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
				if (cmd.data && Array.isArray(cmd.data)) {
					try {
						const ntpTableOpts = { ...(cmd.options || {}) };
						if (ntpTableOpts.columns && Array.isArray(ntpTableOpts.columns)) {
							ntpTableOpts.columns = ntpTableOpts.columns.map((col) => {
								const newCol = { ...col };
								if (typeof col.style === "string") {
									newCol.bold = col.style.includes("B");
									newCol.underline = col.style.includes("U");
									newCol.underlineThick = col.style.includes("U2");
									newCol.invert = col.style.includes("I");
									delete newCol.style;
								}
								if (col.size && Array.isArray(col.size)) {
									newCol.textSize = [
										Math.max(0, col.size[0] - 1),
										Math.max(0, col.size[1] - 1),
									];
									delete newCol.size;
								}
								return newCol;
							});
						}
						ntp.tableCustom(cmd.data, ntpTableOpts);
					} catch (tableErr) {
						ntp.println("[TableErr]");
						console.error("NTP Buffer Gen Table Err:", tableErr);
					}
				}
				break;
			default:
				console.warn(`NTP Buffer Gen: Unhandled cmd type '${cmd.type}'.`);
		}
	}
	resetStylesNTP();
	if (!printDataArray.some((cmd) => cmd.type?.toLowerCase() === "cut"))
		ntp.cut(BreakLine.PART);

	return ntp.getBuffer();
}

export function startApiServer(getDiscoveredPrinters, mainWindow) {
	const app = express();
	app.use(cors({ origin: "*" }));
	app.use(bodyParser.json({ limit: "10mb" }));
	app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

	app.get("/api/printers", (req, res) => {
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
				osName: p.osName, // Added for clarity
			}))
		);
	});

	// Combined and revised /api/print endpoint
	app.post("/api/print", async (req, res) => {
		const {
			printerName,
			templateType,
			templateData,
			printerOptions = {},
		} = req.body;

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
			(p) =>
				p.name.toLowerCase() === printerName.toLowerCase() ||
				(p.osName && p.osName.toLowerCase() === printerName.toLowerCase())
		);
		if (!config)
			return res
				.status(404)
				.json({ error: `Printer named '${printerName}' not found.` });

		let commandsFromTemplate; // Holds command objects from template generator
		try {
			const templateFunction = templateGenerators[templateType.toUpperCase()];
			if (!templateFunction)
				throw new Error(`Template type '${templateType}' not found.`);
			commandsFromTemplate = templateFunction(templateData);
			if (!Array.isArray(commandsFromTemplate))
				throw new Error("Template did not return an array of commands.");
			console.log(
				`API Print: Generated ${commandsFromTemplate.length} NTP-style commands via template '${templateType}' for '${config.name}'.`
			);
		} catch (templateError) {
			console.error(
				`API Print: Error generating print data from template '${templateType}':`,
				templateError
			);
			return res
				.status(500)
				.json({ error: `Template error: ${templateError.message}` });
		}

		const logPrefix = `API_PRINT [${config.name} (${config.connectionType})]:`;
		console.log(
			`${logPrefix} Job using template '${templateType}'. Virtual: ${
				config.isVirtual
			}, Target Device: ${config.osName || config.name}`
		);

		// --- VIRTUAL PRINTER Path (Uses Electron's webContents.print) ---
		if (config.isVirtual || config.connectionType === "VIRTUAL") {
			console.log(
				`${logPrefix} Using Electron WebContents.print() for virtual printer.`
			);
			const htmlContent = commandsToSimpleHtml(
				commandsFromTemplate,
				`Print to ${config.name}`
			);
			const tempHtmlPath = path.join(
				os.tmpdir(),
				`bridge_vp_${Date.now()}.html`
			);

			try {
				if (!mainWindow || mainWindow.isDestroyed()) {
					throw new Error("Main window not available for virtual printing.");
				}
				await fs.writeFile(tempHtmlPath, htmlContent, "utf8");

				// Use a new, temporary BrowserWindow for printing to avoid issues with existing mainWindow state
				const vpWin = new BrowserWindow({
					show: false, //false
					webPreferences: { nodeIntegration: false, contextIsolation: true },
				});

				vpWin.webContents.on("did-fail-load", (e, errCode, errDesc) => {
					console.error(`${logPrefix} VP window load fail:`, errDesc);
					if (!vpWin.isDestroyed()) vpWin.close();
					fs.unlink(tempHtmlPath).catch(() => {}); // Best effort cleanup
					if (!res.headersSent)
						res
							.status(500)
							.json({ error: `Virtual print page load fail: ${errDesc}` });
				});

				await vpWin.loadFile(tempHtmlPath);
				console.log(
					`${logPrefix} Virtual print HTML loaded into temporary window.`
				);

				vpWin.webContents.print(
					{
						silent:
							printerOptions.silent !== undefined
								? printerOptions.silent
								: true,
						deviceName: config.osName || config.name, // Use OS name for Electron's print dialog
						printBackground: true,
						color: false,
						margins: printerOptions.margins || { marginType: "printableArea" },
					},
					(success, reason) => {
						if (!vpWin.isDestroyed()) vpWin.close();
						fs.unlink(tempHtmlPath).catch(() => {});

						if (success) {
							console.log(
								`${logPrefix} Successfully sent to virtual printer ${config.name}.`
							);
							if (!res.headersSent)
								res.json({
									success: true,
									message: `Sent to virtual printer ${config.name}`,
								});
						} else {
							console.error(
								`${logPrefix} Virtual print failed for ${config.name}: ${reason}`
							);
							if (!res.headersSent)
								res
									.status(500)
									.json({ error: `Virtual print fail: ${reason}` });
						}
					}
				);
			} catch (vpErr) {
				console.error(`${logPrefix} VP setup error:`, vpErr);
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
				if (!res.headersSent)
					res
						.status(500)
						.json({ error: `Virtual print prep error: ${vpErr.message}` });
			}
		}
		// --- PHYSICAL PRINTER Path (Attempt to use @Plick/electron-pos-printer) ---
		// This path is suitable for OS_PLICK (printers discovered by Electron and to be printed by Plick)
		// and potentially MDNS_LAN if they are also OS-installed and Plick can target them by name.
		else if (
			config.connectionType === "OS_PLICK" ||
			(config.connectionType === "MDNS_LAN" && config.osName)
		) {
			console.log(
				`${logPrefix} Using @plick/electron-pos-printer for physical printer.`
			);
			try {
				const plickDataPayload = mapNTPCommandsToPlickData(
					commandsFromTemplate,
					printerOptions
				);
				if (!plickDataPayload || plickDataPayload.length === 0) {
					// mapNTPCommandsToPlickData might return empty if no commands are mappable.
					// It includes a warning object in such cases if input was not empty.
					const isEmptyTemplate = commandsFromTemplate.length === 0;
					if (
						!isEmptyTemplate &&
						(!plickDataPayload ||
							plickDataPayload.length === 0 ||
							(plickDataPayload[0] &&
								plickDataPayload[0].value.startsWith("[Warn")))
					) {
						throw new Error(
							"Failed to convert template commands to a printable Plick EPP format. Check mapping."
						);
					} else if (isEmptyTemplate) {
						console.log(
							`${logPrefix} Template was empty, nothing to print with Plick.`
						);
						if (!res.headersSent)
							res.json({
								success: true,
								message: "Empty template, no print job sent.",
							});
						return; // Success, but nothing printed.
					}
				}

				const plickJobOptions = {
					printerName: config.osName || config.name, // Plick uses the OS name
					silent:
						printerOptions?.silent !== undefined ? printerOptions.silent : true,
					copies: printerOptions?.copies || 1,
					preview: printerOptions?.preview || false,
					margin: printerOptions?.margin || "0 0 0 0",
					pageSize: printerOptions?.pageSize || "80mm", // Check Plick docs for default/valid values
					timeOutPerLine: printerOptions?.timeOutPerLine || 400,
					...(printerOptions?.plickSpecificOptions || {}), // For any other Plick-specific options
				};

				console.log(
					`${logPrefix} Sending job to Plick EPP. Target: '${plickJobOptions.printerName}'. Options:`,
					plickJobOptions
				);

				await PosPrinter.print(plickDataPayload, plickJobOptions);

				console.log(
					`${logPrefix} Job successfully sent via @plick/electron-pos-printer to '${config.name}'.`
				);
				if (!res.headersSent)
					res.json({
						success: true,
						message: `Job sent via Plick EPP to '${config.name}'.`,
					});
			} catch (eppError) {
				console.error(
					`${logPrefix} @plick/electron-pos-printer error: ${eppError.message}`,
					eppError
				);
				if (!res.headersSent)
					res.status(500).json({
						error: `Plick EPP print failed for '${config.name}': ${eppError.message}`,
					});
			}
		}
		// --- Direct RAW_USB or OS_CMD (Legacy or specific hardware not covered by Plick) ---
		// This retains the original logic for connection types that Plick might not handle,
		// or if you want to send raw ESC/POS directly.
		else if (config.connectionType === "RAW_USB") {
			const logPrefixUsb = `API_PRINT_RAW_USB [${config.name}]:`;
			console.log(`${logPrefixUsb} Handling job.`);
			if (!config.vid || !config.pid)
				return res
					.status(400)
					.json({ error: "RAW_USB config missing VID/PID." });

			// (The extensive RAW_USB logic from the original code would go here, using 'usb' package and generatePrintBufferNTP)
			// This part is complex and was in your original first app.post("/api/print").
			// For brevity in this merged example, I'm not fully reproducing it, but it would involve:
			// 1. generatePrintBufferNTP(commandsFromTemplate, printerOptions)
			// 2. usb.findByIds(config.vid, config.pid)
			// 3. Opening device, claiming interface, finding endpoint, transferring buffer.
			// 4. Closing device.
			try {
				const rawBuffer = await generatePrintBufferNTP(
					commandsFromTemplate,
					printerOptions
				);
				if (!rawBuffer || rawBuffer.length === 0)
					throw new Error("NTP generated empty buffer for RAW_USB print.");
				console.log(
					`${logPrefixUsb} Generated ${rawBuffer.length} bytes. (RAW USB print logic to be fully implemented here)`
				);
				// ... Actual USB printing logic ...
				console.warn(
					`${logPrefixUsb} Full RAW USB printing logic not yet re-integrated into this specific example snippet.`
				);
				if (!res.headersSent)
					res
						.status(501)
						.json({
							error:
								"RAW_USB printing path needs full re-integration from original code.",
						});
			} catch (rawError) {
				console.error(
					`${logPrefixUsb} Error: ${rawError.message}`,
					rawError.stack
				);
				if (!res.headersSent)
					res
						.status(500)
						.json({ error: `RAW_USB print failed: ${rawError.message}` });
			}
		} else if (
			config.connectionType &&
			config.connectionType.startsWith("OS_")
		) {
			// OS_USB, OS_LAN, OS_LOCAL (via command line)
			const logPrefixOsCmd = `API_PRINT_OS_CMD [${config.name}]:`;
			console.log(
				`${logPrefixOsCmd} Handling OS-queued printer via command line.`
			);
			if (!config.osName)
				return res
					.status(400)
					.json({
						error:
							"OS Printer config missing osName for command line printing.",
					});

			// (The OS command line printing logic from the original code would go here)
			// This involved generating a raw buffer and then using 'lp' or 'powershell Out-Printer'.
			try {
				const rawBufferOs = await generatePrintBufferNTP(
					commandsFromTemplate,
					printerOptions
				);
				if (!rawBufferOs || rawBufferOs.length === 0)
					throw new Error("Generated empty buffer for OS_CMD print.");
				const tempFilePathOs = path.join(
					os.tmpdir(),
					`os_cmd_job_${Date.now()}.bin`
				);
				await fs.writeFile(tempFilePathOs, rawBufferOs);
				console.log(
					`${logPrefixOsCmd} Raw buffer (${rawBufferOs.length} bytes) for '${config.osName}' written to ${tempFilePathOs}`
				);

				let command;
				const quotedOsName =
					os.platform() === "win32"
						? `"${config.osName}"`
						: `'${config.osName}'`; // Handle spaces in names

				if (os.platform() === "win32") {
					const escPsName = quotedOsName.replace(/"/g, '`"'); // For PowerShell
					command = `powershell -NoProfile -NonInteractive -Command "Get-Content -Path '${tempFilePathOs}' -Encoding Byte -Raw | Out-Printer -Name ${escPsName}"`;
				} else {
					// macOS, Linux
					command = `lp -d ${quotedOsName.replace(
						/'/g,
						""
					)} -o raw "${tempFilePathOs}"`; // lp -d name (no quotes usually for name)
				}
				console.log(`${logPrefixOsCmd} Executing: ${command}`);

				exec(command, { timeout: 15000 }, async (error, stdout, stderr) => {
					await fs
						.unlink(tempFilePathOs)
						.catch((e) =>
							console.warn("Temp OS file unlink error:", e.message)
						);
					if (error) {
						console.error(
							`${logPrefixOsCmd} OS Command FAIL: ${error.message}`,
							`STDOUT: ${stdout}`,
							`STDERR: ${stderr}`
						);
						if (!res.headersSent)
							res
								.status(500)
								.json({
									error: `OS print command failed: ${stderr || error.message}`,
								});
					} else {
						console.log(
							`${logPrefixOsCmd} OS Command SUCCESS for '${config.osName}'.`
						);
						if (!res.headersSent)
							res.json({
								success: true,
								message: `Job sent to OS printer '${config.name}'.`,
							});
					}
				});
			} catch (osCmdError) {
				console.error(
					`${logPrefixOsCmd} Error: ${osCmdError.message}`,
					osCmdError.stack
				);
				if (!res.headersSent)
					res
						.status(500)
						.json({
							error: `OS_CMD print setup failed: ${osCmdError.message}`,
						});
			}
		}
		// --- Direct TCP/IP printing for MDNS_LAN not handled by Plick/OS Name (Legacy or specific hardware)
		else if (config.connectionType === "MDNS_LAN" && config.ip && config.port) {
			const logPrefixTcp = `API_PRINT_TCP [${config.name}]:`;
			console.log(
				`${logPrefixTcp} Handling direct TCP printer to ${config.ip}:${config.port}.`
			);
			// (Direct TCP printing using node-thermal-printer, similar to original MDNS_LAN block)
			try {
				const ntpLan = new ThermalPrinter({
					type:
						(printerOptions?.type &&
							PrinterTypes[printerOptions.type.toUpperCase()]) ||
						PrinterTypes.EPSON,
					interface: `tcp://${config.ip}:${config.port}`,
					characterSet:
						(printerOptions?.characterSet &&
							CharacterSet[printerOptions.characterSet.toUpperCase()]) ||
						CharacterSet.UTF_8,
					timeout: printerOptions?.timeout || 7000,
				});

				// The NTP command generation logic needs to be replicated here for ntpLan instance
				// This is simplified, assumes commandsFromTemplate can be processed by a similar loop as in generatePrintBufferNTP
				// For a full solution, refactor NTP command processing into a reusable function.
				if (printerOptions?.initialAlign)
					ntpLan.align(printerOptions.initialAlign.toUpperCase());
				for (const cmd of commandsFromTemplate) {
					// Simplified loop: apply commands to ntpLan.
					// This should mirror the logic within generatePrintBufferNTP but call methods on ntpLan
					switch (cmd.type?.toLowerCase()) {
						case "text":
						case "println":
							ntpLan.println(String(cmd.content || cmd.text || ""));
							break;
						case "feed":
							ntpLan.feed(parseInt(cmd.lines, 10) || 1);
							break;
						case "cut":
							ntpLan.cut();
							break;
						// ... Add more command mappings specific to ntpLan.execute() context ...
						default:
							console.warn(
								`${logPrefixTcp} Skipping unmapped command '${cmd.type}' for direct TCP NTP printing.`
							);
					}
				}
				if (
					!commandsFromTemplate.some((cmd) => cmd.type?.toLowerCase() === "cut")
				)
					ntpLan.cut();

				await ntpLan.execute();
				console.log(`${logPrefixTcp} Job sent successfully via TCP.`);
				if (!res.headersSent)
					res.json({
						success: true,
						message: `Job sent to TCP printer '${config.name}'.`,
					});
			} catch (tcpError) {
				console.error(
					`${logPrefixTcp} Error: ${tcpError.message}`,
					tcpError.stack
				);
				if (!res.headersSent)
					res
						.status(500)
						.json({ error: `Direct TCP print failed: ${tcpError.message}` });
			}
		} else {
			console.error(
				`${logPrefix} Unhandled printer configuration. ConnType: '${config.connectionType}' for printer '${config.name}'`
			);
			if (!res.headersSent)
				res.status(400).json({
					error: `Cannot print. Unhandled configuration or missing details for '${config.name}'. Connection Type: ${config.connectionType}`,
				});
		}
	});

	const server = app.listen(API_PORT, "0.0.0.0", () => {
		console.log(
			`Bridge API Server (Plick EPP Integrated Mode) listening on port ${API_PORT}.`
		);
		console.log(`  Local:            http://localhost:${API_PORT}`);
		// To find your local IP is more involved, this is just a placeholder message.
		console.log(
			`  On Your Network:  http://<your-local-ip>:${API_PORT} (Find your machine's IP address)`
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
					`API Server Critical Error: ${bind} requires elevated privileges or is blocked.`
				);
				process.exit(1);
				break;
			case "EADDRINUSE":
				console.error(`API Server Critical Error: ${bind} is already in use.`);
				process.exit(1);
				break;
			default:
				console.error(`API Server Critical Error: ${error.code}`, error);
				throw error;
		}
	});
	return server;
}
