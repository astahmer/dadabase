/**
 * Utilities for exporting selected table rows in various formats
 */

export interface ExportOptions {
	format: "json" | "csv";
	filename?: string;
}

/**
 * Converts rows to CSV format
 */
function rowsToCSV(
	rows: Array<Record<string, unknown>>,
	columns: string[],
): string {
	if (rows.length === 0) return "";

	// CSV header
	const header = columns
		.map((col) => {
			// Escape quotes and wrap in quotes if contains comma, newline, or quotes
			const escaped = String(col).replace(/"/g, '""');
			return escaped.includes(",") || escaped.includes("\n")
				? `"${escaped}"`
				: escaped;
		})
		.join(",");

	// CSV rows
	const csvRows = rows.map((row) =>
		columns
			.map((col) => {
				const value = row[col];
				const stringValue =
					value === null || value === undefined ? "" : String(value);
				// Escape quotes and wrap in quotes if contains comma, newline, or quotes
				const escaped = stringValue.replace(/"/g, '""');
				return escaped.includes(",") || escaped.includes("\n")
					? `"${escaped}"`
					: escaped;
			})
			.join(","),
	);

	return [header, ...csvRows].join("\n");
}

/**
 * Converts rows to JSON format
 */
function rowsToJSON(rows: Array<Record<string, unknown>>): string {
	return JSON.stringify(rows, null, 2);
}

/**
 * Exports rows to a file
 */
export function exportRows(
	rows: Array<Record<string, unknown>>,
	columns: string[],
	options: ExportOptions,
): void {
	if (rows.length === 0) return;

	let content: string;
	let mimeType: string;
	let extension: string;

	if (options.format === "csv") {
		content = rowsToCSV(rows, columns);
		mimeType = "text/csv;charset=utf-8;";
		extension = "csv";
	} else {
		content = rowsToJSON(rows);
		mimeType = "application/json;charset=utf-8;";
		extension = "json";
	}

	// Create a blob and download it
	const blob = new Blob([content], { type: mimeType });
	const link = document.createElement("a");
	const url = URL.createObjectURL(blob);

	link.setAttribute("href", url);
	link.setAttribute("download", options.filename || `export.${extension}`);
	link.style.visibility = "hidden";

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// Clean up
	URL.revokeObjectURL(url);
}
