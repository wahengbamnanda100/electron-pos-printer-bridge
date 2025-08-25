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

	const baseFont = {
		fontFamily: "Arial, sans-serif",
		fontSize: "12px",
	};

	const makeLine = (char = "-") => char.repeat(61);

	const receipt = [];

	// ===== HEADER =====
	if (logo) {
		receipt.push({
			type: "image",
			url: logo,
			position: "center", // position of image: 'left' | 'center' | 'right'
			width: "80px", // width of image in px; default: auto
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

	receipt.push({
		type: "text",
		value: "الوجبة",
		style: { ...baseFont, fontSize: "12px", textAlign: "center" },
	});
	receipt.push({
		type: "text",
		value: "Tel : تليفون",
		style: { ...baseFont, fontSize: "10px", textAlign: "center" },
	});
	receipt.push({
		type: "text",
		value: "Fax : فاكس",
		style: { ...baseFont, fontSize: "10px", textAlign: "center" },
	});
	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== INVOICE DETAILS =====
	receipt.push({
		type: "table",
		style: { ...baseFont, fontSize: "10px" },
		tableHeader: [],
		tableBody: [
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
				{
					type: "text",
					value: `Staff :`,
					style: { textAlign: "left" },
				},
				{
					type: "text",
					value: staffName || "",
					style: { textAlign: "left" },
				},
			],
		].filter((r) => r.length),
		tableFooter: [],
		tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableBodyStyle: { textAlign: "left" },
		tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableHeaderCellStyle: { padding: "2px 2px" },
		tableBodyCellStyle: { padding: "2px", textAlign: "left" },
		tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
	});

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== CUSTOMER DETAILS =====
	const customerTableBody = [];
	if (customerName) customerTableBody.push([`Customer Name : ${customerName}`]);
	if (customerMobile)
		customerTableBody.push([`Mobile Number : ${customerMobile}`]);
	if (deliveryAddress?.length > 0) {
		deliveryAddress
			.split(",")
			.forEach((line) => customerTableBody.push([line.trim()]));
	}

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

	customerName &&
		receipt.push({ type: "text", value: makeLine(), style: baseFont });

	receipt.push({
		type: "text",
		value: `***${orderType}***`,
		style: {
			...baseFont,
			textAlign: "center",
			fontWeight: "bold",
			width: "100%",
			padding: "4px",
		},
	});

	const itemTableBody = items.flatMap((item) => {
		const rows = [
			[
				{
					type: "text",
					value: `${item.name}${item.nameAr ? `\n${item.nameAr}` : ""}`,
					style: { textAlign: "left", whiteSpace: "pre-line" },
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
			],
		];

		if (item.subitems?.length) {
			item.subitems.forEach((sub) => {
				rows.push([
					{
						type: "text",
						value: `   --${sub.name}${sub.nameAr ? `\n   ${sub.nameAr}` : ""}`,
						style: { textAlign: "left", whiteSpace: "pre-line" },
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
		return rows;
	});

	// ===== ITEMS TABLE =====
	receipt.push({
		type: "table",
		style: { fontFamily: "Tahoma, Arial, sans-serif", fontSize: "12px" },
		tableHeader: [
			{ type: "text", value: "Menu", style: { textAlign: "left" } },
			{ type: "text", value: "Qty", style: { textAlign: "left" } },
			{ type: "text", value: "Amount(QAR)", style: { textAlign: "left" } },
		],
		tableBody: [...itemTableBody],
		tableFooter: [],
		tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableBodyStyle: {},
		tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableHeaderCellStyle: { padding: "2px 2px" },
		tableBodyCellStyle: { padding: "2px", textAlign: "left" },
		tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
	});

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== TOTALS TABLE =====

	const totalTable = [
		[
			{
				type: "text",
				value: `Gross Amount / إجمالي المبلغ`,
				style: { textAlign: "right", fontWeight: "bold" },
			},
			{
				type: "text",
				value: parseFloat(grossAmount).toFixed(2),
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],
		[
			{
				type: "text",
				value: `Discount / خصم`,
				style: { textAlign: "right", fontWeight: "bold" },
			},
			{
				type: "text",
				value: parseFloat(discountAmountTotal || "0").toFixed(2),
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],

		[
			{
				type: "text",
				value: `Balance / الرصيد المتبقي`,
				style: { textAlign: "right", fontWeight: "bold" },
			},
			{
				type: "text",
				value: parseFloat(balanceAmount).toFixed(2),
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],
		[
			{
				type: "text",
				value: `Delivery Charge / رسوم التوصيل`,
				style: { textAlign: "right", fontWeight: "bold" },
			},
			{
				type: "text",
				value: parseFloat(deliveryCharge).toFixed(2),
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],
		[
			{
				type: "text",
				value: `${`Net Amount`}\n ${`صافي المبلغ`}`,
				style: { textAlign: "right", fontWeight: "bold" },
			},
			{
				type: "text",
				value: parseFloat(netAmount).toFixed(2),
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],
	];

	const totalTableFooter = [];

	totalTableFooter.push([
		`Paid Amount / المبلغ المدفوع`,
		parseFloat(paidAmount).toFixed(2),
	]);
	receipt.push({
		type: "table",
		// tableBodyStyle: { ...baseFont, fontSize: "10px" },
		style: { fontFamily: "Tahoma, Arial, sans-serif", fontSize: "12px" },
		tableHeader: [],
		tableBody: totalTable,
		tableFooter: [
			[
				{
					type: "text",
					value: "Paid Amount :",
					style: { textAlign: "right", fontWeight: "bold" },
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
			borderTop: "1ps solid black",
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

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== SETTLEMENT DETAILS =====
	if (settlements?.length) {
		receipt.push({
			type: "text",
			value: "SETTLEMENT DETAILS / تفاصيل التسوية",
			style: {
				...baseFont,
				fontWeight: "bold",
				textAlign: "center",
				marginBottom: "4px",
			},
		});

		const settlementTableBody = settlements.map((s) => {
			let paymentMethodAr = "";
			switch (s.method.toLowerCase()) {
				case "cash":
					paymentMethodAr = "نقدي";
					break;
				case "card":
				case "credit card":
					paymentMethodAr = "بطاقة ائتمان";
					break;
				case "voucher":
					paymentMethodAr = "قسيمة";
					break;
				case "staff":
					paymentMethodAr = "موظف";
					break;
				default:
					paymentMethodAr = "دفع";
			}
			return [
				{
					type: "text",
					value: `${s.method} / ${paymentMethodAr}`,
					style: { textAlign: "left" },
				},
				{
					type: "text",
					value: parseFloat(s.amount).toFixed(2),
					style: { textAlign: "right" },
				},
			];
		});

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

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== FOOTER =====
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
			style: { ...baseFont, fontSize: "10px", marginTop: "10px" },
		});
	}
	if (signLabel) {
		receipt.push({
			type: "text",
			value: signLabel,
			style: { ...baseFont, fontSize: "10px", marginTop: "5px" },
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
				marginBottom: "5px",
			},
		});
	}

	receipt.push({
		type: "raw",
		value: Buffer.from([0x0a, 0x0a, 0x0a, 0x0a]),
	});

	receipt.push({
		type: "raw",
		value: Buffer.from([0x1d, 0x56, 0x00]),
	});

	// receipt.push({ type: "raw", format: "hex", value: "0A0A0A" });
	// receipt.push({ type: "raw", format: "hex", value: "1D5601" });

	return receipt;
}
