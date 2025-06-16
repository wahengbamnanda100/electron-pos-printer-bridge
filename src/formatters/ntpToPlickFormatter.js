// Paste your mapNTPCommandsToPlickData function here
// Make sure to export it:
// export function mapNTPCommandsToPlickData(ntpCommands, printerOptions = {}) { ... }

export function mapNTPCommandsToPlickData(ntpCommands, printerOptions = {}) {
	const plickData = [];
	if (!Array.isArray(ntpCommands)) {
		console.error(
			"mapNTPCommandsToPlickData: input ntpCommands is not an array"
		);
		return [
			{
				type: "text",
				value: "[Error: Invalid template commands input - not an array]",
			},
		];
	}

	console.log(
		`mapNTPCommandsToPlickData: Converting ${ntpCommands.length} NTP commands to Plick format.`
	);

	let currentLineBuffer = ""; // Buffer for accumulating text from 'print' commands

	for (const cmd of ntpCommands) {
		if (!cmd || typeof cmd.type !== "string") {
			console.warn(
				"mapNTPCommandsToPlickData: Encountered invalid command object",
				cmd
			);
			plickData.push({
				type: "text",
				value: "[Error: Invalid command object in template]",
			});
			continue;
		}

		// Derive Plick style from NTP command properties
		let defaultTextAlign = "left";
		if (
			cmd.align?.toLowerCase() === "ct" ||
			cmd.align?.toLowerCase() === "center"
		)
			defaultTextAlign = "center";
		else if (
			cmd.align?.toLowerCase() === "rt" ||
			cmd.align?.toLowerCase() === "right"
		)
			defaultTextAlign = "right";

		const style = {
			fontWeight: cmd.style?.includes("B") ? "bold" : "normal",
			textDecoration: cmd.style?.includes("U") ? "underline" : "none",
			textAlign: defaultTextAlign,
			fontSize: "12px", // Default
		};

		if (cmd.size && Array.isArray(cmd.size) && cmd.size.length > 0) {
			const w = cmd.size[0] || 1;
			const h = cmd.size[1] || w;
			if (w >= 2 && h >= 2) style.fontSize = "22px";
			else if (h >= 2) style.fontSize = "20px";
			else if (w >= 2) style.fontSize = "15px";
		}

		switch (cmd.type?.toLowerCase()) {
			case "text":
			case "print":
				currentLineBuffer += String(cmd.content || cmd.text || cmd.value || "");
				break;

			case "println":
				if (currentLineBuffer) {
					plickData.push({
						type: "text",
						value:
							currentLineBuffer +
							String(cmd.content || cmd.text || cmd.value || ""),
						style: style,
					});
					currentLineBuffer = "";
				} else {
					plickData.push({
						type: "text",
						value: String(cmd.content || cmd.text || cmd.value || ""),
						style: style,
					});
				}
				break;

			case "feed":
				if (currentLineBuffer) {
					plickData.push({
						type: "text",
						value: currentLineBuffer,
						style: style,
					});
					currentLineBuffer = "";
				}
				const lines = parseInt(cmd.lines, 10) || 1;
				for (let i = 0; i < lines; i++) {
					plickData.push({
						type: "text",
						value: " ",
						style: { fontSize: "12px" },
					});
				}
				break;

			case "cut":
				if (currentLineBuffer) {
					plickData.push({
						type: "text",
						value: currentLineBuffer,
						style: style,
					});
					currentLineBuffer = "";
				}
				console.warn(
					"mapNTPCommandsToPlickData: 'cut' command has no direct Plick EPP data equivalent. Cutting is usually automatic or a print option."
				);
				break;

			case "setstyles":
			case "resetstyles":
			case "align":
				if (currentLineBuffer) {
					plickData.push({
						type: "text",
						value: currentLineBuffer,
						style: style,
					});
					currentLineBuffer = "";
				}
				console.log(
					`mapNTPCommandsToPlickData: NTP style command '${cmd.type}' encountered. Effect incorporated into element styles or handled by buffer flush.`
				);
				break;
			case "barcode":
			case "qr":
			case "image":
			case "imagebuffer":
			case "drawline":
			case "tablecustom":
			case "raw":
			default:
				if (currentLineBuffer) {
					plickData.push({
						type: "text",
						value: currentLineBuffer,
						style: style,
					});
					currentLineBuffer = "";
				}

				if (cmd.type?.toLowerCase() === "barcode") {
					plickData.push({
						type: "barCode",
						value: String(cmd.content || cmd.value),
						height: parseInt(cmd.height, 10) || 40,
						width: parseInt(cmd.width, 10) || 2,
						displayValue: cmd.hriPos !== undefined ? cmd.hriPos > 0 : true,
						position: style.textAlign,
					});
				} else if (cmd.type?.toLowerCase() === "qr") {
					plickData.push({
						type: "qrCode",
						value: String(cmd.content || cmd.value),
						height: (parseInt(cmd.cellSize, 10) || 3) * 20,
						width: (parseInt(cmd.cellSize, 10) || 3) * 20,
						position: style.textAlign,
						correctionLevel: ["L", "M", "Q", "H"].includes(
							String(cmd.correction).toUpperCase()
						)
							? String(cmd.correction).toUpperCase()
							: "M",
					});
				} else if (cmd.type?.toLowerCase() === "image") {
					if (cmd.path) {
						plickData.push({
							type: "image",
							path: cmd.path,
							position: style.textAlign,
						});
					} else {
						plickData.push({
							type: "text",
							value: "[Image path missing]",
							style: style,
						});
					}
				} else if (cmd.type?.toLowerCase() === "imagebuffer") {
					if (cmd.buffer) {
						const base64Image = Buffer.isBuffer(cmd.buffer)
							? cmd.buffer.toString("base64")
							: String(cmd.buffer);
						plickData.push({
							type: "image",
							url: `data:image/png;base64,${base64Image}`,
							position: style.textAlign,
						});
					} else {
						plickData.push({
							type: "text",
							value: "[Image buffer missing]",
							style: style,
						});
					}
				} else if (cmd.type?.toLowerCase() === "drawline") {
					plickData.push({ type: "divider" });
				} else if (cmd.type?.toLowerCase() === "tablecustom") {
					plickData.push({
						type: "text",
						value:
							"[NTP TableCustom complex: mapping to Plick Table TBD. Raw data attempt:]",
						style: { fontSize: "10px" },
					});
					if (cmd.data && Array.isArray(cmd.data)) {
						cmd.data.forEach((row) => {
							if (Array.isArray(row)) {
								plickData.push({
									type: "text",
									value: row.join(" | "),
									style: { fontSize: "10px", textAlign: "left" },
								});
							}
						});
					}
					console.warn(
						"mapNTPCommandsToPlickData: 'tablecustom' requires significant effort to map to Plick's table structure."
					);
				} else if (cmd.type?.toLowerCase() === "raw") {
					plickData.push({
						type: "text",
						value: "[RAW NTP command not supported by Plick EPP]",
						style: style,
					});
				} else {
					console.warn(
						`mapNTPCommandsToPlickData: Unhandled NTP command type '${cmd.type}' treated as block. Attempting to send as plain text.`
					);
					plickData.push({
						type: "text",
						value: `[Unsupported NTP command: ${
							cmd.type
						} - Content: ${JSON.stringify(
							cmd.content || cmd.text || cmd.value || ""
						)?.substring(0, 100)}]`,
						style: { fontSize: "10px", textAlign: "left" },
					});
				}
				break;
		}
	}

	if (currentLineBuffer) {
		plickData.push({
			type: "text",
			value: currentLineBuffer,
			style: { textAlign: "left", fontSize: "12px" },
		});
	}

	if (plickData.length === 0 && ntpCommands.length > 0) {
		console.warn(
			"mapNTPCommandsToPlickData: Resulting Plick data array is empty, though NTP commands were provided. This might indicate all commands were unhandled or only resulted in state changes."
		);
		plickData.push({
			type: "text",
			value:
				"[Warning: No Plick commands generated. Template might be empty or use only unmappable NTP types.]",
		});
	} else if (plickData.length === 0 && ntpCommands.length === 0) {
		plickData.push({
			type: "text",
			value: "[Info: Empty template processed.]",
		});
	}

	const validatedPlickData = [];
	for (let i = 0; i < plickData.length; i++) {
		if (plickData[i] && typeof plickData[i].type === "string") {
			validatedPlickData.push(plickData[i]);
		} else {
			console.error(
				"mapNTPCommandsToPlickData: Produced a non-object or object without 'type' at index",
				i,
				plickData[i]
			);
			validatedPlickData.push({
				type: "text",
				value: `[FATAL MAPPER ERROR: Invalid object created at index ${i}]`,
			});
		}
	}
	return validatedPlickData;
}
