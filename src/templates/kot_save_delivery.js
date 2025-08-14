/**
 * Generates printData for the Chelokabab Takeaway Receipt.
 * This format is optimized for @plick/electron-pos-printer.
 *
 * @param {object} data - The dynamic data for the ticket.
 * @param {string} [data.storeName="TW KITCHEN"]
 * @param {string} [data.orderType="Takeaway"]
 * @param {string} [data.fontFamily="Arial, sans-serif"] - The font family to use.
 * @param {string} [data.logoUrl] - URL for the logo image
 * @param {string} [data.customerName]
 * @param {string} [data.customerMobile]
 * @param {string} [data.followUpStatus]
 * @param {string} [data.deliveryTime]
 * @param {string} [data.orderNumber]
 * @param {string} [data.orderDate]
 * @param {string} [data.orderTime]
 * @param {number|string} [data.pax]
 * @param {Array<object>} [data.items] - e.g., [{ qty: 1, name: "MAIN", nameAr: "رئيسي", amount: 10.00, subItems: [...] }]
 * @param {number|string} [data.totalAmount]
 * @param {string} [data.totalAmountArabic]
 * @param {string} [data.servedBy]
 * @param {string} [data.servedByLabel="Sbl :"]
 * @param {string} [data.notes]
 * @param {string} [data.deliveryAddress]
 * @param {boolean} [data.cancel=false] - Whether to show cancelled status
 * @returns {Array<object>} - Array of print command objects for @plick/electron-pos-printer.
 */
export function generateChelokababTakeawayReceipt(data = {}) {
	const plickCommands = [];
	const paperCharWidth = 42;
	const FONT_FAMILY = data.fontFamily || "Arial, sans-serif";

	const d = (value, defaultValue = "") =>
		value !== undefined && value !== null ? String(value) : defaultValue;

	const formatAmount = (amount) => {
		const num = parseFloat(d(amount, "0"));
		return num.toFixed(2);
	};

	const centerText = (text, maxWidth = paperCharWidth) => {
		if (!text) return " ".repeat(maxWidth);
		const textLength = text.length;
		if (textLength >= maxWidth) return text.substring(0, maxWidth);
		const padding = Math.floor((maxWidth - textLength) / 2);
		return (
			" ".repeat(padding) + text + " ".repeat(maxWidth - textLength - padding)
		);
	};

	// --- Recursive Helper to Print Items and their Sub-Items ---
	const printItemAndSubItems = (
		item,
		indentLevel = 0,
		isSubItem = false,
		cancel = false
	) => {
		const indent = "  ".repeat(indentLevel);
		const qtyStr = d(item.qty, "0");
		const itemName = d(item.name, "N/A ITEM").toUpperCase();
		const amount = formatAmount(item.amount);

		// Create the main item row with proper column alignment
		const qtyColWidth = 6;
		const amountColWidth = 10;
		const menuColWidth = paperCharWidth - qtyColWidth - amountColWidth;

		let displayName = itemName;
		if (isSubItem) {
			displayName = `${indent}- ${itemName}`;
		} else {
			displayName = `${indent}${itemName}`;
		}

		// Format the item line with proper spacing
		const qtyColumn = qtyStr.padEnd(qtyColWidth);
		const menuColumn =
			displayName.length > menuColWidth
				? displayName.substring(0, menuColWidth)
				: displayName.padEnd(menuColWidth);
		const amountColumn = amount.padStart(amountColWidth);

		plickCommands.push({
			type: "text",
			value: `${qtyColumn}${menuColumn}${amountColumn}`,
			style: {
				fontFamily: FONT_FAMILY,
				fontWeight: isSubItem ? "normal" : "bold",
				fontSize: isSubItem ? "1em" : "1.2em",
			},
		});

		// Arabic Item Name (if any, centered)
		if (item.nameAr) {
			plickCommands.push({
				type: "text",
				value: centerText(d(item.nameAr)),
				style: {
					fontFamily: FONT_FAMILY,
					textAlign: "center",
					fontSize: "1em",
				},
			});
		}

		// Show cancelled status if needed
		if (cancel) {
			plickCommands.push({
				type: "text",
				value: centerText("(Cancelled)"),
				style: {
					fontFamily: FONT_FAMILY,
					fontWeight: "bold",
					fontSize: "1.2em",
					textAlign: "center",
				},
			});
		}

		// Recursively print sub-items
		if (item.subItems && item.subItems.length > 0) {
			item.subItems.forEach((subItem) => {
				printItemAndSubItems(subItem, indentLevel + 1, true, cancel);
			});
		}

		// Add divider after main items (not sub-items)
		if (!isSubItem) {
			plickCommands.push({
				type: "text",
				value: "-".repeat(paperCharWidth),
				style: { fontFamily: FONT_FAMILY },
			});
		}
	};

	// --- Template Definition Start ---

	// Logo Section
	if (data.logoUrl) {
		plickCommands.push({
			type: "image",
			url: data.logoUrl,
			position: "center",
			width: "200px",
			height: "auto",
		});
	}

	// Store Name and Order Type
	plickCommands.push({
		type: "text",
		value: d(data.storeName, "TW KITCHEN"),
		style: {
			fontFamily: FONT_FAMILY,
			fontWeight: "bold",
			fontSize: "1.2em",
			textAlign: "center",
		},
	});

	plickCommands.push({
		type: "text",
		value: d(data.orderType, "Takeaway").toUpperCase(),
		style: {
			fontFamily: FONT_FAMILY,
			fontWeight: "bold",
			fontSize: "1.2em",
			textAlign: "center",
		},
	});

	// Customer Information
	if (data.customerName) {
		plickCommands.push({
			type: "text",
			value: "Customer :",
			style: { fontFamily: FONT_FAMILY, fontWeight: "bold" },
		});
		plickCommands.push({
			type: "text",
			value: d(data.customerName),
			style: { fontFamily: FONT_FAMILY },
		});
	}

	if (data.customerMobile) {
		plickCommands.push({
			type: "text",
			value: "Mobile No:",
			style: { fontFamily: FONT_FAMILY, fontWeight: "bold" },
		});
		plickCommands.push({
			type: "text",
			value: d(data.customerMobile),
			style: { fontFamily: FONT_FAMILY },
		});
	}

	if (data.followUpStatus) {
		plickCommands.push({
			type: "text",
			value: d(data.followUpStatus),
			style: {
				fontFamily: FONT_FAMILY,
				fontWeight: "bold",
				textAlign: "center",
			},
		});
	}

	if (data.deliveryTime) {
		plickCommands.push({
			type: "text",
			value: `Delv Time: ${d(data.deliveryTime)}`,
			style: { fontFamily: FONT_FAMILY },
		});
	}

	// Order Number Section
	plickCommands.push({
		type: "text",
		value: "=".repeat(paperCharWidth),
		style: { fontFamily: FONT_FAMILY },
	});

	plickCommands.push({
		type: "text",
		value: `No# : ${d(data.orderNumber, "N/A")}`,
		style: {
			fontFamily: FONT_FAMILY,
			fontWeight: "bold",
			fontSize: "1.8em",
		},
	});

	plickCommands.push({
		type: "text",
		value: "=".repeat(paperCharWidth),
		style: { fontFamily: FONT_FAMILY },
	});

	// Date, Time, Pax Information
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
	const paxInfo = data.pax
		? `Pax : ${parseFloat(d(data.pax, "0")).toFixed(2)}`
		: "";

	const dateTimeLine = `Date : ${orderDateStr} ${orderTimeStr}`;
	const spaceCount = Math.max(
		1,
		paperCharWidth - dateTimeLine.length - paxInfo.length
	);

	plickCommands.push({
		type: "text",
		value: `${dateTimeLine}${" ".repeat(spaceCount)}${paxInfo}`,
		style: { fontFamily: FONT_FAMILY },
	});

	plickCommands.push({
		type: "text",
		value: "-".repeat(paperCharWidth),
		style: { fontFamily: FONT_FAMILY },
	});

	// Items Header with proper column spacing
	const qtyColWidth = 6;
	const amountColWidth = 10;
	const menuColWidth = paperCharWidth - qtyColWidth - amountColWidth;

	const qtyHeader = "Qty".padEnd(qtyColWidth);
	const menuHeader = "Menu".padEnd(menuColWidth);
	const amountHeader = "Amount".padStart(amountColWidth);

	plickCommands.push({
		type: "text",
		value: `${qtyHeader}${menuHeader}${amountHeader}`,
		style: {
			fontFamily: FONT_FAMILY,
			fontWeight: "bold",
		},
	});

	plickCommands.push({
		type: "text",
		value: "-".repeat(paperCharWidth),
		style: { fontFamily: FONT_FAMILY },
	});

	// Items List
	if (data.items && data.items.length > 0) {
		data.items.forEach((item) => {
			printItemAndSubItems(item, 0, false, data.cancel);
		});
	}

	// Total Amount
	const totalQtyCol = "".padEnd(qtyColWidth);
	const totalMenuCol = "Total :".padEnd(menuColWidth);
	const totalAmountCol = formatAmount(data.totalAmount).padStart(
		amountColWidth
	);

	plickCommands.push({
		type: "text",
		value: `${totalQtyCol}${totalMenuCol}${totalAmountCol}`,
		style: {
			fontFamily: FONT_FAMILY,
			fontWeight: "bold",
		},
	});

	if (data.totalAmountArabic) {
		plickCommands.push({
			type: "text",
			value: d(data.totalAmountArabic, "مجموع"),
			style: {
				fontFamily: FONT_FAMILY,
				fontWeight: "bold",
			},
		});
	}

	// Served By Section
	if (data.servedBy) {
		plickCommands.push({
			type: "text",
			value: d(data.servedByLabel, "Sbl :"),
			style: { fontFamily: FONT_FAMILY },
		});
		plickCommands.push({
			type: "text",
			value: d(data.servedBy),
			style: { fontFamily: FONT_FAMILY },
		});
	}

	// Notes Section
	if (data.notes) {
		plickCommands.push({
			type: "text",
			value: "Notes :",
			style: { fontFamily: FONT_FAMILY, fontWeight: "bold" },
		});
		plickCommands.push({
			type: "text",
			value: d(data.notes),
			style: { fontFamily: FONT_FAMILY, fontWeight: "bold" },
		});
	}

	// Delivery Address Section
	if (data.deliveryAddress) {
		plickCommands.push({
			type: "text",
			value: "***** DELIVERY ADDRESS *****",
			style: {
				fontFamily: FONT_FAMILY,
				fontWeight: "bold",
				textAlign: "center",
			},
		});

		const addressLines = d(data.deliveryAddress).split("\n");
		addressLines.forEach((line) => {
			plickCommands.push({
				type: "text",
				value: line.trim(),
				style: { fontFamily: FONT_FAMILY },
			});
		});
	}

	// Final spacing and cut
	plickCommands.push({ type: "text", value: " " });
	plickCommands.push({ type: "text", value: " " });
	plickCommands.push({ type: "text", value: " " });

	return plickCommands;
}
