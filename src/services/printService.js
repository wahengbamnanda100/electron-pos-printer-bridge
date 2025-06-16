// src/services/printService.js
import { getTemplateFunction } from "../templates/index.js";
import { mapNTPCommandsToPlickData } from "../formatters/ntpToPlickFormatter.js";
import { commandsToSimpleHtml } from "../formatters/ntpToHtmlFormatter.js";
import { generatePrintBufferNTP } from "../formatters/ntpToEscposBufferFormatter.js";

import { printVirtually } from "../printing/virtualPrinter.js";
import { printWithPlick } from "../printing/plickPosPrinter.js";
import { printViaOsCommand } from "../printing/osCommandPrinter.js";
import { printViaTcpIp } from "../printing/tcpIpPrinter.js";
import { printViaRawUsb } from "../printing/rawUsbPrinter.js"; // Placeholder

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

	const printerConfig = printers.find(
		(p) =>
			p.name.toLowerCase() === printerName.toLowerCase() ||
			(p.osName && p.osName.toLowerCase() === printerName.toLowerCase())
	);

	if (!printerConfig) {
		throw new Error(`Printer named '${printerName}' not found.`);
	}

	let ntpStyleCommands;
	try {
		const templateFunction = getTemplateFunction(templateType);
		ntpStyleCommands = templateFunction(templateData);
		if (!Array.isArray(ntpStyleCommands)) {
			throw new Error("Template did not return an array of commands.");
		}
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

	if (printerConfig.isVirtual || printerConfig.connectionType === "VIRTUAL") {
		console.log(
			`${logPrefix} Using Electron WebContents.print() for virtual printer.`
		);
		const htmlContent = commandsToSimpleHtml(
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
