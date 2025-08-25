// src/utils/thermalReceiptTemplate.js

export function generateGoCrispyInvoiceReceipt(data) {
	const {
		logo,
		storeName,
		orderType,
		currentdate,
		invoiceDate,
		invoiceTime,
		billNo,
		pax,
		kotNo,
		deliveryDateTime,
		staffName,
		customerName,
		customerMobile,
		items,
		grossAmount,
		discountAmountTotal,
		deliveryCharge,
		netAmount,
		paidAmount,
		balanceAmount,
		settlements,
		deliveryAddress,
		commentsLabel,
		signLabel,
		thankYouMessage,
		close,
	} = data;

	// Base styles
	const baseFont = {
		fontFamily: "Arial, sans-serif",
		fontSize: "12px",
	};

	const arabicFont = {
		fontFamily: "Tahoma, Arial, sans-serif",
		fontSize: "12px",
		direction: "rtl",
		textAlign: "right",
	};

	// Helper functions
	const makeLine = (char = "-") => char.repeat(63);

	const createBilingualText = (englishText, arabicText, style = {}) => ({
		type: "text",
		value: `${englishText}\n${arabicText}`,
		style: {
			...baseFont,
			whiteSpace: "pre-line",
			...style,
		},
	});

	const createArabicText = (text, style = {}) => ({
		type: "text",
		value: text,
		style: {
			...arabicFont,
			...style,
		},
	});

	const receipt = [];

	// ===== HEADER SECTION =====
	if (logo) {
		receipt.push({
			type: "image",
			url: logo,
			position: "center",
			width: "80px",
			height: "80px",
		});
	}

	if (storeName) {
		receipt.push({
			type: "text",
			value: storeName,
			style: {
				...baseFont,
				fontWeight: "bold",
				fontSize: "14px",
				textAlign: "center",
			},
		});
	}

	// Arabic restaurant name
	receipt.push(
		createArabicText("الوجبة", {
			fontSize: "12px",
			textAlign: "center",
		})
	);

	receipt.push({
		type: "text",
		value: "Tel : : تليفون",
		style: { ...baseFont, textAlign: "center", whiteSpace: "pre-line" },
	});

	receipt.push({
		type: "text",
		value: "Fax : : فاكس",
		style: { ...baseFont, textAlign: "center", whiteSpace: "pre-line" },
	});

	receipt.push({
		type: "text",
		value: makeLine(),
		style: baseFont,
	});

	// ===== INVOICE DETAILS SECTION =====
	const invoiceDetailsTable = [
		[
			{
				type: "text",
				value: `Date : ${invoiceDate}`,
				style: { textAlign: "left" },
			},
			{
				type: "text",
				value: `Time : ${invoiceTime}`,
				style: { textAlign: "right" },
			},
		],
		[
			{
				type: "text",
				value: `Bill No : ${billNo}`,
				style: { textAlign: "left" },
			},
			{
				type: "text",
				value: `Pax : ${pax || ""}`,
				style: { textAlign: "right" },
			},
		],
		[
			{
				type: "text",
				value: `KOT No : `,
				style: {
					textAlign: "left",
					fontWeight: "bold",
					borderTop: "1px solid black",
					borderBottom: "1px solid black",
				},
			},
			{
				type: "text",
				value: kotNo || "",
				style: {
					textAlign: "left",
					fontWeight: "bold",
					borderTop: "1px solid black",
					borderBottom: "1px solid black",
				},
			},
		],
		[
			{
				type: "text",
				value: "Delivery Date/Time :",
				style: { textAlign: "left" },
			},
			{
				type: "text",
				value: deliveryDateTime || "",
				style: { textAlign: "left" },
			},
		],
		[
			{ type: "text", value: `Staff :`, style: { textAlign: "left" } },
			{ type: "text", value: staffName || "", style: { textAlign: "left" } },
		],
	].filter((row) => row.length);

	receipt.push({
		type: "table",
		style: { ...baseFont, fontSize: "10px" },
		tableHeader: [],
		tableBody: invoiceDetailsTable,
		tableFooter: [],
		tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableBodyStyle: { textAlign: "left" },
		tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableHeaderCellStyle: { padding: "2px 2px" },
		tableBodyCellStyle: { padding: "2px", textAlign: "left" },
		tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
	});

	receipt.push({
		type: "text",
		value: makeLine(),
		style: baseFont,
	});

	// ===== CUSTOMER DETAILS SECTION =====
	const customerTableBody = [];

	if (customerName) {
		customerTableBody.push([`Customer Name : ${customerName}`]);
	}

	if (customerMobile) {
		customerTableBody.push([`Mobile Number : ${customerMobile}`]);
	}

	if (deliveryAddress?.length > 0) {
		deliveryAddress
			.split(",")
			.forEach((line) => customerTableBody.push([line.trim()]));
	}

	if (customerTableBody.length > 0) {
		receipt.push({
			type: "table",
			style: { ...baseFont, fontSize: "12px" },
			tableHeader: [],
			tableBody: customerTableBody,
			tableFooter: [],
			tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableBodyStyle: {},
			tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableHeaderCellStyle: { padding: "2px 2px" },
			tableBodyCellStyle: { padding: "2px", textAlign: "left" },
			tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
		});

		receipt.push({
			type: "text",
			value: makeLine(),
			style: baseFont,
		});
	}

	// Order type header
	receipt.push({
		type: "text",
		value: `*** ${orderType} ***`,
		style: {
			...baseFont,
			textAlign: "center",
			fontWeight: "bold",
			width: "100%",
			padding: "4px",
		},
	});

	// ===== ITEMS TABLE SECTION (MODIFIED) =====
	const itemTableBody = items.flatMap((item) => {
		const rows = [];

		const mainItemRow = [
			{
				type: "text",
				value: item.nameAr ? `${item.name}\n${item.nameAr}` : item.name,
				style: {
					textAlign: "left",
					whiteSpace: "pre-line",
					...(item.nameAr && { direction: "ltr" }),
				},
			},
			{
				type: "text",
				value: item.qty || "1",
				style: { textAlign: "right" },
			},
			{
				type: "text",
				value: parseFloat(item.amount || "0").toFixed(2),
				style: { textAlign: "right" },
			},
		];
		rows.push(mainItemRow);

		// Add subitems if they exist, using padding for indentation
		if (item.subitems?.length) {
			item.subitems.forEach((sub) => {
				rows.push([
					{
						type: "text",
						value: sub.nameAr
							? `-- ${sub.name}\n-- ${sub.nameAr}`
							: `-- ${sub.name}`,
						style: {
							textAlign: "left",
							whiteSpace: "pre-line",
							paddingLeft: "15px", // Indentation with padding
							...(sub.nameAr && { direction: "ltr" }),
						},
					},
					{
						type: "text",
						value: sub.qty || "1",
						style: { textAlign: "right" },
					},
					{
						type: "text",
						value: parseFloat(sub.amount || "0").toFixed(2),
						style: { textAlign: "right" },
					},
				]);
			});
		}

		// Add a separator line after each main item block
		rows.push([
			{
				type: "text",
				value: "-".repeat(40),
				style: { textAlign: "center" },
				colspan: 3, // Make the cell span all 3 columns
			},
		]);

		return rows;
	});

	receipt.push({
		type: "table",
		style: { fontFamily: "Tahoma, Arial, sans-serif", fontSize: "12px" },
		tableHeader: [
			{ type: "text", value: "Menu", style: { textAlign: "left" } },
			{ type: "text", value: "Qty", style: { textAlign: "left" } },
			{ type: "text", value: "Amount(QAR)", style: { textAlign: "left" } },
		],
		tableBody: itemTableBody,
		tableFooter: [],
		tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableBodyStyle: {},
		tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableHeaderCellStyle: { padding: "2px 2px" },
		tableBodyCellStyle: { padding: "2px", textAlign: "left" },
		tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
	});

	receipt.push({
		type: "text",
		value: makeLine(),
		style: baseFont,
	});

	// ===== TOTALS SECTION =====
	const createTotalRow = (englishLabel, arabicLabel, amount) => [
		{
			type: "text",
			value: `${englishLabel}\n${arabicLabel}`,
			style: {
				textAlign: "right",
				fontWeight: "bold",
				whiteSpace: "pre-line",
				direction: "ltr",
			},
		},
		{
			type: "text",
			value: parseFloat(amount).toFixed(2),
			style: { textAlign: "right", fontWeight: "bold" },
		},
	];

	const totalTable = [
		createTotalRow("Gross Amount", "إجمالي المبلغ", grossAmount),
		createTotalRow("Discount", "خصم", discountAmountTotal || "0"),
		createTotalRow("Balance", "الرصيد المتبقي", balanceAmount),
		createTotalRow("Delivery Charge", "رسوم التوصيل", deliveryCharge),
		createTotalRow("Net Amount", "صافي المبلغ", netAmount),
	];

	receipt.push({
		type: "table",
		style: { fontFamily: "Tahoma, Arial, sans-serif", fontSize: "12px" },
		tableHeader: [],
		tableBody: totalTable,
		tableFooter: [
			[
				{
					type: "text",
					value: "Paid Amount :\nالمبلغ المدفوع :",
					style: {
						textAlign: "right",
						fontWeight: "bold",
						whiteSpace: "pre-line",
						direction: "ltr",
					},
				},
				{
					type: "text",
					value: `${paidAmount}`,
					style: { textAlign: "right", fontWeight: "bold" },
				},
			],
		],
		tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableBodyStyle: {},
		tableFooterStyle: {
			backgroundColor: "#ffffffff",
			borderTop: "1px solid black",
			color: "black",
		},
		tableHeaderCellStyle: { padding: "2px 2px" },
		tableBodyCellStyle: {
			padding: "2px",
			textAlign: "left",
			fontWeight: "bold",
		},
		tableFooterCellStyle: {
			padding: "5px 2px",
			fontWeight: "bold",
			borderTop: "1px solid black",
		},
	});

	receipt.push({
		type: "text",
		value: makeLine(),
		style: baseFont,
	});

	// ===== SETTLEMENT DETAILS SECTION =====
	if (settlements?.length) {
		receipt.push(
			createBilingualText("SETTLEMENT DETAILS", "تفاصيل التسوية", {
				fontWeight: "bold",
				textAlign: "center",
				marginBottom: "4px",
			})
		);

		const getPaymentMethodArabic = (method) => {
			const translations = {
				cash: "نقدي",
				card: "بطاقة ائتمان",
				"credit card": "بطاقة ائتمان",
				voucher: "قسيمة",
				staff: "موظف",
				default: "دفع",
			};
			return translations[method.toLowerCase()] || translations["default"];
		};

		const settlementTableBody = settlements.map((settlement) => [
			{
				type: "text",
				value: `${settlement.method}\n${getPaymentMethodArabic(
					settlement.method
				)}`,
				style: {
					textAlign: "left",
					whiteSpace: "pre-line",
					direction: "ltr",
				},
			},
			{
				type: "text",
				value: parseFloat(settlement.amount).toFixed(2),
				style: { textAlign: "right" },
			},
		]);

		receipt.push({
			type: "table",
			style: { ...baseFont, fontSize: "10px" },
			tableHeader: [],
			tableBody: settlementTableBody,
			tableFooter: [],
			tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableBodyStyle: {},
			tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableHeaderCellStyle: { padding: "2px 2px" },
			tableBodyCellStyle: { padding: "2px", textAlign: "left" },
			tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
		});
	}

	receipt.push({
		type: "text",
		value: makeLine(),
		style: baseFont,
	});

	// ===== FOOTER SECTION =====
	if (thankYouMessage) {
		receipt.push({
			type: "text",
			value: thankYouMessage,
			style: {
				...baseFont,
				textAlign: "center",
				fontWeight: "bold",
				fontSize: "10px",
			},
		});
	}

	if (commentsLabel) {
		receipt.push({
			type: "text",
			value: commentsLabel,
			style: {
				...baseFont,
				fontSize: "10px",
				marginTop: "10px",
			},
		});
	}

	if (signLabel) {
		receipt.push({
			type: "text",
			value: signLabel,
			style: {
				...baseFont,
				fontSize: "10px",
				marginTop: "5px",
			},
		});
	}

	if (close) {
		receipt.push({
			type: "text",
			value: `*** ${close} ***`,
			style: {
				...baseFont,
				textAlign: "center",
				fontWeight: "bold",
				fontSize: "10px",
				marginTop: "10px",
			},
		});
	}

	if (currentdate) {
		receipt.push({
			type: "text",
			value: currentdate,
			style: {
				...baseFont,
				textAlign: "center",
				fontSize: "10px",
				marginTop: "5px",
			},
		});
	}

	// Printer control commands
	receipt.push({
		type: "raw",
		value: Buffer.from([0x0a, 0x0a, 0x0a, 0x0a]),
	});

	receipt.push({
		type: "raw",
		value: Buffer.from([0x1d, 0x56, 0x00]),
	});

	return receipt;
}
