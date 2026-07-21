import type { SchemaColumnDraft, SchemaMutateDialect } from "./types.ts";

import { assertSafeSqlDataType, assertSafeSqlDefault } from "./assert-safe-sql-fragments.ts";
import { qualifyTable, quoteIdent } from "./quote-ident.ts";
import { isSqliteLikeDialect } from "./types.ts";

export class UnsupportedSchemaMutateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedSchemaMutateError";
  }
}

/**
 * Alter an existing column. Postgres only in MVP.
 * SQLite requires table rebuild — refused here.
 */
export function buildAlterColumnSql(input: {
  dialect: SchemaMutateDialect;
  schema: string;
  table: string;
  /** Current column name (rename not supported in MVP) */
  columnName: string;
  /** Desired column state */
  column: SchemaColumnDraft;
  /** Previous state for diffing which ALTER clauses to emit */
  previous: Pick<SchemaColumnDraft, "dataType" | "nullable" | "defaultValue">;
}): string {
  const { dialect, schema, table, columnName, column, previous } = input;

  if (isSqliteLikeDialect(dialect)) {
    throw new UnsupportedSchemaMutateError(
      "SQLite cannot ALTER COLUMN type/null/default without rebuilding the table (not in MVP).",
    );
  }

  if (!table.trim()) throw new Error("Table name is required");
  if (!columnName.trim()) throw new Error("Column name is required");

  const qualified = qualifyTable(dialect, schema, table);
  const col = quoteIdent(columnName.trim());
  const stmts: string[] = [];

  const nextTypeRaw = column.dataType.trim();
  if (nextTypeRaw && nextTypeRaw !== previous.dataType.trim()) {
    const nextType = assertSafeSqlDataType(nextTypeRaw);
    stmts.push(`ALTER TABLE ${qualified} ALTER COLUMN ${col} TYPE ${nextType}`);
  }

  if (column.nullable !== previous.nullable) {
    stmts.push(
      column.nullable
        ? `ALTER TABLE ${qualified} ALTER COLUMN ${col} DROP NOT NULL`
        : `ALTER TABLE ${qualified} ALTER COLUMN ${col} SET NOT NULL`,
    );
  }

  const prevDefault = previous.defaultValue ?? null;
  const nextDefault = column.defaultValue ?? null;
  if (prevDefault !== nextDefault) {
    if (nextDefault == null || nextDefault === "") {
      stmts.push(`ALTER TABLE ${qualified} ALTER COLUMN ${col} DROP DEFAULT`);
    } else {
      stmts.push(
        `ALTER TABLE ${qualified} ALTER COLUMN ${col} SET DEFAULT ${assertSafeSqlDefault(nextDefault)}`,
      );
    }
  }

  if (stmts.length === 0) {
    throw new Error("No column changes to apply");
  }

  return `${stmts.join(";\n")};`;
}
