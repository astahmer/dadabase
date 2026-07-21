export interface ParseCsvOptions {
  delimiter?: string;
  /** When true (default), the first row is used as the header and rows become objects. */
  hasHeader?: boolean;
}

export interface ParseCsvResult {
  header: string[] | null;
  /** Raw rows (each an array of field strings), excluding the header row when present. */
  rows: string[][];
  /** Rows mapped to objects keyed by header, present only when a header was parsed. */
  records: Array<Record<string, string>>;
}

/**
 * RFC4180-ish CSV parser: supports quoted fields (with escaped `""`), fields containing the
 * delimiter or newlines, and both `\n` and `\r\n` line endings.
 */
export function parseCsv(input: string, options: ParseCsvOptions = {}): ParseCsvResult {
  const delimiter = options.delimiter ?? ",";
  const hasHeader = options.hasHeader ?? true;

  const allRows = parseCsvRows(input, delimiter);
  // Drop a single trailing empty row caused by a final newline.
  if (allRows.length > 0) {
    const last = allRows[allRows.length - 1];
    if (last.length === 1 && last[0] === "") allRows.pop();
  }

  if (allRows.length === 0) {
    return { header: null, rows: [], records: [] };
  }

  const header = hasHeader ? allRows[0] : null;
  const rows = hasHeader ? allRows.slice(1) : allRows;
  const records = header
    ? rows.map((row) => {
        const record: Record<string, string> = {};
        header.forEach((col, i) => {
          record[col] = row[i] ?? "";
        });
        return record;
      })
    : [];

  return { header, rows, records };
}

function parseCsvRows(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // Treat \r\n and lone \r as a single row terminator.
      if (input[i + 1] === "\n") i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  // Flush trailing field/row if the input didn't end with a newline.
  if (field !== "" || row.length > 0) {
    pushRow();
  }

  return rows;
}
