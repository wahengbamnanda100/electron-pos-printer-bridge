// src/templates/goCrispyThermalReceipt.js

/**
 * Generates printData for the GO CRISPY GHARAFA Thermal Receipt.
 *
 * @param {object} data - The dynamic data for the ticket.
 * @param {string} [data.logoPath] - Absolute path to the logo image.
 * @param {string} [data.storeName="GO CRISPY GHARAFA"]
 * @param {string} [data.tel]
 * @param {string} [data.telArabic="الهاتف"]
 * @param {string} [data.fax]
 * @param {string} [data.faxArabic="الفاكس"]
 * @param {string} [data.date] // e.g., 23-Jun-2025
 * @param {string} [data.time] // e.g., 12:44 pm
 * @param {string} [data.billNo] // e.g., Sample Invoice
 * @param {number|string} [data.pax]
 * @param {string} [data.kotNo] // e.g., GOCG/KOT2500223(9:44AM)
 * @param {string} [data.deliveryDateTime] // e.g., 23-Jun-2025 9:44 am
 * @param {string} [data.customerName]
 * @param {string} [data.customerMobile]
 * @param {Array<object>} data.items - [{ name: "APPLE JUICEeee", nameAr: "عصير تفاح", qty: 2, amount: 6.00, subItems: [...] }]
 *                                   // amount here is line total (qty * unit_price)
 * @param {number|string} data.totalAmount
 * @param {string} [data.totalAmountArabic="مجموع"]
 * @param {number|string} [data.deliveryCharge]
 * @param {string} [data.deliveryChargeArabic="رسوم التوصيل"]
 * @param {number|string} data.netAmount
 * @param {string} [data.netAmountArabic="المبلغ الإجمالي"]
 * @param {string} [data.thankYouMessage="**THANK YOU FOR DINING WITH US **"]
 * @param {string} [data.commentsLabel="Comments......................................."]
 * @param {string} [data.signLabel="Sign.........................................."]
 * @returns {Array<object>} - Array of print command objects.
 */
export function generateGoCrispyThermalReceipt(data = {}) {
	const printCommands = [];
	// Adjust paperCharWidth based on your printer's font (usually 42 or 48 for 80mm).
	// This is mainly for full-width line separators. tableCustom handles column widths.
	const paperCharWidth = 48;

	const d = (value, defaultValue = "") =>
		value !== undefined && value !== null ? String(value) : defaultValue;
	const formatAmount = (amount) => parseFloat(d(amount, "0")).toFixed(2);

	// --- Recursive Item Printer ---
	const printInvoiceItem = (item, indentLevel = 0, isSubItem = false) => {
		const indent = "  ".repeat(indentLevel); // Indentation for sub-items
		const qtyStr = d(item.qty);
		// For thermal, control name length more explicitly if needed, or let tableCustom handle wrapping
		const nameStr = `${indent}${isSubItem ? "- " : ""}${d(item.name)}`;
		const amountStr = formatAmount(item.amount); // Assuming item.amount is line total

		// Main Item Line: Name (L), Qty (C), Amount (R)
		printCommands.push({
			type: "tableCustom",
			data: [[nameStr, qtyStr, amountStr]],
			options: {
				columns: [
					{ width: 0.6, align: "LEFT", style: isSubItem ? "" : "B" }, // Menu name
					{ width: 0.15, align: "CENTER" }, // Qty
					{ width: 0.25, align: "RIGHT" }, // Amount
				],
			},
		});

		// Arabic Name (if any, indented, left-aligned under name)
		if (item.nameAr) {
			printCommands.push({ type: "setStyles", align: "LT" }); // Left align for Arabic name line
			printCommands.push({
				type: "println",
				content: `${indent}  ${d(item.nameAr)}`,
			});
			printCommands.push({ type: "resetStyles" });
		}

		if (item.subItems && item.subItems.length > 0) {
			item.subItems.forEach((subItem) =>
				printInvoiceItem(subItem, indentLevel + 1, true)
			);
		}
	};

	// --- Logo ---
	if (data.logoPath) {
		printCommands.push({ type: "align", align: "CT" });
		printCommands.push({
			type: "image",
			path: data.logoPath,
			options: { rasterize: true },
		}); // Add rasterize for complex logos
		printCommands.push({ type: "feed", lines: 1 });
	} else {
		printCommands.push({
			type: "setStyles",
			align: "CT",
			style: "B",
			size: [1, 2],
		}); // Larger fallback
		printCommands.push({ type: "println", content: "Logo Placeholder" });
		printCommands.push({ type: "resetStyles" });
		printCommands.push({ type: "feed", lines: 1 });
	}

	// Store Name
	printCommands.push({
		type: "setStyles",
		align: "CT",
		style: "B",
		size: [1, 2],
	}); // Larger & Bold
	printCommands.push({
		type: "println",
		content: d(data.storeName, "GO CRISPY GHARAFA"),
	});
	printCommands.push({ type: "resetStyles" });
	printCommands.push({ type: "feed", lines: 1 });

	// Contact Info - using tableCustom for better bi-directional alignment
	if (data.tel) {
		printCommands.push({
			type: "tableCustom",
			data: [[`Tel : ${d(data.tel)}`, `${d(data.telArabic, "الهاتف")} :`]],
			options: {
				columns: [
					{ width: 0.5, align: "LEFT" },
					{ width: 0.5, align: "RIGHT" },
				],
			},
		});
	}
	if (data.fax) {
		printCommands.push({
			type: "tableCustom",
			data: [[`Fax : ${d(data.fax)}`, `${d(data.faxArabic, "الفاكس")} :`]],
			options: {
				columns: [
					{ width: 0.5, align: "LEFT" },
					{ width: 0.5, align: "RIGHT" },
				],
			},
		});
	}
	printCommands.push({ type: "drawLine" });

	// Header Info
	// For lines with two pieces of info, tableCustom is more reliable than space padding
	printCommands.push({
		type: "tableCustom",
		data: [[`Date : ${d(data.date)}`, `Time : ${d(data.time)}`]],
		options: {
			columns: [
				{ width: 0.5, align: "LEFT" },
				{ width: 0.5, align: "LEFT" },
			],
		}, // Both left aligned on their side
	});
	printCommands.push({
		type: "tableCustom",
		data: [[`Bill : ${d(data.billNo)}`, `Pax : ${d(data.pax, "1")}`]],
		options: {
			columns: [
				{ width: 0.7, align: "LEFT" },
				{ width: 0.3, align: "LEFT" },
			],
		},
	});
	if (data.kotNo)
		printCommands.push({
			type: "println",
			content: `KOT No. : ${d(data.kotNo)}`,
			style: "B",
		}); // KOT No. is bold
	if (data.deliveryDateTime)
		printCommands.push({
			type: "println",
			content: `Delivery Date/Time : ${d(data.deliveryDateTime)}`,
		});
	printCommands.push({ type: "drawLine" });

	// Customer Info
	if (data.customerName)
		printCommands.push({
			type: "println",
			content: `Customer Name : ${d(data.customerName)}`,
			style: "B",
		});
	if (data.customerMobile)
		printCommands.push({
			type: "println",
			content: `Mobile Number : ${d(data.customerMobile)}`,
			style: "B",
		});
	printCommands.push({ type: "drawLine" });

	// Numbered Lines (if any) - these seem like placeholders in the image
	if (data.numberedLines && data.numberedLines.length > 0) {
		data.numberedLines.forEach((line) =>
			printCommands.push({ type: "println", content: d(line) })
		);
		printCommands.push({ type: "drawLine" });
	}

	// Items Header: Menu, Qty, Amount(QAR)
	printCommands.push({
		type: "tableCustom",
		data: [["Menu", "Qty", "Amount(QAR)"]],
		options: {
			columns: [
				{ width: 0.6, align: "LEFT", style: "B" }, // Menu
				{ width: 0.15, align: "CENTER", style: "B" }, // Qty
				{ width: 0.25, align: "RIGHT", style: "B" }, // Amount
			],
		},
	});
	printCommands.push({ type: "drawLine" });

	// Delivery Section Title (if any)
	if (data.deliverySectionTitle) {
		printCommands.push({ type: "setStyles", align: "CT", style: "B" });
		printCommands.push({
			type: "println",
			content: d(data.deliverySectionTitle),
		});
		printCommands.push({ type: "resetStyles" });
	}

	// Items List
	if (data.items && data.items.length > 0) {
		data.items.forEach((item) => {
			printInvoiceItem(item, 0, false); // Uses the recursive helper
		});
	}
	printCommands.push({ type: "drawLine" }); // Line after all items

	// --- Financial Summary ---
	const printFinancialLineNTP = (labelEn, labelAr, value, options = {}) => {
		const {
			isBold = true,
			isLargeAmount = false, // For Net Amount font size
			showColon = true,
		} = options;

		const enLabelText = labelEn + (showColon ? " :" : "");
		const amountText = formatAmount(value);
		const amountSize = isLargeAmount ? [1, 2] : [1, 1]; // Double height for Net Amount value
		const labelSize = [1, 1]; // All labels normal height

		printCommands.push({
			type: "tableCustom",
			data: [[enLabelText, amountText]],
			options: {
				columns: [
					{
						width: 0.7,
						align: "LEFT",
						style: isBold ? "B" : "",
						size: labelSize,
					},
					{
						width: 0.3,
						align: "RIGHT",
						style: isBold ? "B" : "",
						size: amountSize,
					},
				],
			},
		});
		if (labelAr) {
			printCommands.push({
				type: "setStyles",
				align: "LT",
				style: isBold ? "B" : "",
				size: labelSize,
			}); // Left aligned for Arabic label on its line
			printCommands.push({ type: "println", content: labelAr });
			printCommands.push({ type: "resetStyles" });
		}
	};

	printFinancialLineNTP(
		"Total",
		d(data.totalAmountArabic, "مجموع"),
		data.totalAmount
	);
	// Discount is not in this new image, so we'll skip it unless data is provided.
	if (
		data.discountAmount !== undefined &&
		parseFloat(d(data.discountAmount, 0)) > 0
	) {
		const discountLabelEn = data.discountPercentage
			? `${d(data.discountPercentage)}% Discount`
			: "Discount";
		printFinancialLineNTP(
			discountLabelEn,
			d(data.discountArabic, "خصم"),
			data.discountAmount
		);
	}
	if (
		data.deliveryCharge !== undefined &&
		parseFloat(d(data.deliveryCharge, 0)) > 0
	) {
		printFinancialLineNTP(
			"Delivery Charge",
			d(data.deliveryChargeArabic, "رسوم التوصيل"),
			data.deliveryCharge
		);
	}
	// No line before Net Amount in this specific image.
	printFinancialLineNTP(
		"Net Amount",
		d(data.netAmountArabic, "المبلغ الإجمالي"),
		data.netAmount,
		{ isLargeAmount: true }
	);
	printCommands.push({ type: "drawLine" }); // Line after Net Amount

	// Paid Amount and Settlement Details are not in this simpler receipt image.
	// If they were, you'd add them here.

	// Footer
	if (data.thankYouMessage) {
		printCommands.push({ type: "setStyles", align: "CT", style: "B" });
		printCommands.push({ type: "println", content: d(data.thankYouMessage) });
		printCommands.push({ type: "resetStyles" });
	}
	printCommands.push({ type: "feed", lines: 1 });
	if (data.commentsLabel)
		printCommands.push({ type: "println", content: d(data.commentsLabel) });
	if (data.signLabel)
		printCommands.push({ type: "println", content: d(data.signLabel) });

	printCommands.push({ type: "feed", lines: 3 });
	printCommands.push({ type: "cut" });

	return printCommands;
}
