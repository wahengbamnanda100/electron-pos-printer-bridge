import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { OS_COMMAND_PRINT_TIMEOUT } from "../config/index.js";

export async function printViaOsCommand(
	rawBuffer,
	printerConfig,
	printerOptions = {}
) {
	const logPrefix = `OS_CMD_PRINT [${printerConfig.name}]:`;
	console.log(`${logPrefix} Handling OS-queued printer via command line.`);

	if (!printerConfig.osName) {
		throw new Error(
			"OS Printer config missing osName for command line printing."
		);
	}
	if (!rawBuffer || rawBuffer.length === 0) {
		throw new Error("Generated empty buffer for OS_CMD print.");
	}

	const tempFilePathOs = path.join(os.tmpdir(), `os_cmd_job_${Date.now()}.bin`);
	await fs.writeFile(tempFilePathOs, rawBuffer);
	console.log(
		`${logPrefix} Raw buffer (${rawBuffer.length} bytes) for '${printerConfig.osName}' written to ${tempFilePathOs}`
	);

	return new Promise((resolve, reject) => {
		let command;
		// Quoting for printer names with spaces
		const printerNameForCmd = printerConfig.osName;

		if (os.platform() === "win32") {
			// PowerShell needs quotes around names with spaces, and if path has spaces.
			// Using -Raw with Get-Content ensures byte stream.
			command = `powershell -NoProfile -NonInteractive -Command "Get-Content -Path '${tempFilePathOs}' -Encoding Byte -Raw | Out-Printer -Name '${printerNameForCmd.replace(
				/'/g,
				"''"
			)}'"`;
		} else {
			// macOS, Linux: lp -d 'Printer Name' /path/to/file
			// lp standardly expects printer name without quotes unless shell requires it for spaces,
			// but -o raw is crucial.
			command = `lp -d "${printerNameForCmd.replace(
				/"/g,
				'\\"'
			)}" -o raw "${tempFilePathOs}"`;
		}
		console.log(`${logPrefix} Executing: ${command}`);

		exec(
			command,
			{ timeout: printerOptions.timeout || OS_COMMAND_PRINT_TIMEOUT },
			async (error, stdout, stderr) => {
				try {
					await fs.unlink(tempFilePathOs);
				} catch (e) {
					console.warn(`${logPrefix} Temp OS file unlink error:`, e.message);
				}

				if (error) {
					const errorMessage = `OS Command FAIL: ${error.message}. STDOUT: ${stdout}. STDERR: ${stderr}`;
					console.error(`${logPrefix} ${errorMessage}`);
					reject(
						new Error(`OS print command failed: ${stderr || error.message}`)
					);
				} else {
					console.log(
						`${logPrefix} OS Command SUCCESS for '${printerConfig.osName}'.`
					);
					resolve({
						success: true,
						message: `Job sent to OS printer '${printerConfig.name}'.`,
					});
				}
			}
		);
	});
}
