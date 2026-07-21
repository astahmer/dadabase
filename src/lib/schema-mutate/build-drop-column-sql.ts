import type { SchemaMutateDialect } from "./types.ts";

import { qualifyTable, quoteIdent } from "./quote-ident.ts";

export function buildDropColumnSql(input: {
  dialect: SchemaMutateDialect;
  schema: string;
  table: string;
  column: string;
}): string {
  const { dialect, schema, table, column } = input;
  if (!table.trim()) throw new Error("Table name is required");
  if (!column.trim()) throw new Error("Column name is required");

  return `ALTER TABLE ${qualifyTable(dialect, schema, table)}\n  DROP COLUMN ${quoteIdent(column.trim())};`;
}
