// src/bridge-api.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
// Import necessary types and enums from node-thermal-printer
import {
	ThermalPrinter,
	PrinterTypes,
	CharacterSet,
	BreakLine, // For cut modes
	// Align and Style are NOT directly exported enums; use string literals or boolean methods.
} from "node-thermal-printer";

const API_PORT = process.env.API_PORT || 3030;

export function startApiServer(getDiscoveredPrinters) {
	const app = express();
	app.use(cors({ origin: "*" })); // Consider restricting origin for production environments
	app.use(bodyParser.json({ limit: "10mb" })); // Increased limit for potential base64 image data
	app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

	// Endpoint to list available printers
	app.get("/api/printers", (req, res) => {
		const printers = getDiscoveredPrinters();
		if (!printers) {
			console.warn(
				"API /api/printers: getDiscoveredPrinters() call returned null or undefined."
			);
			return res.status(500).json({
				error: "Printer list is currently unavailable from the main process.",
			});
		}
		// Map printer data to the format expected by the client
		res.json(
			printers.map((p) => ({
				id: p.id,
				name: p.name, // This name will be used by the client to specify the printer
				type: p.type,
				status: p.status,
				description: p.description,
				isDefault: p.isDefault,
			}))
		);
	});

	// Main endpoint to handle print jobs
	app.post("/api/print", async (req, res) => {
		const { printerName, printData, printerOptions } = req.body;

		if (!printerName) {
			return res
				.status(400)
				.json({ error: "Missing 'printerName' in the request body." });
		}
		if (!printData || !Array.isArray(printData)) {
			return res.status(400).json({
				error:
					"Missing or invalid 'printData'. It must be an array of command objects.",
			});
		}

		const printers = getDiscoveredPrinters();
		if (!printers) {
			console.error(
				"API /api/print: Failed to retrieve the discovered printers list from the main process."
			);
			return res.status(500).json({
				error:
					"Printer configuration is not available. Cannot proceed with printing.",
			});
		}

		// Find the target printer's configuration using the provided name (case-insensitive)
		const config = printers.find(
			(p) => p.name.toLowerCase() === printerName.toLowerCase()
		);

		if (!config) {
			console.warn(
				`API /api/print: Printer with name '${printerName}' was not found in the discovered list.`
			);
			return res.status(404).json({
				error: `Printer named '${printerName}' not found or has not been discovered.`,
			});
		}

		console.log(
			`API Print: Received print job for '${config.name}' (Type: ${config.type}, Identified by name: '${printerName}') with ${printData.length} command(s).`
		);

		let thermalPrinter; // Declare outside try to potentially use in finally
		try {
			let interfaceOpt;
			// Determine printer driver type (EPSON, STAR, etc.) from client options or use a default
			const printerDriverType =
				printerOptions &&
				printerOptions.type &&
				PrinterTypes[printerOptions.type.toUpperCase()]
					? PrinterTypes[printerOptions.type.toUpperCase()]
					: PrinterTypes.EPSON; // Default to EPSON if not specified
			// Determine character set from client options or use a default
			const charSet =
				printerOptions &&
				printerOptions.characterSet &&
				CharacterSet[printerOptions.characterSet.toUpperCase()]
					? CharacterSet[printerOptions.characterSet.toUpperCase()]
					: CharacterSet.UTF_8; // UTF_8 is a good default for international characters
			const timeout = printerOptions?.timeout || 5000; // Default connection/print timeout

			// Determine the connection interface based on the printer type from discovery
			if (config.type === "electron_os") {
				if (!config.osName)
					throw new Error(
						`Printer '${config.name}': Configuration error - 'osName' is missing for an Electron OS discovered printer.`
					);
				interfaceOpt = `printer:${config.osName}`;
			} else if (config.type === "lan_mdns") {
				if (!config.ip || !config.port)
					throw new Error(
						`Printer '${config.name}': Configuration error - 'ip' or 'port' is missing for an mDNS LAN discovered printer.`
					);
				interfaceOpt = `tcp://${config.ip}:${config.port}`;
			} else {
				// Fallback for unrecognized types - attempt to use its name as if it's an OS printer
				console.warn(
					`API Print: Printer '${config.name}' has an unrecognized type '${config.type}'. Attempting connection using its name as an OS printer ('printer:${config.name}').`
				);
				interfaceOpt = `printer:${config.name}`;
			}

			console.log(
				`API Print: Initializing ThermalPrinter instance. Interface: '${interfaceOpt}', Driver Type: '${printerDriverType}', CharSet: '${charSet}'`
			);
			thermalPrinter = new ThermalPrinter({
				type: printerDriverType,
				interface: interfaceOpt,
				characterSet: charSet,
				removeSpecialCharacters:
					printerOptions?.removeSpecialCharacters === true, // Defaults to false
				lineCharacter: printerOptions?.lineCharacter || "-", // Character for drawLine style LINE
				timeout: timeout,
			});

			// Helper function to reset text styles to printer defaults
			const resetToDefaultTextStyles = () => {
				thermalPrinter.align("LT"); // Default to Left Alignment
				thermalPrinter.setTextNormal(); // Resets font size to normal
				thermalPrinter.bold(false);
				thermalPrinter.underline(false); // Use boolean for simple underline
				thermalPrinter.underlineThick(false); // Specific method for thick underline
				thermalPrinter.invert(false);
			};

			// Apply any initial global alignment from client options
			if (printerOptions?.initialAlign) {
				thermalPrinter.align(printerOptions.initialAlign.toUpperCase());
			}

			// Process each command object in the printData array
			for (const cmd of printData) {
				// Reset styles before most commands to ensure clean state, unless cmd itself is a style setter
				if (
					cmd.type?.toLowerCase() !== "setstyles" &&
					cmd.type?.toLowerCase() !== "resetstyles"
				) {
					resetToDefaultTextStyles();
				}

				console.log(
					`API Print: Processing command - Type: ${
						cmd.type
					}, Details: ${JSON.stringify(cmd).substring(0, 100)}...`
				);

				// Standardize align value from command, default to Left
				const alignment = cmd.align ? cmd.align.toUpperCase() : "LT";

				switch (
					cmd.type?.toLowerCase() // Use toLowerCase for case-insensitivity
				) {
					case "text":
					case "println": // Allow 'println' as an alias for 'text'
						thermalPrinter.align(alignment);
						if (cmd.style) {
							// Expected format: 'B', 'U', 'U2', 'I' or combinations e.g. 'BU'
							if (cmd.style.includes("B")) thermalPrinter.bold(true);
							if (cmd.style.includes("U2")) thermalPrinter.underlineThick(true);
							else if (cmd.style.includes("U")) thermalPrinter.underline(true); // Simple underline
							if (cmd.style.includes("I")) thermalPrinter.invert(true);
						}
						if (cmd.size && Array.isArray(cmd.size) && cmd.size.length === 2) {
							// node-thermal-printer sizes are 0-7. If client sends 1-8 (1=normal), subtract 1.
							thermalPrinter.setTextSize(
								Math.max(0, cmd.size[0] - 1),
								Math.max(0, cmd.size[1] - 1)
							);
						}
						thermalPrinter.println(String(cmd.content || cmd.text || ""));
						break;

					case "feed":
						thermalPrinter.feed(parseInt(cmd.lines, 10) || 1); // Feed specified lines or 1 by default
						break;

					case "cut":
						thermalPrinter.cut(
							cmd.mode === "FULL" ? BreakLine.FULL : BreakLine.PART
						); // Default to partial cut
						break;

					case "beep":
						thermalPrinter.beep(
							parseInt(cmd.n, 10) || 1,
							parseInt(cmd.t, 10) || 100
						);
						break;

					case "align": // Explicit command to set alignment for subsequent operations
						if (cmd.align) thermalPrinter.align(cmd.align.toUpperCase());
						break;

					case "setstyles": // Apply styles without immediately printing text
						if (cmd.align) thermalPrinter.align(cmd.align.toUpperCase());
						if (cmd.style) {
							if (cmd.style.includes("B")) thermalPrinter.bold(true);
							if (cmd.style.includes("U2")) thermalPrinter.underlineThick(true);
							else if (cmd.style.includes("U")) thermalPrinter.underline(true);
							if (cmd.style.includes("I")) thermalPrinter.invert(true);
						}
						if (cmd.size && Array.isArray(cmd.size) && cmd.size.length === 2) {
							thermalPrinter.setTextSize(
								Math.max(0, cmd.size[0] - 1),
								Math.max(0, cmd.size[1] - 1)
							);
						}
						break;

					case "resetstyles": // Explicitly reset all text styles
						resetToDefaultTextStyles();
						break;

					case "barcode":
						thermalPrinter.align(alignment);
						thermalPrinter.printBarcode(
							String(cmd.content || cmd.value), // Barcode content
							parseInt(cmd.barcodeType, 10) || 73, // Default to CODE128_AUTO (value 73)
							{
								// Options
								height: parseInt(cmd.height, 10) || 50,
								width: parseInt(cmd.width, 10) || 2, // Bar width factor (usually 2-6)
								hriPos: parseInt(cmd.hriPos, 10) || 0, // HRI position (0=none, 1=above, 2=below, 3=both)
								hriFont: parseInt(cmd.hriFont, 10) || 0, // HRI font (0=FontA, 1=FontB)
								...(cmd.options || {}), // Allow any other valid options
							}
						);
						break;

					case "qr":
						thermalPrinter.align(alignment);
						await thermalPrinter.printQR(String(cmd.content || cmd.value), {
							cellSize: parseInt(cmd.cellSize, 10) || 3,
							correction: cmd.correction ? cmd.correction.toUpperCase() : "M", // L, M, Q, H
							model: parseInt(cmd.model, 10) || 2, // Model 1 or 2
						});
						break;

					case "image": // cmd.path = local filesystem path to the image
						thermalPrinter.align(alignment);
						if (cmd.path) {
							try {
								console.log(
									`API Print: Attempting to print image from path: ${cmd.path}`
								);
								await thermalPrinter.printImage(cmd.path);
							} catch (imgError) {
								console.error(
									"API Print: Error printing image from path:",
									cmd.path,
									imgError
								);
								thermalPrinter.println("[Error: Image could not be printed]");
							}
						} else {
							thermalPrinter.println("[Error: Image path not provided]");
						}
						break;

					case "imagebuffer": // cmd.buffer = base64 encoded image string
						thermalPrinter.align(alignment);
						if (cmd.buffer) {
							try {
								console.log(
									"API Print: Attempting to print image from base64 buffer."
								);
								await thermalPrinter.printImageBuffer(
									Buffer.from(cmd.buffer, "base64")
								);
							} catch (imgBuffError) {
								console.error(
									"API Print: Error printing image from buffer:",
									imgBuffError
								);
								thermalPrinter.println(
									"[Error: Image buffer could not be printed]"
								);
							}
						} else {
							thermalPrinter.println("[Error: Image buffer not provided]");
						}
						break;

					case "drawline":
						// Use lineCharacter from constructor for LINE, or specified symbols for others.
						// The BreakLine enum is mostly for 'cut' related operations.
						// drawLine uses the character set in constructor.
						thermalPrinter.drawLine(); // Uses constructor's lineCharacter
						break;

					case "raw": // cmd.content = hex string or Buffer object
						const bufferToSend = Buffer.isBuffer(cmd.content)
							? cmd.content
							: Buffer.from(String(cmd.content || ""), "hex");
						thermalPrinter.raw(bufferToSend);
						break;

					default:
						console.warn(
							`API Print: Unhandled or unknown command type '${cmd.type}'.`
						);
				}
			}

			resetToDefaultTextStyles(); // Final reset

			// Add a final cut if not explicitly requested by the printData commands
			if (!printData.some((cmd) => cmd.type?.toLowerCase() === "cut")) {
				console.log("API Print: Adding a final partial cut to the print job.");
				thermalPrinter.cut(BreakLine.PART);
			}

			// Send all buffered commands to the printer
			const executeResult = await thermalPrinter.execute();
			console.log(
				`API Print: thermalPrinter.execute() for '${config.name}' completed. Result:`,
				executeResult
			);

			if (!res.headersSent) {
				res.json({
					success: true,
					message: `Print job successfully sent to '${config.name}'.`,
				});
			}
		} catch (err) {
			console.error(
				`API Print: Error during print job processing for printer '${printerName}' (resolved to '${config.name}'): ${err.message}`,
				err.stack
			);
			if (!res.headersSent) {
				res
					.status(500)
					.json({ error: `Print failed for '${config.name}': ${err.message}` });
			}
		} finally {
			// Optional: If ThermalPrinter instance might be reused, clear its buffer.
			// For one-off prints like this, execute() sends and the instance is discarded, so clear() might not be essential.
			// if (thermalPrinter) {
			//     try { thermalPrinter.clear(); } catch (e) { console.error("API Print: Error in thermalPrinter.clear():", e); }
			// }
		}
	});

	// Start the Express server
	const server = app.listen(API_PORT, "0.0.0.0", () => {
		// Listen on all network interfaces
		console.log(
			`Bridge API Server (Electron getPrinters Mode) listening for connections.`
		);
		console.log(`  Local:            http://localhost:${API_PORT}`);
		console.log(
			`  On Your Network:  http://<your-local-ip>:${API_PORT} (approx)`
		);
	});

	server.on("error", (error) => {
		if (error.syscall !== "listen") {
			throw error;
		}
		const bind =
			typeof API_PORT === "string" ? "Pipe " + API_PORT : "Port " + API_PORT;
		switch (error.code) {
			case "EACCES":
				console.error(
					`API Server Critical Error: ${bind} requires elevated privileges or is blocked by a firewall.`
				);
				process.exit(1);
				break;
			case "EADDRINUSE":
				console.error(
					`API Server Critical Error: ${bind} is already in use by another application.`
				);
				process.exit(1);
				break;
			default:
				console.error(`API Server Critical Error: ${error.code}`, error);
				throw error;
		}
	});

	return server;
}
