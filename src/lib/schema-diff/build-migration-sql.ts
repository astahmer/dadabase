import { quoteIdent } from "#src/lib/schema-mutate/quote-ident.ts";

import type { SchemaDiffColumn, SchemaDiffDialect, SchemaDiffOp } from "./types.ts";

function qualify(schema: string, table: string): string {
  return schema ? `${quoteIdent(schema)}.${quoteIdent(table)}` : quoteIdent(table);
}

function columnDefinition(dialect: SchemaDiffDialect, column: SchemaDiffColumn): string {
  const parts = [quoteIdent(column.name), column.dataType];
  if (column.primaryKey) parts.push("PRIMARY KEY");
  if (!column.nullable && !(column.primaryKey && dialect === "sqlite")) parts.push("NOT NULL");
  if (column.defaultValue != null && column.defaultValue !== "") {
    parts.push(`DEFAULT ${column.defaultValue}`);
  }
  return parts.join(" ");
}

function buildAddColumnClause(column: SchemaDiffColumn): string {
  const parts = [`ADD COLUMN ${quoteIdent(column.name)} ${column.dataType}`];
  if (!column.nullable) parts.push("NOT NULL");
  if (column.defaultValue != null && column.defaultValue !== "") {
    parts.push(`DEFAULT ${column.defaultValue}`);
  }
  return parts.join(" ");
}

/**
 * Renders migration ops (see `diffTableStructures`) into SQL text.
 * SQLite cannot `ALTER COLUMN` in place; those ops are rendered as a comment pointing
 * at `buildSqliteRebuildAlterSql` instead of raising, so a full migration script can
 * still be produced for review.
 */
export function buildMigrationSql(
  ops: readonly SchemaDiffOp[],
  dialect: SchemaDiffDialect,
): string {
  const statements: string[] = [];

  for (const op of ops) {
    switch (op.kind) {
      case "add-table": {
        const defs = op.columns.map((c) => columnDefinition(dialect, c)).join(",\n  ");
        statements.push(`CREATE TABLE ${qualify(op.schema, op.table)} (\n  ${defs}\n);`);
        break;
      }
      case "drop-table": {
        statements.push(`DROP TABLE IF EXISTS ${qualify(op.schema, op.table)};`);
        break;
      }
      case "rename-table": {
        statements.push(
          `ALTER TABLE ${qualify(op.schema, op.fromTable)} RENAME TO ${quoteIdent(op.toTable)};`,
        );
        break;
      }
      case "add-column": {
        statements.push(
          `ALTER TABLE ${qualify(op.schema, op.table)} ${buildAddColumnClause(op.column)};`,
        );
        break;
      }
      case "drop-column": {
        statements.push(
          `ALTER TABLE ${qualify(op.schema, op.table)} DROP COLUMN ${quoteIdent(op.column)};`,
        );
        break;
      }
      case "alter-column": {
        if (dialect === "sqlite") {
          statements.push(
            `-- SQLite cannot ALTER COLUMN "${op.column}" on ${qualify(op.schema, op.table)} in place; ` +
              `use buildSqliteRebuildAlterSql() to rebuild the table instead.`,
          );
          break;
        }
        const qualified = qualify(op.schema, op.table);
        const col = quoteIdent(op.column);
        const clauses: string[] = [];
        if (op.to.dataType !== op.from.dataType) {
          clauses.push(`ALTER TABLE ${qualified} ALTER COLUMN ${col} TYPE ${op.to.dataType}`);
        }
        if (op.to.nullable !== op.from.nullable) {
          clauses.push(
            op.to.nullable
              ? `ALTER TABLE ${qualified} ALTER COLUMN ${col} DROP NOT NULL`
              : `ALTER TABLE ${qualified} ALTER COLUMN ${col} SET NOT NULL`,
          );
        }
        const fromDefault = op.from.defaultValue ?? null;
        const toDefault = op.to.defaultValue ?? null;
        if (fromDefault !== toDefault) {
          clauses.push(
            toDefault == null || toDefault === ""
              ? `ALTER TABLE ${qualified} ALTER COLUMN ${col} DROP DEFAULT`
              : `ALTER TABLE ${qualified} ALTER COLUMN ${col} SET DEFAULT ${toDefault}`,
          );
        }
        statements.push(...clauses.map((c) => `${c};`));
        break;
      }
    }
  }

  return statements.join("\n");
}
