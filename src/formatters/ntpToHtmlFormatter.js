// Paste your commandsToSimpleHtml function here
// Make sure to export it:
// export function commandsToSimpleHtml(printDataArray, documentTitle = "Print Document") { ... }
export function commandsToSimpleHtml(
	printDataArray,
	documentTitle = "Print Document"
) {
	let htmlBody = "";
	let currentAlignment = "left";

	printDataArray.forEach((cmd) => {
		let textContent = String(cmd.content || cmd.text || cmd.value || "");
		let styleString = "";
		let tag = "div";

		const cmdAlign = cmd.align?.toLowerCase();
		if (cmd.type?.toLowerCase() === "align" && cmdAlign) {
			currentAlignment =
				cmdAlign === "ct" || cmdAlign === "center"
					? "center"
					: cmdAlign === "rt" || cmdAlign === "right"
					? "right"
					: "left";
		}
		let effectiveAlign = cmd.align
			? cmd.align.toLowerCase() === "ct" || cmd.align.toLowerCase() === "center"
				? "center"
				: cmd.align.toLowerCase() === "rt" ||
				  cmd.align.toLowerCase() === "right"
				? "right"
				: "left"
			: currentAlignment;
		styleString += `text-align: ${effectiveAlign};`;

		if (cmd.style) {
			if (cmd.style.includes("B")) styleString += "font-weight: bold;";
			if (cmd.style.includes("U")) styleString += "text-decoration: underline;";
		}
		if (cmd.size && Array.isArray(cmd.size)) {
			const widthFactor = cmd.size[0] || 1;
			const heightFactor = cmd.size[1] || 1;
			if (widthFactor >= 3 || heightFactor >= 3)
				styleString += "font-size: 2em; line-height:1.1; margin-bottom: 0.1em;";
			else if (widthFactor >= 2 || heightFactor >= 2)
				styleString +=
					"font-size: 1.5em; line-height:1.1; margin-bottom: 0.05em;";
			else styleString += "font-size: 1em;";
		} else {
			styleString += "font-size: 1em;";
		}

		switch (cmd.type?.toLowerCase()) {
			case "text":
			case "println":
				htmlBody += `<${tag} style="${styleString}"><pre>${textContent}</pre></${tag}>\n`;
				break;
			case "setstyles":
				if (cmd.align) currentAlignment = cmd.align.toLowerCase();
				break;
			case "resetstyles":
				currentAlignment = "left";
				break;
			case "feed":
				htmlBody += "<br>".repeat(parseInt(cmd.lines, 10) || 1);
				break;
			case "drawline":
				htmlBody +=
					'<hr style="border:none; border-top: 1px dashed #555; margin: 8px 0;">\n';
				break;
			case "barcode":
				htmlBody += `<div style="${styleString}">[BARCODE: ${textContent}]</div>\n`;
				break;
			case "qr":
				htmlBody += `<div style="${styleString}">[QR CODE: ${textContent}]</div>\n`;
				break;
			case "tablecustom":
				htmlBody +=
					'<table border="0" style="width:100%; border-collapse: collapse; margin-bottom: 10px; font-size: 0.9em;"><tbody>';
				if (cmd.data && Array.isArray(cmd.data)) {
					cmd.data.forEach((row) => {
						htmlBody += "<tr>";
						row.forEach((cell, cellIndex) => {
							let cellHtmlStyle = "padding: 1px 2px; border: none;";
							if (cmd.options?.columns?.[cellIndex]) {
								const colOpt = cmd.options.columns[cellIndex];
								if (colOpt.align === "RIGHT")
									cellHtmlStyle += "text-align:right;";
								else if (colOpt.align === "CENTER")
									cellHtmlStyle += "text-align:center;";
								else cellHtmlStyle += "text-align:left;";
								if (colOpt.style?.includes("B"))
									cellHtmlStyle += "font-weight:bold;";
								if (colOpt.size?.[1] >= 2) cellHtmlStyle += "font-size:1.4em;";
							}
							htmlBody += `<td style="${cellHtmlStyle}">${String(cell)}</td>`;
						});
						htmlBody += "</tr>";
					});
				}
				htmlBody += "</tbody></table>\n";
				break;
		}
	});
	return `<!DOCTYPE html><html><head><title>${documentTitle}</title><meta charset="UTF-8"><style>body{font-family:'Courier New',Courier,monospace;margin:10mm;font-size:10pt}pre{white-space:pre-wrap;margin:0;padding:0;line-height:1.2}div{margin-bottom:1px;line-height:1.2}table,th,td{border:none!important}</style></head><body>${htmlBody}</body></html>`;
}
