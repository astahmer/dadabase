import type { SchemaColumnDraft, SchemaMutateDialect } from "./types.ts";

import { qualifyTable, quoteIdent } from "./quote-ident.ts";

export function buildAddColumnSql(input: {
  dialect: SchemaMutateDialect;
  schema: string;
  table: string;
  column: SchemaColumnDraft;
}): string {
  const { dialect, schema, table, column } = input;
  if (!table.trim()) throw new Error("Table name is required");
  if (!column.name.trim()) throw new Error("Column name is required");
  if (!column.dataType.trim()) throw new Error("Data type is required");

  const parts = [
    `ALTER TABLE ${qualifyTable(dialect, schema, table)}`,
    `ADD COLUMN ${quoteIdent(column.name.trim())} ${column.dataType.trim()}`,
  ];

  if (!column.nullable) {
    parts[1] += " NOT NULL";
  }
  if (column.unique) {
    parts[1] += " UNIQUE";
  }
  if (column.defaultValue != null && column.defaultValue !== "") {
    parts[1] += ` DEFAULT ${column.defaultValue}`;
  }
  // PK on ADD COLUMN is rarely portable; omit from ADD (use create-table for PK)

  return `${parts.join("\n  ")};`;
}
