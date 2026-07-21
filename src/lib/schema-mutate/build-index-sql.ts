import type { SchemaMutateDialect } from "./types.ts";

import { qualifyTable, quoteIdent } from "./quote-ident.ts";

export interface IndexColumnDraft {
  name: string;
  direction?: "asc" | "desc";
}

export interface BuildCreateIndexSqlInput {
  dialect: SchemaMutateDialect;
  schema: string;
  table: string;
  indexName: string;
  columns: ReadonlyArray<string | IndexColumnDraft>;
  unique?: boolean;
  ifNotExists?: boolean;
}

function normalizeColumn(column: string | IndexColumnDraft): IndexColumnDraft {
  return typeof column === "string" ? { name: column } : column;
}

function columnExpr(column: IndexColumnDraft): string {
  const direction = column.direction ? ` ${column.direction.toUpperCase()}` : "";
  return `${quoteIdent(column.name)}${direction}`;
}

/** Builds a `CREATE [UNIQUE] INDEX` statement. Index names are not schema-qualified per SQL convention. */
export function buildCreateIndexSql(input: BuildCreateIndexSqlInput): string {
  const { dialect, schema, table, indexName, columns, unique = false, ifNotExists = true } = input;

  if (!table.trim()) throw new Error("Table name is required");
  if (!indexName.trim()) throw new Error("Index name is required");
  if (columns.length === 0) throw new Error("At least one column is required");

  const uniqueKeyword = unique ? "UNIQUE " : "";
  const existsClause = ifNotExists ? "IF NOT EXISTS " : "";
  const columnList = columns.map((c) => columnExpr(normalizeColumn(c))).join(", ");

  return (
    `CREATE ${uniqueKeyword}INDEX ${existsClause}${quoteIdent(indexName.trim())} ` +
    `ON ${qualifyTable(dialect, schema, table)} (${columnList});`
  );
}

export interface BuildDropIndexSqlInput {
  dialect: SchemaMutateDialect;
  schema: string;
  indexName: string;
  ifExists?: boolean;
}

/** Builds a `DROP INDEX` statement, schema-qualified when a schema is provided. */
export function buildDropIndexSql(input: BuildDropIndexSqlInput): string {
  const { dialect, schema, indexName, ifExists = true } = input;
  if (!indexName.trim()) throw new Error("Index name is required");

  const qualified = qualifyTable(dialect, schema, indexName.trim());
  return `DROP INDEX ${ifExists ? "IF EXISTS " : ""}${qualified};`;
}
