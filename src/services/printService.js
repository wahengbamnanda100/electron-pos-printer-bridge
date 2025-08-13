// src/services/printService.js
import { getTemplateFunction } from "../templates/index.js";

// import { generateTwKitchenTakeawayTicketPDF } from "../pdf-genarator/kotReceiptPdf.js";

import { mapNTPCommandsToPlickData } from "../formatters/ntpToPlickFormatter.js";
import { commandsToSimpleHtml } from "../formatters/ntpToHtmlFormatter.js";
import { generatePrintBufferNTP } from "../formatters/ntpToEscposBufferFormatter.js";

// import {
// 	printHtmlVirtually,
// 	printPdfVirtually,
// } from "../printing/virtualPrinter.js";
import {
	printPdfVirtually,
	printVirtually,
} from "../printing/virtualPrinter.js";
import { printWithPlick } from "../printing/plickPosPrinter.js";
import { printViaOsCommand } from "../printing/osCommandPrinter.js";
import { printViaTcpIp } from "../printing/tcpIpPrinter.js";
import { printViaRawUsb } from "../printing/rawUsbPrinter.js"; // Placeholder

// Node.js core modules for path resolution
import { shell } from "electron";
import path from "path";
import { fileURLToPath } from "url"; // Only if __dirname is not naturally available (ESM context)
import fs from "fs/promises";
import os from "os";

let serviceModuleDir;
try {
	serviceModuleDir = __dirname; // Will work if in a CJS-like environment or Electron main with nodeIntegration
} catch (e) {
	// Fallback for pure ESM environments
	const __filename_service = fileURLToPath(import.meta.url);
	serviceModuleDir = path.dirname(__filename_service);
}

const fixedLogoPath = path.join(
	serviceModuleDir,
	"..",
	"..",
	"assets",
	"logo.png"
);
console.log("Attempting to use fixed logo path:", fixedLogoPath);

function findPrinterConfiguration(printers, requestedPrinterName) {
	const requestedNameLower = requestedPrinterName.toLowerCase();

	// 1. Exact match (case-insensitive) by name or osName
	let foundPrinter = printers.find(
		(p) =>
			p.name.toLowerCase() === requestedNameLower ||
			(p.osName && p.osName.toLowerCase() === requestedNameLower)
	);
	if (foundPrinter) return foundPrinter;

	// 2. Fuzzy match for common virtual printer terms
	const fuzzyTerms = [
		"onenote",
		"oneNote",
		"pdf",
		"xps",
		"microsoft print to pdf",
		"save to onenote",
	];
	if (fuzzyTerms.some((term) => requestedNameLower.includes(term))) {
		// If requested name is generic like "onenote" or "pdf"
		// Find the first available printer whose name CONTAINS the requested term (or a more specific term if needed)
		// Prioritize non-protected versions if multiple exist for terms like "onenote"
		foundPrinter =
			printers.find(
				(p) =>
					p.name.toLowerCase().includes(requestedNameLower) &&
					!p.name.toLowerCase().includes("protected")
			) ||
			printers.find(
				(p) =>
					p.osName &&
					p.osName.toLowerCase().includes(requestedNameLower) &&
					!p.osName.toLowerCase().includes("protected")
			) ||
			printers.find((p) => p.name.toLowerCase().includes(requestedNameLower)) || // Fallback to any containing term
			printers.find(
				(p) => p.osName && p.osName.toLowerCase().includes(requestedNameLower)
			);

		if (foundPrinter) {
			console.log(
				`Fuzzy match: Requested '${requestedPrinterName}', using '${foundPrinter.name}'`
			);
			return foundPrinter;
		}
	}
	return null; // No printer found
}

// export async function handlePrintRequest(
// 	jobDetails,
// 	getDiscoveredPrinters,
// 	mainWindow
// ) {
// 	const {
// 		printerName,
// 		templateType,
// 		templateData,
// 		printerOptions = {},
// 	} = jobDetails;

// 	if (!printerName) throw new Error("Missing 'printerName'.");
// 	if (!templateType) throw new Error("Missing 'templateType'.");
// 	if (templateData === undefined) throw new Error("Missing 'templateData'.");

// 	const printers = getDiscoveredPrinters();
// 	if (!printers) throw new Error("Printer configuration unavailable.");

// 	// const printerConfig = printers.find(
// 	// 	(p) =>
// 	// 		p.name.toLowerCase() === printerName.toLowerCase() ||
// 	// 		(p.osName && p.osName.toLowerCase() === printerName.toLowerCase())
// 	// );

// 	const printerConfig = findPrinterConfiguration(printers, printerName);

// 	if (!printerConfig) {
// 		throw new Error(`Printer named '${printerName}' not found.`);
// 	}

// 	let ntpStyleCommands;

// 	const finalTemplateData = {
// 		...templateData, // Spread incoming data from API
// 		logoPath: fixedLogoPath, // Override or add the fixed local logo path
// 		// This path will be used by both NTP and PDF templates
// 	};
// 	try {
// 		const templateFunction = getTemplateFunction(templateType);
// 		ntpStyleCommands = templateFunction(finalTemplateData);
// 		if (!Array.isArray(ntpStyleCommands)) {
// 			throw new Error("Template did not return an array of commands.");
// 		}
// 		console.log(
// 			`PrintService: Generated ${ntpStyleCommands.length} NTP-style commands via template '${templateType}' for '${printerConfig.name}'.`
// 		);
// 	} catch (templateError) {
// 		console.error(
// 			`PrintService: Error generating print data from template '${templateType}':`,
// 			templateError
// 		);
// 		throw new Error(`Template error: ${templateError.message}`);
// 	}

// 	const logPrefix = `PRINT_SVC [${printerConfig.name} (${printerConfig.connectionType})]:`;
// 	console.log(
// 		`${logPrefix} Job using template '${templateType}'. Virtual: ${
// 			printerConfig.isVirtual
// 		}, Target: ${printerConfig.osName || printerConfig.name}`
// 	);

// 	// --- Route to the correct printing method ---
// 	console.log(
// 		"⚡⚡⚡[printerConfig connectionType]",
// 		printerConfig.connectionType
// 	);
// 	if (printerConfig.isVirtual || printerConfig.connectionType === "VIRTUAL") {
// 		console.log(
// 			`${logPrefix} Using Electron WebContents.print() for virtual printer.`
// 		);
// 		const htmlContent = await commandsToSimpleHtml(
// 			ntpStyleCommands,
// 			`Print to ${printerConfig.name}`
// 		);
// 		return printVirtually(
// 			htmlContent,
// 			printerConfig,
// 			mainWindow,
// 			printerOptions
// 		);
// 	} else if (
// 		printerConfig.connectionType === "OS_PLICK" ||
// 		(printerConfig.connectionType === "MDNS_LAN" &&
// 			printerConfig.osName &&
// 			printerConfig.isPlickCompatible) // Add a flag if MDNS can be Plick
// 	) {
// 		console.log(
// 			`${logPrefix} Using @plick/electron-pos-printer for physical printer.`
// 		);
// 		const plickDataPayload = mapNTPCommandsToPlickData(
// 			ntpStyleCommands,
// 			printerOptions
// 		);
// 		return printWithPlick(ntpStyleCommands, printerConfig, printerOptions);
// 	} else if (printerConfig.connectionType === "RAW_USB") {
// 		console.log(`${logPrefix} Using RAW USB printing path.`);
// 		const rawBuffer = await generatePrintBufferNTP(
// 			ntpStyleCommands,
// 			printerOptions
// 		);
// 		return printViaRawUsb(rawBuffer, printerConfig, printerOptions); // This is a stub
// 	} else if (
// 		printerConfig.connectionType &&
// 		printerConfig.connectionType.startsWith("OS_") &&
// 		printerConfig.osName
// 	) {
// 		// OS_USB, OS_LAN, OS_LOCAL (via command line), but not OS_PLICK (handled above)
// 		console.log(`${logPrefix} Using OS command line printing.`);
// 		const rawBufferOs = await generatePrintBufferNTP(
// 			ntpStyleCommands,
// 			printerOptions
// 		);
// 		return printViaOsCommand(rawBufferOs, printerConfig, printerOptions);
// 	} else if (
// 		printerConfig.connectionType === "MDNS_LAN" &&
// 		printerConfig.ip &&
// 		printerConfig.port
// 	) {
// 		// Direct TCP/IP printing for MDNS_LAN not handled by Plick/OS Name
// 		console.log(`${logPrefix} Using direct TCP/IP printing.`);
// 		// For TCP/IP with node-thermal-printer, we pass the NTP-style commands directly
// 		return printViaTcpIp(ntpStyleCommands, printerConfig, printerOptions);
// 	} else {
// 		const errorMessage = `Unhandled printer configuration. ConnType: '${printerConfig.connectionType}' for printer '${printerConfig.name}'. Cannot print.`;
// 		console.error(`${logPrefix} ${errorMessage}`);
// 		throw new Error(errorMessage);
// 	}
// }

export async function handlePrintRequest(
	jobDetails,
	getDiscoveredPrinters,
	mainWindow
) {
	const {
		printerName,
		templateType,
		templateData,
		printerOptions = {},
	} = jobDetails;

	if (!printerName) throw new Error("Missing 'printerName'.");
	if (!templateType) throw new Error("Missing 'templateType'.");
	if (templateData === undefined) throw new Error("Missing 'templateData'.");

	const printers = getDiscoveredPrinters();
	if (!printers) throw new Error("Printer configuration unavailable.");

	const printerConfig = findPrinterConfiguration(printers, printerName);

	if (!printerConfig) {
		throw new Error(`Printer named '${printerName}' not found.`);
	}

	// Renamed to be format-agnostic
	let generatedCommands;

	const finalTemplateData = {
		...templateData,
		logoPath: fixedLogoPath,
	};
	try {
		const templateFunction = getTemplateFunction(templateType);
		generatedCommands = templateFunction(finalTemplateData);
		if (!Array.isArray(generatedCommands)) {
			throw new Error("Template did not return an array of commands.");
		}
		console.log(
			`PrintService: Generated ${generatedCommands.length} commands via template '${templateType}' for '${printerConfig.name}'.`
		);
	} catch (templateError) {
		console.error(
			`PrintService: Error generating print data from template '${templateType}':`,
			templateError
		);
		throw new Error(`Template error: ${templateError.message}`);
	}

	const logPrefix = `PRINT_SVC [${printerConfig.name} (${printerConfig.connectionType})]:`;
	console.log(
		`${logPrefix} Job using template '${templateType}'. Virtual: ${
			printerConfig.isVirtual
		}, Target: ${printerConfig.osName || printerConfig.name}`
	);

	console.log(
		"⚡⚡⚡[printerConfig connectionType]",
		printerConfig.connectionType
	);

	// --- Route to the correct printing method ---
	if (printerConfig.isVirtual || printerConfig.connectionType === "VIRTUAL") {
		console.log(
			`${logPrefix} Using Electron WebContents.print() for virtual printer.`
		);
		const htmlContent = await commandsToSimpleHtml(
			generatedCommands,
			`Print to ${printerConfig.name}`
		);
		return printVirtually(
			htmlContent,
			printerConfig,
			mainWindow,
			printerOptions
		);
	}
	// ====================================================================
	// >>>>>>>>>> START OF MODIFIED LOGIC FOR PLICK PRINTERS <<<<<<<<<<
	// ====================================================================
	else if (
		printerConfig.connectionType === "OS_PLICK" ||
		(printerConfig.connectionType === "MDNS_LAN" &&
			printerConfig.osName &&
			printerConfig.isPlickCompatible)
	) {
		console.log(
			`${logPrefix} Using @plick/electron-pos-printer for physical printer.`
		);

		let finalPlickCommands;

		// Heuristic check: If the first command looks like a modern Plick command,
		// assume the entire array is already in the correct format.
		const isNativePlickFormat =
			generatedCommands.length > 0 &&
			["text", "divider", "feed", "image", "qrCode", "barcode"].includes(
				generatedCommands[0].type
			);

		if (isNativePlickFormat) {
			console.log(
				`${logPrefix} Template output appears to be in native Plick format. Bypassing adapter.`
			);
			// The template output is already correct, use it directly.
			finalPlickCommands = generatedCommands;
		} else {
			// Otherwise, use the adapter as a fallback for legacy NTP-style templates.
			console.log(
				`${logPrefix} Template output appears to be in legacy NTP format. Using adapter for conversion.`
			);
			finalPlickCommands = mapNTPCommandsToPlickData(
				generatedCommands,
				printerOptions
			);
		}

		// The variable passed to the printer now contains correctly formatted commands.
		return printWithPlick(finalPlickCommands, printerConfig, printerOptions);
	}
	// ====================================================================
	// >>>>>>>>>> END OF MODIFIED LOGIC <<<<<<<<<<
	// ====================================================================
	else if (printerConfig.connectionType === "RAW_USB") {
		console.log(`${logPrefix} Using RAW USB printing path.`);
		const rawBuffer = await generatePrintBufferNTP(
			generatedCommands,
			printerOptions
		);
		return printViaRawUsb(rawBuffer, printerConfig, printerOptions);
	} else if (
		printerConfig.connectionType &&
		printerConfig.connectionType.startsWith("OS_") &&
		printerConfig.osName
	) {
		console.log(`${logPrefix} Using OS command line printing.`);
		const rawBufferOs = await generatePrintBufferNTP(
			generatedCommands,
			printerOptions
		);
		return printViaOsCommand(rawBufferOs, printerConfig, printerOptions);
	} else if (
		printerConfig.connectionType === "MDNS_LAN" &&
		printerConfig.ip &&
		printerConfig.port
	) {
		console.log(`${logPrefix} Using direct TCP/IP printing.`);
		return printViaTcpIp(generatedCommands, printerConfig, printerOptions);
	} else {
		const errorMessage = `Unhandled printer configuration. ConnType: '${printerConfig.connectionType}' for printer '${printerConfig.name}'. Cannot print.`;
		console.error(`${logPrefix} ${errorMessage}`);
		throw new Error(errorMessage);
	}
}

export async function handleDirectPdfPrintRequest(
	jobDetails,
	getDiscoveredPrinters,
	mainWindow
) {
	const {
		printerName: requestedPrinterName,
		pdfBase64, // Expecting a base64 encoded PDF string (without "data:application/pdf;base64," prefix)
		printerOptions = {}, // e.g., { copies: 1, color: false, margins: { marginType: "default" }}
	} = jobDetails;

	if (!requestedPrinterName) throw new Error("Missing 'printerName'.");
	if (!pdfBase64) throw new Error("Missing 'pdfBase64' data.");

	const printers = getDiscoveredPrinters();
	if (!printers) throw new Error("Printer configuration unavailable.");

	// Use the existing helper to find the printer config
	const printerConfig = findPrinterConfiguration(
		printers,
		requestedPrinterName
	);

	if (!printerConfig) {
		throw new Error(
			`Printer named or matching '${requestedPrinterName}' not found or configured.`
		);
	}

	const logPrefix = `DIRECT_PDF_PRINT_SVC [${printerConfig.name} (${printerConfig.connectionType})]:`;
	console.log(
		`${logPrefix} Received direct PDF print job for printer '${printerConfig.name}'.`
	);

	let tempPdfPath = "";
	try {
		// Decode base64 PDF and write to a temporary file
		const pdfBuffer = Buffer.from(pdfBase64, "base64");
		tempPdfPath = path.join(os.tmpdir(), `direct_print_${Date.now()}.pdf`);
		await fs.writeFile(tempPdfPath, pdfBuffer);
		console.log(`${logPrefix} Temporary PDF saved to ${tempPdfPath}.`);
		// shell.openPath(tempPdfPath);
		const stats = await fs.stat(tempPdfPath);
		console.log("PDF file size (bytes):", stats.size);

		// Use the existing printPdfVirtually function. It prints a local PDF
		// to the specified deviceName (which can be a physical OS printer).
		const result = await printPdfVirtually(
			tempPdfPath,
			printerConfig,
			mainWindow,
			printerOptions
		);
		return result;
	} catch (printError) {
		console.error(
			`${logPrefix} Error in direct PDF printing pipeline:`,
			printError
		);
		throw new Error(
			`Direct PDF print failed for ${printerConfig.name}: ${printError.message}`
		);
	} finally {
		if (tempPdfPath) {
			// Clean up the temporary PDF file
			await fs
				.unlink(tempPdfPath)
				.catch((err) =>
					console.warn(
						`${logPrefix} Failed to delete temp PDF ${tempPdfPath}: ${err.message}`
					)
				);
		}
	}
}

export async function handlePDFPrintRequest(
	jobDetails,
	getDiscoveredPrinters,
	mainWindow
) {
	const {
		printerName,
		templateType,
		templateData,
		printerOptions = {},
	} = jobDetails;

	if (!printerName) throw new Error("Missing 'printerName'.");
	if (!templateType) throw new Error("Missing 'templateType'.");
	if (templateData === undefined) throw new Error("Missing 'templateData'.");

	const printers = getDiscoveredPrinters();
	if (!printers) throw new Error("Printer configuration unavailable.");

	// const printerConfig = printers.find(
	// 	(p) =>
	// 		p.name.toLowerCase() === printerName.toLowerCase() ||
	// 		(p.osName && p.osName.toLowerCase() === printerName.toLowerCase())
	// );

	const printerConfig = findPrinterConfiguration(printers, printerName);

	if (!printerConfig) {
		throw new Error(`Printer named '${printerName}' not found.`);
	}

	let ntpStyleCommands;

	const finalTemplateData = {
		...templateData, // Spread incoming data from API
		logoPath: fixedLogoPath, // Override or add the fixed local logo path
		// This path will be used by both NTP and PDF templates
	};
	try {
		const templateFunction = getTemplateFunction(templateType);
		ntpStyleCommands = templateFunction(finalTemplateData);
		if (!Array.isArray(ntpStyleCommands)) {
			throw new Error("Template did not return an array of commands.");
		}
		console.log("NTP TEMPLATE DATA", JSON.stringify(ntpStyleCommands, null, 2));
		console.log(
			`PrintService: Generated ${ntpStyleCommands.length} NTP-style commands via template '${templateType}' for '${printerConfig.name}'.`
		);
	} catch (templateError) {
		console.error(
			`PrintService: Error generating print data from template '${templateType}':`,
			templateError
		);
		throw new Error(`Template error: ${templateError.message}`);
	}

	const logPrefix = `PRINT_SVC [${printerConfig.name} (${printerConfig.connectionType})]:`;
	console.log(
		`${logPrefix} Job using template '${templateType}'. Virtual: ${
			printerConfig.isVirtual
		}, Target: ${printerConfig.osName || printerConfig.name}`
	);

	// --- Route to the correct printing method ---
	console.log(
		"⚡⚡⚡[printerConfig connectionType]",
		printerConfig.connectionType
	);
	if (printerConfig.isVirtual || printerConfig.connectionType === "VIRTUAL") {
		console.log(
			`${logPrefix} Using Electron WebContents.print() for virtual printer.`
		);
		const htmlContent = await commandsToSimpleHtml(
			ntpStyleCommands,
			`Print to ${printerConfig.name}`
		);
		return printVirtually(
			htmlContent,
			printerConfig,
			mainWindow,
			printerOptions
		);
	} else if (
		printerConfig.connectionType === "OS_PLICK" ||
		(printerConfig.connectionType === "MDNS_LAN" &&
			printerConfig.osName &&
			printerConfig.isPlickCompatible) // Add a flag if MDNS can be Plick
	) {
		console.log(
			`${logPrefix} Using @plick/electron-pos-printer for physical printer.`
		);
		const plickDataPayload = mapNTPCommandsToPlickData(
			ntpStyleCommands,
			printerOptions
		);
		return printWithPlick(plickDataPayload, printerConfig, printerOptions);
	} else if (printerConfig.connectionType === "RAW_USB") {
		console.log(`${logPrefix} Using RAW USB printing path.`);
		const rawBuffer = await generatePrintBufferNTP(
			ntpStyleCommands,
			printerOptions
		);
		return printViaRawUsb(rawBuffer, printerConfig, printerOptions); // This is a stub
	} else if (
		printerConfig.connectionType &&
		printerConfig.connectionType.startsWith("OS_") &&
		printerConfig.osName
	) {
		// OS_USB, OS_LAN, OS_LOCAL (via command line), but not OS_PLICK (handled above)
		console.log(`${logPrefix} Using OS command line printing.`);
		const rawBufferOs = await generatePrintBufferNTP(
			ntpStyleCommands,
			printerOptions
		);
		return printViaOsCommand(rawBufferOs, printerConfig, printerOptions);
	} else if (
		printerConfig.connectionType === "MDNS_LAN" &&
		printerConfig.ip &&
		printerConfig.port
	) {
		// Direct TCP/IP printing for MDNS_LAN not handled by Plick/OS Name
		console.log(`${logPrefix} Using direct TCP/IP printing.`);
		// For TCP/IP with node-thermal-printer, we pass the NTP-style commands directly
		return printViaTcpIp(ntpStyleCommands, printerConfig, printerOptions);
	} else {
		const errorMessage = `Unhandled printer configuration. ConnType: '${printerConfig.connectionType}' for printer '${printerConfig.name}'. Cannot print.`;
		console.error(`${logPrefix} ${errorMessage}`);
		throw new Error(errorMessage);
	}
}
