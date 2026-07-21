import { quoteIdent } from "#src/lib/schema-mutate/quote-ident.ts";

import type { InferredColumnType } from "./infer-column-types.ts";

export type InsertPreviewDialect = "postgres" | "sqlite";

export interface BuildInsertPreviewSqlInput {
  dialect: InsertPreviewDialect;
  schema?: string;
  table: string;
  columns: readonly string[];
  rows: Array<Record<string, unknown>>;
  columnTypes?: Record<string, InferredColumnType>;
  /** Caps how many rows are rendered; remaining rows are summarized in a trailing comment. Default 50. */
  maxRows?: number;
}

function formatValue(
  value: unknown,
  dialect: InsertPreviewDialect,
  type: InferredColumnType | undefined,
): string {
  if (value === null || value === undefined || value === "") return "NULL";

  if (type === "boolean") {
    const truthy =
      typeof value === "boolean" ? value : String(value).trim().toLowerCase() === "true";
    return dialect === "sqlite" ? (truthy ? "1" : "0") : truthy ? "TRUE" : "FALSE";
  }

  if (type === "integer" || type === "real") {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? String(num) : "NULL";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

/** Builds a preview multi-row `INSERT INTO ... VALUES (...), (...);` statement for imported rows. */
export function buildInsertPreviewSql(input: BuildInsertPreviewSqlInput): string {
  const { dialect, schema, table, columns, rows, columnTypes = {}, maxRows = 50 } = input;

  if (!table.trim()) throw new Error("Table name is required");
  if (columns.length === 0) throw new Error("At least one column is required");

  const qualified = schema ? `${quoteIdent(schema)}.${quoteIdent(table)}` : quoteIdent(table);
  const columnList = columns.map((col) => quoteIdent(col)).join(", ");

  const visibleRows = rows.slice(0, maxRows);
  const valueLines = visibleRows.map((row) => {
    const values = columns
      .map((col) => formatValue(row[col], dialect, columnTypes[col]))
      .join(", ");
    return `  (${values})`;
  });

  if (valueLines.length === 0) {
    return `-- No rows to insert into ${qualified}`;
  }

  const lines = [`INSERT INTO ${qualified} (${columnList}) VALUES`, valueLines.join(",\n") + ";"];

  const remaining = rows.length - visibleRows.length;
  if (remaining > 0) {
    lines.push(`-- ... ${remaining} more row${remaining === 1 ? "" : "s"} omitted from preview`);
  }

  return lines.join("\n");
}
