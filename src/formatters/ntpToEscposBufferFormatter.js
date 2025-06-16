import {
	ThermalPrinter,
	PrinterTypes,
	CharacterSet,
	BreakLine,
} from "node-thermal-printer";
import { DEFAULT_NTP_OPTIONS } from "../config/index.js";

// Paste your generatePrintBufferNTP function here
// Make sure to export it:
// export async function generatePrintBufferNTP(printDataArray, printerOptions = {}) { ... }
// Adjust to use DEFAULT_NTP_OPTIONS
export async function generatePrintBufferNTP(
	printDataArray,
	printerOptions = {}
) {
	const ntp = new ThermalPrinter({
		type:
			(printerOptions?.type &&
				PrinterTypes[printerOptions.type.toUpperCase()]) ||
			DEFAULT_NTP_OPTIONS.type,
		characterSet:
			(printerOptions?.characterSet &&
				CharacterSet[printerOptions.characterSet.toUpperCase()]) ||
			DEFAULT_NTP_OPTIONS.characterSet,
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
			resetStylesNTP(); // Reset before most commands unless it's a style command itself

		const alignCmdNTP = cmd.align ? cmd.align.toUpperCase() : "LT"; // Default align for commands that use it

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
			case "align": // Standalone align command
				if (cmd.align) ntp.align(cmd.align.toUpperCase());
				break;
			case "setstyles": // Explicit style setting command
				if (cmd.align) ntp.align(cmd.align.toUpperCase());
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
						// Assuming buffer is base64 string if not a Buffer instance
						const bufferToPrint = Buffer.isBuffer(cmd.buffer)
							? cmd.buffer
							: Buffer.from(cmd.buffer, "base64");
						await ntp.printImageBuffer(bufferToPrint);
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
									delete newCol.style; // NTP expects boolean flags
								}
								if (col.size && Array.isArray(col.size)) {
									newCol.textSize = [
										// NTP uses textSize for columns
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
	resetStylesNTP(); // Final reset
	if (!printDataArray.some((cmd) => cmd.type?.toLowerCase() === "cut"))
		ntp.cut(BreakLine.PART); // Default cut if not specified

	return ntp.getBuffer();
}
