/**
 * Utilities for exporting selected table rows in various formats
 */

export interface ExportOptions {
	format: "json" | "csv" | "tsv";
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
					value === null || value === undefined
						? ""
						: typeof value === "object"
							? JSON.stringify(value)
							: String(value);
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
 * Converts rows to TSV format
 */
function rowsToTSV(
	rows: Array<Record<string, unknown>>,
	columns: string[],
): string {
	if (rows.length === 0) return "";

	const header = columns.join("\t");

	const tsvRows = rows.map((row) =>
		columns
			.map((col) => {
				const value = row[col];
				const stringValue =
					value === null || value === undefined
						? ""
						: typeof value === "object"
							? JSON.stringify(value)
							: String(value);
				return stringValue.replace(/\t/g, " ");
			})
			.join("\t"),
	);

	return [header, ...tsvRows].join("\n");
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * Generates SQL INSERT statements for the selected rows
 */
export function rowsToInsertStatements(
	rows: Array<Record<string, unknown>>,
	columns: string[],
	tableName: string,
	schemaName?: string,
): string {
	if (rows.length === 0) return "";

	const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;
	const columnList = columns.map((col) => `"${col}"`).join(", ");

	const statements = rows.map((row) => {
		const values = columns
			.map((col) => {
				const value = row[col];
				if (value === null || value === undefined) {
					return "NULL";
				}
				if (typeof value === "number") {
					return String(value);
				}
				if (typeof value === "boolean") {
					return value ? "TRUE" : "FALSE";
				}
				if (typeof value === "object") {
					const escaped = JSON.stringify(value).replace(/'/g, "''");
					return `'${escaped}'`;
				}
				// Escape single quotes and wrap in quotes
				const escaped = String(value).replace(/'/g, "''");
				return `'${escaped}'`;
			})
			.join(", ");

		return `INSERT INTO ${fullTableName} (${columnList}) VALUES (${values});`;
	});

	return statements.join("\n");
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
	} else if (options.format === "tsv") {
		content = rowsToTSV(rows, columns);
		mimeType = "text/tab-separated-values;charset=utf-8;";
		extension = "tsv";
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
