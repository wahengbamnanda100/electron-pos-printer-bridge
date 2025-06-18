// src/formatters/ntpToHtmlFormatter.js
import fs from "fs/promises"; // To read image files for base64 conversion
import path from "path"; // To help determine image type from extension

/**
 * Converts an array of NTP-style command objects to an HTML string.
 * This function is asynchronous due to image file reading.
 *
 * @param {Array<object>} printDataArray - Array of NTP-style command objects.
 * @param {string} documentTitle - Title for the HTML document.
 * @param {boolean} isThermalLayout - If true, applies styles for an 80mm thermal receipt layout.
 * @returns {Promise<string>} - A promise that resolves with the HTML string.
 */
export async function commandsToSimpleHtml( // <<<<------ ASYNC FUNCTION
	printDataArray,
	documentTitle = "Print Document",
	isThermalLayout = true
) {
	let htmlBody = "";
	let currentGlobalAlignment = "left"; // For commands that set a global state

	for (const cmd of printDataArray) {
		// Use for...of to allow await inside the loop
		let textContent = String(cmd.content || cmd.text || cmd.value || "");

		// Styles for the wrapping <div> for each line/command
		let lineDivStyle = "";
		// Base styles for <pre> tags used for text content
		let preTagStyle =
			"margin:0; padding:0; white-space: pre-wrap; word-break: break-all;";

		let effectiveLineAlign = currentGlobalAlignment;
		const cmdAlignProp = cmd.align?.toLowerCase();

		if (cmdAlignProp === "ct" || cmdAlignProp === "center")
			effectiveLineAlign = "center";
		else if (cmdAlignProp === "rt" || cmdAlignProp === "right")
			effectiveLineAlign = "right";
		else if (cmdAlignProp === "lt" || cmdAlignProp === "left")
			effectiveLineAlign = "left";

		// 'align' command type specifically sets the global alignment for subsequent lines
		if (cmd.type?.toLowerCase() === "align" && cmdAlignProp) {
			currentGlobalAlignment = effectiveLineAlign;
		}

		lineDivStyle += `text-align: ${effectiveLineAlign};`; // Text alignment for the line's div

		let fontSize = isThermalLayout ? "10pt" : "1em";
		if (cmd.style) {
			if (cmd.style.includes("B")) lineDivStyle += "font-weight: 700;"; // Use numeric for bold
			if (cmd.style.includes("U"))
				lineDivStyle += "text-decoration: underline;";
		}

		if (cmd.size && Array.isArray(cmd.size)) {
			const widthFactor = cmd.size[0] || 1;
			const heightFactor = cmd.size[1] || 1;
			if (isThermalLayout) {
				if (widthFactor >= 2 || heightFactor >= 2) fontSize = "16pt"; // Approx double size
				if (widthFactor >= 3 || heightFactor >= 3) fontSize = "20pt"; // Approx triple size
			} else {
				// For wider, non-thermal layouts
				if (widthFactor >= 3 || heightFactor >= 3) fontSize = "2em";
				else if (widthFactor >= 2 || heightFactor >= 2) fontSize = "1.5em";
			}
		}
		lineDivStyle += `font-size: ${fontSize};`;
		lineDivStyle += `line-height: 1.2; margin: 0; padding: 0;`; // Minimal margin/padding for div lines

		let lineHtmlPart = ""; // HTML for the current command

		switch (cmd.type?.toLowerCase()) {
			case "text":
			case "println":
				lineHtmlPart = `<div style="${lineDivStyle}"><pre style="${preTagStyle}">${textContent}</pre></div>\n`;
				break;
			case "align":
				// This command only sets state (currentGlobalAlignment), no visible output itself.
				break;
			case "setstyles":
				if (cmd.align) {
					// If setStyles includes alignment, update global state
					const styleAlign = cmd.align.toLowerCase();
					if (styleAlign === "ct" || styleAlign === "center")
						currentGlobalAlignment = "center";
					else if (styleAlign === "rt" || styleAlign === "right")
						currentGlobalAlignment = "right";
					else if (styleAlign === "lt" || styleAlign === "left")
						currentGlobalAlignment = "left";
				}
				// Note: If setStyles is meant to make *subsequent* text bold without printing text itself,
				// this formatter currently doesn't have a global "isBold" state. Boldness is applied per command.
				break;
			case "resetstyles":
				currentGlobalAlignment = "left";
				// currentGlobalIsBold = false; // if you implement global bold state
				break;
			case "feed":
				const feedLines = parseInt(cmd.lines, 10) || 1;
				for (let i = 0; i < feedLines; i++) {
					lineHtmlPart += `<div style="text-align: ${effectiveLineAlign}; font-size: ${
						isThermalLayout ? "10pt" : "1em"
					}; height: ${isThermalLayout ? "1.2em" : "1em"};"> </div>\n`;
				}
				break;
			case "drawline":
				const lineChar = cmd.style === "DOUBLE" ? "=" : "-";
				const lineWidth = isThermalLayout ? 42 : 60; // Adjust character count for line
				lineHtmlPart = `<div style="text-align: center; font-size: ${
					isThermalLayout ? "10pt" : "1em"
				}; line-height: 1; margin: 2px 0;"><pre style="margin:0; padding:0; overflow: hidden;">${lineChar.repeat(
					lineWidth
				)}</pre></div>\n`;
				break;
			case "barcode":
				lineHtmlPart = `<div style="${lineDivStyle}">[BARCODE: ${textContent}]</div>\n`; // Placeholder
				break;
			case "qr":
				lineHtmlPart = `<div style="${lineDivStyle}">[QR CODE: ${textContent}]</div>\n`; // Placeholder
				break;
			case "tablecustom": // Very basic HTML table representation
				let tableHtml = `<div style="text-align: ${effectiveLineAlign}; font-size: ${
					isThermalLayout ? "9pt" : "0.9em"
				}; margin-bottom: 5px; ${lineDivStyle}">`; // Apply lineDivStyle here too
				if (cmd.data && Array.isArray(cmd.data)) {
					cmd.data.forEach((row) => {
						let rowString = "";
						if (Array.isArray(row)) {
							// Rudimentary column spacing - real tables are complex
							rowString = row.map((cell) => String(cell).padEnd(15)).join(" ");
						}
						tableHtml += `<pre style="margin:0; padding:0; white-space: pre-wrap; word-break: break-all; text-align: left;">${rowString.trim()}</pre>\n`;
					});
				}
				tableHtml += `</div>\n`;
				lineHtmlPart = tableHtml;
				break;
			case "image":
				if (cmd.path) {
					try {
						await fs.access(cmd.path); // Check if path is accessible
						const imageBuffer = await fs.readFile(cmd.path); // ASYNC
						const base64Image = imageBuffer.toString("base64");
						const ext = path.extname(cmd.path).toLowerCase();
						let mimeType = "image/png"; // Default
						if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
						else if (ext === ".gif") mimeType = "image/gif";
						else if (ext === ".bmp") mimeType = "image/bmp";
						// Add more common types if needed

						const imageStyle = isThermalLayout
							? "max-width: 68mm; max-height: 100px; display: block; margin-left: auto; margin-right: auto;"
							: "max-width: 100%; height: auto; display: block; margin-left: auto; margin-right: auto;";
						lineHtmlPart = `<div style="${lineDivStyle}"><img src="data:${mimeType};base64,${base64Image}" alt="Print Image" style="${imageStyle}" /></div>\n`;
					} catch (e) {
						console.error(
							`HTML Formatter: Error processing image path ${cmd.path}:`,
							e.message
						);
						lineHtmlPart = `<div style="${lineDivStyle}">[Image Error: ${cmd.path}]</div>\n`;
					}
				} else {
					lineHtmlPart = `<div style="${lineDivStyle}">[Image Path Missing]</div>\n`;
				}
				break;
			case "imagebuffer": // Assuming cmd.buffer is already a base64 string or a Buffer
				if (cmd.buffer) {
					let base64Image = "";
					if (Buffer.isBuffer(cmd.buffer)) {
						base64Image = cmd.buffer.toString("base64");
					} else if (typeof cmd.buffer === "string") {
						base64Image = cmd.buffer; // Assuming it's already base64
					} else {
						console.warn(
							"HTML Formatter: imageBuffer 'buffer' property is not a Buffer or string."
						);
						base64Image = ""; // Avoid errors
					}

					if (base64Image) {
						const mimeType = cmd.mimeType || "image/png"; // Expect mimeType to be passed or default
						const imageStyle = isThermalLayout
							? "max-width: 68mm; max-height: 100px; display: block; margin-left: auto; margin-right: auto;"
							: "max-width: 100%; height: auto; display: block; margin-left: auto; margin-right: auto;";
						lineHtmlPart = `<div style="${lineDivStyle}"><img src="data:${mimeType};base64,${base64Image}" alt="Print Image Buffer" style="${imageStyle}" /></div>\n`;
					} else {
						lineHtmlPart = `<div style="${lineDivStyle}">[Image Buffer Invalid]</div>\n`;
					}
				} else {
					lineHtmlPart = `<div style="${lineDivStyle}">[Image Buffer Missing]</div>\n`;
				}
				break;
			default:
				console.warn(
					`HTML Formatter: Unsupported command type '${cmd.type}'. Content: ${textContent}`
				);
				lineHtmlPart = `<div style="${lineDivStyle}">[Unsupported command: ${cmd.type}]</div>\n`;
				break;
		}
		htmlBody += lineHtmlPart;
	}

	const thermalStylesDefinition = isThermalLayout
		? `
        html, body { overflow-x: hidden; /* Prevent horizontal scrollbar with fixed width */ }
        body {
            font-family: 'Consolas', 'Menlo', 'Courier New', Courier, monospace;
            margin: 5mm;
            font-size: 10pt;
            background-color: #fff; /* Ensure white background for printing */
            width: 70mm; /* Approx 80mm paper width minus some margin */
            max-width: 70mm; /* Crucial for constraining width */
            box-sizing: border-box;
        }
        div { /* Base style for all our generated line divs */
            width: 100%; /* Make divs take full available width of the body */
            box-sizing: border-box;
            margin-bottom: 0; /* Reset default div margin if any, control via lineDivStyle */
            padding: 0;
        }
        pre {
            white-space: pre-wrap; /* Wrap text */
            word-break: break-all; /* Break long words if no spaces */
            margin: 0;
            padding: 0;
            line-height: 1.2;
        }
        img {
            object-fit: contain; /* Ensure image scales nicely within its bounds */
        }
    `
		: ` /* Styles for non-thermal (wider) layout */
        body { font-family:'Courier New',Courier,monospace; margin:10mm; font-size:10pt; }
        pre { white-space:pre-wrap; margin:0; padding:0; line-height:1.2; }
        div { margin-bottom:1px; line-height:1.2; } /* Default div styling for wider layouts */
        img { max-width: 100%; height: auto; display: block; margin: 5px 0; }
    `;

	return `<!DOCTYPE html><html><head><title>${documentTitle}</title><meta charset="UTF-8"><style>${thermalStylesDefinition}</style></head><body>${htmlBody}</body></html>`;
}
