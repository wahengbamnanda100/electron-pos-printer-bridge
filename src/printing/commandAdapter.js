// // commandAdapter.js (Updated)

// /**
//  * Converts node-thermal-printer style commands to @plick/electron-pos-printer format.
//  *
//  * @param {Array<object>} ntpCommands - Array of commands from a generator function.
//  * @param {number} [paperCharWidth=42] - Default character width for lines.
//  * @returns {Array<object>} - Array of command objects for @plick/electron-pos-printer.
//  */
// export function convertNtpToPlick(ntpCommands, paperCharWidth = 42) {
// 	const plickCommands = [];
// 	let currentStyleState = {
// 		align: "left",
// 		fontWeight: "normal",
// 		fontSize: "1em", // Base font size
// 		fontFamily: "Arial",
// 	};

// 	const mapNtpAlignToPlick = (ntpAlign) => {
// 		switch (ntpAlign) {
// 			case "CT":
// 				return "center";
// 			case "RT":
// 				return "right";
// 			case "LT":
// 			default:
// 				return "left";
// 		}
// 	};

// 	const mapNtpSizeToPlickFontSize = (ntpSizeArray) => {
// 		if (
// 			!ntpSizeArray ||
// 			!Array.isArray(ntpSizeArray) ||
// 			ntpSizeArray.length !== 2
// 		)
// 			return "1em"; // Default

// 		const widthMultiplier = ntpSizeArray[0];
// 		const heightMultiplier = ntpSizeArray[1];

// 		// Approximate font size. Plick might render these differently.
// 		// [1,1] normal, [1,2] doubleHeight, [2,1] doubleWidth, [2,2] doubleBoth
// 		if (heightMultiplier === 2 && widthMultiplier === 2) return "2em";
// 		if (heightMultiplier === 2) return "1.7em"; // Primarily taller
// 		if (widthMultiplier === 2) return "1em"; // Standard CSS font-size mainly affects height.
// 		// True double width is hard. Maybe use larger 'em' if it widens glyphs.
// 		return "1em";
// 	};

// 	const buildStyleString = (stylesObject) => {
// 		return Object.entries(stylesObject)
// 			.map(
// 				([key, value]) =>
// 					`${key.replace(
// 						/[A-Z]/g,
// 						(letter) => `-${letter.toLowerCase()}`
// 					)}:${value};`
// 			)
// 			.join("");
// 	};

// 	for (const cmd of ntpCommands) {
// 		let plickCssProps = {};

// 		switch (cmd.type) {
// 			case "setStyles":
// 				if (cmd.align) currentStyleState.align = mapNtpAlignToPlick(cmd.align);
// 				if (cmd.style)
// 					currentStyleState.fontWeight = cmd.style.includes("B")
// 						? "bold"
// 						: "normal";
// 				if (cmd.size)
// 					currentStyleState.fontSize = mapNtpSizeToPlickFontSize(cmd.size);
// 				break;

// 			case "resetStyles":
// 				currentStyleState = {
// 					align: "left",
// 					fontWeight: "normal",
// 					fontSize: "1em",
// 				};
// 				break;

// 			case "align": // Standalone align command (often for images/barcodes)
// 				if (cmd.align) currentStyleState.align = mapNtpAlignToPlick(cmd.align);
// 				break;

// 			case "println":
// 				const textAlign = cmd.align
// 					? mapNtpAlignToPlick(cmd.align)
// 					: currentStyleState.align;
// 				const fontWeight =
// 					cmd.style && cmd.style.includes("B")
// 						? "bold"
// 						: currentStyleState.fontWeight;
// 				const fontSize = cmd.size
// 					? mapNtpSizeToPlickFontSize(cmd.size)
// 					: currentStyleState.fontSize;

// 				plickCssProps = {
// 					textAlign: textAlign,
// 					fontWeight: fontWeight,
// 					fontSize: fontSize,
// 				};

// 				plickCommands.push({
// 					type: "text",
// 					value: cmd.content || "",
// 					style: buildStyleString(plickCssProps),
// 				});
// 				break;

// 			case "feed":
// 				plickCommands.push({ type: "feed", lines: cmd.lines || 1 });
// 				break;

// 			case "cut":
// 				plickCommands.push({ type: "cut" });
// 				break;

// 			case "drawLine":
// 				plickCommands.push({
// 					type: "text",
// 					value: "-".repeat(paperCharWidth), // Or use cmd.character || '-'
// 					style: buildStyleString({
// 						textAlign: "center",
// 						fontFamily: "monospace",
// 					}),
// 				});
// 				break;

// 			case "image":
// 				plickCommands.push({
// 					type: "image",
// 					path: cmd.path,
// 					position: currentStyleState.align || "center", // Use current alignment for image position
// 					// width: '50px', // Optional: Plick might support width/height for images
// 					// height: '50px',
// 				});
// 				break;

// 			case "tableCustom":
// 				const plickTableData = {
// 					type: "table",
// 					headers: [], // Plick might want headers separate or treat first row as headers.
// 					tableRows: [],
// 					// Optional: style for the whole table container
// 					// style: 'width: 100%; border-collapse: collapse;',
// 					// Optional: array of styles for columns
// 					// columnStyles: []
// 				};

// 				const ntpColumns =
// 					cmd.options && cmd.options.columns ? cmd.options.columns : [];

// 				// Check if the first row of NTP data should be Plick headers
// 				// This is an assumption; adjust if Plick has a more explicit header definition
// 				if (cmd.data && cmd.data.length > 0) {
// 					// Let's treat all rows as tableRows for simplicity and style them per cell.
// 					// Plick's 'table' might also accept a 'headers' array directly.
// 					// If your first NTP row is always headers, you could populate plickTableData.headers here.
// 				}

// 				cmd.data.forEach((rowData, rowIndex) => {
// 					const plickRow = [];
// 					rowData.forEach((cellData, cellIndex) => {
// 						const colDef = ntpColumns[cellIndex] || {}; // Fallback to empty if not enough colDefs

// 						const cellCssProps = {
// 							// Default text align for table cells is often left
// 							textAlign: colDef.align
// 								? mapNtpAlignToPlick(colDef.align)
// 								: "left",
// 						};

// 						if (colDef.style && colDef.style.includes("B")) {
// 							cellCssProps.fontWeight = "bold";
// 						}
// 						if (colDef.size) {
// 							cellCssProps.fontSize = mapNtpSizeToPlickFontSize(colDef.size);
// 						}
// 						// Plick might take width as a percentage string or a fraction
// 						// Assuming Plick table cells can take { text, align, width, style }
// 						const plickCell = {
// 							text: String(cellData),
// 							align: cellCssProps.textAlign, // Plick might prefer align here
// 							style: buildStyleString(cellCssProps),
// 						};

// 						// Width: Plick's table might handle this in various ways
// 						// 1. As a property on the cell object: plickCell.width = `${(colDef.width || 0.1) * 100}%`;
// 						// 2. As part of columnStyles on the main table object
// 						// 3. Directly in the cell's style string: cellCssProps.width = `${(colDef.width || 0.1) * 100}%`;
// 						// Let's try adding to cell's style string for now.
// 						if (colDef.width) {
// 							// Ensure style string ends with ; if not empty before adding width
// 							let currentCellstyle = plickCell.style || "";
// 							if (currentCellstyle && !currentCellstyle.endsWith(";")) {
// 								currentCellstyle += ";";
// 							}
// 							plickCell.style = `${currentCellstyle}width: ${
// 								colDef.width * 100
// 							}%;`;
// 						}

// 						plickRow.push(plickCell);
// 					});
// 					plickTableData.tableRows.push(plickRow);
// 				});

// 				// If your first NTP row was actually a header, you could structure it like this:
// 				// if (plickTableData.tableRows.length > 0) {
// 				//     plickTableData.headers = plickTableData.tableRows.shift(); // Use first row as header
// 				// }

// 				plickCommands.push(plickTableData);
// 				break;

// 			default:
// 				console.warn(
// 					`[NTP to Plick] Unsupported command type: ${cmd.type}`,
// 					cmd
// 				);
// 		}
// 	}
// 	return plickCommands;
// }

//!@______________________________________________

/**
 * Converts node-thermal-printer style commands to @plick/electron-pos-printer format.
 * This adapter translates legacy commands into a structure that @plick/electron-pos-printer
 * can render, including handling text styles, alignment, and basic commands.
 *
 * @param {Array<object>} ntpCommands - Array of command objects from a generator function
 *   like the original `generateTwKitchenTakeawayTicket`.
 * @param {number} [paperCharWidth=42] - Default character width for drawing lines.
 * @returns {Array<object>} - Array of command objects compatible with @plick/electron-pos-printer.
 */
export function convertNtpToPlick(ntpCommands, paperCharWidth = 42) {
	const plickCommands = [];

	// Holds the current style state, mimicking how a thermal printer processes commands sequentially.
	let currentStyle = {
		textAlign: "left",
		fontWeight: "normal",
		fontSize: "1em",
		fontFamily: "Arial, sans-serif", //"Arial, sans-serif" Default to a monospaced font for better alignment
	};

	/**
	 * Maps node-thermal-printer alignment constants to CSS textAlign values.
	 * @param {string} ntpAlign - The NTP alignment ('LT', 'CT', 'RT').
	 * @returns {string} The corresponding CSS textAlign value.
	 */
	const mapNtpAlignToPlick = (ntpAlign) => {
		switch (ntpAlign) {
			case "CT":
				return "center";
			case "RT":
				return "right";
			case "LT":
			default:
				return "left";
		}
	};

	/**
	 * Approximates node-thermal-printer font size multipliers to CSS 'em' units.
	 * @param {Array<number>} ntpSizeArray - The NTP size array (e.g., [1, 2] for double height).
	 * @returns {string} The corresponding CSS fontSize value in 'em'.
	 */
	const mapNtpSizeToPlickFontSize = (ntpSizeArray) => {
		if (!Array.isArray(ntpSizeArray) || ntpSizeArray.length !== 2) {
			return "1em"; // Default size
		}
		const [width, height] = ntpSizeArray;
		// Prioritize height for font-size, as it's the primary scaling factor in CSS.
		if (height > 1) {
			return `${1 + (height - 1) * 0.5}em`; // e.g., a height of 2 becomes 1.5em
		}
		if (width > 1) {
			return `${1 + (width - 1) * 0.25}em`; // Slightly increase size for width
		}
		return "1em";
	};

	// Process each command from the input array
	for (const cmd of ntpCommands) {
		switch (cmd.type) {
			case "setStyles":
				// Update the global style state based on the command properties.
				if (cmd.align) currentStyle.textAlign = mapNtpAlignToPlick(cmd.align);
				if (cmd.style)
					currentStyle.fontWeight = cmd.style.includes("B") ? "bold" : "normal";
				if (cmd.size)
					currentStyle.fontSize = mapNtpSizeToPlickFontSize(cmd.size);
				// Allow for a custom fontFamily property to be passed in a setStyles command
				if (cmd.fontFamily) currentStyle.fontFamily = cmd.fontFamily;
				break;

			case "resetStyles":
				// Reset the style state to its default values.
				currentStyle = {
					textAlign: "left",
					fontWeight: "normal",
					fontSize: "1em",
					fontFamily: "Arial, sans-serif",
				};
				break;

			case "println":
				// Create a Plick text command.
				// It starts with the current global style and overrides any properties
				// specified directly in the println command itself.
				const finalStyle = { ...currentStyle };
				if (cmd.align) finalStyle.textAlign = mapNtpAlignToPlick(cmd.align);
				if (cmd.style)
					finalStyle.fontWeight = cmd.style.includes("B") ? "bold" : "normal";
				if (cmd.size) finalStyle.fontSize = mapNtpSizeToPlickFontSize(cmd.size);
				if (cmd.fontFamily) finalStyle.fontFamily = cmd.fontFamily;

				plickCommands.push({
					type: "text",
					value: cmd.content || "",
					style: finalStyle,
				});
				break;

			case "feed":
				// Plick doesn't have a direct 'feed' command. We simulate it by adding
				// empty text lines, which effectively creates vertical space.
				const lines = cmd.lines || 1;
				for (let i = 0; i < lines; i++) {
					// Using a non-empty space ensures the line is rendered.
					plickCommands.push({ type: "text", value: " " });
				}
				break;

			case "cut":
				// Directly map to Plick's 'cut' command.
				plickCommands.push({ type: "cut" });
				break;

			case "drawLine":
				// Use Plick's semantic 'divider' command, which is cleaner than printing dashes.
				plickCommands.push({ type: "divider" });
				break;

			// Note: 'tableCustom', 'image', etc., would be translated here if needed.
			// The provided template does not use them, so they are omitted for clarity.

			default:
				// Log a warning for any command types that this adapter doesn't know how to handle.
				console.warn(
					`[NTP to Plick Adapter] Unsupported command type: "${cmd.type}"`,
					cmd
				);
		}
	}

	return plickCommands;
}
