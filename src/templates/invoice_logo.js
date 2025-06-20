// src/templates/goCrispyInvoiceReceipt.js

/**
 * Generates printData for the GO CRISPY GHARAFA Invoice Receipt.
 * (JSDoc and other parts of the file remain the same as your last provided version)
 * ...
 */
export function generateGoCrispyInvoiceReceipt(data = {}) {
	const printCommands = [];
	const paperCharWidth = 48; // Adjusted for potential slightly wider characters or needs

	const d = (value, defaultValue = "") =>
		value !== undefined && value !== null ? String(value) : defaultValue;
	const formatAmount = (amount) => parseFloat(d(amount, "0")).toFixed(2);

	// alignLine helper from your previous version can be useful for some header lines
	const alignLine = (
		left,
		right,
		totalWidth = paperCharWidth,
		leftWidthPercent = 0.65
	) => {
		// ... (keep your alignLine implementation)
		const leftStr = String(left);
		const rightStr = String(right);
		const leftMaxWidth = Math.floor(totalWidth * leftWidthPercent) - 1; // -1 for a space
		const rightMaxWidth =
			totalWidth - Math.floor(totalWidth * leftWidthPercent);
		const paddedLeft = leftStr.padEnd(leftMaxWidth);
		const paddedRight = rightStr.padStart(rightMaxWidth);
		return `${paddedLeft.substring(0, leftMaxWidth)} ${paddedRight.substring(
			0,
			rightMaxWidth
		)}`;
	};

	// --- Recursive Item Printer (keep your existing printInvoiceItem function) ---
	const printInvoiceItem = (item, indentLevel = 0, isSubItem = false) => {
		// ... (your existing printInvoiceItem implementation)
		const indent = "  ".repeat(indentLevel);
		const qtyStr = d(item.qty);
		const nameStr = `${indent}${isSubItem ? "- " : ""}${d(item.name)}`;
		const amountStr = formatAmount(item.amount); // Assuming item.amount is line total

		printCommands.push({
			type: "tableCustom",
			data: [[nameStr, qtyStr, amountStr]],
			options: {
				columns: [
					{ width: 0.6, align: "LEFT", style: isSubItem ? "" : "B" },
					{ width: 0.15, align: "CENTER" },
					{ width: 0.25, align: "RIGHT" },
				],
			},
		});

		if (item.nameAr) {
			printCommands.push({ type: "setStyles", align: "LT" });
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

	// --- Logo, Header, Customer Info, Items etc. (Same as your provided code) ---
	// (All the initial printCommands.push calls for logo, store name, contact, bill info, items list)
	// ...
	// START OF YOUR EXISTING CODE (abbreviated for focus)
	if (data.logoPath) {
		/* ... logo ... */
	} else {
		/* ... */
	}
	if (data.logoTaglineArabic) {
		/* ... */
	}
	if (data.logoTaglineEnglish) {
		/* ... */
	}
	printCommands.push({ type: "feed", lines: 1 });
	printCommands.push({
		type: "setStyles",
		align: "CT",
		style: "B",
		size: [1, 2],
	});
	printCommands.push({
		type: "println",
		content: d(data.storeName, "GO CRISPY GHARAFA"),
	});
	printCommands.push({ type: "resetStyles" });
	if (data.tel)
		printCommands.push({
			type: "println",
			content: alignLine(`Tel : ${d(data.tel)}`, `الهاتف :`),
			align: "CT",
			style: "B",
		});
	if (data.fax)
		printCommands.push({
			type: "println",
			content: alignLine(`Fax : ${d(data.fax)}`, `الفاكس :`),
			align: "CT",
			style: "B",
		});
	printCommands.push({ type: "drawLine" });
	printCommands.push({
		type: "println",
		content: `Date : ${d(data.invoiceDate)}   Time : ${d(data.invoiceTime)}`,
	});
	printCommands.push({
		type: "println",
		content: `Bill : ${d(data.billNo)}   Pax : ${d(data.pax, "1")}`,
	});
	if (data.kotNo)
		printCommands.push({
			type: "println",
			content: `KOT No.: ${d(data.kotNo)}`,
		});
	if (data.deliveryDateTime)
		printCommands.push({
			type: "println",
			content: `Delivery Date/Time: ${d(data.deliveryDateTime)}`,
		});
	printCommands.push({ type: "drawLine" });
	if (data.staffName)
		printCommands.push({ type: "println", content: d(data.staffName) });
	printCommands.push({ type: "drawLine" });
	// if (data.customerName)
	printCommands.push({
		type: "println",
		content: `Customer Name: ${d(data.customerName) || ""}`,
	});
	// if (data.customerMobile)
	printCommands.push({
		type: "println",
		content: `Mobile Number: ${d(data.customerMobile) || ""}`,
	});
	printCommands.push({ type: "drawLine" });
	if (data.deliveryAddress && data.deliveryAddress.length > 0) {
		data.deliveryAddress.forEach((address) =>
			printCommands.push({ type: "println", content: d(address) })
		);
		printCommands.push({ type: "drawLine" });
	}
	printCommands.push({
		type: "tableCustom",
		data: [["Menu", "Qty", "Amount(QAR)"]],
		options: {
			columns: [
				{ width: 0.6, align: "LEFT", style: "B" },
				{ width: 0.15, align: "CENTER", style: "B" },
				{ width: 0.25, align: "RIGHT", style: "B" },
			],
		},
	});
	printCommands.push({ type: "drawLine" });
	if (data.orderbilltype) {
		printCommands.push({
			type: "println",
			content: `***${d(data.orderbilltype, "Takeaway")}***`,
			align: "CT",
			style: "B",
		});
	}
	if (data.deliverySectionTitle) {
		printCommands.push({ type: "setStyles", align: "CT", style: "B" });
		printCommands.push({
			type: "println",
			content: d(data.deliverySectionTitle),
		});
		printCommands.push({ type: "resetStyles" });
	}
	if (data.items && data.items.length > 0) {
		data.items.forEach((item) => {
			printInvoiceItem(item, 0, false);
		});
	}
	printCommands.push({ type: "drawLine" });
	// END OF ABBREVIATED EXISTING CODE

	// --- Financial Summary (REVISED) ---
	const printFinancialLine = (labelEn, labelAr, value, options = {}) => {
		const {
			isBold = true, // Default to bold for financial lines
			isLargeAmount = false, // Special flag for Net Amount's larger font size
			labelEnStyle = "", // Additional styles for English label if needed
			amountStyle = "", // Additional styles for amount if needed
			arabicLabelStyle = "B", // Default Arabic label to bold
			showColon = true,
		} = options;

		const enLabelText = labelEn + (showColon ? " :" : "");
		const amountText = formatAmount(value);

		// English Label and Amount using tableCustom
		printCommands.push({
			type: "tableCustom",
			data: [[enLabelText, amountText]],
			options: {
				columns: [
					{
						width: 0.65,
						align: "LEFT",
						style: (isBold ? "B" : "") + labelEnStyle,
						size: [1, 1],
					}, // English label
					{
						width: 0.35,
						align: "RIGHT",
						style: (isBold ? "B" : "") + amountStyle,
						size: isLargeAmount ? [1, 2] : [1, 1],
					}, // Amount
				],
			},
		});

		// Arabic Label on the next line, left-aligned
		if (labelAr) {
			printCommands.push({
				type: "setStyles",
				align: "LT",
				style: arabicLabelStyle,
				size: [1, 1],
			}); // Left aligned for Arabic label
			printCommands.push({ type: "println", content: labelAr });
			printCommands.push({ type: "resetStyles" });
		}
	};

	// Total
	printFinancialLine(
		"Total",
		d(data.totalAmountArabic, "مجموع"),
		data.total // This should be the sum of item.amount values
	);

	// Discount
	if (
		data.discountAmount !== undefined &&
		parseFloat(d(data.discountAmount, 0)) > 0
	) {
		const discountLabelEn = data.discountPercentage
			? `${d(data.discountPercentage)}% Discount`
			: "Discount";
		printFinancialLine(
			discountLabelEn,
			d(data.discountArabic, "خصم"),
			data.discountAmount
		);
	}

	// Delivery Charge
	if (
		data.deliveryCharge !== undefined
		// && parseFloat(d(data.deliveryCharge, 0)) > 0
	) {
		printFinancialLine(
			"Delivery Charge",
			d(data.deliveryChargeArabic, "رسوم التوصيل"),
			data.deliveryCharge
		);
	}

	// Line before Net Amount
	// printCommands.push({ type: "drawLine" });

	// Net Amount (Larger font for amount)
	printFinancialLine(
		"Net Amount",
		d(data.netAmountArabic, "المبلغ الإجمالي"),
		data.netAmount,
		{ isLargeAmount: true } // Pass option to make amount text larger
	);

	// Line before Paid Amount
	// printCommands.push({ type: "drawLine" });

	// Paid Amount
	printFinancialLine(
		"Paid Amount",
		d(data.paidAmountArabic, "المبلغ المدفوع"),
		data.invoicegrossamount
	);
	printCommands.push({ type: "drawLine" });

	// --- Settlement Details, Footer (Same as your provided code) ---
	// (All the printCommands.push calls for Settlement, Thank You, Comments, Sign, Cut)
	// ...
	// START OF YOUR EXISTING CODE (abbreviated for focus)
	printCommands.push({ type: "setStyles", align: "CT", style: "B" });
	printCommands.push({
		type: "println",
		content: `${d(data.settlementDetailsLabel, "SETTLEMENT DETAILS")}/${d(
			data.settlementDetailsArabic,
			"معلومات مفصلة عن تسوية"
		)}`,
	});
	printCommands.push({ type: "resetStyles" });
	if (data.settlements && data.settlements.length > 0) {
		data.settlements.forEach((settlement) => {
			// Use printFinancialLine for settlements as well, but without Arabic label and specific styling
			printFinancialLine(
				`${d(settlement.method).toUpperCase()}`, // Method name as English label
				null, // No Arabic label for the method line itself
				settlement.amount,
				{ isBold: false, showColon: true } // Settlement methods not bold in image, show colon
			);
		});
	}
	printCommands.push({ type: "drawLine" });
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
	// END OF ABBREVIATED EXISTING CODE

	return printCommands;
}
