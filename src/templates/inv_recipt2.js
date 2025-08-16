// src/utils/thermalReceiptTemplate.js

/**
 * Generates a thermal receipt template matching the exact format shown in the image
 * @param {DetailedInvoiceTemplateData} data - Invoice data from processRawInvoiceData function
 * @returns {Array} Receipt template array for @plick/electron-pos-printer
 */
export function generateGoCrispyInvoiceReceipt(data) {
	const {
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

	const makeLine = (char = "-") => char.repeat(48);

	const receipt = [];

	// ===== HEADER =====
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

	// Store location in Arabic
	receipt.push({
		type: "text",
		value: "الوجبة",
		style: {
			...baseFont,
			fontSize: "12px",
			textAlign: "center",
		},
	});

	// Tel and Fax placeholders
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
		type: "text",
		value: `Date : ${invoiceDate}    Time : ${invoiceTime}`,
		style: { ...baseFont, fontSize: "10px" },
	});
	receipt.push({
		type: "text",
		value: `Bill : ${billNo}  Pax : ${pax}`,
		style: { ...baseFont, fontSize: "10px" },
	});
	receipt.push({
		type: "text",
		value: `KOT No. : ${kotNo || ""}`,
		style: { ...baseFont, fontSize: "10px" },
	});
	if (deliveryDateTime) {
		receipt.push({
			type: "text",
			value: `Delivery Date : ${deliveryDateTime}`,
			style: { ...baseFont, fontSize: "10px" },
		});
	}
	if (staffName) {
		receipt.push({
			type: "text",
			value: staffName,
			style: { ...baseFont, fontSize: "10px" },
		});
	}

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== CUSTOMER DETAILS =====
	if (customerName) {
		receipt.push({
			type: "text",
			value: `Customer Name : ${customerName}`,
			style: { ...baseFont, fontSize: "10px" },
		});
	}
	if (customerMobile) {
		receipt.push({
			type: "text",
			value: `Mobile Number : ${customerMobile}`,
			style: { ...baseFont, fontSize: "10px" },
		});
	}

	// Delivery address components (if available)
	if (deliveryAddress) {
		const addressLines = deliveryAddress.split(", ");
		addressLines.forEach((line) => {
			if (line.trim()) {
				receipt.push({
					type: "text",
					value: line.trim(),
					style: { ...baseFont, fontSize: "10px" },
				});
			}
		});
	}

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== ITEMS TABLE HEADER =====
	receipt.push({
		type: "text",
		value: "Menu                    Qty Amount(QAR)",
		style: { ...baseFont, fontSize: "10px", fontWeight: "bold" },
	});
	receipt.push({
		type: "text",
		value: "قائمة الطعام              كمية    المبلغ",
		style: { ...baseFont, fontSize: "10px" },
	});

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== ITEMS =====
	items.forEach((item) => {
		// Main item - English name
		const itemQty = item.qty || "1";
		const itemAmount = parseFloat(item.amount || "0").toFixed(2);

		// Format main item line
		const itemLine = `${item.name.padEnd(20)} ${itemQty.padStart(
			3
		)} ${itemAmount.padStart(8)}`;
		receipt.push({
			type: "text",
			value: itemLine,
			style: { ...baseFont, fontSize: "10px", fontWeight: "bold" },
		});

		// Arabic name on next line if available
		if (item.nameAr) {
			receipt.push({
				type: "text",
				value: item.nameAr,
				style: { ...baseFont, fontSize: "10px" },
			});
		}

		// Subitems
		if (item.subitems?.length) {
			item.subitems.forEach((sub) => {
				const subQty = sub.qty || "1";
				const subAmount = parseFloat(sub.amount || "0").toFixed(2);

				// Format subitem line with indentation
				const subLine = `  ${sub.name.padEnd(18)} ${subQty.padStart(
					3
				)} ${subAmount.padStart(8)}`;
				receipt.push({
					type: "text",
					value: subLine,
					style: { ...baseFont, fontSize: "10px" },
				});

				// Arabic subitem name
				if (sub.nameAr) {
					receipt.push({
						type: "text",
						value: `  ${sub.nameAr}`,
						style: { ...baseFont, fontSize: "10px" },
					});
				}
			});
		}
	});

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== AMOUNT TOTALS =====
	receipt.push({
		type: "text",
		value: `Gross Amount :             ${parseFloat(grossAmount).toFixed(2)}`,
		style: { ...baseFont, fontSize: "10px", fontWeight: "bold" },
	});
	receipt.push({
		type: "text",
		value: "إجمالي المبلغ",
		style: { ...baseFont, fontSize: "10px" },
	});

	receipt.push({
		type: "text",
		value: `Discount :                 ${parseFloat(
			discountAmountTotal || "0"
		).toFixed(2)}`,
		style: { ...baseFont, fontSize: "10px" },
	});

	if (parseFloat(deliveryCharge || "0") > 0) {
		receipt.push({
			type: "text",
			value: `Delivery Charge :          ${parseFloat(deliveryCharge).toFixed(
				2
			)}`,
			style: { ...baseFont, fontSize: "10px" },
		});
	}

	receipt.push({
		type: "text",
		value: `Net Amount :               ${parseFloat(netAmount).toFixed(2)}`,
		style: { ...baseFont, fontSize: "10px", fontWeight: "bold" },
	});
	receipt.push({
		type: "text",
		value: "صافي المبلغ",
		style: { ...baseFont, fontSize: "10px" },
	});

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	receipt.push({
		type: "text",
		value: `Paid Amount :              ${parseFloat(paidAmount).toFixed(2)}`,
		style: { ...baseFont, fontSize: "10px", fontWeight: "bold" },
	});
	receipt.push({
		type: "text",
		value: "المبلغ المدفوع",
		style: { ...baseFont, fontSize: "10px" },
	});

	if (parseFloat(balanceAmount || "0") > 0) {
		receipt.push({
			type: "text",
			value: `Balance :                  ${parseFloat(balanceAmount).toFixed(
				2
			)}`,
			style: { ...baseFont, fontSize: "10px", fontWeight: "bold" },
		});
		receipt.push({
			type: "text",
			value: "الرصيد المتبقي",
			style: { ...baseFont, fontSize: "10px" },
		});
	}

	receipt.push({ type: "text", value: makeLine(), style: baseFont });

	// ===== SETTLEMENT DETAILS =====
	if (settlements?.length) {
		receipt.push({
			type: "text",
			value: "SETTLEMENT DETAILS",
			style: { ...baseFont, fontSize: "10px", fontWeight: "bold" },
		});
		receipt.push({
			type: "text",
			value: "تفاصيل طريقة السداد",
			style: { ...baseFont, fontSize: "10px" },
		});

		settlements.forEach((settlement) => {
			let paymentMethod = settlement.method;
			let paymentMethodAr = "";

			// Map payment methods to Arabic
			switch (settlement.method.toLowerCase()) {
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

			const settlementLine = `${paymentMethod.padEnd(15)} : ${parseFloat(
				settlement.amount
			).toFixed(2)}`;
			receipt.push({
				type: "text",
				value: settlementLine,
				style: { ...baseFont, fontSize: "10px" },
			});

			if (settlement.cardNo) {
				receipt.push({
					type: "text",
					value: `                      CAR ${settlement.cardNo}`,
					style: { ...baseFont, fontSize: "10px" },
				});
			}

			// Add Arabic translation
			receipt.push({
				type: "text",
				value: paymentMethodAr,
				style: { ...baseFont, fontSize: "10px" },
			});
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

	// Closing message and timestamp
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

	// Current date/time at bottom
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

	// ===== PRINTER COMMANDS =====
	receipt.push({
		type: "raw",
		format: "hex",
		value: "0A0A0A", // 3 line feeds
	});

	receipt.push({
		type: "raw",
		format: "hex",
		value: "1D5601", // Cut paper command
	});

	return receipt;
}
