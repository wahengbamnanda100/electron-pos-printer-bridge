export function generateGoCrispyInvoiceReceipt(data) {
	const {
		storeName,
		orderType,
		invoiceDate,
		invoiceTime,
		billNo,
		pax,
		kotNo,
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
		commentsLabel,
		signLabel,
		thankYouMessage,
		close,
	} = data;

	const CHAR_WIDTH = 61;
	const baseFont = {
		fontFamily: "Tahoma, Arial, sans-serif",
		fontSize: "12px",
	};
	const makeLine = (char = "-") => char.repeat(CHAR_WIDTH);

	const receipt = [];

	// ===== Header =====
	receipt.push({
		type: "text",
		value: storeName,
		style: {
			...baseFont,
			fontWeight: "700",
			fontSize: "14px",
			textAlign: "center",
		},
	});
	if (orderType) {
		receipt.push({
			type: "text",
			value: orderType,
			style: { ...baseFont, textAlign: "center" },
		});
	}
	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	receipt.push({
		type: "text",
		value: `Date: ${invoiceDate}   Time: ${invoiceTime}`,
		style: baseFont,
	});
	receipt.push({ type: "text", value: `Bill No: ${billNo}`, style: baseFont });
	if (pax)
		receipt.push({ type: "text", value: `Pax: ${pax}`, style: baseFont });
	if (kotNo)
		receipt.push({ type: "text", value: `KOT No: ${kotNo}`, style: baseFont });
	if (staffName)
		receipt.push({
			type: "text",
			value: `Staff: ${staffName}`,
			style: baseFont,
		});

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	if (customerName)
		receipt.push({
			type: "text",
			value: `Customer: ${customerName}`,
			style: baseFont,
		});
	if (customerMobile)
		receipt.push({
			type: "text",
			value: `Mobile: ${customerMobile}`,
			style: baseFont,
		});

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== Items Table =====
	const tableBody = items.map((item) => [
		{
			type: "text",
			value: item.name + (item.nameAr ? `\n${item.nameAr}` : ""),
			style: {
				textAlign: "left",
				whiteSpace: "pre-line",
			},
		},
		{
			type: "text",
			value: item.qty || "",
			style: { textAlign: "right" },
		},
		{
			type: "text",
			value: `${item.amount || "0.00"}`,
			style: { textAlign: "right" },
		},
	]);

	receipt.push({
		type: "table",
		style: { fontFamily: "Tahoma, Arial, sans-serif", fontSize: "12px" },
		tableHeader: [
			{ type: "text", value: "Menu", style: { textAlign: "left" } },
			{ type: "text", value: "Qty", style: { textAlign: "right" } },
			{ type: "text", value: "Amount(QAR)", style: { textAlign: "right" } },
		],
		tableBody,
		tableFooter: [],
		tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableBodyStyle: {},
		tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
		tableHeaderCellStyle: { padding: "2px 2px" },
		tableBodyCellStyle: { padding: "4px 2px" },
		tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
	});

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== Amount Section =====
	const amountTableBody = [
		[
			{
				type: "text",
				value: "Gross Amount :",
				style: { textAlign: "right", fontWeight: "bold" },
			},
			{
				type: "text",
				value: `${grossAmount}`,
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],
		[
			{
				type: "text",
				value: "Discount :",
				style: { textAlign: "right", fontWeight: "bold" },
			},
			{
				type: "text",
				value: `${discountAmountTotal}`,
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],

		[
			{
				type: "text",
				value: "Balance :",
				style: { textAlign: "right", fontWeight: "bold" },
			},
			{
				type: "text",
				value: `${balanceAmount}`,
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],
		[
			{
				type: "text",
				value: "Delivery Charge :",
				style: { textAlign: "right", fontWeight: "bold" },
			},
			{
				type: "text",
				value: `${deliveryCharge}`,
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],
		[
			{
				type: "text",
				value: "Net Amount :",
				style: { textAlign: "right", fontWeight: "bold" },
			},
			{
				type: "text",
				value: `${netAmount}`,
				style: { textAlign: "right", fontWeight: "bold" },
			},
		],
	];

	receipt.push({
		type: "table",
		style: { fontFamily: "Tahoma, Arial, sans-serif", fontSize: "12px" },
		tableHeader: [],
		tableBody: amountTableBody,
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
			borderTop: "1px solid black",
			color: "black",
		},
		tableHeaderCellStyle: { padding: "2px 2px" },
		tableBodyCellStyle: { padding: "4px 2px" },
		tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
	});

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== Settlements Table =====
	if (settlements?.length) {
		receipt.push({
			type: "text",
			value: "SETTLEMENT DETAILS / تفاصيل التسوية",
			style: {
				...baseFont,
				fontWeight: "bold",
				textAlign: "center",
				padding: "3px",
			},
		});

		const settlementsTableBody = settlements.map((s) => [
			{ type: "text", value: `${s.method}`, style: { textAlign: "left" } },
			{ type: "text", value: `:`, style: { textAlign: "left" } },
			{ type: "text", value: `${s.amount}`, style: { textAlign: "right" } },
		]);

		receipt.push({
			type: "table",
			style: { fontFamily: "Tahoma, Arial, sans-serif", fontSize: "12px" },
			tableHeader: [],
			tableBody: settlementsTableBody,
			tableFooter: [],
			tableHeaderStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableBodyStyle: {},
			tableFooterStyle: { backgroundColor: "#ffffffff", color: "black" },
			tableHeaderCellStyle: { padding: "2px 2px" },
			tableBodyCellStyle: { padding: "4px 2px" },
			tableFooterCellStyle: { padding: "5px 2px", fontWeight: "400" },
		});
	}

	// ===== Footer =====
	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	if (thankYouMessage)
		receipt.push({
			type: "text",
			value: thankYouMessage,
			style: { ...baseFont, textAlign: "center", padding: "3px" },
		});

	// ===== Footer =====
	if (commentsLabel)
		receipt.push({
			type: "text",
			value: commentsLabel,
			style: { ...baseFont, marginBottom: "4px", padding: "6px" },
		});

	if (signLabel)
		receipt.push({
			type: "text",
			value: signLabel,
			style: { ...baseFont, padding: "4px" },
		});

	if (close)
		receipt.push({
			type: "text",
			value: close,
			style: { ...baseFont, textAlign: "center" },
		});

	return receipt;
}
