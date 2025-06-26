// commandAdapter.js (Updated)

/**
 * Converts node-thermal-printer style commands to @plick/electron-pos-printer format.
 *
 * @param {Array<object>} ntpCommands - Array of commands from a generator function.
 * @param {number} [paperCharWidth=42] - Default character width for lines.
 * @returns {Array<object>} - Array of command objects for @plick/electron-pos-printer.
 */
export function convertNtpToPlick(ntpCommands, paperCharWidth = 42) {
	const plickCommands = [];
	let currentStyleState = {
		align: "left",
		fontWeight: "normal",
		fontSize: "1em", // Base font size
	};

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

	const mapNtpSizeToPlickFontSize = (ntpSizeArray) => {
		if (
			!ntpSizeArray ||
			!Array.isArray(ntpSizeArray) ||
			ntpSizeArray.length !== 2
		)
			return "1em"; // Default

		const widthMultiplier = ntpSizeArray[0];
		const heightMultiplier = ntpSizeArray[1];

		// Approximate font size. Plick might render these differently.
		// [1,1] normal, [1,2] doubleHeight, [2,1] doubleWidth, [2,2] doubleBoth
		if (heightMultiplier === 2 && widthMultiplier === 2) return "2em";
		if (heightMultiplier === 2) return "1.7em"; // Primarily taller
		if (widthMultiplier === 2) return "1em"; // Standard CSS font-size mainly affects height.
		// True double width is hard. Maybe use larger 'em' if it widens glyphs.
		return "1em";
	};

	const buildStyleString = (stylesObject) => {
		return Object.entries(stylesObject)
			.map(
				([key, value]) =>
					`${key.replace(
						/[A-Z]/g,
						(letter) => `-${letter.toLowerCase()}`
					)}:${value};`
			)
			.join("");
	};

	for (const cmd of ntpCommands) {
		let plickCssProps = {};

		switch (cmd.type) {
			case "setStyles":
				if (cmd.align) currentStyleState.align = mapNtpAlignToPlick(cmd.align);
				if (cmd.style)
					currentStyleState.fontWeight = cmd.style.includes("B")
						? "bold"
						: "normal";
				if (cmd.size)
					currentStyleState.fontSize = mapNtpSizeToPlickFontSize(cmd.size);
				break;

			case "resetStyles":
				currentStyleState = {
					align: "left",
					fontWeight: "normal",
					fontSize: "1em",
				};
				break;

			case "align": // Standalone align command (often for images/barcodes)
				if (cmd.align) currentStyleState.align = mapNtpAlignToPlick(cmd.align);
				break;

			case "println":
				const textAlign = cmd.align
					? mapNtpAlignToPlick(cmd.align)
					: currentStyleState.align;
				const fontWeight =
					cmd.style && cmd.style.includes("B")
						? "bold"
						: currentStyleState.fontWeight;
				const fontSize = cmd.size
					? mapNtpSizeToPlickFontSize(cmd.size)
					: currentStyleState.fontSize;

				plickCssProps = {
					textAlign: textAlign,
					fontWeight: fontWeight,
					fontSize: fontSize,
				};

				plickCommands.push({
					type: "text",
					value: cmd.content || "",
					style: buildStyleString(plickCssProps),
				});
				break;

			case "feed":
				plickCommands.push({ type: "feed", lines: cmd.lines || 1 });
				break;

			case "cut":
				plickCommands.push({ type: "cut" });
				break;

			case "drawLine":
				plickCommands.push({
					type: "text",
					value: "-".repeat(paperCharWidth), // Or use cmd.character || '-'
					style: buildStyleString({
						textAlign: "center",
						fontFamily: "monospace",
					}),
				});
				break;

			case "image":
				plickCommands.push({
					type: "image",
					path: cmd.path,
					position: currentStyleState.align || "center", // Use current alignment for image position
					// width: '50px', // Optional: Plick might support width/height for images
					// height: '50px',
				});
				break;

			case "tableCustom":
				const plickTableData = {
					type: "table",
					headers: [], // Plick might want headers separate or treat first row as headers.
					tableRows: [],
					// Optional: style for the whole table container
					// style: 'width: 100%; border-collapse: collapse;',
					// Optional: array of styles for columns
					// columnStyles: []
				};

				const ntpColumns =
					cmd.options && cmd.options.columns ? cmd.options.columns : [];

				// Check if the first row of NTP data should be Plick headers
				// This is an assumption; adjust if Plick has a more explicit header definition
				if (cmd.data && cmd.data.length > 0) {
					// Let's treat all rows as tableRows for simplicity and style them per cell.
					// Plick's 'table' might also accept a 'headers' array directly.
					// If your first NTP row is always headers, you could populate plickTableData.headers here.
				}

				cmd.data.forEach((rowData, rowIndex) => {
					const plickRow = [];
					rowData.forEach((cellData, cellIndex) => {
						const colDef = ntpColumns[cellIndex] || {}; // Fallback to empty if not enough colDefs

						const cellCssProps = {
							// Default text align for table cells is often left
							textAlign: colDef.align
								? mapNtpAlignToPlick(colDef.align)
								: "left",
						};

						if (colDef.style && colDef.style.includes("B")) {
							cellCssProps.fontWeight = "bold";
						}
						if (colDef.size) {
							cellCssProps.fontSize = mapNtpSizeToPlickFontSize(colDef.size);
						}
						// Plick might take width as a percentage string or a fraction
						// Assuming Plick table cells can take { text, align, width, style }
						const plickCell = {
							text: String(cellData),
							align: cellCssProps.textAlign, // Plick might prefer align here
							style: buildStyleString(cellCssProps),
						};

						// Width: Plick's table might handle this in various ways
						// 1. As a property on the cell object: plickCell.width = `${(colDef.width || 0.1) * 100}%`;
						// 2. As part of columnStyles on the main table object
						// 3. Directly in the cell's style string: cellCssProps.width = `${(colDef.width || 0.1) * 100}%`;
						// Let's try adding to cell's style string for now.
						if (colDef.width) {
							// Ensure style string ends with ; if not empty before adding width
							let currentCellstyle = plickCell.style || "";
							if (currentCellstyle && !currentCellstyle.endsWith(";")) {
								currentCellstyle += ";";
							}
							plickCell.style = `${currentCellstyle}width: ${
								colDef.width * 100
							}%;`;
						}

						plickRow.push(plickCell);
					});
					plickTableData.tableRows.push(plickRow);
				});

				// If your first NTP row was actually a header, you could structure it like this:
				// if (plickTableData.tableRows.length > 0) {
				//     plickTableData.headers = plickTableData.tableRows.shift(); // Use first row as header
				// }

				plickCommands.push(plickTableData);
				break;

			default:
				console.warn(
					`[NTP to Plick] Unsupported command type: ${cmd.type}`,
					cmd
				);
		}
	}
	return plickCommands;
}
