import { quoteIdent } from "#src/lib/schema-mutate/quote-ident.ts";

/** Escapes a SQL string literal by doubling single quotes. */
function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function stringifySqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "object") return `'${escapeSqlLiteral(JSON.stringify(value))}'`;
  return `'${escapeSqlLiteral(String(value))}'`;
}

/** Builds one `INSERT INTO ... VALUES (...)` statement per row. */
export function rowsToInsertSql(
  rows: Array<Record<string, unknown>>,
  columns: string[],
  tableName: string,
  schemaName?: string,
): string {
  if (rows.length === 0) return "";

  const fullTableName = schemaName
    ? `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`
    : quoteIdent(tableName);
  const columnList = columns.map((col) => quoteIdent(col)).join(", ");

  const statements = rows.map((row) => {
    const values = columns.map((col) => stringifySqlValue(row[col])).join(", ");
    return `INSERT INTO ${fullTableName} (${columnList}) VALUES (${values});`;
  });

  return statements.join("\n");
}
