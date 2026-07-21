import type { SchemaMutateDialect } from "./types.ts";

import { UnsupportedSchemaMutateError } from "./build-alter-column-sql.ts";
import { qualifyTable, quoteIdent } from "./quote-ident.ts";
import { isSqliteLikeDialect } from "./types.ts";

export type ForeignKeyAction = "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION";

export interface BuildAddForeignKeySqlInput {
  dialect: SchemaMutateDialect;
  schema: string;
  table: string;
  constraintName: string;
  columns: readonly string[];
  referencedSchema?: string;
  referencedTable: string;
  referencedColumns: readonly string[];
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

const SQLITE_FK_MESSAGE =
  "SQLite cannot ADD/DROP a foreign key constraint on an existing table without rebuilding it " +
  "(foreign keys are declared at CREATE TABLE time); use buildSqliteRebuildAlterSql-style table rebuild instead.";

/** Builds a Postgres `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...` statement. */
export function buildAddForeignKeySql(input: BuildAddForeignKeySqlInput): string {
  const {
    dialect,
    schema,
    table,
    constraintName,
    columns,
    referencedSchema,
    referencedTable,
    referencedColumns,
    onDelete,
    onUpdate,
  } = input;

  if (isSqliteLikeDialect(dialect)) {
    throw new UnsupportedSchemaMutateError(SQLITE_FK_MESSAGE);
  }
  if (!table.trim()) throw new Error("Table name is required");
  if (!constraintName.trim()) throw new Error("Constraint name is required");
  if (columns.length === 0) throw new Error("At least one column is required");
  if (!referencedTable.trim()) throw new Error("Referenced table is required");
  if (referencedColumns.length === 0) throw new Error("At least one referenced column is required");

  const columnList = columns.map((c) => quoteIdent(c)).join(", ");
  const referencedColumnList = referencedColumns.map((c) => quoteIdent(c)).join(", ");
  const referenced = qualifyTable(dialect, referencedSchema ?? schema, referencedTable);

  const parts = [
    `ALTER TABLE ${qualifyTable(dialect, schema, table)}`,
    `ADD CONSTRAINT ${quoteIdent(constraintName.trim())}`,
    `FOREIGN KEY (${columnList}) REFERENCES ${referenced} (${referencedColumnList})`,
  ];
  if (onDelete) parts.push(`ON DELETE ${onDelete}`);
  if (onUpdate) parts.push(`ON UPDATE ${onUpdate}`);

  return `${parts.join("\n  ")};`;
}

export interface BuildDropForeignKeySqlInput {
  dialect: SchemaMutateDialect;
  schema: string;
  table: string;
  constraintName: string;
}

/** Builds a Postgres `ALTER TABLE ... DROP CONSTRAINT ...` statement. */
export function buildDropForeignKeySql(input: BuildDropForeignKeySqlInput): string {
  const { dialect, schema, table, constraintName } = input;

  if (isSqliteLikeDialect(dialect)) {
    throw new UnsupportedSchemaMutateError(SQLITE_FK_MESSAGE);
  }
  if (!table.trim()) throw new Error("Table name is required");
  if (!constraintName.trim()) throw new Error("Constraint name is required");

  return `ALTER TABLE ${qualifyTable(dialect, schema, table)}\n  DROP CONSTRAINT ${quoteIdent(constraintName.trim())};`;
}
