// src/api/routes/printerRoutes.js
import { Router } from "express";

export function createPrinterRoutes(getDiscoveredPrinters) {
	const router = Router();

	router.get("/", (req, res) => {
		try {
			const printers = getDiscoveredPrinters(); // This function is passed from electron-main.js
			if (!printers) {
				return res
					.status(500)
					.json({ error: "Printer list unavailable from the main process." });
			}
			res.json(
				printers.map((p) => ({
					// Ensure this structure matches what your API clients expect
					id: p.id,
					name: p.name,
					connectionType: p.connectionType,
					status: p.status,
					description: p.description,
					isDefault: p.isDefault,
					isVirtual: p.isVirtual,
					osName: p.osName,
					isPlickCompatible: p.isPlickCompatible,
					ip: p.ip,
					port: p.port,
					vid: p.vid,
					pid: p.pid,
					// Add other relevant fields if needed
				}))
			);
		} catch (error) {
			console.error("API Error fetching printers:", error);
			res.status(500).json({ error: "Failed to retrieve printer list." });
		}
	});

	return router;
}
