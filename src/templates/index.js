import { generateTwKitchenTakeawayTicket } from "./kot_save_recipt.js";
import { generateChelokababTakeawayReceipt } from "./template_2.js";
import { generateGoCrispyInvoiceReceipt } from "./invoice_logo.js";
// Import other template generators here

export const templateGenerators = {
	KOT_SAVE: generateTwKitchenTakeawayTicket,
	TEMP_2: generateChelokababTakeawayReceipt,
	INV: generateGoCrispyInvoiceReceipt,

	// Add more template identifiers and their corresponding functions here
};

export function getTemplateFunction(templateType) {
	const templateFunction = templateGenerators[templateType.toUpperCase()];
	if (!templateFunction) {
		throw new Error(`Template type '${templateType}' not found.`);
	}
	return templateFunction;
}
