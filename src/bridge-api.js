// src/bridge-api.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { BrowserWindow } from "electron"; // For virtual printing
import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process"; // For OS command line printing

// For generating ESC/POS buffers and direct TCP printing
import {
	ThermalPrinter,
	PrinterTypes,
	CharacterSet,
	BreakLine,
} from "node-thermal-printer";

// For direct RAW USB communication
import usb from "usb"; // Assumes 'npm i usb' and electron-rebuild has worked

// --- Import your template generators ---
// import { generateStandardReceipt } from "./templates/standardReceipt.js";
// import { generateKitchenOrderTicket } from "./templates/kitchenOrderTicket.js";
import { generateTwKitchenTakeawayTicket } from "./templates/kot_save_recipt";

const API_PORT = process.env.API_PORT || 3030;

// Mapping of template types to generator functions
const templateGenerators = {
	KOT_SAVE: generateTwKitchenTakeawayTicket,
	// Add more template identifiers and their corresponding functions here
};

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

export function startApiServer(getDiscoveredPrinters) {
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
			}))
		);
	});

	app.post("/api/print", async (req, res) => {
		const {
			printerName,
			templateType,
			templateData,
			printerOptions = {},
		} = req.body; // Ensure printerOptions exists

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

		let printDataArray; // Holds command objects from template
		try {
			const templateFunction = templateGenerators[templateType.toUpperCase()];
			if (!templateFunction)
				throw new Error(`Template type '${templateType}' not found.`);
			printDataArray = templateFunction(templateData); // Call template generator
			if (!Array.isArray(printDataArray))
				throw new Error("Template did not return an array of commands.");
			console.log(
				`API Print: Generated ${printDataArray.length} commands via template '${templateType}' for '${config.name}'.`
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

		console.log(
			`API Print: Job for '${config.name}' (ConnType: ${config.connectionType}, Virtual: ${config.isVirtual}) using template '${templateType}'`
		);

		if (config.connectionType === "VIRTUAL") {
			console.log(`API Print VIRTUAL: Handling '${config.name}'`);
			const htmlContent = commandsToSimpleHtml(
				printDataArray,
				`Print to ${config.name}`
			); // Use the generated printDataArray
			const tempHtmlPath = path.join(
				os.tmpdir(),
				`bridge_vp_${Date.now()}.html`
			);
			try {
				await fs.writeFile(tempHtmlPath, htmlContent, "utf8");
				const vpWin = new BrowserWindow({
					show: false,
					webPreferences: { nodeIntegration: false, contextIsolation: true },
				});

				vpWin.webContents.on("did-fail-load", (e, errCode, errDesc) => {
					console.error("VP window load fail:", errDesc);
					if (!vpWin.isDestroyed()) vpWin.close();
					fs.unlink(tempHtmlPath).catch(() => {});
					if (!res.headersSent)
						res
							.status(500)
							.json({ error: `Virtual print page load fail: ${errDesc}` });
				});
				await vpWin.loadFile(tempHtmlPath);

				vpWin.webContents.print(
					{
						silent:
							printerOptions.silent !== undefined
								? printerOptions.silent
								: true,
						deviceName: config.name,
						printBackground: true,
						color: false,
						margins: printerOptions.margins || { marginType: "printableArea" },
					},
					(success, reason) => {
						if (!vpWin.isDestroyed()) vpWin.close();
						fs.unlink(tempHtmlPath).catch(() => {});
						if (success) {
							if (!res.headersSent)
								res.json({
									success: true,
									message: `Sent to virtual printer ${config.name}`,
								});
						} else {
							if (!res.headersSent)
								res
									.status(500)
									.json({ error: `Virtual print fail: ${reason}` });
						}
					}
				);
			} catch (vpErr) {
				console.error("VP setup error:", vpErr);
				if (fs.existsSync(tempHtmlPath))
					await fs.unlink(tempHtmlPath).catch(() => {}); // Await cleanup
				if (!res.headersSent)
					res
						.status(500)
						.json({ error: `Virtual print prep error: ${vpErr.message}` });
			}
		} else if (config.connectionType === "RAW_USB") {
			const logPrefix = `API_PRINT_RAW_USB [${config.name}]:`;
			console.log(`${logPrefix} Handling job.`);
			if (!config.vid || !config.pid)
				return res
					.status(400)
					.json({ error: "RAW_USB config missing VID/PID." });

			let usbDeviceInstance = null; // From 'usb' package
			try {
				const rawBuffer = await generatePrintBufferNTP(
					printDataArray,
					printerOptions
				);
				if (!rawBuffer || rawBuffer.length === 0)
					throw new Error("NTP generated empty buffer for RAW_USB print.");
				console.log(
					`${logPrefix} Generated ${rawBuffer.length} bytes using NTP buffer helper.`
				);

				usbDeviceInstance = usb.findByIds(config.vid, config.pid);
				if (!usbDeviceInstance)
					throw new Error(
						`Device VID:0x${config.vid.toString(
							16
						)} PID:0x${config.pid.toString(16)} not found. Disconnected?`
					);

				// Promisified open ensures device.open() completes or fails clearly
				await new Promise((resolve, reject) => {
					try {
						usbDeviceInstance.open();
						setTimeout(resolve, 50);
					} catch (e) {
						// open is sync
						reject(e);
					}
				});
				console.log(`${logPrefix} USB Device opened.`);

				let outEndpoint = null;
				if (!usbDeviceInstance.interfaces) {
					console.log(
						`${logPrefix} No interfaces found initially, attempting device reset...`
					);
					await new Promise((resolveReset, rejectReset) => {
						usbDeviceInstance.reset((error) =>
							error ? rejectReset(error) : setTimeout(resolveReset, 250)
						);
					});
					console.log(
						`${logPrefix} Device reset complete. Re-finding device...`
					);
					usbDeviceInstance = usb.findByIds(config.vid, config.pid); // Re-fetch device
					if (!usbDeviceInstance || !usbDeviceInstance.interfaces)
						throw new Error("Failed to get interfaces even after reset.");
				}

				for (const iface of usbDeviceInstance.interfaces) {
					try {
						if (iface.isKernelDriverActive()) {
							console.log(
								`${logPrefix} Detaching kernel driver for interface ${iface.interfaceNumber}...`
							);
							await new Promise((resolveDetach) => {
								iface.detachKernelDriver();
								setTimeout(resolveDetach, 100);
							});
						}
						await new Promise((resolveClaim) => {
							iface.claim();
							setTimeout(resolveClaim, 50);
						});
						console.log(
							`${logPrefix} Claimed interface ${iface.interfaceNumber}.`
						);
						for (const endpoint of iface.endpoints)
							if (endpoint.direction === "out") {
								outEndpoint = endpoint;
								break;
							}
						if (outEndpoint) break;
						else iface.release(true, () => {}); // Auto-re-attach kernel if needed
					} catch (claimErr) {
						console.warn(
							`${logPrefix} Could not claim IF ${iface.interfaceNumber}: ${claimErr.message}. Trying next.`
						);
					}
				}
				if (!outEndpoint)
					throw new Error(
						"No suitable OUT endpoint found. Ensure Zadig/WinUSB for Windows or correct libusb permissions."
					);
				console.log(
					`${logPrefix} Using OUT endpoint: ${outEndpoint.address}. Transferring ${rawBuffer.length} bytes...`
				);

				await new Promise((resolveTransfer, rejectTransfer) => {
					outEndpoint.transfer(rawBuffer, (error) => {
						if (error)
							rejectTransfer(
								new Error(`USB Transfer Error: ${error.message || error}`)
							);
						else resolveTransfer();
					});
				});
				console.log(`${logPrefix} USB data transfer complete.`);

				const ifaceToRelease = usbDeviceInstance.interfaces?.find(
					(i) => i.interfaceNumber === outEndpoint.interfaceNumber
				);
				if (ifaceToRelease?.claimed)
					await new Promise((r) => ifaceToRelease.release(true, r)); // Release and re-attach kernel

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
				if (usbDeviceInstance && usbDeviceInstance.opened) {
					try {
						usbDeviceInstance.close();
						console.log(`${logPrefix} USB Device closed in finally.`);
					} catch (e) {
						console.error(`${logPrefix} USB Device close error in finally:`, e);
					}
				}
			}
		} else if (config.connectionType === "MDNS_LAN") {
			const logPrefix = `API_PRINT_MDNS_LAN [${config.name}]:`;
			console.log(`${logPrefix} Handling printer.`);
			if (!config.ip || !config.port)
				return res
					.status(400)
					.json({ error: "MDNS_LAN config missing IP/Port." });

			let ntpLan;
			try {
				ntpLan = new ThermalPrinter({
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
				// --- Generate commands using ntpLan instance ---
				// This block is the same as the generatePrintBufferNTP but using ntpLan
				const resetStylesTCP = () => {
					/* Use ntpLan... */
				};
				if (printerOptions?.initialAlign)
					ntpLan.align(printerOptions.initialAlign.toUpperCase());
				for (const cmd of printDataArray) {
					resetStylesTCP(); /* Full switch case here using ntpLan... */
				}
				resetStylesTCP();
				if (!printDataArray.some((cmd) => cmd.type?.toLowerCase() === "cut"))
					ntpLan.cut();
				// --- End command generation ---
				await ntpLan.execute();
				console.log(`${logPrefix} Job sent successfully via TCP.`);
				if (!res.headersSent)
					res.json({
						success: true,
						message: `Job sent to MDNS_LAN printer '${config.name}'.`,
					});
			} catch (mdnsError) {
				console.error(
					`${logPrefix} Error: ${mdnsError.message}`,
					mdnsError.stack
				);
				if (!res.headersSent)
					res
						.status(500)
						.json({ error: `MDNS_LAN print failed: ${mdnsError.message}` });
			}
		} else if (
			config.connectionType &&
			config.connectionType.startsWith("OS_")
		) {
			// OS_USB, OS_LAN, OS_LOCAL
			const logPrefix = `API_PRINT_OS_CMD [${config.name}]:`;
			console.log(`${logPrefix} Handling OS-queued printer.`);
			if (!config.osName)
				return res
					.status(400)
					.json({ error: "OS Printer config missing osName." });

			try {
				const rawBufferOs = await generatePrintBufferNTP(
					printDataArray,
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
					`${logPrefix} Raw buffer (${rawBufferOs.length} bytes) for '${config.osName}' written to ${tempFilePathOs}`
				);

				let command;
				const quotedOsName = `"${config.osName}"`;
				if (os.platform() === "win32") {
					const escPsName = quotedOsName.replace(/"/g, '`"');
					command = `powershell -NoProfile -NonInteractive -Command "Get-Content -Path '${tempFilePathOs}' -Encoding Byte -Raw | Out-Printer -Name ${escPsName}"`;
				} else {
					command = `lp -d ${quotedOsName} -o raw "${tempFilePathOs}"`;
				}
				console.log(`${logPrefix} Executing: ${command}`);

				exec(command, { timeout: 15000 }, async (error, stdout, stderr) => {
					// Use callback for exec
					await fs
						.unlink(tempFilePathOs)
						.catch((e) =>
							console.warn("Temp OS file unlink error:", e.message)
						);
					if (error) {
						console.error(
							`${logPrefix} OS Command FAIL: ${error.message}`,
							`STDOUT: ${stdout}`,
							`STDERR: ${stderr}`
						);
						if (!res.headersSent)
							res.status(500).json({
								error: `OS print command failed: ${stderr || error.message}`,
							});
					} else {
						console.log(
							`${logPrefix} OS Command SUCCESS. Job sent to queue for '${config.osName}'.`
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
					`${logPrefix} Error: ${osCmdError.message}`,
					osCmdError.stack
				);
				if (!res.headersSent)
					res.status(500).json({
						error: `OS_CMD print setup failed: ${osCmdError.message}`,
					});
			}
		} else {
			console.error(
				`API Print: Unhandled printer configuration. ConnType: '${config.connectionType}' for printer '${config.name}'`
			);
			if (!res.headersSent)
				res.status(400).json({
					error: `Cannot print. Unhandled config for '${config.name}'.`,
				});
		}
	});

	const server = app.listen(API_PORT, "0.0.0.0", () => {
		console.log(`Bridge API Server (Multi-Path Printing Mode) listening.`);
		console.log(`  Local:            http://localhost:${API_PORT}`);
		console.log(
			`  On Your Network:  http://<your-local-ip>:${API_PORT} (approx)`
		); // Inform user
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
					`API Server Critical Error: ${bind} requires elevated privileges/is blocked.`
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
