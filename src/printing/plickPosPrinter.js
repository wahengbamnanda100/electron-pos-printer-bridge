// import { PosPrinter, isPlickPrinterLoaded } from "../utils/pnpPlickLoader.js";
// import { PLICK_DEFAULT_OPTIONS } from "../config/index.js";
// import { convertNtpToPlick } from "./commandAdapter.js";

// export async function printWithPlick(
// 	originalPayload,
// 	printerConfig,
// 	printerOptions = {},
// 	paperCharWidth = 42
// ) {
// 	const logPrefix = `PLICK_PRINT [${printerConfig.name}]:`;

// 	if (!isPlickPrinterLoaded()) {
// 		throw new Error("@plick/electron-pos-printer is not loaded. Cannot print.");
// 	}

// 	const plickDataPayload = convertNtpToPlick(originalPayload, paperCharWidth);

// 	if (!plickDataPayload || plickDataPayload.length === 0) {
// 		// Check if it's an intentional empty payload or an error placeholder from the formatter
// 		if (
// 			plickDataPayload &&
// 			plickDataPayload[0] &&
// 			plickDataPayload[0].value?.startsWith("[Warn")
// 		) {
// 			throw new Error(
// 				"Failed to convert template commands to a printable Plick EPP format. Check mapping."
// 			);
// 		}
// 		console.log(`${logPrefix} Plick data payload is empty, nothing to print.`);
// 		return {
// 			success: true,
// 			message: "Empty payload, no print job sent to Plick.",
// 		};
// 	}

// 	// const customCss =
// 	// 	styleOptions.fontFamily !== "monospace"
// 	// 		? `
// 	// 	@font-face {
// 	// 		font-family: '${styleOptions.fontFamily}';
// 	// 		src: url('path/to/your/fonts/${styleOptions.fontFamily}.ttf') format('truetype');
// 	// 	}
// 	// 	body {
// 	// 		font-family: '${styleOptions.fontFamily}', sans-serif;
// 	// 	}
// 	// `
// 	// 		: "";

// 	const plickJobOptions = {
// 		printerName: printerConfig.osName || printerConfig.name, // Plick uses the OS name
// 		silent:
// 			printerOptions?.silent !== undefined
// 				? printerOptions.silent
// 				: PLICK_DEFAULT_OPTIONS.silent,
// 		copies: printerOptions?.copies || PLICK_DEFAULT_OPTIONS.copies,
// 		preview: printerOptions?.preview || PLICK_DEFAULT_OPTIONS.preview,
// 		margin: printerOptions?.margin || PLICK_DEFAULT_OPTIONS.margin,
// 		pageSize: printerOptions?.pageSize || PLICK_DEFAULT_OPTIONS.pageSize,
// 		timeOutPerLine:
// 			printerOptions?.timeOutPerLine || PLICK_DEFAULT_OPTIONS.timeOutPerLine,
// 		// header: `<style>${customCss}</style>`,
// 		...(printerOptions?.plickSpecificOptions || {}),
// 	};

// 	console.log(
// 		`${logPrefix} Sending job to Plick EPP. Target: '${plickJobOptions.printerName}'. Options:`,
// 		plickJobOptions
// 	);

// 	try {
// 		await PosPrinter.print(plickDataPayload, plickJobOptions);
// 		console.log(
// 			`${logPrefix} Job successfully sent via @plick/electron-pos-printer.`
// 		);
// 		return {
// 			success: true,
// 			message: `Job sent via Plick EPP to '${printerConfig.name}'.`,
// 		};
// 	} catch (eppError) {
// 		console.error(
// 			`${logPrefix} @plick/electron-pos-printer error pbj: ${JSON.stringify(
// 				eppError,
// 				null,
// 				2
// 			)}`,
// 			eppError
// 		);
// 		console.error(
// 			`${logPrefix} @plick/electron-pos-printer error: ${eppError.message}`,
// 			eppError
// 		);
// 		throw new Error(
// 			`Plick EPP print failed for '${printerConfig.name}': ${eppError.message}`
// 		);
// 	}
// }

import { PosPrinter, isPlickPrinterLoaded } from "../utils/pnpPlickLoader.js";
import { PLICK_DEFAULT_OPTIONS } from "../config/index.js";

export async function printWithPlick(
	plickDataPayload,
	printerConfig,
	printerOptions = {}
) {
	const logPrefix = `PLICK_PRINT [${printerConfig.name}]:`;

	if (!isPlickPrinterLoaded()) {
		throw new Error(
			`${logPrefix} @plick/electron-pos-printer is not loaded. Cannot print.`
		);
	}

	// ====================================================================
	// >>>>>>>>>> START OF NEW DEBUGGING LOGS <<<<<<<<<<
	// ====================================================================

	console.log(`${logPrefix} Preparing to send job. Validating payload...`);

	// Validate the received payload before attempting to print.
	if (
		!plickDataPayload ||
		!Array.isArray(plickDataPayload) ||
		plickDataPayload.length === 0
	) {
		console.error(
			`${logPrefix} ERROR: Received an empty or invalid data payload. Cannot print.`
		);
		// Log the invalid payload to see what it was
		console.log(
			`${logPrefix} Faulty Payload Received:`,
			JSON.stringify(plickDataPayload, null, 2)
		);
		throw new Error("Print job aborted: Received an empty or invalid payload.");
	}

	const plickJobOptions = {
		printerName: printerConfig.osName || printerConfig.name,
		silent:
			printerOptions?.silent !== undefined
				? printerOptions.silent
				: PLICK_DEFAULT_OPTIONS.silent,
		copies: printerOptions?.copies || PLICK_DEFAULT_OPTIONS.copies,
		preview: printerOptions?.preview || PLICK_DEFAULT_OPTIONS.preview,
		margin: printerOptions?.margin || PLICK_DEFAULT_OPTIONS.margin,
		pageSize: printerOptions?.pageSize || PLICK_DEFAULT_OPTIONS.pageSize,
		timeOutPerLine:
			printerOptions?.timeOutPerLine || PLICK_DEFAULT_OPTIONS.timeOutPerLine,
		...(printerOptions?.plickSpecificOptions || {}),
	};

	// Log the exact data being sent to the library
	console.log("------------------- DEBUGGING PRINT JOB -------------------");
	console.log(`${logPrefix} FINAL PAYLOAD being sent to PosPrinter.print():`);
	console.log(JSON.stringify(plickDataPayload, null, 2));
	console.log(`${logPrefix} FINAL OPTIONS being sent to PosPrinter.print():`);
	console.log(JSON.stringify(plickJobOptions, null, 2));
	console.log("----------------------------------------------------------");

	// ====================================================================
	// >>>>>>>>>> END OF NEW DEBUGGING LOGS <<<<<<<<<<
	// ====================================================================

	try {
		console.log("PRINTING INITIATED");
		await PosPrinter.print(plickDataPayload, plickJobOptions);
		console.log(
			`${logPrefix} Job successfully sent via @plick/electron-pos-printer.`
		);
		return {
			success: true,
			message: `Job sent via Plick EPP to '${printerConfig.name}'.`,
		};
	} catch (eppError) {
		console.error(
			`${logPrefix} @plick/electron-pos-printer reported an error:`,
			eppError
		);
		throw new Error(
			`Plick EPP print failed for '${printerConfig.name}': ${eppError.message}`
		);
	}
}
