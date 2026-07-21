import type { SchemaMutateDialect } from "./types.ts";

import { qualifyTable } from "./quote-ident.ts";

export function buildDropTableSql(input: {
  dialect: SchemaMutateDialect;
  schema: string;
  table: string;
  ifExists?: boolean;
}): string {
  const { dialect, schema, table, ifExists = true } = input;
  const name = table.trim();
  if (!name) throw new Error("Table name is required");
  const exists = ifExists ? "IF EXISTS " : "";
  return `DROP TABLE ${exists}${qualifyTable(dialect, schema, name)};`;
}
