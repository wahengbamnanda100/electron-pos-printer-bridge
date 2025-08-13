// src/api/server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { API_PORT } from "../config/index.js";
import { createPrinterRoutes } from "./routes/printerRoutes.js";
import { createPrintRoutes } from "./routes/printRoutes.js";
import { createPdfPrintRoutes } from "./routes/pdfPrintroutes.js";
import { handleDirectPdfPrintRequest } from "../services/printService.js";

export function startApiServer(getDiscoveredPrinters, mainWindow) {
	const app = express();

	app.use(cors({ origin: "*" }));
	app.use(bodyParser.json({ limit: "10mb" }));
	app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

	app.use("/api/printers", createPrinterRoutes(getDiscoveredPrinters));
	app.use("/api/print", createPrintRoutes(getDiscoveredPrinters, mainWindow));
	app.use(
		"/api/print-pdf",
		createPdfPrintRoutes(getDiscoveredPrinters, mainWindow)
	);

	app.post("/api/print-pdf-direct", async (req, res) => {
		try {
			// Pass getDiscoveredPrinters and mainWindow similar to the other print route
			const result = await handleDirectPdfPrintRequest(
				req.body,
				getDiscoveredPrinters,
				mainWindow
			);
			res.json(result);
		} catch (error) {
			console.error(
				`API /print-pdf-direct Error: ${error.message}`,
				error.stack
			);
			const statusCode = error.message.toLowerCase().includes("not found")
				? 404
				: error.message.toLowerCase().includes("missing")
				? 400
				: 500;
			res.status(statusCode).json({ error: error.message });
		}
	});

	app.get("/api/health", (req, res) => {
		res.status(200).json({ status: "OK", message: "API Server is running." });
	});

	const server = app.listen(API_PORT, "0.0.0.0", () => {
		console.log(`Bridge API Server listening on port ${API_PORT}.`);
		console.log(`  Local:            http://localhost:${API_PORT}/api/health`);
		console.log(
			`  On Your Network:  http://<your-local-ip>:${API_PORT}/api/health`
		);
	});

	server.on("error", (error) => {
		if (error.syscall !== "listen") throw error;
		const bind =
			typeof API_PORT === "string" ? "Pipe " + API_PORT : "Port " + API_PORT;
		switch (error.code) {
			case "EACCES":
				console.error(
					`API Server Critical Error: ${bind} requires elevated privileges.`
				);
				process.exit(1);
				break;
			case "EADDRINUSE":
				console.error(`API Server Critical Error: ${bind} is already in use.`);
				process.exit(1);
				break;
			default:
				console.error(`API Server Critical Error: ${error.code}`, error);
				throw error;
		}
	});
	return server;
}
