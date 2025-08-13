/**
 * Generates a self-contained HTML string for the TW Kitchen Takeaway Ticket,
 * styled to resemble an 80mm thermal receipt.
 *
 * @param {object} data - The same dynamic data object used by the NTP template.
 * @returns {string} - A complete HTML document as a string.
 */
export function generateTwKitchenTakeawayTicketHtml(data = {}) {
	// Helper to safely get data or return a default, converting to string
	const d = (value, defaultValue = "") =>
		value !== undefined && value !== null ? String(value) : defaultValue;

	// Recursive helper to generate HTML for an item and its sub-items
	const generateItemHtml = (item, indentLevel = 0) => {
		const isSubItem = indentLevel > 0;
		const qtyStr = d(item.qty, "0");
		const itemName = d(item.name, "N/A ITEM").toUpperCase();
		const itemNotes = d(item.notes);

		// Determine classes and styles based on whether it's a main item or sub-item
		const itemLineClass = isSubItem
			? "item-line sub-item"
			: "item-line main-item";
		const indentStyle = `padding-left: ${indentLevel * 20}px;`;

		let itemHtml = `
            <div class="${itemLineClass}" style="${indentStyle}">
                <span class="item-qty">${qtyStr}</span>
                <span class="item-name">${itemName}</span>
            </div>
        `;

		if (itemNotes) {
			itemHtml += `
                <div class="item-notes" style="${indentStyle}">
                    <span>(${itemNotes})</span>
                </div>
            `;
		}

		// Recursively append sub-items
		if (item.subItems && item.subItems.length > 0) {
			item.subItems.forEach((subItem) => {
				itemHtml += generateItemHtml(subItem, indentLevel + 1);
			});
		}

		return itemHtml;
	};

	// --- Build the main HTML parts ---

	const storeName = d(data.storeName, "TW KITCHEN");
	const orderType = `*** ${d(data.orderType, "TAKEAWAY").toUpperCase()} ***`;

	const customerInfoHtml = `
        ${
					data.customerName
						? `<div>Customer : ${d(data.customerName)}</div>`
						: ""
				}
        ${
					data.customerMobile
						? `<div>Mobile No: ${d(data.customerMobile)}</div>`
						: ""
				}
        ${
					data.deliveryTime
						? `<div>Delv Time:${d(data.deliveryTime)}</div>`
						: ""
				}
    `;

	const orderNumber = `No# : ${d(data.orderNumber, "N/A")}`;

	const orderDate = d(
		data.orderDate,
		new Date()
			.toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
			.replace(/ /g, "-")
	);
	const orderTime = d(
		data.orderTime,
		new Date().toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})
	);
	const paxInfo = data.pax
		? `Pax : ${parseFloat(d(data.pax, 0)).toFixed(2)}`
		: "";

	const itemsHtml =
		data.items && data.items.length > 0
			? data.items.map((item) => generateItemHtml(item, 0)).join("")
			: "<div>No items in this order.</div>";

	const servedByHtml = data.servedBy
		? `<div>Served By : ${d(data.servedBy)}</div>`
		: "";

	const notesHtml =
		data.notes && String(data.notes).trim() !== ""
			? `<div class="notes-section">
               <div class="bold">Notes :</div>
               <div class="large-text bold">${d(data.notes)}</div>
           </div>`
			: "";

	// --- Assemble the final HTML with embedded CSS ---

	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kitchen Ticket - ${d(data.orderNumber, "")}</title>
            <style>
                /* CSS to mimic an 80mm thermal receipt */
                @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap');

                body {
                    font-family: 'Roboto Mono', monospace;
                    width: 300px; /* Approx width for 80mm paper */
                    font-size: 12px;
                    line-height: 1.4;
                    color: #000;
                    background-color: #fff;
                    margin: 0;
                    padding: 10px;
                }
                .receipt-container {
                    width: 100%;
                }
                .text-center { text-align: center; }
                .text-left { text-align: left; }
                .bold { font-weight: 700; }

                /* Simulating different text sizes */
                .large-text { font-size: 20px; line-height: 1.2; }
                .xl-text { font-size: 24px; line-height: 1.1; }

                /* Section Spacing */
                .section { margin-bottom: 10px; }

                /* Separator Lines */
                .separator-thick {
                    font-size: 14px;
                    font-weight: 700;
                    text-align: center;
                    margin: 5px 0;
                    letter-spacing: -1px;
                }
                .separator-thin {
                    border-top: 1px dashed #000;
                    margin: 8px 0;
                }

                /* Header */
                .header .store-name {
                    font-size: 22px;
                }

                /* Order Number */
                .order-number-box {
                    padding: 5px 0;
                }

                /* Two-column layout using Flexbox */
                .flex-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                /* Items List */
                .items-header {
                    display: flex;
                    font-weight: 700;
                }
                .items-header .qty-header { width: 40px; }
                .items-header .menu-header { flex: 1; }

                .item-line {
                    display: flex;
                    align-items: flex-start;
                    margin-top: 5px;
                }
                .item-line.main-item .item-name {
                    font-size: 18px; /* Double height simulation */
                    font-weight: 700;
                }
                .item-line.sub-item .item-name {
                    font-size: 12px; /* Normal size for sub-items */
                }
                .item-qty {
                    width: 30px; /* Fixed width for quantity alignment */
                    font-weight: 700;
                    font-size: 18px; /* Match main item height */
                    text-align: left;
                    padding-right: 5px;
                }
                .item-name {
                    flex: 1;
                    word-break: break-word;
                }
                .item-notes {
                    font-size: 12px;
                    padding-left: 30px; /* Indent notes under the item name */
                }
                .sub-item .item-qty {
                    font-size: 12px; /* Normal size for sub-item qty */
                }
                
                .notes-section {
                    margin-top: 10px;
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">

                <div class="section header text-center">
                    <div class="store-name bold">${storeName}</div>
                    <div class="bold">${orderType}</div>
                </div>

                <div class="section customer-info">
                    ${customerInfoHtml}
                </div>

                <div class="section order-number-box">
                    <div class="separator-thick">${"=".repeat(42)}</div>
                    <div class="xl-text bold text-center">${orderNumber}</div>
                    <div class="separator-thick">${"=".repeat(42)}</div>
                </div>

                <div class="section date-time-pax">
                    <div class="flex-container">
                        <span>Date : ${orderDate} ${orderTime}</span>
                        <span class="bold">${paxInfo}</span>
                    </div>
                    ${
											data.followUpStatus
												? `<div class="text-center bold">${data.followUpStatus}</div>`
												: ""
										}
                </div>

                <div class="separator-thin"></div>

                <div class="section items-list">
                    <div class="items-header">
                        <span class="qty-header">Qty</span>
                        <span class="menu-header">Menu</span>
                    </div>
                    <div class="separator-thin"></div>
                    <div class="bold">ADD-ON</div>
                    ${itemsHtml}
                </div>

                <div class="separator-thin"></div>

                <div class="section served-by">
                    ${servedByHtml}
                </div>

                ${notesHtml}

                <div class="separator-thick" style="margin-top: 15px;">${"=".repeat(
									42
								)}</div>

            </div>
        </body>
        </html>
    `;
}
