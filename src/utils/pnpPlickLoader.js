import { createRequire } from "module";
const require = createRequire(import.meta.url);

let PosPrinterInstance;
let pnpPlickLoaded = false;

try {
	const plickLib = require("@plick/electron-pos-printer");
	if (!plickLib || !plickLib.PosPrinter) {
		throw new Error(
			"PosPrinter class not found in @plick/electron-pos-printer module."
		);
	}
	PosPrinterInstance = plickLib.PosPrinter;
	console.log(
		"Successfully loaded PosPrinter from @plick/electron-pos-printer"
	);
	pnpPlickLoaded = true;
} catch (e) {
	console.error(
		"FATAL: Failed to require or access PosPrinter from '@plick/electron-pos-printer'. Ensure it is installed and compiled correctly.",
		e
	);
	// Stub to prevent further crashes if library is missing
	PosPrinterInstance = {
		print: async () => {
			throw new Error(
				"@plick/electron-pos-printer not loaded. Printing unavailable."
			);
		},
	};
	pnpPlickLoaded = false;
}

export const PosPrinter = PosPrinterInstance;
export const isPlickPrinterLoaded = () => pnpPlickLoaded;
