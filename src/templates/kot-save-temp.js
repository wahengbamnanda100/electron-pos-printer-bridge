// src/templates/twKitchenTakeawayTicket.js

/**
 * Generates printData for the TW Kitchen Takeaway Ticket, matching the provided image.
 * @param {object} data - The dynamic data for the ticket.
 * @param {string} [data.storeName] - Defaults to "TW KITCHEN"
 * @param {string} [data.orderType] - Defaults to "TAKEAWAY"
 * @param {string} [data.customerName]
 * @param {string} [data.customerMobile]
 * @param {string} [data.deliveryTime] - e.g., "15-May-2025 9:21 am"
 * @param {string} [data.orderNumber] - e.g., "TWK-KIT2501882"
 * @param {string} [data.orderDate] - e.g., "15-May-2025" (can be derived from deliveryTime if not separate)
 * @param {string} [data.orderTime] - e.g., "9:21 am" (can be derived from deliveryTime if not separate)
 * @param {number | string} [data.pax] - e.g., 1.00 or "1.00"
 * @param {Array<object>} [data.items] - [{ qty: 11, name: "subway bread", isAddon: false/true, notes: "Extra spicy" }, ...]
 * @param {string} [data.servedBy] - e.g., "0465 - KARIM MOHAMED KAMAL MOHAMED"
 * @param {string} [data.notes] - The actual note content, the label "Notes :" will be added.
 * @returns {Array<object>} - Array of print command objects.
 */
export function generateTwKitchenTakeawayTicket(data = {}) {
	const printCommands = [];
	const paperCharWidth = 42; // Target character width for an 80mm printer with standard font. Adjust if needed.

	// --- Helper function to get data value or default ---
	const d = (value, defaultValue = "") =>
		value !== undefined && value !== null ? String(value) : defaultValue;

	// --- Helper functions for adding print commands ---
	const addText = (content = "", align = "LT", style = "", size = [1, 1]) => {
		printCommands.push({
			type: "text",
			content: String(content),
			align,
			style,
			size,
		});
	};

	const addStyledText = (
		content = "",
		align = "LT",
		style = "",
		size = [1, 1]
	) => {
		// Only add if content is not empty, or if explicit styling is applied to an empty line (for spacing)
		const textContent = String(content);
		if (
			textContent.trim() !== "" ||
			style ||
			(size && (size[0] > 1 || size[1] > 1))
		) {
			printCommands.push({ type: "setStyles", align, style, size });
			printCommands.push({ type: "text", content: textContent });
			printCommands.push({ type: "resetStyles" });
		} else if (textContent === "") {
			// If content is deliberately empty, respect alignment for potential spacing
			printCommands.push({ type: "setStyles", align, style, size });
			printCommands.push({ type: "text", content: "" });
			printCommands.push({ type: "resetStyles" });
		}
	};

	const drawLine = (type = "DOTTED_THIN") => {
		// The 'drawLine' command in bridge-api uses the ThermalPrinter constructor's 'lineCharacter'
		// We'll assume bridge-api's drawLine handles different styles or that default is suitable.
		// If more control needed here, pass line character to a text command.
		let lineStyleName = "LINE"; // Corresponds to a ThermalPrinter.BreakLine option (or similar)
		if (type === "DOTTED_THICK")
			lineStyleName = "DOUBLE"; // map to what bridgeAPI drawLine can handle
		else if (type === "DOTTED_THIN") lineStyleName = "DOT";

		printCommands.push({ type: "drawLine", lineStyle: lineStyleName });
	};

	const addFeed = (lines = 1) => {
		printCommands.push({ type: "feed", lines });
	};

	// --- Receipt Generation ---

	// Section 1: Header
	addStyledText(d(data.storeName, "TW KITCHEN"), "CT", "B", [1, 2]); // Bold, Double Height
	addStyledText(
		`*** ${d(data.orderType, "TAKEAWAY").toUpperCase()} ***`,
		"CT",
		"B"
	);
	addFeed();

	// Section 2: Customer Info
	if (data.customerName) addText(`Customer : ${d(data.customerName)}`);
	if (data.customerMobile) addText(`Mobile No: ${d(data.customerMobile)}`); // Matches image spacing
	if (data.deliveryTime) addText(`Delv Time:${d(data.deliveryTime)}`); // Matches image spacing
	addFeed();

	// Section 3: Order Number (Large and Bold, solid line above and below)
	// The image has a thick solid line above order number, which drawLine(SOLID) tries to achieve.
	// A true solid block line across the receipt usually needs raw ESC/POS or specific printer support.
	// We'll use text with repeating chars for a visually solid line for simplicity.
	addText("==========================================", "CT"); // Simulating a thick line
	addStyledText(`No# : ${d(data.orderNumber, "N/A")}`, "LT", "B", [2, 2]); // Large Text
	addText("==========================================", "CT"); // Simulating a thick line

	// Section 4: Order Date/Time/Pax Line
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
		new Date().toLocaleTimeString([], {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})
	);
	let paxStr = "";
	if (data.pax !== undefined && data.pax !== null) {
		const paxValue = parseFloat(d(data.pax, "0"));
		paxStr = `Pax : ${paxValue.toFixed(2)}`;
	}
	// Attempt to space this out. Max 42 chars.
	// "Date : 15-May-2025 9:21 am Pax : 1.00" -> roughly 40 chars
	const dateLabel = "Date : ";
	const dateTimeAndPax = `${orderDateStr} ${orderTimeStr}`;
	const remainingSpaceForPax =
		paperCharWidth - (dateLabel.length + dateTimeAndPax.length);

	let datePaxLine = `${dateLabel}${dateTimeAndPax}`;
	if (paxStr) {
		if (remainingSpaceForPax > paxStr.length + 2) {
			// +2 for spacing
			datePaxLine +=
				"  ".repeat(
					Math.max(1, Math.floor((remainingSpaceForPax - paxStr.length) / 2))
				) + paxStr;
		} else {
			// Not enough space to nicely align Pax, just append
			datePaxLine += ` ${paxStr}`;
			// Or break into two lines:
			// addText(`${dateLabel}${dateTimeAndPax}`);
			// addText(paxStr, 'RT'); // Align pax to the right on a new line if too long
		}
	}
	addText(datePaxLine);
	drawLine("DOTTED_THIN");

	// --- Section 5, 6, 7: Items using a Table ---

	const tableData = [];

	addStyledText("Qty    Menu", "LT", "B"); // Retain this style if desired above table
	drawLine("DOTTED_THIN");
	// addStyledText("ADD-ON", "LT", "B"); // This header appears before the items

	if (data.items && data.items.length > 0) {
		data.items.forEach((item) => {
			const qtyStr = d(item.qty, "0"); // Don't pad here, let table handle alignment/width
			const nameStr = d(item.name, "N/A").toUpperCase();

			// Add item row
			tableData.push([qtyStr, nameStr]);

			if (item.notes) {
				// Add notes as a separate "row" spanning columns, or as part of the item name column.
				// For simplicity, we can make notes span or indent.
				// tableCustom might need special handling for multi-line notes within a cell.
				// A common approach is to put notes on the next line, potentially indented.
				tableData.push(["", `  (${d(item.notes)})`]); // Indented note on a new line, in the "name" column
			}
		});
	}

	if (tableData.length > 0) {
		printCommands.push({
			type: "tableCustom",
			table: [
				// Array of rows
				// Example for custom headers if not done with addStyledText above
				// { text:"Qty", align:"LEFT", width:0.15, style: "B" },
				// { text:"Menu Item", align:"LEFT", width:0.85, style: "B" },
			],
			data: tableData, // This is your array of row arrays: [['11', 'SUBWAY BREAD'], ['','  (note)']]
			options: {
				// Define column properties
				// The widths are fractions of the total printer width (0.0 to 1.0)
				// Make sure sum of widths for visible columns is <= 1.0
				columns: [
					{ width: 0.15, align: "LEFT", style: "B", size: [1, 2] }, // For Qty - Bold, Double Height
					{ width: 0.85, align: "LEFT", style: "B", size: [1, 2] }, // For Menu Item Name - Bold, Double Height
					// Notes will use the style of the Menu Item column.
				],
				// verticalSeparator: '|', // Optional: character for vertical separators
				// horizontalSeparator: '-', // Optional: character for horizontal separators (header/footer)
				//
				// For styling rows/cells: node-thermal-printer documentation says data can be objects too.
				// e.g. {text:"11", style:"B"}, {text:"ITEM", style:"BI"} but this makes data generation complex.
				// Using column-level styles via `options.columns` is simpler here.
				// Ensure your bridge-api `tableCustom` processing can pass these column options to NTP.
			},
		});
	}

	// Section 5: Items Header
	// addStyledText("Qty    Menu", "LT", "B"); // Based on image alignment, Qty is fixed then Menu
	// drawLine("DOTTED_THIN");

	// Section 6: ADD-ON Header
	// addStyledText("ADD-ON", "LT", "B");
	// (Note: The image seems to use this as a general header before items,
	// not necessarily for a separate list of addon-only items)

	// Section 7: Items (Large, Bold)
	// if (data.items && data.items.length > 0) {
	// 	data.items.forEach((item) => {
	// 		// For "11 subway bread", qty is 2 chars, name starts after.
	// 		// Max width of qty could be ~3 chars "999"
	// 		const qtyStr = d(item.qty, "0").padStart(3, " "); // Pad qty to 3 chars " 11"
	// 		// Item name is large and bold
	// 		addStyledText(
	// 			`${qtyStr} ${d(item.name, "N/A").toUpperCase()}`,
	// 			"LT",
	// 			"B",
	// 			[1, 2]
	// 		); // Double height, normal width for items. Or [2,2] for very large.
	// 		// Image items appear double height and bold.
	// 		if (item.notes) {
	// 			// Optional notes per item
	// 			addText(`     (${d(item.notes)})`); // Indent item notes
	// 		}
	// 	});
	// }
	// drawLine("DOTTED_THIN");
	// addFeed(); // Space after items

	// Section 8: Served By
	if (data.servedBy) {
		// Splitting logic if servedBy is too long
		const servedByPrefix = "Served By : ";
		const maxNameLength = paperCharWidth - servedByPrefix.length;
		let servedByName = d(data.servedBy);
		addText(`${servedByPrefix}${servedByName.substring(0, maxNameLength)}`);
		servedByName = servedByName.substring(maxNameLength);
		while (servedByName.length > 0) {
			addText("            " + servedByName.substring(0, paperCharWidth - 12)); // Indent subsequent lines
			servedByName = servedByName.substring(paperCharWidth - 12);
		}
	}
	addFeed(); // Space before Notes

	// Section 9: Notes (Label bold, content large and bold)
	if (data.notes !== undefined && data.notes !== null) {
		// Check explicitly, even empty string for notes is valid
		addStyledText("Notes :", "LT", "B"); // Label is normal size, bold
		addStyledText(d(data.notes), "LT", "B", [1, 2]); // Content large and bold (double height)
	}

	drawLine("DOTTED_THICK"); // Double dashed line (equals signs)

	// Standard end
	addFeed(2); // Extra feed before cut
	printCommands.push({ type: "cut" });

	return printCommands;
}
