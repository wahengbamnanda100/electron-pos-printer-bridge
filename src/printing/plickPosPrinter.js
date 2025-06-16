import { PosPrinter, isPlickPrinterLoaded } from "../utils/pnpPlickLoader.js";
import { PLICK_DEFAULT_OPTIONS } from "../config/index.js";

export async function printWithPlick(
	plickDataPayload,
	printerConfig,
	printerOptions = {}
) {
	const logPrefix = `PLICK_PRINT [${printerConfig.name}]:`;

	if (!isPlickPrinterLoaded()) {
		throw new Error("@plick/electron-pos-printer is not loaded. Cannot print.");
	}

	if (!plickDataPayload || plickDataPayload.length === 0) {
		// Check if it's an intentional empty payload or an error placeholder from the formatter
		if (
			plickDataPayload &&
			plickDataPayload[0] &&
			plickDataPayload[0].value?.startsWith("[Warn")
		) {
			throw new Error(
				"Failed to convert template commands to a printable Plick EPP format. Check mapping."
			);
		}
		console.log(`${logPrefix} Plick data payload is empty, nothing to print.`);
		return {
			success: true,
			message: "Empty payload, no print job sent to Plick.",
		};
	}

	const plickJobOptions = {
		printerName: printerConfig.osName || printerConfig.name, // Plick uses the OS name
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

	console.log(
		`${logPrefix} Sending job to Plick EPP. Target: '${plickJobOptions.printerName}'. Options:`,
		plickJobOptions
	);

	try {
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
			`${logPrefix} @plick/electron-pos-printer error: ${eppError.message}`,
			eppError
		);
		throw new Error(
			`Plick EPP print failed for '${printerConfig.name}': ${eppError.message}`
		);
	}
}
