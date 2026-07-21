import { downloadTextFile } from "./download-text-file.ts";
import { rowsToCsv } from "./rows-to-csv.ts";
import { rowsToInsertSql } from "./rows-to-insert-sql.ts";
import { rowsToJson } from "./rows-to-json.ts";
import { rowsToTsv } from "./rows-to-tsv.ts";

export { downloadTextFile } from "./download-text-file.ts";
export { rowsToCsv } from "./rows-to-csv.ts";
export { rowsToInsertSql } from "./rows-to-insert-sql.ts";
export { rowsToJson } from "./rows-to-json.ts";
export { rowsToTsv } from "./rows-to-tsv.ts";

export type ExportFormat = "json" | "csv" | "tsv" | "sql";

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  /** Table name to qualify INSERT statements when format is "sql". */
  tableName?: string;
  /** Schema name to qualify INSERT statements when format is "sql". */
  schemaName?: string;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv;charset=utf-8;",
  tsv: "text/tab-separated-values;charset=utf-8;",
  json: "application/json;charset=utf-8;",
  sql: "application/sql;charset=utf-8;",
};

const EXTENSIONS: Record<ExportFormat, string> = {
  csv: "csv",
  tsv: "tsv",
  json: "json",
  sql: "sql",
};

/** Serializes rows to the requested export format's text content. */
export function stringifyRows(
  rows: Array<Record<string, unknown>>,
  columns: string[],
  options: Pick<ExportOptions, "format" | "tableName" | "schemaName">,
): string {
  switch (options.format) {
    case "csv":
      return rowsToCsv(rows, columns);
    case "tsv":
      return rowsToTsv(rows, columns);
    case "sql":
      return rowsToInsertSql(rows, columns, options.tableName || "table", options.schemaName);
    case "json":
    default:
      return rowsToJson(rows);
  }
}

/** Serializes rows to the requested format and triggers a browser download. */
export function exportRows(
  rows: Array<Record<string, unknown>>,
  columns: string[],
  options: ExportOptions,
  doc: Document = document,
): void {
  if (rows.length === 0) return;

  const content = stringifyRows(rows, columns, options);
  const mimeType = MIME_TYPES[options.format];
  const extension = EXTENSIONS[options.format];

  downloadTextFile(content, options.filename || `export.${extension}`, mimeType, doc);
}

/** Copies text to the clipboard, returning whether it succeeded. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Generates SQL INSERT statements for the selected rows. */
export function rowsToInsertStatements(
  rows: Array<Record<string, unknown>>,
  columns: string[],
  tableName: string,
  schemaName?: string,
): string {
  return rowsToInsertSql(rows, columns, tableName, schemaName);
}
