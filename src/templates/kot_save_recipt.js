/**
 * Enhanced Kitchen Order Ticket Generator for Plick Electron Thermal Printer
 * Optimized for thermal printing with improved structure and performance
 *
 * @param {Object} data - The order data
 * @param {string} [data.storeName] - Store name
 * @param {string} [data.orderType] - Order type (TAKEAWAY, DINE-IN, etc.)
 * @param {string} [data.customerName] - Customer name
 * @param {string} [data.customerMobile] - Customer mobile number
 * @param {string} [data.deliveryTime] - Delivery time
 * @param {string} [data.orderNumber] - Order number
 * @param {string} [data.orderDate] - Order date
 * @param {string} [data.orderTime] - Order time
 * @param {number} [data.pax] - Number of people
 * @param {string} [data.followUpStatus] - Follow up status
 * @param {Array} [data.items] - Order items array
 * @param {string} [data.servedBy] - Server name
 * @param {string} [data.notes] - Order notes
 * @param {string} [data.fontFamily] - Font family for printing
 * @returns {Array} Array of print command objects
 */
export function generateTwKitchenTakeawayTicket(data = {}) {
	// Configuration constants
	const CONFIG = {
		paperCharWidth: 42,
		defaultFont: "Tahoma, Arial, sans-serif",
		separator: "---------------------------------------------",
		indentSize: 4,
		thermalCommands: {
			partialCut: "\x1d\x56\x01",
			fullCut: "\x1d\x56\x00",
			bold: "\x1b\x45\x01",
			normal: "\x1b\x45\x00",
			center: "\x1b\x61\x01",
			left: "\x1b\x61\x00",
		},
	};

	/**
	 * Safe value extraction with defaults
	 * @param {*} value - Value to extract
	 * @param {string} defaultValue - Default value if null/undefined
	 * @returns {string} Safe string value
	 */
	const safeValue = (value, defaultValue = "") => {
		return value !== undefined && value !== null
			? String(value).trim()
			: defaultValue;
	};

	/**
	 * Format date for thermal printer
	 * @param {string} date - Input date
	 * @returns {string} Formatted date
	 */
	const formatDate = (date) => {
		if (!date) {
			return new Date()
				.toLocaleDateString("en-GB", {
					day: "2-digit",
					month: "short",
					year: "numeric",
				})
				.replace(/ /g, "-");
		}
		return safeValue(date);
	};

	/**
	 * Format time for thermal printer
	 * @param {string} time - Input time
	 * @returns {string} Formatted time
	 */
	const formatTime = (time) => {
		if (!time) {
			return new Date().toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			});
		}
		return safeValue(time);
	};

	/**
	 * Create a text command object
	 * @param {string} value - Text value
	 * @param {Object} style - Style object
	 * @returns {Object} Text command
	 */
	const createTextCommand = (value, style = {}) => {
		return {
			type: "text",
			value: safeValue(value),
			style: {
				fontFamily: CONFIG.defaultFont,
				...style,
			},
		};
	};

	/**
	 * Create separator line
	 * @returns {Object} Separator command
	 */
	const createSeparator = () => {
		return createTextCommand(CONFIG.separator);
	};

	const getLastNChars = (str, n) => {
		if (typeof str !== "string") return "";
		if (n <= 0) return "";
		return str.slice(-n);
	};

	/**
	 * Generate header section
	 * @param {Object} data - Order data
	 * @returns {Array} Header commands
	 */
	const generateHeader = (data) => {
		const commands = [];
		const fontFamily = safeValue(data.fontFamily, CONFIG.defaultFont);

		// Store name
		commands.push(
			createTextCommand(safeValue(data.storeName, "TW KITCHEN"), {
				fontFamily,
				fontWeight: "bold",
				fontSize: "14px",
				textAlign: "center",
			})
		);

		// Order type
		commands.push(
			createTextCommand(
				`*** ${safeValue(data.orderType, "TAKEAWAY").toUpperCase()} ***`,
				{
					fontFamily,
					fontWeight: "bold",
					textAlign: "center",
				}
			)
		);

		commands.push(
			createTextCommand(getLastNChars(data.orderNumber, 5), {
				fontFamily,
				fontWeight: "bold",
				fontSize: "16px",
				textAlign: "center",
			})
		);

		// Customer info (only if provided)
		const customerInfo = [
			{ label: "Customer", value: data.customerName },
			{ label: "Invoice Type", value: data.orderType },
			{ label: "Mobile No", value: data.customerMobile },
			{ label: "Delivery Time", value: data.deliveryTime },
		];

		customerInfo.forEach(({ label, value }) => {
			commands.push(
				createTextCommand(`${label} : ${safeValue(value)}`, { fontFamily })
			);
		});

		return commands;
	};

	/**
	 * Generate order number section
	 * @param {Object} data - Order data
	 * @returns {Array} Order number commands
	 */
	const generateOrderNumber = (data) => {
		const commands = [];
		const fontFamily = safeValue(data.fontFamily, CONFIG.defaultFont);

		commands.push({ type: "divider" });
		commands.push(
			createTextCommand(`No# : ${safeValue(data.orderNumber, "N/A")}`, {
				fontFamily,
				fontWeight: "bold",
				fontSize: "16px",
				textAlign: "center",
			})
		);
		// commands.push(createSeparator());
		commands.push({ type: "divider" });

		return commands;
	};

	/**
	 * Generate date/time and pax section
	 * @param {Object} data - Order data
	 * @returns {Array} DateTime commands
	 */
	const generateDateTime = (data) => {
		const commands = [];
		const fontFamily = safeValue(data.fontFamily, CONFIG.defaultFont);

		const orderDate = formatDate(data.orderDate);
		const orderTime = formatTime(data.orderTime);
		const paxInfo = data.pax
			? `Pax : ${parseFloat(safeValue(data.pax, 0)).toFixed(0)}`
			: "";

		const leftCol = `Date : ${orderDate} ${orderTime}`;
		const rightCol = paxInfo;
		const spaceCount = Math.max(
			1,
			CONFIG.paperCharWidth - leftCol.length - rightCol.length
		);

		commands.push(
			createTextCommand(`${leftCol}${" ".repeat(spaceCount)}${rightCol}`, {
				fontFamily,
			})
		);

		// Follow-up status (if provided)
		if (data.followUpStatus && safeValue(data.followUpStatus).trim()) {
			commands.push(
				createTextCommand(safeValue(data.followUpStatus), {
					fontFamily,
					fontWeight: "bold",
					textAlign: "center",
				})
			);
		}

		return commands;
	};

	/**
	 * Build table rows recursively for nested items
	 * @param {Object} item - Order item
	 * @param {number} indentLevel - Current indent level
	 * @returns {Array} Table rows
	 */
	const buildTableRows = (item, indentLevel = 0, subItem = false) => {
		const rows = [];
		const isCategory =
			item.isCategory || (!item.hasOwnProperty("qty") && item.name);

		if (isCategory) {
			// Category header row
			rows.push([
				{
					type: "text",
					value: safeValue(item.name).toUpperCase(),
					style: {
						fontWeight: subItem ? "light" : "bold",
						paddingTop: "4px",
						textAlign: "left",
					},
					colspan: 2,
				},
			]);
		} else {
			// Regular item row
			const indent = " ".repeat(indentLevel * CONFIG.indentSize);
			const namePrefix = indentLevel > 0 ? `${indent}- ` : indent;

			rows.push([
				{
					type: "text",
					value: safeValue(item.qty, "0"),
					style: {
						fontWeight: "bold",
						fontSize: "14px",
						textAlign: "left",
					},
				},
				{
					type: "text",
					value: `${namePrefix}${safeValue(item.name)}`,
					style: {
						fontWeight: "bold",
						fontSize: "14px",
						textAlign: "left",
					},
				},
			]);

			// Item notes (if any)
			if (item.notes && safeValue(item.notes).trim()) {
				rows.push([
					{
						type: "text",
						value: "",
						style: { textAlign: "left" },
					},
					{
						type: "text",
						value: `${indent}(${safeValue(item.notes)})`,
						style: {
							fontSize: "12px",
							fontStyle: "italic",
							textAlign: "left",
						},
					},
				]);
			}
		}

		// Process sub-items recursively
		if (
			item.subItems &&
			Array.isArray(item.subItems) &&
			item.subItems.length > 0
		) {
			item.subItems.forEach((subItem) => {
				rows.push(...buildTableRows(subItem, indentLevel + 1, true));
			});
		}

		return rows;
	};

	/**
	 * Generate items table
	 * @param {Object} data - Order data
	 * @returns {Array} Table commands
	 */
	const generateItemsTable = (data) => {
		if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
			return [];
		}

		const fontFamily = safeValue(data.fontFamily, CONFIG.defaultFont);
		const tableBody = [];

		// Process all items
		data.items.forEach((item) => {
			tableBody.push(...buildTableRows(item));
		});

		if (tableBody.length === 0) {
			return [];
		}

		return [
			{
				type: "table",
				style: {
					fontFamily,
					fontSize: "12px",
				},
				tableHeader: [
					{
						type: "text",
						value: "Qty",
						style: { textAlign: "left", fontWeight: "bold" },
					},
					{
						type: "text",
						value: "Menu",
						style: { textAlign: "left", fontWeight: "bold" },
					},
				],
				tableBody,
				tableFooter: [],
				tableHeaderStyle: {
					backgroundColor: "#ffffff",
					color: "#000000",
				},
				tableBodyStyle: {},
				tableFooterStyle: {
					backgroundColor: "#ffffff",
					color: "#000000",
				},
				tableHeaderCellStyle: {
					padding: "2px 2px",
					borderBottom: "1px solid #ccc",
				},
				tableBodyCellStyle: {
					padding: "4px 2px",
					borderBottom: "1px dash black",
				},
				tableFooterCellStyle: {
					// padding: "5px 2px",
					// fontWeight: "400",
				},
			},
		];
	};

	/**
	 * Generate footer section
	 * @param {Object} data - Order data
	 * @returns {Array} Footer commands
	 */
	const generateFooter = (data) => {
		const commands = [];
		const fontFamily = safeValue(data.fontFamily, CONFIG.defaultFont);

		// Served by information
		if (data.servedBy && safeValue(data.servedBy).trim()) {
			commands.push(
				createTextCommand(`Served By : ${safeValue(data.servedBy)}`, {
					fontFamily,
					fontWeight: "bold",
					marginTop: "5px",
				})
			);
		}

		// Order notes
		const notes = safeValue(data.notes).trim();
		// if (notes) {
		// commands.push(createSeparator());
		commands.push({ type: "divider" });
		commands.push(
			createTextCommand("Notes :", {
				fontFamily,
				fontWeight: "bold",
			})
		);
		commands.push(
			createTextCommand(notes, {
				fontFamily,
				fontWeight: "bold",
				fontSize: "14px",
				width: "100%",
				wordWrap: "break-word",
				whiteSpace: "normal",
			})
		);
		// }

		// Final separator and cut command
		// commands.push(createSeparator());
		commands.push({ type: "divider", style: { marginBottom: "4px" } });
		// commands.push(
		// 	createTextCommand("", { textAlign: "center", marginBottom: "4px" })
		// );
		// commands.push({
		// 	type: "text",
		// 	value: CONFIG.thermalCommands.partialCut,
		// });

		return commands;
	};

	// Main function logic - Generate complete kitchen ticket
	try {
		const receipt = [
			...generateHeader(data),
			...generateOrderNumber(data),
			...generateDateTime(data),
			...generateItemsTable(data),
			...generateFooter(data),
		];

		return receipt;
	} catch (error) {
		console.error("Error generating kitchen ticket:", error);
		return [
			{
				type: "text",
				value: "Error generating ticket",
				style: { textAlign: "center", color: "red" },
			},
		];
	}
}

export default generateTwKitchenTakeawayTicket;
