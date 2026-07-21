import { parseCsv } from "#src/lib/data-import/parse-csv.ts";

export interface ParsePastedRowsResult {
  columns: string[];
  rows: Array<Record<string, string>>;
  /** Whether the first line was detected as a header row (and excluded from `rows`). */
  hasHeader: boolean;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** True when every value in `candidate` matches one of `knownColumns` (case/space-insensitive). */
function looksLikeHeaderRow(
  candidate: readonly string[],
  knownColumns: readonly string[],
): boolean {
  if (candidate.length === 0) return false;
  const known = new Set(knownColumns.map(normalize));
  return candidate.every((value) => known.has(normalize(value)));
}

/**
 * Parses clipboard-pasted tabular text (TSV or CSV) into columns + row records.
 * Delimiter is auto-detected (tab wins over comma, matching how spreadsheets copy cells).
 * When `knownColumns` is provided and the first row's values all match known column
 * names, that row is treated as a header; otherwise every line is treated as data and
 * generic `column_N` names are used (or `knownColumns`, positionally, if provided).
 */
export function parsePasteRows(
  text: string,
  knownColumns: readonly string[] = [],
): ParsePastedRowsResult {
  const delimiter = text.includes("\t") ? "\t" : ",";
  const { rows: rawRows } = parseCsv(text, { delimiter, hasHeader: false });

  if (rawRows.length === 0) {
    return { columns: [], rows: [], hasHeader: false };
  }

  const firstRow = rawRows[0]!;
  const hasHeader = knownColumns.length > 0 && looksLikeHeaderRow(firstRow, knownColumns);

  const columns = hasHeader
    ? firstRow.map((c) => c.trim())
    : Array.from(
        { length: Math.max(knownColumns.length, firstRow.length) },
        (_, i) => knownColumns[i] ?? `column_${i + 1}`,
      );

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

  const rows = dataRows.map((raw) => {
    const record: Record<string, string> = {};
    columns.forEach((col, i) => {
      record[col] = raw[i] ?? "";
    });
    return record;
  });

  return { columns, rows, hasHeader };
}
