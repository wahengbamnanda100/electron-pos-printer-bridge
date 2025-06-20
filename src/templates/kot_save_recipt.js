// /**
//  * Generates printData (an array of command objects) for the TW Kitchen Takeaway Ticket.
//  * This format is designed to be processed by node-thermal-printer methods
//  * (e.g., via generatePrintBufferNTP or direct ThermalPrinter instance).
//  *
//  * @param {object} data - The dynamic data for the ticket.
//  * @param {string} [data.storeName="TW KITCHEN"]
//  * @param {string} [data.orderType="TAKEAWAY"]
//  * @param {string} [data.customerName]
//  * @param {string} [data.customerMobile]
//  * @param {string} [data.deliveryTime] - e.g., "15-May-2025 9:21 am"
//  * @param {string} [data.orderNumber] - e.g., "TWK-KIT2501882"
//  * @param {string} [data.orderDate] - (Can be derived if not provided) e.g., "15-May-2025"
//  * @param {string} [data.orderTime] - (Can be derived if not provided) e.g., "9:21 am"
//  * @param {number|string} [data.pax] - e.g., 1 or "1.00"
//  * @param {Array<object>} [data.items] - e.g., [{ qty: 11, name: "subway bread", notes: "extra cheese" }]
//  * @param {string} [data.servedBy] - e.g., "0465 - KARIM MOHAMED KAMAL MOHAMED"
//  * @param {string} [data.notes] - General order notes.
//  * @returns {Array<object>} - Array of print command objects.
//  */
// export function generateTwKitchenTakeawayTicket(data = {}) {
// 	const printCommands = [];
// 	const paperCharWidth = 42; // Approx characters for 80mm thermal paper with standard font. Adjust this!

// 	// Helper to safely get data or return a default, converting to string
// 	const d = (value, defaultValue = "") =>
// 		value !== undefined && value !== null ? String(value) : defaultValue;

// 	// --- Template Definition Start ---

// 	// Header Section
// 	printCommands.push({
// 		type: "setStyles",
// 		align: "CT",
// 		style: "B",
// 		size: [1, 2],
// 	}); // Double height, normal width bold
// 	printCommands.push({
// 		type: "println",
// 		content: d(data.storeName, "TW KITCHEN"),
// 	});
// 	printCommands.push({
// 		type: "setStyles",
// 		align: "CT",
// 		style: "B",
// 		size: [1, 1],
// 	}); // Normal size bold
// 	printCommands.push({
// 		type: "println",
// 		content: `*** ${d(data.orderType, "TAKEAWAY").toUpperCase()} ***`,
// 	});
// 	printCommands.push({ type: "resetStyles" }); // Reset to default before next section
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// Customer Information Section
// 	if (data.customerName) {
// 		printCommands.push({
// 			type: "println",
// 			content: `Customer : ${d(data.customerName)}`,
// 		});
// 	}
// 	if (data.customerMobile) {
// 		printCommands.push({
// 			type: "println",
// 			content: `Mobile No: ${d(data.customerMobile)}`,
// 		}); // Matched spacing
// 	}
// 	if (data.deliveryTime) {
// 		printCommands.push({
// 			type: "println",
// 			content: `Delv Time:${d(data.deliveryTime)}`,
// 		}); // Matched spacing
// 	}
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// Order Number Section (Large and Bold)
// 	// Simulate thick line with equals signs (node-thermal-printer drawLine is thin by default)
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
// 	}); // Large and bold
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

// 	// Format for two columns, Date & Time left, Pax right
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
// 	printCommands.push({ type: "drawLine" }); // Thin dashed line

// 	// Items Header
// 	printCommands.push({ type: "setStyles", align: "LT", style: "B" });
// 	printCommands.push({ type: "println", content: "Qty    Menu" }); // Spacing to align "Menu"
// 	printCommands.push({ type: "resetStyles" });
// 	printCommands.push({ type: "drawLine" });

// 	// "ADD-ON" Sub-header
// 	printCommands.push({ type: "setStyles", align: "LT", style: "B" });
// 	printCommands.push({ type: "println", content: "ADD-ON" });
// 	printCommands.push({ type: "resetStyles" });
// 	// Note: Image implies ADD-ON is a general header before listing main items.
// 	// If addons are distinct, you'd loop through data.addons here.

// 	// Items List (Large text, Qty followed by Name)
// 	if (data.items && data.items.length > 0) {
// 		data.items.forEach((item) => {
// 			const qtyStr = d(item.qty, "0").padStart(3, " "); // Pad Qty to 3 chars, e.g., " 11"
// 			const itemName = d(item.name, "N/A ITEM").toUpperCase();

// 			// Item line with larger text (e.g., double height)
// 			printCommands.push({
// 				type: "setStyles",
// 				align: "LT",
// 				style: "B",
// 				size: [1, 2],
// 			}); // Double Height, Normal Width, Bold
// 			printCommands.push({ type: "println", content: `${qtyStr} ${itemName}` });
// 			printCommands.push({ type: "resetStyles" }); // Reset after each item name

// 			if (item.notes) {
// 				printCommands.push({ type: "setStyles", align: "LT", size: [1, 1] }); // Normal size for notes
// 				printCommands.push({
// 					type: "println",
// 					content: `     (${d(item.notes)})`,
// 				}); // Indented notes
// 				printCommands.push({ type: "resetStyles" });
// 			}
// 		});
// 	}
// 	printCommands.push({ type: "drawLine" }); // Dashed line after items
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// Served By Section
// 	if (data.servedBy) {
// 		const servedByPrefix = "Served By : ";
// 		const maxNameLineLength = paperCharWidth - servedByPrefix.length;
// 		let servedByFull = d(data.servedBy);

// 		printCommands.push({ type: "println", content: servedByPrefix }); // Print prefix without newline
// 		// Word wrap for servedBy name if it's too long
// 		let remainingName = servedByFull;
// 		let isFirstLine = true;
// 		while (remainingName.length > 0) {
// 			let lineToPrint;
// 			if (!isFirstLine) {
// 				printCommands.push({ type: "println", content: "            " }); // Indent subsequent lines
// 			}
// 			if (
// 				remainingName.length >
// 				(isFirstLine ? maxNameLineLength : paperCharWidth - 12)
// 			) {
// 				let breakPoint = remainingName.lastIndexOf(
// 					" ",
// 					isFirstLine ? maxNameLineLength : paperCharWidth - 12
// 				);
// 				if (breakPoint === -1 || breakPoint === 0)
// 					breakPoint = isFirstLine ? maxNameLineLength : paperCharWidth - 12; // Force break
// 				lineToPrint = remainingName.substring(0, breakPoint);
// 				remainingName = remainingName.substring(breakPoint).trimStart();
// 			} else {
// 				lineToPrint = remainingName;
// 				remainingName = "";
// 			}
// 			printCommands.push({ type: "println", content: lineToPrint });
// 			isFirstLine = false;
// 		}
// 		if (isFirstLine && servedByFull.length === 0) {
// 			// if servedBy was empty and we printed prefix.
// 			printCommands.push({ type: "println", content: "" }); // Add newline if only prefix was printed.
// 		}
// 	}
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// Notes Section
// 	if (data.notes !== undefined && data.notes !== null && data.notes !== "") {
// 		printCommands.push({
// 			type: "setStyles",
// 			align: "LT",
// 			style: "B",
// 			size: [1, 1],
// 		}); // Label in normal bold
// 		printCommands.push({ type: "println", content: "Notes :" });
// 		printCommands.push({ type: "resetStyles" });
// 		printCommands.push({
// 			type: "setStyles",
// 			align: "LT",
// 			style: "B",
// 			size: [1, 2],
// 		}); // Note content double height bold
// 		printCommands.push({ type: "println", content: d(data.notes) });
// 		printCommands.push({ type: "resetStyles" });
// 	}

// 	// Final double dashed line (thick separator)
// 	printCommands.push({
// 		type: "println",
// 		content: "=".repeat(paperCharWidth),
// 		align: "CT",
// 	});
// 	// This uses a 'drawLine' type that bridge-api.js would interpret for NTP:
// 	// printCommands.push({ type: 'drawLine', lineStyle: "DOUBLE" });

// 	// End of receipt
// 	printCommands.push({ type: "feed", lines: 3 }); // Some space before cutting
// 	printCommands.push({ type: "cut" });

// 	return printCommands;
// }

// src/templates/kot_save_receipt.js (or your original filename)

/**
 * Generates printData for a Kitchen Order Ticket with nested item support.
 * This format is designed for node-thermal-printer.
 *
 * @param {object} data - The dynamic data for the ticket.
 * @param {string} [data.storeName="TW KITCHEN"]
 * @param {string} [data.orderType="TAKEAWAY"]
 * @param {string} [data.customerName]
 * @param {string} [data.customerMobile]
 * // ... (other JSDoc params as needed)
 * @param {Array<object>} [data.items] - e.g., [{ qty: 1, name: "Main Item", notes: "Note", subItems: [...] }]
 * // ...
 * @returns {Array<object>} - Array of print command objects.
 */
export function generateTwKitchenTakeawayTicket(data = {}) {
	// Or your original function name
	const printCommands = [];
	const paperCharWidth = 42;

	const d = (value, defaultValue = "") =>
		value !== undefined && value !== null ? String(value) : defaultValue;

	// --- Recursive Helper to Print Items and their Sub-Items ---
	const printItemAndSubItemsKOT = (
		item,
		indentLevel = 0,
		isSubItem = false
	) => {
		const indentSpaces = "  ".repeat(indentLevel);
		const qtyStr = d(item.qty, "0").padStart(3, " ");
		let itemName = d(item.name, "N/A ITEM").toUpperCase();

		if (isSubItem) {
			itemName = `${indentSpaces}  - ${itemName}`; // Indent and prefix sub-items
		} else {
			itemName = `${indentSpaces}${itemName}`;
		}

		// Item line: Qty and Name (large, bold for main; normal for sub-items)
		printCommands.push({
			type: "setStyles",
			align: "LT",
			style: "B",
			size: isSubItem ? [1, 1] : [1, 2], // Main items double height, sub-items normal
		});
		printCommands.push({
			type: "println",
			content: `${isSubItem ? indentSpaces + qtyStr : qtyStr} ${itemName}`,
		});
		printCommands.push({ type: "resetStyles" }); // Reset after each item name

		// Item Notes (normal size, indented)
		if (item.notes) {
			printCommands.push({ type: "setStyles", align: "LT", size: [1, 1] });
			printCommands.push({
				type: "println",
				content: `${indentSpaces}     (${d(item.notes)})`, // Further indent notes
			});
			printCommands.push({ type: "resetStyles" });
		}

		// Recursively print sub-items
		if (item.subItems && item.subItems.length > 0) {
			item.subItems.forEach((subItem) => {
				printItemAndSubItemsKOT(subItem, indentLevel + 1, true);
			});
		}
	};

	// --- Template Definition Start ---

	// Header Section
	printCommands.push({
		type: "setStyles",
		align: "CT",
		style: "B",
		size: [1, 2],
	});
	printCommands.push({
		type: "println",
		content: d(data.storeName, "TW KITCHEN"),
	});
	printCommands.push({
		type: "setStyles",
		align: "CT",
		style: "B",
		size: [1, 1],
	});
	printCommands.push({
		type: "println",
		content: `*** ${d(data.orderType, "TAKEAWAY").toUpperCase()} ***`,
	});
	printCommands.push({ type: "resetStyles" });
	printCommands.push({ type: "feed", lines: 1 });

	// Customer Information Section
	if (data.customerName)
		printCommands.push({
			type: "println",
			content: `Customer : ${d(data.customerName)}`,
		});
	if (data.customerMobile)
		printCommands.push({
			type: "println",
			content: `Mobile No: ${d(data.customerMobile)}`,
		});
	if (data.deliveryTime)
		printCommands.push({
			type: "println",
			content: `Delv Time:${d(data.deliveryTime)}`,
		});
	printCommands.push({ type: "feed", lines: 1 });

	// Order Number Section
	printCommands.push({
		type: "println",
		content: "=".repeat(paperCharWidth),
		align: "CT",
	});
	printCommands.push({
		type: "setStyles",
		align: "CT",
		style: "B",
		size: [2, 2],
	}); // Centered as per original KOT
	printCommands.push({
		type: "println",
		content: `No# : ${d(data.orderNumber, "N/A")}`,
	});
	printCommands.push({ type: "resetStyles" });
	printCommands.push({
		type: "println",
		content: "=".repeat(paperCharWidth),
		align: "CT",
	});

	// Date, Time, Pax Line
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
	printCommands.push({
		type: "println",
		content: `${leftColDateTime}${" ".repeat(spaceCount)}${rightColPax}`,
	});
	printCommands.push({
		type: "println",
		content: `${data.followUpStatus}`,
		align: "CT",
		style: "B",
	});
	printCommands.push({ type: "drawLine" });

	// Items Header
	printCommands.push({ type: "setStyles", align: "LT", style: "B" });
	printCommands.push({ type: "println", content: "Qty    Menu" });
	printCommands.push({ type: "resetStyles" });
	printCommands.push({ type: "drawLine" });

	// "ADD-ON" Sub-header - this was in your original KOT. Keep if still relevant.
	// If it's a general category, it stays. If items themselves define categories, remove this.
	printCommands.push({ type: "setStyles", align: "LT", style: "B" });
	printCommands.push({ type: "println", content: "ADD-ON" });
	printCommands.push({ type: "resetStyles" });
	printCommands.push({ type: "feed", lines: 0 }); // Minimal feed

	// Items List (Now uses the recursive helper)
	if (data.items && data.items.length > 0) {
		data.items.forEach((item) => {
			printItemAndSubItemsKOT(item, 0, false); // Start with indentLevel 0
		});
	}
	printCommands.push({ type: "drawLine" }); // Dashed line after all items
	printCommands.push({ type: "feed", lines: 1 });

	// Served By Section
	if (data.servedBy) {
		// Using simple println for Served By as multi-line handling with 'print' is complex
		// And the original KOT example didn't show complex wrapping for this field.
		printCommands.push({
			type: "println",
			content: `Served By : ${d(data.servedBy)}`,
		});
	}
	printCommands.push({ type: "feed", lines: 1 });

	// Notes Section
	if (
		data.notes !== undefined &&
		data.notes !== null &&
		String(data.notes).trim() !== ""
	) {
		printCommands.push({
			type: "setStyles",
			align: "LT",
			style: "B",
			size: [1, 1],
		});
		printCommands.push({ type: "println", content: "Notes :" });
		printCommands.push({ type: "resetStyles" });
		printCommands.push({
			type: "setStyles",
			align: "LT",
			style: "B",
			size: [1, 2],
		});
		printCommands.push({ type: "println", content: d(data.notes) });
		printCommands.push({ type: "resetStyles" });
	}

	// Final separator
	printCommands.push({
		type: "println",
		content: "=".repeat(paperCharWidth),
		align: "CT",
	});
	printCommands.push({ type: "feed", lines: 3 });
	printCommands.push({ type: "cut" });

	return printCommands;
}
