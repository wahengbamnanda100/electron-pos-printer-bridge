// // src/templates/cheloKababReceipt.js

// /**
//  * Generates printData for the Chelokabab Takeaway Receipt.
//  *
//  * @param {object} data - The dynamic data for the ticket.
//  * @param {string} [data.logoPath] - Filesystem path to the logo image.
//  * @param {string} [data.storeName="TW KITCHEN"]
//  * @param {string} [data.orderType="Takeaway"]
//  * @param {string} [data.customerName]
//  * @param {string} [data.customerMobile]
//  * @param {string} [data.followUpStatus] // Removed default here to only show if provided
//  * @param {string} [data.deliveryTime] - e.g., "15-May-2025 9:21 am"
//  * @param {string} [data.orderNumber]
//  * @param {string} [data.orderDate]
//  * @param {string} [data.orderTime]
//  * @param {number|string} [data.pax]
//  * @param {Array<object>} data.items - e.g., [{ qty: 4, name: "subway bread", nameAr: "خبز صب واي", amount: 12.00, description: "subway bread" }]
//  * @param {number|string} data.totalAmount
//  * @param {string} [data.totalAmountArabic="مجموع"]
//  * @param {string} [data.kotTotalAmount] // KOT Total is not in this new image, making it optional
//  * @param {string} [data.servedBy]
//  * @param {string} [data.notes] - General order notes.
//  * @param {string} [data.deliveryAddress] - Formatted delivery address string.
//  * @returns {Array<object>} - Array of print command objects.
//  */
// export function generateChelokababTakeawayReceipt(data = {}) {
// 	const printCommands = [];
// 	const paperCharWidth = 42; // Approx for 80mm, used for "thick lines"

// 	const d = (value, defaultValue = "") =>
// 		value !== undefined && value !== null ? String(value) : defaultValue;

// 	const formatAmount = (amount) => {
// 		const num = parseFloat(d(amount, "0"));
// 		return num.toFixed(2);
// 	};

// 	// --- Logo ---
// 	if (data.logoPath) {
// 		printCommands.push({ type: "align", align: "CT" });
// 		printCommands.push({
// 			type: "image",
// 			path: data.logoPath,
// 			options: { rasterize: true },
// 		}); // Add rasterize if image is complex
// 		printCommands.push({ type: "feed", lines: 1 });
// 	} else {
// 		printCommands.push({
// 			type: "setStyles",
// 			align: "CT",
// 			style: "B",
// 			size: [2, 2],
// 		});
// 		printCommands.push({ type: "println", content: "Chelokabab" });
// 		printCommands.push({ type: "resetStyles" });
// 		printCommands.push({ type: "feed", lines: 1 });
// 	}
// 	// The very small Arabic text below the logo in the image is likely part of the logo image itself.

// 	// Store Info
// 	printCommands.push({
// 		type: "setStyles",
// 		align: "CT",
// 		style: "B",
// 		size: [1, 1],
// 	});
// 	printCommands.push({
// 		type: "println",
// 		content: d(data.storeName, "TW KITCHEN"),
// 	});
// 	printCommands.push({
// 		type: "println",
// 		content: d(data.orderType, "Takeaway").toUpperCase(),
// 	});
// 	printCommands.push({ type: "resetStyles" });
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// Customer Info (Bold as per image)
// 	if (data.customerName)
// 		printCommands.push({
// 			type: "println",
// 			content: `Customer : ${d(data.customerName)}`,
// 			style: "B",
// 		});
// 	if (data.customerMobile)
// 		printCommands.push({
// 			type: "println",
// 			content: `Mobile No: ${d(data.customerMobile)}`,
// 			style: "B",
// 		});

// 	// Follow UP (Centered and Bold)
// 	if (data.followUpStatus) {
// 		printCommands.push({ type: "setStyles", align: "CT", style: "B" });
// 		printCommands.push({ type: "println", content: d(data.followUpStatus) }); // Default removed, only print if provided
// 		printCommands.push({ type: "resetStyles" });
// 	}
// 	// Delivery Time (Normal text, left aligned)
// 	if (data.deliveryTime)
// 		printCommands.push({
// 			type: "println",
// 			content: `Delv Time: ${d(data.deliveryTime)}`,
// 		});
// 	printCommands.push({ type: "feed", lines: 1 }); // Space after this block

// 	// Order Number (Thick lines, Large Bold Centered Text for No#)
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
// 	}); // Centered Order No
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

// 	// Date, Time, Pax
// 	const orderDateStr = d(
// 		data.orderDate,
// 		new Date()
// 			.toLocaleDateString("en-GB", {
// 				day: "2-digit",
// 				month: "short",
// 				year: "numeric",
// 			})
// 			.replace(/ /g, "-")
// 	);
// 	const orderTimeStr = d(
// 		data.orderTime,
// 		new Date().toLocaleTimeString("en-US", {
// 			hour: "numeric",
// 			minute: "2-digit",
// 			hour12: true,
// 		})
// 	);
// 	const paxInfo = data.pax
// 		? `Pax : ${parseFloat(d(data.pax, "0")).toFixed(2)}`
// 		: "";
// 	printCommands.push({
// 		type: "tableCustom",
// 		data: [[`Date : ${orderDateStr} ${orderTimeStr}`, paxInfo]],
// 		options: {
// 			columns: [
// 				{ width: 0.7, align: "LEFT" },
// 				{ width: 0.3, align: "RIGHT" },
// 			],
// 		},
// 	});
// 	printCommands.push({ type: "drawLine" }); // Dashed line separator

// 	// Items Header (Qty, Menu, Amount)
// 	printCommands.push({
// 		type: "tableCustom",
// 		data: [["Qty", "Menu", "Amount"]],
// 		options: {
// 			columns: [
// 				{ width: 0.15, align: "LEFT", style: "B" },
// 				{ width: 0.55, align: "CENTER", style: "B" },
// 				{ width: 0.3, align: "RIGHT", style: "B" },
// 			],
// 		}, // Menu header centered
// 	});
// 	// No line directly after this header in the new image.

// 	// Items List
// 	if (data.items && data.items.length > 0) {
// 		data.items.forEach((item) => {
// 			// Main Item Line: Qty, English Name (large, bold), Amount (normal, bold)
// 			printCommands.push({
// 				type: "tableCustom",
// 				data: [
// 					[d(item.qty), d(item.name).toUpperCase(), formatAmount(item.amount)],
// 				],
// 				options: {
// 					columns: [
// 						// Qty and Name larger and bold
// 						{ width: 0.15, align: "LEFT", style: "B", size: [1, 2] },
// 						{ width: 0.55, align: "LEFT", style: "B", size: [1, 2] }, // English name left aligned
// 						{ width: 0.3, align: "RIGHT", style: "B", size: [1, 1] }, // Amount normal size
// 					],
// 				},
// 			});

// 			// Item Description (if any, centered below English name)
// 			if (item.description) {
// 				printCommands.push({ type: "setStyles", align: "CT", size: [1, 1] }); // Centered, normal size
// 				printCommands.push({
// 					type: "println",
// 					content: `  ${d(item.description)}`,
// 				}); // Indent slightly for visual hierarchy
// 				printCommands.push({ type: "resetStyles" });
// 			}

// 			// Arabic Item Name (if any, centered below description or English name)
// 			if (item.nameAr) {
// 				printCommands.push({
// 					type: "setStyles",
// 					align: "CT",
// 					style: "B",
// 					size: [1, 1],
// 				}); // Centered, bold, normal size
// 				printCommands.push({ type: "println", content: d(item.nameAr) });
// 				printCommands.push({ type: "resetStyles" });
// 			}
// 			printCommands.push({ type: "drawLine" }); // Line after each full item entry
// 		});
// 	}
// 	// Removed the single drawLine after the loop, as it's now per item.

// 	// Total
// 	printCommands.push({
// 		type: "tableCustom",
// 		data: [["Total", ":", formatAmount(data.totalAmount)]],
// 		options: {
// 			columns: [
// 				{ width: 0.6, align: "LEFT", style: "B", size: [1, 1] },
// 				{ width: 0.1, align: "CENTER", style: "B", size: [1, 1] },
// 				{ width: 0.3, align: "RIGHT", style: "B", size: [1, 1] },
// 			],
// 		},
// 	});
// 	if (data.totalAmountArabic) {
// 		printCommands.push({
// 			type: "setStyles",
// 			align: "LT",
// 			style: "B",
// 			size: [1, 1],
// 		}); // "مجموع" is left-aligned and bold in new image
// 		printCommands.push({
// 			type: "println",
// 			content: d(data.totalAmountArabic, "مجموع"),
// 		});
// 		printCommands.push({ type: "resetStyles" });
// 	}
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// KOT Total Amount (This section is not present in the new image, so make it conditional)
// 	if (data.kotTotalAmount !== undefined) {
// 		printCommands.push({
// 			type: "println",
// 			content: "-".repeat(paperCharWidth),
// 			align: "CT",
// 		}); // Dashed line separator
// 		printCommands.push({
// 			type: "tableCustom",
// 			data: [[`KOT Total Amount`, ":", formatAmount(data.kotTotalAmount)]],
// 			options: {
// 				columns: [
// 					{ width: 0.6, align: "LEFT", style: "B", size: [1, 2] },
// 					{ width: 0.1, align: "CENTER", style: "B", size: [1, 2] },
// 					{ width: 0.3, align: "RIGHT", style: "B", size: [1, 2] },
// 				],
// 			},
// 		});
// 		printCommands.push({ type: "drawLine" }); // Dashed line separator
// 	}

// 	// Served By
// 	// The text "bl :" seems to be a label before "Served By"
// 	if (data.servedByLabel && data.servedBy) {
// 		// e.g. data.servedByLabel = "Sbl :"
// 		printCommands.push({
// 			type: "println",
// 			content: `${d(data.servedByLabel)} ${d(data.servedBy)}`,
// 		});
// 	} else if (data.servedBy) {
// 		printCommands.push({
// 			type: "println",
// 			content: `Served By : ${d(data.servedBy)}`,
// 		});
// 	}

// 	// Notes
// 	if (data.notes) {
// 		printCommands.push({ type: "setStyles", style: "B" }); // Notes label is bold
// 		printCommands.push({ type: "println", content: "Notes : " }); // Print "Notes :" without newline
// 		printCommands.push({ type: "resetStyles" });
// 		printCommands.push({ type: "setStyles", style: "B", size: [1, 1] }); // Note content itself is bold, normal height
// 		printCommands.push({ type: "println", content: d(data.notes) }); // Actual note content
// 		printCommands.push({ type: "resetStyles" });
// 	}
// 	printCommands.push({ type: "feed", lines: 1 });

// 	// Delivery Address
// 	if (data.deliveryAddress) {
// 		printCommands.push({ type: "setStyles", align: "CT", style: "B" });
// 		printCommands.push({
// 			type: "println",
// 			content: "***** DELIVERY ADDRESS *****",
// 		});
// 		printCommands.push({ type: "resetStyles" });
// 		printCommands.push({ type: "setStyles", align: "LT", size: [1, 1] });
// 		const addressLines = d(data.deliveryAddress).split("\n");
// 		addressLines.forEach((line) => {
// 			printCommands.push({ type: "println", content: line });
// 		});
// 		printCommands.push({ type: "resetStyles" });
// 	}

// 	// Footer Separator / End of receipt
// 	printCommands.push({ type: "feed", lines: 1 });
// 	// No thick line at the very end in this new image
// 	printCommands.push({ type: "feed", lines: 3 });
// 	printCommands.push({ type: "cut" });

// 	return printCommands;
// }

// src/templates/cheloKababReceipt.js

/**
 * Generates printData for the Chelokabab Takeaway Receipt.
 *
 * @param {object} data - The dynamic data for the ticket.
 * // ... (other props)
 * @param {Array<object>} data.items - e.g., [{ qty: 1, name: "MAIN", nameAr: "رئيسي", amount: 10.00, subItems: [...] }]
 * // ... (other props)
 * @returns {Array<object>} - Array of print command objects.
 */
export function generateChelokababTakeawayReceipt(data = {}) {
	const printCommands = [];
	const paperCharWidth = 42;

	const d = (value, defaultValue = "") =>
		value !== undefined && value !== null ? String(value) : defaultValue;

	const formatAmount = (amount) => {
		const num = parseFloat(d(amount, "0"));
		return num.toFixed(2);
	};

	const centerText = (text, maxWidth, padChar = " ") => {
		// Basic centering, might need refinement for mixed LTR/RTL and varying font widths
		if (!text) return padChar.repeat(maxWidth); // Return empty centered line if no text
		const textLength = text.length; // This is char count, not visual width
		if (textLength >= maxWidth) return text.substring(0, maxWidth);
		const padding = Math.floor((maxWidth - textLength) / 2);
		return (
			padChar.repeat(padding) +
			text +
			padChar.repeat(maxWidth - textLength - padding)
		);
	};

	// --- Recursive Helper to Print Items and their Sub-Items ---
	// indentLevel: 0 for main items, 1 for first level sub-items, etc.
	// isSubItem: boolean to differentiate styling or prefix for sub-items
	const printItemAndSubItems = (item, indentLevel = 0, isSubItem = false) => {
		const indentSpaces = "  ".repeat(indentLevel); // 2 spaces per indent level
		const menuColumnCharWidth =
			Math.floor(paperCharWidth * 0.55) - indentSpaces.length;

		// Main Item Line: Qty, English Name (large, bold), Amount (normal, bold)
		let itemNameDisplay = d(item.name).toUpperCase();
		if (isSubItem) {
			// Optionally prefix sub-items, e.g., "- " or based on type
			itemNameDisplay = `${indentSpaces}- ${itemNameDisplay}`;
		} else {
			itemNameDisplay = `${indentSpaces}${itemNameDisplay}`;
		}

		printCommands.push({
			type: "tableCustom",
			data: [
				[
					isSubItem ? `${indentSpaces}${d(item.qty)}` : d(item.qty), // Indent Qty for sub-items
					itemNameDisplay,
					formatAmount(item.amount),
				],
			],
			options: {
				columns: [
					// Qty and Name larger and bold for main items, potentially smaller for sub-items
					{
						width: 0.15,
						align: "LEFT",
						style: "B",
						size: isSubItem ? [1, 1] : [1, 2],
					},
					{
						width: 0.55,
						align: "LEFT",
						style: "B",
						size: isSubItem ? [1, 1] : [1, 2],
					},
					{ width: 0.3, align: "RIGHT", style: "B", size: [1, 1] },
				],
			},
		});

		// Item Description (if any, centered under the menu area, indented)
		if (item.description) {
			printCommands.push({ type: "setStyles", align: "CT", size: [1, 1] });
			printCommands.push({
				type: "println",
				content: centerText(
					`${indentSpaces}  ${d(item.description)}`,
					menuColumnCharWidth
				),
			});
			printCommands.push({ type: "resetStyles" });
		}

		// Arabic Item Name (if any, centered under the menu area, indented)
		if (item.nameAr) {
			printCommands.push({ type: "setStyles", align: "CT", size: [1, 1] }); // Not bold for Arabic name as per last image
			printCommands.push({
				type: "println",
				content: centerText(
					`${indentSpaces}${d(item.nameAr)}`,
					menuColumnCharWidth
				),
			});
			printCommands.push({ type: "resetStyles" });
		}

		// Recursively print sub-items
		if (item.subItems && item.subItems.length > 0) {
			item.subItems.forEach((subItem) => {
				printItemAndSubItems(subItem, indentLevel + 1, true);
			});
		}
		// Only draw line after main items or last sub-item of a group
		// This logic might need refinement if you want lines between sub-items too
		if (!isSubItem) {
			// Draw line after a main item and all its sub-items are printed
			printCommands.push({ type: "drawLine" });
		}
	};

	// --- Logo, Store Info, Customer Info, Follow UP, Order Number, Date/Time/Pax (Same as before) ---
	if (data.logoPath) {
		printCommands.push({ type: "align", align: "CT" });
		printCommands.push({
			type: "image",
			path: data.logoPath,
			options: { rasterize: true },
		});
		printCommands.push({ type: "feed", lines: 1 });
	} else {
		/* ... fallback ... */
	}

	printCommands.push({
		type: "setStyles",
		align: "CT",
		style: "B",
		size: [1, 1],
	});
	printCommands.push({
		type: "println",
		content: d(data.storeName, "TW KITCHEN"),
	});
	printCommands.push({ type: "resetStyles" });
	printCommands.push({
		type: "setStyles",
		align: "CT",
		style: "B",
		size: [1, 1],
	});
	printCommands.push({
		type: "println",
		content: d(data.orderType, "Takeaway").toUpperCase(),
	});
	printCommands.push({ type: "resetStyles" });
	printCommands.push({ type: "feed", lines: 1 });

	if (data.customerName) {
		printCommands.push({ type: "println", content: "Customer : ", style: "B" });
		printCommands.push({ type: "println", content: d(data.customerName) });
	}
	if (data.customerMobile) {
		printCommands.push({ type: "println", content: "Mobile No: ", style: "B" });
		printCommands.push({ type: "println", content: d(data.customerMobile) });
	}
	if (data.followUpStatus) {
		printCommands.push({
			type: "setStyles",
			align: "CT",
			style: "B",
			size: [1, 1],
		});
		printCommands.push({ type: "println", content: d(data.followUpStatus) });
		printCommands.push({ type: "resetStyles" });
	}
	if (data.deliveryTime)
		printCommands.push({
			type: "println",
			content: `Delv Time: ${d(data.deliveryTime)}`,
		});
	printCommands.push({ type: "feed", lines: 0 });

	printCommands.push({
		type: "println",
		content: "=".repeat(paperCharWidth),
		align: "CT",
	});
	printCommands.push({
		type: "setStyles",
		align: "LT",
		style: "B",
		size: [2, 2],
	});
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
	printCommands.push({
		type: "tableCustom",
		data: [[`Date : ${orderDateStr} ${orderTimeStr}`, paxInfo]],
		options: {
			columns: [
				{ width: 0.75, align: "LEFT" },
				{ width: 0.25, align: "RIGHT" },
			],
		},
	});
	printCommands.push({ type: "drawLine" });

	// Items Header (Qty Menu Amount)
	printCommands.push({
		type: "tableCustom",
		data: [["Qty", "Menu", "Amount"]],
		options: {
			columns: [
				{ width: 0.15, align: "LEFT", style: "B" },
				{ width: 0.55, align: "CENTER", style: "B" },
				{ width: 0.3, align: "RIGHT", style: "B" },
			],
		},
	});
	// Removed separate "ADD-ON" text here. If "ADD-ON" is a category, items would fall under it.
	// Or it can be a specific item type.

	// Items List (Now uses the recursive helper)
	if (data.items && data.items.length > 0) {
		data.items.forEach((item) => {
			printItemAndSubItems(item, 0, false); // Start with indentLevel 0, not a subItem itself
		});
	}
	// The drawLine after the loop is removed because printItemAndSubItems handles lines after main items.

	// --- Total, Served By, Notes, Delivery Address, Footer (Same as before) ---
	printCommands.push({
		type: "tableCustom",
		data: [["Total", ":", formatAmount(data.totalAmount)]],
		options: {
			columns: [
				{ width: 0.6, align: "LEFT", style: "B" },
				{ width: 0.1, align: "CENTER", style: "B" },
				{ width: 0.3, align: "RIGHT", style: "B" },
			],
		},
	});
	if (data.totalAmountArabic) {
		printCommands.push({ type: "setStyles", align: "LT", style: "B" });
		printCommands.push({
			type: "println",
			content: d(data.totalAmountArabic, "مجموع"),
		});
		printCommands.push({ type: "resetStyles" });
	}
	printCommands.push({ type: "feed", lines: 1 });

	if (data.kotTotalAmount !== undefined) {
		/* ... KOT Total ... */
	}

	if (data.servedBy) {
		printCommands.push({
			type: "println",
			content: `${d(data.servedByLabel, "Sbl :")} `,
		});
		printCommands.push({ type: "println", content: d(data.servedBy) });
	}
	if (data.notes) {
		printCommands.push({ type: "println", content: "Notes : ", style: "B" });
		printCommands.push({ type: "setStyles", style: "B", size: [1, 1] });
		printCommands.push({ type: "println", content: d(data.notes) });
		printCommands.push({ type: "resetStyles" });
	}
	printCommands.push({ type: "feed", lines: 1 });

	if (data.deliveryAddress) {
		printCommands.push({ type: "setStyles", align: "CT", style: "B" });
		printCommands.push({
			type: "println",
			content: "***** DELIVERY ADDRESS *****",
		});
		printCommands.push({ type: "resetStyles" });
		printCommands.push({ type: "setStyles", align: "LT", size: [1, 1] });
		const addressLines = d(data.deliveryAddress).split("\n");
		addressLines.forEach((line) => {
			printCommands.push({ type: "println", content: line });
		});
		printCommands.push({ type: "resetStyles" });
	}

	printCommands.push({ type: "feed", lines: 3 });
	printCommands.push({ type: "cut" });

	return printCommands;
}
