function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Converts rows to TSV format. Tabs and newlines within cells are collapsed to spaces. */
export function rowsToTsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  if (rows.length === 0) return "";

  const sanitize = (value: string) => value.replaceAll("\t", " ").replaceAll("\n", " ");
  const header = columns.map((col) => sanitize(col)).join("\t");
  const tsvRows = rows.map((row) =>
    columns.map((col) => sanitize(stringifyCell(row[col]))).join("\t"),
  );

  return [header, ...tsvRows].join("\n");
}
