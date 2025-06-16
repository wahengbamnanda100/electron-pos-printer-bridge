// src/printing/tcpIpPrinter.js
import {
	ThermalPrinter,
	PrinterTypes,
	CharacterSet,
	BreakLine,
} from "node-thermal-printer";
import { DEFAULT_NTP_OPTIONS } from "../config/index.js";

// This function needs to re-apply NTP commands to a new NTP instance configured for TCP/IP
// It's similar to generatePrintBufferNTP but instead of getBuffer(), it calls execute().
export async function printViaTcpIp(
	ntpCommands,
	printerConfig,
	printerOptions = {}
) {
	const logPrefix = `TCP_PRINT [${printerConfig.name} (${printerConfig.ip}:${printerConfig.port})]:`;
	console.log(`${logPrefix} Starting direct TCP print.`);

	if (!printerConfig.ip || !printerConfig.port) {
		throw new Error("TCP/IP printer configuration missing IP address or port.");
	}

	const ntpLan = new ThermalPrinter({
		type:
			(printerOptions?.type &&
				PrinterTypes[printerOptions.type.toUpperCase()]) ||
			DEFAULT_NTP_OPTIONS.type,
		interface: `tcp://${printerConfig.ip}:${printerConfig.port}`,
		characterSet:
			(printerOptions?.characterSet &&
				CharacterSet[printerOptions.characterSet.toUpperCase()]) ||
			DEFAULT_NTP_OPTIONS.characterSet,
		timeout: printerOptions?.timeout || DEFAULT_NTP_OPTIONS.timeout,
	});

	try {
		const isConnected = await ntpLan.isPrinterConnected();
		if (!isConnected) {
			throw new Error(
				`${logPrefix} Printer not connected at ${printerConfig.ip}:${printerConfig.port}`
			);
		}
	} catch (connectionError) {
		console.error(
			`${logPrefix} Error checking printer connection:`,
			connectionError
		);
		throw new Error(
			`${logPrefix} Failed to connect to printer at ${printerConfig.ip}:${printerConfig.port}. Details: ${connectionError.message}`
		);
	}

	const resetStylesNTP = () => {
		ntpLan.align("LT");
		ntpLan.setTextNormal();
		ntpLan.bold(false);
		ntpLan.underline(false);
		ntpLan.underlineThick(false);
		ntpLan.invert(false);
	};

	if (printerOptions?.initialAlign)
		ntpLan.align(printerOptions.initialAlign.toUpperCase());

	for (const cmd of ntpCommands) {
		// Reset styles before most commands, unless it's a style command itself or a simple state command like align
		if (
			cmd.type?.toLowerCase() !== "setstyles" &&
			cmd.type?.toLowerCase() !== "resetstyles" &&
			cmd.type?.toLowerCase() !== "align"
		) {
			resetStylesNTP();
		}
		const alignCmdNTP = cmd.align ? cmd.align.toUpperCase() : "LT"; // Default align for commands that use it

		switch (cmd.type?.toLowerCase()) {
			case "text": // print text without appending a newline (NTP lib .print())
				ntpLan.align(alignCmdNTP);
				if (cmd.style) {
					if (cmd.style.includes("B")) ntpLan.bold(true);
					if (cmd.style.includes("U2")) ntpLan.underlineThick(true);
					else if (cmd.style.includes("U")) ntpLan.underline(true);
					if (cmd.style.includes("I")) ntpLan.invert(true);
				}
				if (cmd.size && Array.isArray(cmd.size) && cmd.size.length === 2) {
					ntpLan.setTextSize(
						Math.max(0, cmd.size[0] - 1),
						Math.max(0, cmd.size[1] - 1)
					);
				}
				ntpLan.print(String(cmd.content || cmd.text || cmd.value || "")); // Use .print for "text"
				break;
			case "println": // print text with a newline
				ntpLan.align(alignCmdNTP);
				if (cmd.style) {
					if (cmd.style.includes("B")) ntpLan.bold(true);
					if (cmd.style.includes("U2")) ntpLan.underlineThick(true);
					else if (cmd.style.includes("U")) ntpLan.underline(true);
					if (cmd.style.includes("I")) ntpLan.invert(true);
				}
				if (cmd.size && Array.isArray(cmd.size) && cmd.size.length === 2) {
					ntpLan.setTextSize(
						Math.max(0, cmd.size[0] - 1),
						Math.max(0, cmd.size[1] - 1)
					);
				}
				ntpLan.println(String(cmd.content || cmd.text || cmd.value || ""));
				break;
			case "feed":
				ntpLan.feed(parseInt(cmd.lines, 10) || 1);
				break;
			case "cut":
				ntpLan.cut(cmd.mode === "FULL" ? BreakLine.FULL : BreakLine.PART);
				break;
			case "beep":
				ntpLan.beep(parseInt(cmd.n, 10) || 1, parseInt(cmd.t, 10) || 100);
				break;
			case "align": // Standalone align command
				if (cmd.align) ntpLan.align(cmd.align.toUpperCase());
				break;
			case "setstyles": // Explicit style setting command
				if (cmd.align) ntpLan.align(cmd.align.toUpperCase());
				if (cmd.style) {
					if (cmd.style.includes("B")) ntpLan.bold(true);
					if (cmd.style.includes("U2")) ntpLan.underlineThick(true);
					else if (cmd.style.includes("U")) ntpLan.underline(true);
					if (cmd.style.includes("I")) ntpLan.invert(true);
					// Add other styles as needed e.g. ntpLan.setTextDoubleHeight(), ntpLan.setTextDoubleWidth()
				}
				if (cmd.size && Array.isArray(cmd.size) && cmd.size.length === 2) {
					// Width, Height
					ntpLan.setTextSize(
						Math.max(0, cmd.size[0] - 1),
						Math.max(0, cmd.size[1] - 1)
					);
				}
				break;
			case "resetstyles":
				resetStylesNTP();
				break;
			case "barcode":
				ntpLan.align(alignCmdNTP);
				ntpLan.printBarcode(
					String(cmd.content || cmd.value),
					parseInt(cmd.barcodeType, 10) || 73, // Code128 default
					{
						height: parseInt(cmd.height, 10) || 50,
						width: parseInt(cmd.width, 10) || 2, // Module width
						hriPos: parseInt(cmd.hriPos, 10) || 0, // HRI position (0=none, 1=above, 2=below, 3=both)
						hriFont: parseInt(cmd.hriFont, 10) || 0, // HRI font
						...(cmd.options || {}), // Pass any other NTP specific options
					}
				);
				break;
			case "qr":
				ntpLan.align(alignCmdNTP);
				await ntpLan.printQR(String(cmd.content || cmd.value), {
					cellSize: parseInt(cmd.cellSize, 10) || 3,
					correction: cmd.correction || "M", // Error correction level: L, M, Q, H
					model: parseInt(cmd.model, 10) || 2, // Model: 1 or 2
				});
				break;
			case "image":
				ntpLan.align(alignCmdNTP);
				if (cmd.path) {
					try {
						await ntpLan.printImage(cmd.path);
					} catch (e) {
						console.error(`${logPrefix} NTP printImage error:`, e);
						ntpLan.println("[ImgPathErr]"); // Print an error placeholder on the receipt
					}
				} else {
					ntpLan.println("[NoImgPath]");
				}
				break;
			case "imagebuffer":
				ntpLan.align(alignCmdNTP);
				if (cmd.buffer) {
					try {
						const bufferToPrint = Buffer.isBuffer(cmd.buffer)
							? cmd.buffer
							: Buffer.from(cmd.buffer, "base64");
						await ntpLan.printImageBuffer(bufferToPrint);
					} catch (e) {
						console.error(`${logPrefix} NTP printImageBuffer error:`, e);
						ntpLan.println("[ImgBuffErr]");
					}
				} else {
					ntpLan.println("[NoImgBuff]");
				}
				break;
			case "drawline": // Draws a line of dashes
				ntpLan.drawLine();
				break;
			case "raw": // Send raw ESC/POS commands
				ntpLan.raw(
					Buffer.isBuffer(cmd.content)
						? cmd.content
						: Buffer.from(String(cmd.content || ""), "hex")
				);
				break;
			case "tablecustom":
				if (cmd.data && Array.isArray(cmd.data)) {
					try {
						// Map the simple command structure's options to NTP's tableCustom options
						const ntpTableOpts = { ...(cmd.options || {}) };
						if (ntpTableOpts.columns && Array.isArray(ntpTableOpts.columns)) {
							ntpTableOpts.columns = ntpTableOpts.columns.map((col) => {
								const newCol = { ...col };
								// Convert simple style string to NTP boolean flags
								if (typeof col.style === "string") {
									newCol.bold = col.style.includes("B");
									newCol.underline = col.style.includes("U"); // simple underline
									newCol.underlineThick = col.style.includes("U2"); // thick underline
									newCol.invert = col.style.includes("I");
									delete newCol.style; // Remove the original style string
								}
								// Convert simple size array [widthMultiplier, heightMultiplier] to NTP textSize [width, height] (0-7 scale)
								if (col.size && Array.isArray(col.size)) {
									newCol.textSize = [
										// NTP uses textSize for columns
										Math.max(0, Math.min(7, (col.size[0] || 1) - 1)),
										Math.max(0, Math.min(7, (col.size[1] || 1) - 1)),
									];
									delete newCol.size; // Remove the original size array
								}
								return newCol;
							});
						}
						ntpLan.tableCustom(cmd.data, ntpTableOpts);
					} catch (tableErr) {
						ntpLan.println("[TableErr]"); // Placeholder on receipt
						console.error(`${logPrefix} NTP tableCustom error:`, tableErr);
					}
				} else {
					ntpLan.println("[NoTableData]");
				}
				break;
			default:
				console.warn(
					`${logPrefix} Skipping unmapped/unknown command type '${cmd.type}' for direct TCP NTP printing.`
				);
		}
	}

	resetStylesNTP(); // Final style reset

	// Add a final cut if not already specified in the commands
	if (!ntpCommands.some((cmd) => cmd.type?.toLowerCase() === "cut")) {
		ntpLan.cut();
	}

	try {
		await ntpLan.execute();
		console.log(`${logPrefix} Job sent successfully via TCP.`);
		return {
			success: true,
			message: `Job sent to TCP printer '${printerConfig.name}'.`,
		};
	} catch (executeError) {
		console.error(
			`${logPrefix} Error during ntpLan.execute(): ${executeError.message}`,
			executeError.stack
		);
		throw new Error(
			`Direct TCP print execution failed for '${printerConfig.name}': ${executeError.message}`
		);
	}
}
