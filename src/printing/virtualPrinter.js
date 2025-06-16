import { BrowserWindow } from "electron";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { VIRTUAL_PRINT_OPTIONS } from "../config/index.js";

export async function printVirtually(
	htmlContent,
	printerConfig,
	mainWindow,
	printerOptions = {}
) {
	const logPrefix = `VIRTUAL_PRINT [${printerConfig.name}]:`;
	console.log(`${logPrefix} Starting virtual print process.`);

	if (!mainWindow || mainWindow.isDestroyed()) {
		throw new Error("Main window not available for virtual printing.");
	}

	const tempHtmlPath = path.join(os.tmpdir(), `bridge_vp_${Date.now()}.html`);
	await fs.writeFile(tempHtmlPath, htmlContent, "utf8");

	// Use a new, temporary BrowserWindow for printing
	const vpWin = new BrowserWindow({
		show: false, // Keep it hidden
		webPreferences: { nodeIntegration: false, contextIsolation: true },
	});

	return new Promise(async (resolve, reject) => {
		vpWin.webContents.on("did-fail-load", (e, errCode, errDesc) => {
			console.error(`${logPrefix} VP window load fail:`, errDesc);
			if (!vpWin.isDestroyed()) vpWin.close();
			fs.unlink(tempHtmlPath).catch(() => {});
			reject(new Error(`Virtual print page load fail: ${errDesc}`));
		});

		try {
			await vpWin.loadFile(tempHtmlPath);
			console.log(
				`${logPrefix} Virtual print HTML loaded into temporary window.`
			);

			const electronPrintOptions = {
				silent:
					printerOptions.silent !== undefined
						? printerOptions.silent
						: VIRTUAL_PRINT_OPTIONS.silent,
				deviceName: printerConfig.osName || printerConfig.name,
				printBackground:
					printerOptions.printBackground !== undefined
						? printerOptions.printBackground
						: VIRTUAL_PRINT_OPTIONS.printBackground,
				color:
					printerOptions.color !== undefined
						? printerOptions.color
						: VIRTUAL_PRINT_OPTIONS.color,
				margins: printerOptions.margins || VIRTUAL_PRINT_OPTIONS.margins,
				...(printerOptions.electronSpecificOptions || {}),
			};

			vpWin.webContents.print(electronPrintOptions, (success, reason) => {
				if (!vpWin.isDestroyed()) vpWin.close();
				fs.unlink(tempHtmlPath).catch(() => {});

				if (success) {
					console.log(`${logPrefix} Successfully sent to virtual printer.`);
					resolve({
						success: true,
						message: `Sent to virtual printer ${printerConfig.name}`,
					});
				} else {
					console.error(`${logPrefix} Virtual print failed: ${reason}`);
					reject(new Error(`Virtual print failed: ${reason}`));
				}
			});
		} catch (vpErr) {
			console.error(`${logPrefix} VP setup error:`, vpErr);
			if (!vpWin.isDestroyed()) vpWin.close();
			if (
				await fs
					.access(tempHtmlPath)
					.then(() => true)
					.catch(() => false)
			) {
				await fs
					.unlink(tempHtmlPath)
					.catch((e) =>
						console.warn("Error unlinking temp html in VP error:", e)
					);
			}
			reject(new Error(`Virtual print preparation error: ${vpErr.message}`));
		}
	});
}
