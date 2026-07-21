/** Escapes a single CSV field: wraps in quotes if it contains a comma, quote, or newline. */
function escapeCsvField(value: string): string {
  const escaped = value.replaceAll('"', '""');
  return /[",\n\r]/.test(value) ? `"${escaped}"` : escaped;
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Converts rows to CSV format (header + rows), using the given column order. */
export function rowsToCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  if (rows.length === 0) return "";

  const header = columns.map((col) => escapeCsvField(col)).join(",");
  const csvRows = rows.map((row) =>
    columns.map((col) => escapeCsvField(stringifyCell(row[col]))).join(","),
  );

  return [header, ...csvRows].join("\n");
}
