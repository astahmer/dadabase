import { parseCsv } from "#src/lib/data-import/parse-csv.ts";

export type ClipboardMatrix = string[][];

/** Parse spreadsheet clipboard text without losing quoted commas or newlines. */
export function parseCellClipboard(text: string): ClipboardMatrix {
  const normalized = text.replace(/\uFEFF/g, "");
  if (!normalized.trim()) return [];
  const delimiter = normalized.includes("\t") ? "\t" : ",";
  return parseCsv(normalized, { delimiter, hasHeader: false }).rows;
}

export function stringifyCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return Object.prototype.toString.call(value);
  }
}

export function escapeTsvCell(value: unknown): string {
  const text = stringifyCellValue(value);
  return /[\t\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function escapeCsvCell(value: unknown): string {
  const text = stringifyCellValue(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function matrixToDelimitedText(
  matrix: readonly (readonly unknown[])[],
  delimiter: "\t" | ",",
): string {
  const escape = delimiter === "\t" ? escapeTsvCell : escapeCsvCell;
  return matrix.map((row) => row.map(escape).join(delimiter)).join("\n");
}
