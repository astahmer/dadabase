import type { SchemaColumnDraft, SchemaMutateDialect } from "./types.ts";

import { assertSafeSqlDataType, assertSafeSqlDefault } from "./assert-safe-sql-fragments.ts";
import { qualifyTable, quoteIdent } from "./quote-ident.ts";
import { isSqliteLikeDialect } from "./types.ts";

function columnDefinition(dialect: SchemaMutateDialect, col: SchemaColumnDraft): string {
  const dataType = assertSafeSqlDataType(col.dataType.trim() || "text");
  const parts = [quoteIdent(col.name), dataType];

  if (col.primaryKey) {
    parts.push("PRIMARY KEY");
    // SQLite INTEGER PRIMARY KEY is rowid alias; skip NOT NULL (implied)
    if (isSqliteLikeDialect(dialect) && dataType.toUpperCase() === "INTEGER") {
      return parts.join(" ");
    }
  }

  if (!col.nullable && !col.primaryKey) {
    parts.push("NOT NULL");
  } else if (!col.nullable && col.primaryKey && !isSqliteLikeDialect(dialect)) {
    parts.push("NOT NULL");
  }

  if (col.unique && !col.primaryKey) {
    parts.push("UNIQUE");
  }

  if (col.defaultValue != null && col.defaultValue !== "") {
    parts.push(`DEFAULT ${assertSafeSqlDefault(col.defaultValue)}`);
  }

  return parts.join(" ");
}

export function buildCreateTableSql(input: {
  dialect: SchemaMutateDialect;
  schema: string;
  table: string;
  columns: readonly SchemaColumnDraft[];
}): string {
  const { dialect, schema, table, columns } = input;
  const name = table.trim();
  if (!name) throw new Error("Table name is required");
  if (columns.length === 0) throw new Error("At least one column is required");
  for (const col of columns) {
    if (!col.name.trim()) throw new Error("Column name is required");
    if (!col.dataType.trim()) throw new Error(`Data type required for column ${col.name}`);
  }

  const defs = columns.map((c) => columnDefinition(dialect, c)).join(",\n  ");
  return `CREATE TABLE ${qualifyTable(dialect, schema, name)} (\n  ${defs}\n);`;
}
