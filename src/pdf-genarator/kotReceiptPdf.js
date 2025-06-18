// // src/pdf-generators/kotReceiptPdf.js
// import pdfMake from "pdfmake/build/pdfmake";
// import pdfFonts from "pdfmake/build/vfs_fonts";

// pdfMake.vfs = pdfFonts.pdfMake.vfs;

// // Optional: Define custom fonts if needed (e.g., a true monospace font)
// // pdfMake.fonts = {
// //   // ... your font definitions
// //   MonospaceFont: {
// //     normal: 'YourMonospaceFont-Regular.ttf',
// //     bold: 'YourMonospaceFont-Bold.ttf',
// //   }
// // };

// export async function generateTwKitchenTakeawayTicketPDF(data = {}) {
// 	const d = (value, defaultValue = "") =>
// 		value !== undefined && value !== null ? String(value) : defaultValue;

// 	const orderDate = d(
// 		data.orderDate,
// 		new Date()
// 			.toLocaleDateString("en-GB", {
// 				day: "2-digit",
// 				month: "short",
// 				year: "numeric",
// 			})
// 			.replace(/ /g, "-")
// 	);
// 	const orderTime = d(
// 		data.orderTime,
// 		new Date().toLocaleTimeString("en-US", {
// 			hour: "numeric",
// 			minute: "2-digit",
// 			hour12: true,
// 		})
// 	);
// 	const paxInfo = data.pax
// 		? `Pax : ${parseFloat(d(data.pax, 0)).toFixed(2)}`
// 		: "";
// 	const fullOrderDateTime = `Date : ${orderDate} ${orderTime}`;

// 	// Target width in points (80mm * 2.83465 pts/mm)
// 	const targetWidthPoints = 80 * 2.83465;
// 	// Margins [left, top, right, bottom]
// 	const pageMargins = [10, 15, 10, 15];
// 	const drawableWidth = targetWidthPoints - pageMargins[0] - pageMargins[2];

// 	const documentDefinition = {
// 		pageSize: { width: targetWidthPoints, height: "auto" },
// 		pageMargins: pageMargins,
// 		defaultStyle: {
// 			font: "Roboto", // Change to 'MonospaceFont' if you define and embed one
// 			fontSize: 10, // Base font size
// 			lineHeight: 1.2,
// 		},
// 		content: [
// 			{
// 				text: d(data.storeName, "TW KITCHEN"),
// 				style: "header",
// 				alignment: "center",
// 			},
// 			{
// 				text: `*** ${d(data.orderType, "TAKEAWAY").toUpperCase()} ***`,
// 				style: "subheader",
// 				alignment: "center",
// 				margin: [0, 0, 0, 10],
// 			},

// 			...(data.customerName
// 				? [{ text: `Customer : ${d(data.customerName)}`, style: "body" }]
// 				: []),
// 			...(data.customerMobile
// 				? [{ text: `Mobile No: ${d(data.customerMobile)}`, style: "body" }]
// 				: []),
// 			...(data.deliveryTime
// 				? [
// 						{
// 							text: `Delv Time: ${d(data.deliveryTime)}`,
// 							style: "body",
// 							margin: [0, 0, 0, 10],
// 						},
// 				  ]
// 				: []),

// 			{
// 				canvas: [
// 					{
// 						type: "line",
// 						x1: 0,
// 						y1: 5,
// 						x2: drawableWidth,
// 						y2: 5,
// 						lineWidth: 1.5,
// 						lineColor: "#333333",
// 					},
// 				],
// 				margin: [0, 5, 0, 2],
// 			},
// 			{
// 				text: `No# : ${d(data.orderNumber, "N/A")}`,
// 				style: "orderNumber",
// 				margin: [0, 2, 0, 2],
// 			},
// 			{
// 				canvas: [
// 					{
// 						type: "line",
// 						x1: 0,
// 						y1: 5,
// 						x2: drawableWidth,
// 						y2: 5,
// 						lineWidth: 1.5,
// 						lineColor: "#333333",
// 					},
// 				],
// 				margin: [0, 2, 0, 5],
// 			},

// 			{
// 				columns: [
// 					{ text: fullOrderDateTime, style: "body" },
// 					{ text: paxInfo, style: "body", alignment: "right" },
// 				],
// 				margin: [0, 0, 0, 2],
// 			},
// 			{
// 				canvas: [
// 					{
// 						type: "line",
// 						x1: 0,
// 						y1: 2,
// 						x2: drawableWidth,
// 						y2: 2,
// 						lineWidth: 0.5,
// 						dash: { length: 2, space: 1 },
// 						lineColor: "#555555",
// 					},
// 				],
// 				margin: [0, 0, 0, 5],
// 			},

// 			{
// 				columns: [
// 					{ text: "Qty", style: "itemsHeader", width: "auto" },
// 					{ text: "Menu", style: "itemsHeader", width: "*" },
// 				],
// 				margin: [0, 0, 0, 2],
// 			},
// 			{
// 				canvas: [
// 					{
// 						type: "line",
// 						x1: 0,
// 						y1: 2,
// 						x2: drawableWidth,
// 						y2: 2,
// 						lineWidth: 0.5,
// 						dash: { length: 2, space: 1 },
// 						lineColor: "#555555",
// 					},
// 				],
// 				margin: [0, 0, 0, 5],
// 			},

// 			{ text: "ADD-ON", style: "itemsHeader", margin: [0, 0, 0, 5] },

// 			...(data.items && data.items.length > 0
// 				? data.items.flatMap((item) => [
// 						// Use flatMap to avoid nested arrays
// 						{
// 							columns: [
// 								{ text: d(item.qty, "0"), style: "itemTextLarge", width: 35 }, // Adjusted width for Qty
// 								{
// 									text: d(item.name, "N/A ITEM").toUpperCase(),
// 									style: "itemTextLarge",
// 									width: "*",
// 								},
// 							],
// 							margin: [0, 1, 0, 1],
// 						},
// 						...(item.notes
// 							? [
// 									{
// 										text: `(${d(item.notes)})`,
// 										style: "itemNotes",
// 										margin: [40, 0, 0, 3], // Indent notes, align with item name start
// 									},
// 							  ]
// 							: []),
// 				  ])
// 				: [
// 						{
// 							text: "No items in this order.",
// 							style: "body",
// 							margin: [0, 5, 0, 5],
// 						},
// 				  ]),

// 			{
// 				canvas: [
// 					{
// 						type: "line",
// 						x1: 0,
// 						y1: 2,
// 						x2: drawableWidth,
// 						y2: 2,
// 						lineWidth: 0.5,
// 						dash: { length: 2, space: 1 },
// 						lineColor: "#555555",
// 					},
// 				],
// 				margin: [0, 5, 0, 10],
// 			},

// 			...(data.servedBy
// 				? [
// 						{
// 							text: `Served By : ${d(data.servedBy)}`,
// 							style: "bodySmall",
// 							margin: [0, 0, 0, 10],
// 							alignment: "left",
// 						},
// 				  ]
// 				: []), // Ensure served by is left aligned

// 			...(data.notes && String(data.notes).trim() !== ""
// 				? [
// 						{ text: "Notes :", style: "notesLabel", margin: [0, 0, 0, 2] },
// 						{
// 							text: d(data.notes),
// 							style: "notesContent",
// 							margin: [0, 0, 0, 10],
// 						},
// 				  ]
// 				: []),

// 			{
// 				canvas: [
// 					{
// 						type: "line",
// 						x1: 0,
// 						y1: 5,
// 						x2: drawableWidth,
// 						y2: 5,
// 						lineWidth: 1.5,
// 						lineColor: "#333333",
// 					},
// 				],
// 				margin: [0, 5, 0, 0],
// 			},
// 		],
// 		styles: {
// 			header: { fontSize: 14, bold: true, margin: [0, 0, 0, 2] },
// 			subheader: { fontSize: 11, bold: true, margin: [0, 0, 0, 5] },
// 			body: { fontSize: 10 },
// 			bodySmall: { fontSize: 9 },
// 			orderNumber: { fontSize: 20, bold: true, margin: [0, 5, 0, 5] },
// 			itemsHeader: { fontSize: 10, bold: true },
// 			itemTextLarge: { fontSize: 16, bold: true }, // Matched image style
// 			itemNotes: { fontSize: 9, italics: true },
// 			notesLabel: { fontSize: 10, bold: true },
// 			notesContent: { fontSize: 14, bold: true }, // Matched image style
// 		},
// 	};

// 	return new Promise((resolve, reject) => {
// 		try {
// 			const pdfDoc = pdfMake.createPdfKitDocument(documentDefinition);
// 			const chunks = [];
// 			pdfDoc.on("data", (chunk) => chunks.push(chunk));
// 			pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
// 			pdfDoc.on("error", reject);
// 			pdfDoc.end();
// 		} catch (error) {
// 			reject(error);
// 		}
// 	});
// }
