import { generateTwKitchenTakeawayTicket } from "./kot_save_recipt.js";
import { generateChelokababTakeawayReceipt } from "./template_2.js";
import { generateGoCrispyInvoiceReceipt } from "./inv_recipt.js";
import { generateTwKitchenTakeawayTicketHtml } from "./kot_save_html.js";
// Import other template generators here

export const templateGenerators = {
	KOT_SAVE: generateTwKitchenTakeawayTicket,
	TEMP_2: generateChelokababTakeawayReceipt,
	INV: generateGoCrispyInvoiceReceipt,
	SAMPLE_KOT: generateGoCrispyInvoiceReceipt,
	KOT_SAVE_HTML: generateTwKitchenTakeawayTicketHtml,

	// Add more template identifiers and their corresponding functions here
};

export function getTemplateFunction(templateType) {
	const templateFunction = templateGenerators[templateType.toUpperCase()];
	if (!templateFunction) {
		throw new Error(`Template type '${templateType}' not found.`);
	}
	return templateFunction;
}
