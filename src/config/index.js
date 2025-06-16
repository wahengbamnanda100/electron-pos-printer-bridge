import { PrinterTypes, CharacterSet } from "node-thermal-printer";

export const API_PORT = process.env.API_PORT || 3030;

export const DEFAULT_NTP_OPTIONS = {
	type: PrinterTypes.EPSON,
	characterSet: CharacterSet.UTF_8,
	timeout: 7000,
};

export const VIRTUAL_PRINT_OPTIONS = {
	silent: true,
	printBackground: true,
	color: false,
	margins: { marginType: "printableArea" },
};

export const PLICK_DEFAULT_OPTIONS = {
	silent: true,
	copies: 1,
	preview: false,
	margin: "0 0 0 0",
	pageSize: "80mm", // Check Plick docs for default/valid values
	timeOutPerLine: 400,
};

export const OS_COMMAND_PRINT_TIMEOUT = 15000;
