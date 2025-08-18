// src/templates/cheloKababReceipt.js

/**
 * Generates printData for the Chelokabab Takeaway Receipt.
 * @param {object} data - The dynamic data for the ticket.
 * @param {Array<object>} data.items - e.g., [{ qty: 1, name: "MAIN", nameAr: "رئيسي", amount: 10.00, subItems: [...] }]
 * @returns {Array<object>} - Array of print command objects in Plick EPP format.
 */
export function generateChelokababTakeawayReceipt(data = {}) {
	const receipt = [];
	
	const baseFont = {
		fontFamily: "Arial, sans-serif",
		fontSize: "12px",
	};

	const d = (value, defaultValue = "") =>
		value !== undefined && value !== null ? String(value) : defaultValue;

	const formatAmount = (amount) => {
		const num = parseFloat(d(amount, "0"));
		return num.toFixed(2);
	};

	const makeLine = (char = "=") => char.repeat(42);

	// --- Recursive Helper to Print Items and their Sub-Items ---
	const buildItemRows = (item, indentLevel = 0, isSubItem = false, cancel = false) => {
		const rows = [];
		const indentSpaces = "  ".repeat(indentLevel);
		
		let itemNameDisplay = d(item.name).toUpperCase();
		if (isSubItem) {
			itemNameDisplay = `${indentSpaces}- ${itemNameDisplay}`;
		} else {
			itemNameDisplay = `${indentSpaces}${itemNameDisplay}`;
		}

		// Main item row
		rows.push([
			{
				type: "text",
				value: isSubItem ? `${indentSpaces}${d(item.qty)}` : d(item.qty),
				style: {
					textAlign: "left",
					fontWeight: "bold",
					fontSize: isSubItem ? "12px" : "16px",
				},
			},
			{
				type: "text",
				value: itemNameDisplay,
				style: {
					textAlign: "left",
					fontWeight: "bold",
					fontSize: isSubItem ? "12px" : "16px",
				},
			},
			{
				type: "text",
				value: formatAmount(item.amount),
				style: {
					textAlign: "right",
					fontWeight: "bold",
					fontSize: "12px",
				},
			},
		]);

		// Arabic name row if exists
		if (item.nameAr) {
			rows.push([
				{
					type: "text",
					value: "",
					style: { textAlign: "left" },
				},
				{
					type: "text",
					value: `${indentSpaces}${d(item.nameAr)}`,
					style: {
						textAlign: "center",
						fontSize: "12px",
					},
				},
				{
					type: "text",
					value: "",
					style: { textAlign: "right" },
				},
			]);
		}

		// Cancel status if applicable
		if (cancel) {
			rows.push([
				{
					type: "text",
					value: "",
					style: { textAlign: "left" },
				},
				{
					type: "text",
					value: `${indentSpaces}(Cancelled)`,
					style: {
						textAlign: "center",
						fontWeight: "bold",
						fontSize: "16px",
					},
				},
				{
					type: "text",
					value: "",
					style: { textAlign: "right" },
				},
			]);
		}

		// Process sub-items recursively
		if (item.subItems && item.subItems.length > 0) {
			item.subItems.forEach((subItem) => {
				const subRows = buildItemRows(subItem, indentLevel + 1, true, cancel);
				rows.push(...subRows);
			});
		}

		return rows;
	};

	// ===== LOGO =====
	if (data.logoPath) {
		receipt.push({
			type: "image",
			url: data.logoPath,
			position: "center",
			width: "80px",
			height: "80px",
		});
		receipt.push({
			type: "text",
			value: " ",
			style: { ...baseFont, fontSize: "6px" },
		});
	}

	// ===== STORE INFO =====
	receipt.push({
		type: "text",
		value: d(data.storeName, "TW KITCHEN"),
		style: {
			...baseFont,
			fontWeight: "bold",
			textAlign: "center",
			fontSize: "12px",
		},
	});

	receipt.push({
		type: "text",
		value: d(data.orderType, "Takeaway").toUpperCase(),
		style: {
			...baseFont,
			fontWeight: "bold",
			textAlign: "center",
			fontSize: "12px",
		},
	});

	receipt.push({
		type: "text",
		value: " ",
		style: { ...baseFont, fontSize: "6px" },
	});

	// ===== CUSTOMER INFO =====
	const customerTableBody = [];
	
	if (data.customerName) {
		customerTableBody.push([
			{
				type: "text",
				value: "Customer :",
				style: { textAlign: "left", fontWeight: "bold" },
			},
			{
				type: "text",
				value: d(data.customerName),
				style: { textAlign: "left" },
			},
		]);
	}

	if (data.customerMobile) {
		customerTableBody.push([
			{
				type: "text",
				value: "Mobile No:",
				style: { textAlign: "left", fontWeight: "bold" },
			},
			{
				type: "text",
				value: d(data.customerMobile),
				style: { textAlign: "left" },
			},
		]);
	}

	if (customerTableBody.length > 0) {
		receipt.push({
			type: "table",
			style: { ...baseFont, fontSize: "12px" },
			tableHeader: [],
			tableBody: customerTableBody,
			tableFooter: [],
			tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableBodyStyle: {},
			tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableHeaderCellStyle: { padding: "2px 2px" },
			tableBodyCellStyle: { padding: "2px", textAlign: "left" },
			tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
		});
	}

	// ===== FOLLOW UP STATUS =====
	if (data.followUpStatus) {
		receipt.push({
			type: "text",
			value: d(data.followUpStatus),
			style: {
				...baseFont,
				fontWeight: "bold",
				textAlign: "center",
				fontSize: "12px",
			},
		});
	}

	// ===== DELIVERY TIME =====
	if (data.deliveryTime) {
		receipt.push({
			type: "text",
			value: `Delv Time: ${d(data.deliveryTime)}`,
			style: { ...baseFont, textAlign: "left" },
		});
	}

	receipt.push({
		type: "text",
		value: makeLine("="),
		style: { ...baseFont, textAlign: "center" },
	});

	// ===== ORDER NUMBER =====
	receipt.push({
		type: "text",
		value: `No# : ${d(data.orderNumber, "N/A")}`,
		style: {
			...baseFont,
			fontWeight: "bold",
			fontSize: "16px",
			textAlign: "left",
		},
	});

	receipt.push({
		type: "text",
		value: makeLine("="),
		style: { ...baseFont, textAlign: "center" },
	});

	// ===== DATE/TIME/PAX =====
	const orderDateStr = d(
		data.orderDate,
		new Date()
			.toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
			.replace(/ /g, "-")
	);

	const orderTimeStr = d(
		data.orderTime,
		new Date().toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})
	);

	const paxInfo = data.pax ? `Pax : ${parseFloat(d(data.pax, "0")).toFixed(2)}` : "";

	receipt.push({
		type: "table",
		style: { ...baseFont, fontSize: "12px" },
		tableHeader: [],
		tableBody: [
			[
				{
					type: "text",
					value: `Date : ${orderDateStr} ${orderTimeStr}`,
					style: { textAlign: "left" },
				},
				{
					type: "text",
					value: paxInfo,
					style: { textAlign: "right" },
				},
			],
		],
		tableFooter: [],
		tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableBodyStyle: {},
		tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableHeaderCellStyle: { padding: "2px 2px" },
		tableBodyCellStyle: { padding: "2px", textAlign: "left" },
		tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
	});

	receipt.push({
		type: "text",
		value: makeLine("-"),
		style: { ...baseFont, textAlign: "center" },
	});

	// ===== ITEMS HEADER =====
	receipt.push({
		type: "table",
		style: { ...baseFont, fontSize: "12px" },
		tableHeader: [
			{
				type: "text",
				value: "Qty",
				style: { textAlign: "left", fontWeight: "bold" },
			},
			{
				type: "text",
				value: "Menu",
				style: { textAlign: "center", fontWeight: "bold" },
			},
			{
				type: "text",
				value: "Amount",
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],
		tableBody: [],
		tableFooter: [],
		tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableBodyStyle: {},
		tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableHeaderCellStyle: { padding: "2px 2px" },
		tableBodyCellStyle: { padding: "2px", textAlign: "left" },
		tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
	});

	// ===== ITEMS LIST =====
	if (data.items && data.items.length > 0) {
		const allItemRows = [];
		
		data.items.forEach((item) => {
			const itemRows = buildItemRows(item, 0, false, data.cancel);
			allItemRows.push(...itemRows);
		});

		receipt.push({
			type: "table",
			style: { ...baseFont, fontSize: "12px" },
			tableHeader: [],
			tableBody: allItemRows,
			tableFooter: [],
			tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableBodyStyle: {},
			tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableHeaderCellStyle: { padding: "2px 2px" },
			tableBodyCellStyle: { padding: "2px", textAlign: "left" },
			tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
		});
	}

	// ===== TOTAL =====
	receipt.push({
		type: "table",
		style: { ...baseFont, fontSize: "12px" },
		tableHeader: [],
		tableBody: [
			[
				{
					type: "text",
					value: "Total",
					style: { textAlign: "left", fontWeight: "bold" },
				},
				{
					type: "text",
					value: ":",
					style: { textAlign: "center", fontWeight: "bold" },
				},
				{
					type: "text",
					value: formatAmount(data.totalAmount),
					style: { textAlign: "right", fontWeight: "bold" },
				},
			],
		],
		tableFooter: [],
		tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableBodyStyle: {},
		tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableHeaderCellStyle: { padding: "2px 2px" },
		tableBodyCellStyle: { padding: "2px", textAlign: "left" },
		tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
	});

	// ===== TOTAL AMOUNT ARABIC =====
	if (data.totalAmountArabic) {
		receipt.push({
			type: "text",
			value: d(data.totalAmountArabic, "مجموع"),
			style: {
				...baseFont,
				fontWeight: "bold",
				textAlign: "left",
			},
		});
	}

	receipt.push({
		type: "text",
		value: " ",
		style: { ...baseFont, fontSize: "6px" },
	});

	// ===== KOT TOTAL =====
	if (data.kotTotalAmount !== undefined) {
		receipt.push({
			type: "text",
			value: `KOT Total: ${formatAmount(data.kotTotalAmount)}`,
			style: { ...baseFont, fontWeight: "bold" },
		});
	}

	// ===== SERVED BY =====
	if (data.servedBy) {
		const servedByTableBody = [
			[
				{
					type: "text",
					value: d(data.servedByLabel, "Sbl :"),
					style: { textAlign: "left" },
				},
				{
					type: "text",
					value: d(data.servedBy),
					style: { textAlign: "left" },
				},
			],
		];

		receipt.push({
			type: "table",
			style: { ...baseFont, fontSize: "12px" },
			tableHeader: [],
			tableBody: servedByTableBody,
			tableFooter: [],
			tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableBodyStyle: {},
			tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableHeaderCellStyle: { padding: "2px 2px" },
			tableBodyCellStyle: { padding: "2px", textAlign: "left" },
			tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
		});
	}

	// ===== NOTES =====
	if (data.notes) {
		receipt.push({
			type: "text",
			value: "Notes :",
			style: { ...baseFont, fontWeight: "bold" },
		});
		receipt.push({
			type: "text",
			value: d(data.notes),
			style: {
				...baseFont,
				fontWeight: "bold",
				fontSize: "12px",
			},
		});
	}

	receipt.push({
		type: "text",
		value: " ",
		style: { ...baseFont, fontSize: "6px" },
	});

	// ===== DELIVERY ADDRESS =====
	if (data.deliveryAddress) {
		receipt.push({
			type: "text",
			value: "***** DELIVERY ADDRESS *****",
			style: {
				...baseFont,
				fontWeight: "bold",
				textAlign: "center",
			},
		});

		const addressLines = d(data.deliveryAddress).split("\n");
		const addressTableBody = addressLines.map((line) => [
			{
				type: "text",
				value: line,
				style: { textAlign: "left", fontSize: "12px" },
			},
		]);

		receipt.push({
			type: "table",
			style: { ...baseFont, fontSize: "12px" },
			tableHeader: [],
			tableBody: addressTableBody,
			tableFooter: [],
			tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableBodyStyle: {},
			tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableHeaderCellStyle: { padding: "2px 2px" },
			tableBodyCellStyle: { padding: "2px", textAlign: "left" },
			tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
		});
	}

	// ===== FOOTER SPACING =====
	receipt.push({
		type: "text",
		value: " ",
		style: { ...baseFont, fontSize: "6px" },
	});
	receipt.push({
		type: "text",
		value: " ",
		style: { ...baseFont, fontSize: "6px" },
	});
	receipt.push({
		type: "text",
		value: " ",
		style: { ...baseFont, fontSize: "6px" },
	});

	// ===== CUT COMMAND =====
	receipt.push({ type: "raw", format: "hex", value: "0A0A0A" });
	receipt.push({ type: "raw", format: "hex", value: "1D5601" });

	return receipt;
}