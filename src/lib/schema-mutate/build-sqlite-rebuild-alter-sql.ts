import type { SchemaColumnDraft } from "./types.ts";

import { assertSafeSqlDataType, assertSafeSqlDefault } from "./assert-safe-sql-fragments.ts";
import { qualifyTable, quoteIdent } from "./quote-ident.ts";

export interface SqliteColumnAlterRequest {
  /** Current name of the column being altered. */
  columnName: string;
  /** New name, if renaming. Defaults to `columnName`. */
  newName?: string;
  dataType?: string;
  nullable?: boolean;
  defaultValue?: string | null;
}

export interface BuildSqliteRebuildAlterSqlInput {
  schema: string;
  table: string;
  /** Full current column list, in order, for the table being altered. */
  columns: readonly SchemaColumnDraft[];
  alter: SqliteColumnAlterRequest;
}

function columnDefinition(col: SchemaColumnDraft): string {
  const dataType = assertSafeSqlDataType(col.dataType.trim() || "TEXT");
  const parts = [quoteIdent(col.name), dataType];

  if (col.primaryKey) {
    parts.push("PRIMARY KEY");
    if (dataType.toUpperCase() === "INTEGER") return parts.join(" ");
  }
  if (!col.nullable) parts.push("NOT NULL");
  if (col.unique && !col.primaryKey) parts.push("UNIQUE");
  if (col.defaultValue != null && col.defaultValue !== "") {
    parts.push(`DEFAULT ${assertSafeSqlDefault(col.defaultValue)}`);
  }
  return parts.join(" ");
}

/**
 * SQLite cannot rename/retype/change nullability or defaults of a column in place.
 * This emits the canonical 12-step rebuild procedure recommended by the SQLite docs:
 * disable FK checks, create a shadow table with the new column definition, copy rows
 * across, drop the old table, rename the shadow table, then re-enable FK checks.
 */
export function buildSqliteRebuildAlterSql(input: BuildSqliteRebuildAlterSqlInput): string {
  const { schema, table, columns, alter } = input;
  if (!table.trim()) throw new Error("Table name is required");
  if (columns.length === 0) throw new Error("At least one column is required");

  const target = columns.find((c) => c.name === alter.columnName);
  if (!target) throw new Error(`Column "${alter.columnName}" not found on table "${table}"`);

  const newName = (alter.newName ?? alter.columnName).trim() || alter.columnName;
  const newColumns = columns.map((col) =>
    col.name === alter.columnName
      ? {
          ...col,
          name: newName,
          dataType: alter.dataType ?? col.dataType,
          nullable: alter.nullable ?? col.nullable,
          defaultValue: alter.defaultValue !== undefined ? alter.defaultValue : col.defaultValue,
        }
      : col,
  );

  const shadowTable = `${table}__dadabase_rebuild`;
  const qualifiedOld = qualifyTable("sqlite", schema, table);
  const qualifiedShadow = qualifyTable("sqlite", schema, shadowTable);

  const defs = newColumns.map((c) => columnDefinition(c)).join(",\n  ");
  const insertColumns = newColumns.map((c) => quoteIdent(c.name)).join(", ");
  const selectColumns = columns.map((c) => quoteIdent(c.name)).join(", ");

  return [
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
    `CREATE TABLE ${qualifiedShadow} (\n  ${defs}\n);`,
    `INSERT INTO ${qualifiedShadow} (${insertColumns}) SELECT ${selectColumns} FROM ${qualifiedOld};`,
    `DROP TABLE ${qualifiedOld};`,
    `ALTER TABLE ${qualifiedShadow} RENAME TO ${quoteIdent(table)};`,
    "COMMIT;",
    "PRAGMA foreign_keys=ON;",
  ].join("\n");
}
