function generateGoCrispyInvoiceReceipt(invoiceData) {
	const {
		customerName,
		customerPhone,
		customerAddress,
		items,
		totalAmount,
		discount,
		tax,
		settlementType,
		storeName,
		storeAddress,
		storePhone,
		storeVAT,
		invoiceNumber,
		orderType,
		arabicTitle,
		createdAt,
	} = invoiceData;

	// Helper to print centered text
	const centerText = (text, options = {}) => ({
		type: "text",
		value: text,
		style: {
			fontFamily: "Tahoma",
			fontWeight: "700",
			textAlign: "center",
			...options,
		},
	});

	// Helper to print left/right aligned key-value lines
	const keyValueLine = (key, value, options = {}) => ({
		type: "text",
		value: `${key}  ${value}`,
		style: {
			fontFamily: "Tahoma",
			fontWeight: "400",
			textAlign: "left",
			...options,
		},
	});

	// Recursive function to print items and sub-items
	const printItems = (items, indent = 0) => {
		const lines = [];
		items.forEach((item) => {
			lines.push({
				type: "text",
				value: `${" ".repeat(indent * 2)}${item.qty} x ${
					item.name
				}  ${item.total.toFixed(2)}`,
				style: { fontFamily: "Tahoma", textAlign: "left" },
			});
			if (item.subItems && item.subItems.length > 0) {
				lines.push(...printItems(item.subItems, indent + 1));
			}
		});
		return lines;
	};

	const receipt = [];

	// Store Logo
	receipt.push({
		type: "image",
		path: "logo.png", // Adjust to your logo path
		position: "center",
		width: 200,
		height: 80,
	});

	// Store Info
	receipt.push(centerText(storeName, { fontSize: "20px" }));
	if (arabicTitle) receipt.push(centerText(arabicTitle, { fontSize: "20px" }));
	receipt.push(centerText(storeAddress));
	receipt.push(centerText(`Tel: ${storePhone}`));
	if (storeVAT) receipt.push(centerText(`VAT: ${storeVAT}`));
	receipt.push({
		type: "text",
		value: "----------------------------------------",
	});

	// Invoice Info
	receipt.push(keyValueLine("Invoice:", invoiceNumber));
	receipt.push(keyValueLine("Date:", createdAt));
	receipt.push(keyValueLine("Order Type:", orderType));
	receipt.push({
		type: "text",
		value: "----------------------------------------",
	});

	// Customer Info
	receipt.push(keyValueLine("Customer:", customerName || ""));
	if (customerPhone) receipt.push(keyValueLine("Phone:", customerPhone));
	if (customerAddress) receipt.push(keyValueLine("Address:", customerAddress));
	receipt.push({
		type: "text",
		value: "----------------------------------------",
	});

	// Items
	receipt.push(...printItems(items));
	receipt.push({
		type: "text",
		value: "----------------------------------------",
	});

	// Totals
	receipt.push(keyValueLine("Total Amount:", totalAmount.toFixed(2)));
	if (discount) receipt.push(keyValueLine("Discount:", discount.toFixed(2)));
	if (tax) receipt.push(keyValueLine("Tax:", tax.toFixed(2)));

	// Final Total
	const grandTotal = totalAmount - (discount || 0) + (tax || 0);
	receipt.push(
		keyValueLine("Grand Total:", grandTotal.toFixed(2), { fontWeight: "700" })
	);
	receipt.push({
		type: "text",
		value: "----------------------------------------",
	});

	// Settlement
	receipt.push(keyValueLine("Settlement:", settlementType));

	// Footer
	receipt.push(centerText("Thank you for your order!", { fontSize: "14px" }));
	receipt.push(centerText("شكرا لطلبك", { fontSize: "14px" }));

	return receipt;
}
