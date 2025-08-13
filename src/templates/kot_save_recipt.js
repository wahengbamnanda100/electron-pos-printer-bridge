// /**
//  * Generates printData for a Kitchen Order Ticket with nested item support.
//  * This format is designed for node-thermal-printer.
//  *
//  * @param {object} data - The dynamic data for the ticket.
//  * @param {string} [data.storeName="TW KITCHEN"]
//  * @param {string} [data.orderType="TAKEAWAY"]
//  * @param {string} [data.customerName]
//  * @param {string} [data.customerMobile]
//  * // ... (other JSDoc params as needed)
//  * @param {Array<object>} [data.items] - e.g., [{ qty: 1, name: "Main Item", notes: "Note", subItems: [...] }]
//  * // ...
//  * @returns {Array<object>} - Array of print command objects.
//  */
// export function generateTwKitchenTakeawayTicket(data = {}) {
// 	// Or your original function name
// 	const printCommands = [];
// 	const paperCharWidth = 42;

// 	const d = (value, defaultValue = "") =>
// 		value !== undefined && value !== null ? String(value) : defaultValue;

// 	// --- Recursive Helper to Print Items and their Sub-Items ---
// 	const printItemAndSubItemsKOT = (
// 		item,
// 		indentLevel = 0,
// 		isSubItem = false
// 	) => {
// 		const indentSpaces = "  ".repeat(indentLevel);
// 		const qtyStr = d(item.qty, "0").padStart(3, " ");
// 		let itemName = d(item.name, "N/A ITEM").toUpperCase();

// 		if (isSubItem) {
// 			itemName = `${indentSpaces}  - ${itemName}`; // Indent and prefix sub-items
// 		} else {
// 			itemName = `${indentSpaces}${itemName}`;
// 		}

// 		// Item line: Qty and Name (large, bold for main; normal for sub-items)
// 		printCommands.push({
// 			type: "setStyles",
// 			align: "LT",
// 			style: "B",
// 			size: isSubItem ? [1, 1] : [1, 2], // Main items double height, sub-items normal
// 		});
// 		printCommands.push({
// 			type: "println",
// 			content: `${isSubItem ? indentSpaces + qtyStr : qtyStr} ${itemName}`,
// 		});
// 		printCommands.push({ type: "resetStyles" }); // Reset after each item name

// 		// Item Notes (normal size, indented)
// 		if (item.notes) {
// 			printCommands.push({ type: "setStyles", align: "LT", size: [1, 1] });
// 			printCommands.push({
// 				type: "println",
// 				content: `${indentSpaces}     (${d(item.notes)})`, // Further indent notes
// 			});
// 			printCommands.push({ type: "resetStyles" });
// 		}

// 		// Recursively print sub-items
// 		if (item.subItems && item.subItems.length > 0) {
// 			item.subItems.forEach((subItem) => {
// 				printItemAndSubItemsKOT(subItem, indentLevel + 1, true);
// 			});
// 		}
// 	};

// 	// --- Template Definition Start ---

// 	// Header Section
// 	printCommands.push({
// 		type: "setStyles",
// 		align: "CT",
// 		style: "B",
// 		size: [1, 2],
// 	});
// 	printCommands.push({
// 		type: "println",
// 		content: d(data.storeName, "TW KITCHEN"),
// 	});
// 	printCommands.push({
// 		type: "setStyles",
// 		align: "CT",
// 		style: "B",
// 		size: [1, 1],
// 	});
// 	printCommands.push({
// 		type: "println",
// 		content: `*** ${d(data.orderType, "TAKEAWAY").toUpperCase()} ***`,
// 	});
// 	printCommands.push({ type: "resetStyles" });
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// Customer Information Section
// 	if (data.customerName)
// 		printCommands.push({
// 			type: "println",
// 			content: `Customer : ${d(data.customerName)}`,
// 		});
// 	if (data.customerMobile)
// 		printCommands.push({
// 			type: "println",
// 			content: `Mobile No: ${d(data.customerMobile)}`,
// 		});
// 	if (data.deliveryTime)
// 		printCommands.push({
// 			type: "println",
// 			content: `Delv Time:${d(data.deliveryTime)}`,
// 		});
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// Order Number Section
// 	printCommands.push({
// 		type: "println",
// 		content: "=".repeat(paperCharWidth),
// 		align: "CT",
// 	});
// 	printCommands.push({
// 		type: "setStyles",
// 		align: "CT",
// 		style: "B",
// 		size: [2, 2],
// 	}); // Centered as per original KOT
// 	printCommands.push({
// 		type: "println",
// 		content: `No# : ${d(data.orderNumber, "N/A")}`,
// 	});
// 	printCommands.push({ type: "resetStyles" });
// 	printCommands.push({
// 		type: "println",
// 		content: "=".repeat(paperCharWidth),
// 		align: "CT",
// 	});

// 	// Date, Time, Pax Line
// 	const orderDate = d(
// 		data.orderDate,
// 		new Date()
// 			.toLocaleDateString("en-GB", {
// 				day: "2-digit",
// 				month: "short",
// 				year: "numeric",
// 			})
// 			.replace(/ /g, "-")
// 	);
// 	const orderTime = d(
// 		data.orderTime,
// 		new Date().toLocaleTimeString("en-US", {
// 			hour: "numeric",
// 			minute: "2-digit",
// 			hour12: true,
// 		})
// 	);
// 	const paxInfo = data.pax
// 		? `Pax : ${parseFloat(d(data.pax, 0)).toFixed(2)}`
// 		: "";
// 	const leftColDateTime = `Date : ${orderDate} ${orderTime}`;
// 	const rightColPax = paxInfo;
// 	const spaceCount = Math.max(
// 		1,
// 		paperCharWidth - leftColDateTime.length - rightColPax.length
// 	);
// 	printCommands.push({
// 		type: "println",
// 		content: `${leftColDateTime}${" ".repeat(spaceCount)}${rightColPax}`,
// 	});
// 	printCommands.push({
// 		type: "println",
// 		content: `${data.followUpStatus}`,
// 		align: "CT",
// 		style: "B",
// 	});
// 	printCommands.push({ type: "drawLine" });

// 	// Items Header
// 	printCommands.push({ type: "setStyles", align: "LT", style: "B" });
// 	printCommands.push({ type: "println", content: "Qty    Menu" });
// 	printCommands.push({ type: "resetStyles" });
// 	printCommands.push({ type: "drawLine" });

// 	// "ADD-ON" Sub-header - this was in your original KOT. Keep if still relevant.
// 	// If it's a general category, it stays. If items themselves define categories, remove this.
// 	printCommands.push({ type: "setStyles", align: "LT", style: "B" });
// 	printCommands.push({ type: "println", content: "ADD-ON" });
// 	printCommands.push({ type: "resetStyles" });
// 	printCommands.push({ type: "feed", lines: 0 }); // Minimal feed

// 	// Items List (Now uses the recursive helper)
// 	if (data.items && data.items.length > 0) {
// 		data.items.forEach((item) => {
// 			printItemAndSubItemsKOT(item, 0, false); // Start with indentLevel 0
// 		});
// 	}
// 	printCommands.push({ type: "drawLine" }); // Dashed line after all items
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// Served By Section
// 	if (data.servedBy) {
// 		// Using simple println for Served By as multi-line handling with 'print' is complex
// 		// And the original KOT example didn't show complex wrapping for this field.
// 		printCommands.push({
// 			type: "println",
// 			content: `Served By : ${d(data.servedBy)}`,
// 		});
// 	}
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// Notes Section
// 	if (
// 		data.notes !== undefined &&
// 		data.notes !== null &&
// 		String(data.notes).trim() !== ""
// 	) {
// 		printCommands.push({
// 			type: "setStyles",
// 			align: "LT",
// 			style: "B",
// 			size: [1, 1],
// 		});
// 		printCommands.push({ type: "println", content: "Notes :" });
// 		printCommands.push({ type: "resetStyles" });
// 		printCommands.push({
// 			type: "setStyles",
// 			align: "LT",
// 			style: "B",
// 			size: [1, 2],
// 		});
// 		printCommands.push({ type: "println", content: d(data.notes) });
// 		printCommands.push({ type: "resetStyles" });
// 	}

// 	// Final separator
// 	printCommands.push({
// 		type: "println",
// 		content: "=".repeat(paperCharWidth),
// 		align: "CT",
// 	});
// 	printCommands.push({ type: "feed", lines: 3 });
// 	printCommands.push({ type: "cut" });

// 	return printCommands;
// }

//!____________________________________________________________________

// /**
//  * Generates printData for a Kitchen Order Ticket with nested item support,
//  * specifically formatted for @plick/electron-pos-printer.
//  *
//  * @param {object} data - The dynamic data for the ticket.
//  * @param {string} [data.storeName="TW KITCHEN"]
//  * @param {string} [data.orderType="TAKEAWAY"]
//  * @param {string} [data.customerName]
//  * @param {string} [data.customerMobile]
//  * @param {string} [data.deliveryTime]
//  * @param {string} [data.orderNumber]
//  * @param {string} [data.orderDate]
//  * @param {string} [data.orderTime]
//  * @param {number|string} [data.pax]
//  * @param {string} [data.followUpStatus]
//  * @param {Array<object>} [data.items] - e.g., [{ qty: 1, name: "Main Item", notes: "Note", subItems: [...] }]
//  * @param {string} [data.servedBy]
//  * @param {string} [data.notes]
//  * @returns {Array<object>} - Array of print command objects for @plick/electron-pos-printer.
//  */
// export function generatePlickKitchenTicket(data = {}) {
// 	const plickCommands = [];
// 	const paperCharWidth = 42; // Keep for layout calculations

// 	const d = (value, defaultValue = "") =>
// 		value !== undefined && value !== null ? String(value) : defaultValue;

// 	// --- Recursive Helper to Print Items and their Sub-Items for Plick ---
// 	const printItemAndSubItems = (item, indentLevel = 0) => {
// 		const indentSpaces = "  ".repeat(indentLevel);
// 		const qtyStr = d(item.qty, "0").padStart(3, " ");
// 		let itemName = d(item.name, "N/A ITEM").toUpperCase();

// 		if (indentLevel > 0) {
// 			itemName = `${indentSpaces}  - ${itemName}`; // Indent and prefix sub-items
// 		} else {
// 			itemName = `${indentSpaces}${itemName}`;
// 		}

// 		// Item line: Qty and Name
// 		plickCommands.push({
// 			type: "text",
// 			value: `${indentLevel > 0 ? indentSpaces + qtyStr : qtyStr} ${itemName}`,
// 			style: {
// 				fontWeight: indentLevel === 0 ? "bold" : "normal",
// 				fontSize: indentLevel === 0 ? "1.2em" : "1em", // Larger font for main items
// 			},
// 		});

// 		// Item Notes
// 		if (item.notes) {
// 			plickCommands.push({
// 				type: "text",
// 				value: `${indentSpaces}     (${d(item.notes)})`,
// 				style: { fontSize: "1em" },
// 			});
// 		}

// 		// Recursively print sub-items
// 		if (item.subItems && item.subItems.length > 0) {
// 			item.subItems.forEach((subItem) => {
// 				printItemAndSubItems(subItem, indentLevel + 1);
// 			});
// 		}
// 	};

// 	// --- Template Definition Start ---

// 	// Header Section
// 	plickCommands.push({
// 		type: "text",
// 		value: d(data.storeName, "TW KITCHEN"),
// 		style: { fontWeight: "bold", fontSize: "1.5em", textAlign: "center" },
// 	});
// 	plickCommands.push({
// 		type: "text",
// 		value: `*** ${d(data.orderType, "TAKEAWAY").toUpperCase()} ***`,
// 		style: { fontWeight: "bold", textAlign: "center" },
// 	});
// 	plickCommands.push({ type: "text", value: " " }); // Feed

// 	// Customer Information Section
// 	if (data.customerName) {
// 		plickCommands.push({
// 			type: "text",
// 			value: `Customer : ${d(data.customerName)}`,
// 		});
// 	}
// 	if (data.customerMobile) {
// 		plickCommands.push({
// 			type: "text",
// 			value: `Mobile No: ${d(data.customerMobile)}`,
// 		});
// 	}
// 	if (data.deliveryTime) {
// 		plickCommands.push({
// 			type: "text",
// 			value: `Delv Time: ${d(data.deliveryTime)}`,
// 		});
// 	}
// 	plickCommands.push({ type: "text", value: " " }); // Feed

// 	// Order Number Section
// 	plickCommands.push({ type: "divider" });
// 	plickCommands.push({
// 		type: "text",
// 		value: `No# : ${d(data.orderNumber, "N/A")}`,
// 		style: { fontWeight: "bold", fontSize: "1.8em", textAlign: "center" },
// 	});
// 	plickCommands.push({ type: "divider" });

// 	// Date, Time, Pax Line
// 	const orderDate = d(
// 		data.orderDate,
// 		new Date()
// 			.toLocaleDateString("en-GB", {
// 				day: "2-digit",
// 				month: "short",
// 				year: "numeric",
// 			})
// 			.replace(/ /g, "-")
// 	);
// 	const orderTime = d(
// 		data.orderTime,
// 		new Date().toLocaleTimeString("en-US", {
// 			hour: "numeric",
// 			minute: "2-digit",
// 			hour12: true,
// 		})
// 	);
// 	const paxInfo = data.pax
// 		? `Pax : ${parseFloat(d(data.pax, 0)).toFixed(2)}`
// 		: "";
// 	const leftColDateTime = `Date : ${orderDate} ${orderTime}`;
// 	const rightColPax = paxInfo;
// 	const spaceCount = Math.max(
// 		1,
// 		paperCharWidth - leftColDateTime.length - rightColPax.length
// 	);
// 	plickCommands.push({
// 		type: "text",
// 		value: `${leftColDateTime}${" ".repeat(spaceCount)}${rightColPax}`,
// 	});
// 	if (data.followUpStatus) {
// 		plickCommands.push({
// 			type: "text",
// 			value: `${data.followUpStatus}`,
// 			style: { fontWeight: "bold", textAlign: "center" },
// 		});
// 	}
// 	plickCommands.push({ type: "divider" });

// 	// Items Header
// 	plickCommands.push({
// 		type: "text",
// 		value: "Qty    Menu",
// 		style: { fontWeight: "bold" },
// 	});
// 	plickCommands.push({ type: "divider" });

// 	// "ADD-ON" Sub-header
// 	plickCommands.push({
// 		type: "text",
// 		value: "ADD-ON",
// 		style: { fontWeight: "bold" },
// 	});
// 	plickCommands.push({ type: "text", value: " " }); // Feed

// 	// Items List
// 	if (data.items && data.items.length > 0) {
// 		data.items.forEach((item) => {
// 			printItemAndSubItems(item);
// 		});
// 	}
// 	plickCommands.push({ type: "divider" });
// 	plickCommands.push({ type: "text", value: " " }); // Feed

// 	// Served By Section
// 	if (data.servedBy) {
// 		plickCommands.push({
// 			type: "text",
// 			value: `Served By : ${d(data.servedBy)}`,
// 		});
// 	}
// 	plickCommands.push({ type: "text", value: " " }); // Feed

// 	// Notes Section
// 	if (d(data.notes).trim() !== "") {
// 		plickCommands.push({
// 			type: "text",
// 			value: "Notes :",
// 			style: { fontWeight: "bold" },
// 		});
// 		plickCommands.push({
// 			type: "text",
// 			value: d(data.notes),
// 			style: { fontWeight: "bold", fontSize: "1.2em" },
// 		});
// 	}

// 	// Final separator
// 	plickCommands.push({ type: "divider" });
// 	plickCommands.push({ type: "text", value: " " });
// 	plickCommands.push({ type: "text", value: " " });
// 	plickCommands.push({ type: "text", value: " " });
// 	plickCommands.push({ type: "cut" });

// 	return plickCommands;
// }

//!_______________

/**
 * Generates printData for a Kitchen Order Ticket with nested item support,
 * specifically formatted for @plick/electron-pos-printer.
 *
 * @param {object} data - The dynamic data for the ticket.
 * @param {string} [data.storeName="TW KITCHEN"]
 * @param {string} [data.fontFamily="monospace"] - The font family to use for the ticket.
 * // ... (other JSDoc params)
 * @returns {Array<object>} - Array of print command objects for @plick/electron-pos-printer.
 */
export function generateTwKitchenTakeawayTicket(data = {}) {
	const plickCommands = [];
	const paperCharWidth = 42;
	const FONT_FAMILY = data.fontFamily || "Arial, sans-serif"; // Default to a monospaced font

	const d = (value, defaultValue = "") =>
		value !== undefined && value !== null ? String(value) : defaultValue;

	// --- Recursive Helper to Print Items and their Sub-Items for Plick ---
	const printItemAndSubItems = (item, indentLevel = 0) => {
		const indentSpaces = "  ".repeat(indentLevel);
		const qtyStr = d(item.qty, "0").padStart(3, " ");
		let itemName = d(item.name, "N/A ITEM").toUpperCase();

		if (indentLevel > 0) {
			itemName = `${indentSpaces}  - ${itemName}`;
		} else {
			itemName = `${indentSpaces}${itemName}`;
		}

		plickCommands.push({
			type: "text",
			value: `${indentLevel > 0 ? indentSpaces + qtyStr : qtyStr} ${itemName}`,
			style: {
				fontFamily: FONT_FAMILY,
				fontWeight: indentLevel === 0 ? "bold" : "normal",
				fontSize: indentLevel === 0 ? "1.2em" : "1em",
			},
		});

		if (item.notes) {
			plickCommands.push({
				type: "text",
				value: `${indentSpaces}     (${d(item.notes)})`,
				style: { fontFamily: FONT_FAMILY, fontSize: "1em" },
			});
		}

		if (item.subItems && item.subItems.length > 0) {
			item.subItems.forEach((subItem) => {
				printItemAndSubItems(subItem, indentLevel + 1);
			});
		}
	};

	// --- Template Definition Start ---

	plickCommands.push({
		type: "text",
		value: d(data.storeName, "TW KITCHEN"),
		style: {
			fontFamily: FONT_FAMILY,
			fontWeight: "bold",
			fontSize: "1.5em",
			textAlign: "center",
		},
	});
	plickCommands.push({
		type: "text",
		value: `*** ${d(data.orderType, "TAKEAWAY").toUpperCase()} ***`,
		style: { fontFamily: FONT_FAMILY, fontWeight: "bold", textAlign: "center" },
	});
	plickCommands.push({ type: "text", value: " " });

	if (data.customerName) {
		plickCommands.push({
			type: "text",
			value: `Customer : ${d(data.customerName)}`,
			style: { fontFamily: FONT_FAMILY },
		});
	}
	if (data.customerMobile) {
		plickCommands.push({
			type: "text",
			value: `Mobile No: ${d(data.customerMobile)}`,
			style: { fontFamily: FONT_FAMILY },
		});
	}
	if (data.deliveryTime) {
		plickCommands.push({
			type: "text",
			value: `Delv Time: ${d(data.deliveryTime)}`,
			style: { fontFamily: FONT_FAMILY },
		});
	}
	plickCommands.push({ type: "text", value: " " });

	plickCommands.push({ type: "divider" });
	plickCommands.push({
		type: "text",
		value: `No# : ${d(data.orderNumber, "N/A")}`,
		style: {
			fontFamily: FONT_FAMILY,
			fontWeight: "bold",
			fontSize: "1.8em",
			textAlign: "center",
		},
	});
	plickCommands.push({ type: "divider" });

	const orderDate = d(
		data.orderDate,
		new Date()
			.toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
			.replace(/ /g, "-")
	);
	const orderTime = d(
		data.orderTime,
		new Date().toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})
	);
	const paxInfo = data.pax
		? `Pax : ${parseFloat(d(data.pax, 0)).toFixed(2)}`
		: "";
	const leftColDateTime = `Date : ${orderDate} ${orderTime}`;
	const rightColPax = paxInfo;
	const spaceCount = Math.max(
		1,
		paperCharWidth - leftColDateTime.length - rightColPax.length
	);
	plickCommands.push({
		type: "text",
		value: `${leftColDateTime}${" ".repeat(spaceCount)}${rightColPax}`,
		style: { fontFamily: FONT_FAMILY },
	});
	if (data.followUpStatus) {
		plickCommands.push({
			type: "text",
			value: `${data.followUpStatus}`,
			style: {
				fontFamily: FONT_FAMILY,
				fontWeight: "bold",
				textAlign: "center",
			},
		});
	}
	plickCommands.push({ type: "divider" });

	plickCommands.push({
		type: "text",
		value: "Qty    Menu",
		style: { fontFamily: FONT_FAMILY, fontWeight: "bold" },
	});
	plickCommands.push({ type: "divider" });

	plickCommands.push({
		type: "text",
		value: "ADD-ON",
		style: { fontFamily: FONT_FAMILY, fontWeight: "bold" },
	});
	plickCommands.push({ type: "text", value: " " });

	if (data.items && data.items.length > 0) {
		data.items.forEach((item) => printItemAndSubItems(item));
	}
	plickCommands.push({ type: "divider" });
	plickCommands.push({ type: "text", value: " " });

	if (data.servedBy) {
		plickCommands.push({
			type: "text",
			value: `Served By : ${d(data.servedBy)}`,
			style: { fontFamily: FONT_FAMILY },
		});
	}
	plickCommands.push({ type: "text", value: " " });

	if (d(data.notes).trim() !== "") {
		plickCommands.push({
			type: "text",
			value: "Notes :",
			style: { fontFamily: FONT_FAMILY, fontWeight: "bold" },
		});
		plickCommands.push({
			type: "text",
			value: d(data.notes),
			style: { fontFamily: FONT_FAMILY, fontWeight: "bold", fontSize: "1.2em" },
		});
	}

	plickCommands.push({ type: "divider" });
	plickCommands.push({ type: "feed", lines: 3 });
	plickCommands.push({ type: "cut" });

	return plickCommands;
}
