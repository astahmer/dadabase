/**
 * Client-side SQL preview for the row editor "Show SQL" disclosure.
 * Execution always goes through parameterized server functions — this is display-only.
 */

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function formatSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function tableName(schema: string, table: string): string {
  return schema ? `${quoteIdent(schema)}.${quoteIdent(table)}` : quoteIdent(table);
}

export function previewInsertSql(
  schema: string,
  table: string,
  values: Record<string, unknown>,
): string {
  const columns = Object.keys(values);
  if (columns.length === 0) {
    return `-- no columns to insert`;
  }

  const cols = columns.map(quoteIdent).join(", ");
  const vals = columns.map((col) => formatSqlLiteral(values[col])).join(", ");
  return `INSERT INTO ${tableName(schema, table)} (${cols})\nVALUES (${vals});`;
}

export function previewUpdateSql(
  schema: string,
  table: string,
  primaryKey: Record<string, unknown>,
  values: Record<string, unknown>,
): string {
  const setCols = Object.keys(values);
  if (setCols.length === 0) {
    return `-- no columns to update`;
  }

  const setClause = setCols
    .map((col) => `${quoteIdent(col)} = ${formatSqlLiteral(values[col])}`)
    .join(",\n  ");

  const whereClause = Object.keys(primaryKey)
    .map((col) => `${quoteIdent(col)} = ${formatSqlLiteral(primaryKey[col])}`)
    .join(" AND ");

  return `UPDATE ${tableName(schema, table)}\nSET\n  ${setClause}\nWHERE ${whereClause};`;
}
