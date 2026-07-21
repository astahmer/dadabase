import type { SchemaMutateDialect } from "./types.ts";

import { isSqliteLikeDialect } from "./types.ts";

export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export function qualifyTable(dialect: SchemaMutateDialect, schema: string, table: string): string {
  if (isSqliteLikeDialect(dialect)) {
    // SQLite: schema is usually "main"; still qualify when provided
    return schema ? `${quoteIdent(schema)}.${quoteIdent(table)}` : quoteIdent(table);
  }
  return `${quoteIdent(schema || "public")}.${quoteIdent(table)}`;
}
