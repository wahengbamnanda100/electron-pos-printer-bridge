import { Router } from "express";
import { handlePDFPrintRequest } from "../../services/printService.js";

export function createPdfPrintRoutes(getDiscoveredPrinters, mainWindow) {
	const router = Router();

	router.post("/", async (req, res) => {
		try {
			const result = await handlePDFPrintRequest(
				req.body,
				getDiscoveredPrinters,
				mainWindow
			);
			res.json(result);
		} catch (error) {
			console.error(`API /print-pdf Error: ${error.message}`, error.stack);
			if (error.message.includes("not found")) {
				res.status(404).json({ error: error.message });
			} else if (error.message.includes("Missing")) {
				res.status(400).json({ error: error.message });
			} else {
				res.status(500).json({ error: error.message });
			}
		}
	});

	return router;
}
