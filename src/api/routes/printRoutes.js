// src/api/routes/printRoutes.js
import { Router } from "express";
import { handlePrintRequest } from "../../services/printService.js";

export function createPrintRoutes(getDiscoveredPrinters, mainWindow) {
	const router = Router();

	router.post("/", async (req, res) => {
		try {
			const result = await handlePrintRequest(
				req.body,
				getDiscoveredPrinters,
				mainWindow
			);
			res.json(result);
		} catch (error) {
			console.error(`API /print Error: ${error.message}`, error.stack);
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
