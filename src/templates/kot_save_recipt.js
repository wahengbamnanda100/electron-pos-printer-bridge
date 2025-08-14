// /**
//  * Generates printData for a Kitchen Order Ticket with nested item support.
//  * This format is optimized and corrected for @plick/electron-pos-printer.
//  *
//  * @param {object} data - The dynamic data for the ticket.
//  * @param {string} [data.storeName="TW KITCHEN"]
//  * @param {string} [data.fontFamily="Arial, sans-serif"] - The font family to use.
//  * @param {Array<object>} [data.items] - Array of items with qty, name, notes, subItems
//  * @returns {Array<object>} - Array of print command objects for @plick/electron-pos-printer.
//  */
// export function generateTwKitchenTakeawayTicket(data = {}) {
// 	const plickCommands = [];
// 	const paperCharWidth = 42;
// 	const FONT_FAMILY = data.fontFamily || "Arial, sans-serif";

// 	const d = (value, defaultValue = "") =>
// 		value !== undefined && value !== null ? String(value) : defaultValue;

// 	// --- Template Definition Start ---

// 	plickCommands.push({
// 		type: "text",
// 		value: d(data.storeName, "TW KITCHEN"),
// 		style: {
// 			fontFamily: FONT_FAMILY,
// 			fontWeight: "bold",
// 			fontSize: "1.5em",
// 			textAlign: "center",
// 		},
// 	});

// 	plickCommands.push({
// 		type: "text",
// 		value: `*** ${d(data.orderType, "TAKEAWAY").toUpperCase()} ***`,
// 		style: { fontFamily: FONT_FAMILY, fontWeight: "bold", textAlign: "center" },
// 	});

// 	if (data.customerName) {
// 		plickCommands.push({
// 			type: "text",
// 			value: `Customer : ${d(data.customerName)}`,
// 			style: { fontFamily: FONT_FAMILY },
// 		});
// 	}
// 	if (data.customerMobile) {
// 		plickCommands.push({
// 			type: "text",
// 			value: `Mobile No: ${d(data.customerMobile)}`,
// 			style: { fontFamily: FONT_FAMILY },
// 		});
// 	}
// 	if (data.deliveryTime) {
// 		plickCommands.push({
// 			type: "text",
// 			value: `Delv Time: ${d(data.deliveryTime)}`,
// 			style: { fontFamily: FONT_FAMILY },
// 		});
// 	}

// 	plickCommands.push({ type: "divider" });

// 	plickCommands.push({
// 		type: "text",
// 		value: `No# : ${d(data.orderNumber, "N/A")}`,
// 		style: {
// 			fontFamily: FONT_FAMILY,
// 			fontWeight: "bold",
// 			fontSize: "1.8em",
// 			textAlign: "center",
// 		},
// 	});

// 	plickCommands.push({ type: "divider" });

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
// 		style: { fontFamily: FONT_FAMILY },
// 	});

// 	if (data.followUpStatus) {
// 		plickCommands.push({
// 			type: "text",
// 			value: `${data.followUpStatus}`,
// 			style: {
// 				fontFamily: FONT_FAMILY,
// 				fontWeight: "bold",
// 				textAlign: "center",
// 			},
// 		});
// 	}

// 	// ====================================================================
// 	// PROPER TABLE FORMAT WITH COLUMN ALIGNMENT
// 	// ====================================================================

// 	// Create table header with proper column spacing
// 	const qtyColWidth = 10; // Width for quantity column
// 	const menuColWidth = paperCharWidth - qtyColWidth - 1; // Remaining width for menu

// 	// Create a dashed line across full width
// 	plickCommands.push({
// 		type: "text",
// 		value: "-".repeat(paperCharWidth),
// 		style: { fontFamily: FONT_FAMILY },
// 	});

// 	// Table header with proper column alignment
// 	const headerQty = "Qty".padEnd(qtyColWidth);
// 	const headerMenu = "Menu";
// 	plickCommands.push({
// 		type: "text",
// 		value: `${headerQty} ${headerMenu}`,
// 		style: { fontFamily: FONT_FAMILY, fontWeight: "bold" },
// 	});

// 	// Another dashed line
// 	plickCommands.push({
// 		type: "text",
// 		value: "-".repeat(paperCharWidth + 25),
// 		style: { fontFamily: FONT_FAMILY },
// 	});

// 	// ADD-ON header
// 	plickCommands.push({
// 		type: "text",
// 		value: "ADD-ON",
// 		style: { fontFamily: FONT_FAMILY, fontWeight: "bold" },
// 	});

// 	// ====================================================================
// 	// ITEMS LIST - PROPERLY FORMATTED COLUMNS
// 	// ====================================================================

// 	/**
// 	 * Recursively prints items and their sub-items with proper column alignment
// 	 * @param {object} item - The item object
// 	 * @param {number} indentLevel - Current indentation level
// 	 */
// 	const printItemAndSubItems = (item, indentLevel = 0) => {
// 		const indent = "  ".repeat(indentLevel);
// 		const qtyStr = d(item.qty, "0").toString();
// 		let itemName = d(item.name, "N/A ITEM").toUpperCase();

// 		if (indentLevel > 0) {
// 			// For sub-items, add the quantity in the qty column but indent the name
// 			const qtyColumn = qtyStr.padEnd(qtyColWidth);
// 			itemName = `${indent}- ${itemName}`;

// 			plickCommands.push({
// 				type: "text",
// 				value: `${qtyColumn}  ${itemName}`,
// 				style: {
// 					fontFamily: FONT_FAMILY,
// 					fontWeight: "normal",
// 					fontSize: "1em",
// 				},
// 			});
// 		} else {
// 			// For main items, create proper column alignment
// 			const qtyColumn = qtyStr.padEnd(qtyColWidth);

// 			plickCommands.push({
// 				type: "text",
// 				value: `${qtyColumn} ${itemName}`,
// 				style: {
// 					fontFamily: FONT_FAMILY,
// 					fontWeight: "bold",
// 					fontSize: "1.2em",
// 				},
// 			});
// 		}

// 		// Add notes if present (aligned under the menu column)
// 		if (item.notes) {
// 			const emptyQtyCol = "".padEnd(qtyColWidth);
// 			const noteIndent = indentLevel > 0 ? indent + "  " : "  ";
// 			plickCommands.push({
// 				type: "text",
// 				value: `${emptyQtyCol} ${noteIndent}(${d(item.notes)})`,
// 				style: { fontFamily: FONT_FAMILY, fontSize: "0.9em" },
// 			});
// 		}

// 		// Add a dashed line after each main item (not sub-items)
// 		if (indentLevel === 0) {
// 			plickCommands.push({
// 				type: "text",
// 				value: "-".repeat(paperCharWidth + 25),
// 				style: { fontFamily: FONT_FAMILY },
// 			});
// 		}

// 		// Recursively print sub-items
// 		if (item.subItems && item.subItems.length > 0) {
// 			item.subItems.forEach((subItem) => {
// 				printItemAndSubItems(subItem, indentLevel + 1);
// 			});
// 		}
// 	};

// 	// Process all items
// 	if (data.items && data.items.length > 0) {
// 		data.items.forEach((item) => printItemAndSubItems(item, 0));
// 	}

// 	// ====================================================================
// 	// FOOTER SECTIONS
// 	// ====================================================================

// 	if (data.servedBy) {
// 		plickCommands.push({
// 			type: "text",
// 			value: `Served By : ${d(data.servedBy)}`,
// 			style: { fontFamily: FONT_FAMILY },
// 		});
// 	}

// 	if (d(data.notes, "").trim() !== "") {
// 		plickCommands.push({
// 			type: "text",
// 			value: "Notes :",
// 			style: { fontFamily: FONT_FAMILY, fontWeight: "bold" },
// 		});
// 		plickCommands.push({
// 			type: "text",
// 			value: d(data.notes, ""),
// 			style: { fontFamily: FONT_FAMILY, fontWeight: "bold", fontSize: "1.2em" },
// 		});
// 	}

// 	// Final spacing and cut
// 	plickCommands.push({
// 		type: "text",
// 		value: "=".repeat(paperCharWidth - 3),
// 		style: { fontFamily: FONT_FAMILY },
// 	});

// 	// Add some spacing before cut
// 	// plickCommands.push({ type: "text", value: " " });
// 	// plickCommands.push({ type: "text", value: " " });
// 	// plickCommands.push({ type: "text", value: " " });

// 	return plickCommands;
// }

/**
 * Generates printData for a Kitchen Order Ticket with nested item support.
 * This format is optimized and corrected for @plick/electron-pos-printer,
 * using a table to perfectly align columns as shown in the provided image.
 *
 * @param {object} data - The dynamic data for the ticket.
 * @param {string} [data.storeName="TW KITCHEN"]
 * @param {string} [data.fontFamily="Arial, sans-serif"]
 * @param {Array<object>} [data.items] - Array of items. A category can be added by including an object like { name: 'ADD-ON', isCategory: true }
 * @returns {Array<object>} - Array of print command objects for @plick/electron-pos-printer.
 */
export function generateTwKitchenTakeawayTicket(data = {}) {
	const plickCommands = [];
	const paperCharWidth = 42;
	const FONT_FAMILY = data.fontFamily || "Arial, sans-serif";

	const d = (value, defaultValue = "") =>
		value !== undefined && value !== null ? String(value) : defaultValue;

	// --- Template Header (No changes needed here) ---
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
	if (data.customerName)
		plickCommands.push({
			type: "text",
			value: `Customer : ${d(data.customerName)}`,
			style: { fontFamily: FONT_FAMILY },
		});
	if (data.customerMobile)
		plickCommands.push({
			type: "text",
			value: `Mobile No: ${d(data.customerMobile)}`,
			style: { fontFamily: FONT_FAMILY },
		});
	if (data.deliveryTime)
		plickCommands.push({
			type: "text",
			value: `Delv Time: ${d(data.deliveryTime)}`,
			style: { fontFamily: FONT_FAMILY },
		});
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
	if (data.followUpStatus)
		plickCommands.push({
			type: "text",
			value: `${data.followUpStatus}`,
			style: {
				fontFamily: FONT_FAMILY,
				fontWeight: "bold",
				textAlign: "center",
			},
		});

	// ====================================================================
	// >>>>>>>>>> TABLE-BASED ITEM LIST FOR PERFECT ALIGNMENT <<<<<<<<<<
	// ====================================================================

	// Prepare the rows for the table body
	const tableBodyRows = [];

	const buildTableRows = (item, indentLevel = 0) => {
		// A category is an item with the 'isCategory' flag or just a name without a quantity
		const isCategory =
			item.isCategory || (!item.hasOwnProperty("qty") && item.name);

		if (isCategory) {
			// Create a row for the category header that spans both columns.
			tableBodyRows.push([
				{
					type: "text",
					value: item.name.toUpperCase(),
					colspan: 2,
					style: { fontWeight: "bold", paddingTop: "4px" },
				},
			]);
		} else {
			// This is a standard item.
			const indent = " ".repeat(indentLevel * 4); // Use more spaces for clear indentation
			const namePrefix = indentLevel > 0 ? `${indent}- ` : indent;

			tableBodyRows.push([
				{
					// Cell 1: Quantity
					type: "text",
					value: d(item.qty, "0"),
					style: {
						fontWeight: "bold",
						fontSize: "1.5em",
						verticalAlign: "middle",
					},
				},
				{
					// Cell 2: Name
					type: "text",
					value: `${namePrefix}${d(item.name)}`,
					style: { fontWeight: "bold", fontSize: "1.5em" },
				},
			]);

			if (item.notes) {
				tableBodyRows.push([
					{ type: "text", value: "" }, // Empty cell in Qty column
					{
						type: "text",
						value: `${indent}  (${d(item.notes)})`,
						style: { fontSize: "1em" },
					},
				]);
			}
		}

		// After every item or category, add a divider row that spans both columns.
		tableBodyRows.push([{ type: "divider", colspan: 2 }]);

		if (item.subItems && item.subItems.length > 0) {
			item.subItems.forEach((subItem) =>
				buildTableRows(subItem, indentLevel + 1)
			);
		}
	};

	// Build the table body from the provided item data
	if (data.items && data.items.length > 0) {
		data.items.forEach((item) => buildTableRows(item, 0));

		// Remove the very last divider for a cleaner look
		if (tableBodyRows.length > 0) {
			const lastRow = tableBodyRows[tableBodyRows.length - 1];
			if (lastRow && lastRow[0] && lastRow[0].type === "divider") {
				tableBodyRows.pop();
			}
		}
	}

	// Create and add the single table object to the print commands
	plickCommands.push({
		type: "table",
		tableHeader: [
			{ type: "text", value: "Qty" },
			{ type: "text", value: "Menu" },
		],
		tableBody: tableBodyRows,
		// Define the styles for the table for a professional appearance
		tableHeaderStyle: {
			fontWeight: "bold",
			borderBottom: "1px dashed #000",
		},
		tableBodyCellStyle: {
			padding: "2px 0", // Add vertical padding to each cell
		},
		columnStyles: ["15%", "85%"], // Define column widths: 15% for Qty, 85% for Menu
	});

	// ====================================================================
	// --- Footer Section and Final Cut (No Changes) ---
	// ====================================================================
	if (data.servedBy) {
		plickCommands.push({
			type: "text",
			value: `Served By : ${d(data.servedBy)}`,
			style: { fontFamily: FONT_FAMILY, paddingTop: "5px" },
		});
	}
	if (d(data.notes).trim() !== "") {
		plickCommands.push({ type: "divider" });
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
	// Buffer flush to ensure the cut command works
	plickCommands.push({
		type: "text",
		value: ".",
		style: { textAlign: "center" },
	});
	// Raw ESC/POS command for a partial cut
	plickCommands.push({ type: "text", value: "\x1d\x56\x01" });

	return plickCommands;
}
