import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
/**
 * DuckDB foreign-key introspection helpers.
 *
 * DuckDB's `information_schema.constraint_column_usage` misreports FK references
 * (it lists the LOCAL constraint columns instead of the referenced ones), so the
 * pg information_schema queries would produce self-referential edges. Reliable
 * FK metadata lives in the `duckdb_constraints()` table function, whose
 * `constraint_text` looks like:
 *
 *   FOREIGN KEY (customer_id) REFERENCES customers(id)
 *   FOREIGN KEY (a, b) REFERENCES main."other table"(x, y)
 *
 * These helpers fetch and parse that shape. Verified empirically in
 * `src/server/db-connection/duckdb/duckdb-catalog.test.ts`.
 */

const unquote = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

export interface DuckDbParsedForeignKey {
  /** Table the constraint lives on. */
  readonly table: string;
  readonly columns: ReadonlyArray<string>;
  /** Schema-qualified or bare target name parsed from the REFERENCES clause. */
  readonly referencedSchema: string | null;
  readonly referencedTable: string;
  readonly referencedColumns: ReadonlyArray<string>;
}

const splitColumnList = (raw: string): string[] =>
  raw
    .split(",")
    .map((part) => unquote(part))
    .filter((part) => part.length > 0);

export const parseDuckDbForeignKeyText = (
  text: string,
  fallbackTable: string,
): Omit<DuckDbParsedForeignKey, "constraintName" | "table"> | null => {
  const match = /FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+(.+?)\s*\(([^)]*)\)/i.exec(text);
  if (!match) return null;

  const localColumns = splitColumnList(match[1] ?? "");
  const target = match[2] ?? "";
  const referencedColumns = splitColumnList(match[3] ?? "");

  if (localColumns.length === 0 || referencedColumns.length === 0) return null;

  // Target may be schema-qualified ("main.customers") or quoted ('"other table"').
  let referencedSchema: string | null = null;
  let referencedTable = target;
  const lastDot = target.lastIndexOf(".");
  if (lastDot > 0 && !target.endsWith(".")) {
    referencedSchema = unquote(target.slice(0, lastDot));
    referencedTable = target.slice(lastDot + 1);
  }
  referencedTable = unquote(referencedTable);

  void fallbackTable;
  return { columns: localColumns, referencedSchema, referencedTable, referencedColumns };
};

/**
 * All foreign keys in a schema, one entry per (constraint, column) pair —
 * mirroring the row shape the pg/mysql/sqlite branches of getTableForeignKeys
 * return.
 */
export const fetchDuckDbForeignKeys = Effect.fnUntraced(function* (
  sql: SqlClient.SqlClient,
  input: { schema: string },
) {
  const rows = yield* sql`
    SELECT constraint_name, table_name, constraint_column_names AS columns, constraint_text
    FROM duckdb_constraints()
    WHERE database_name NOT IN ('temp', 'system')
      AND schema_name = ${input.schema}
      AND constraint_type = 'FOREIGN KEY'
  `;

  const result: Array<{
    constraint_name: string;
    table_name: string;
    column_name: string;
    referenced_table_schema: string;
    referenced_table_name: string;
    referenced_column_name: string;
    delete_rule: string;
  }> = [];

  for (const row of rows) {
    const constraintName = String(row.constraint_name ?? "");
    const tableName = String(row.table_name ?? "");
    const text = String(row.constraint_text ?? "");
    const parsed = parseDuckDbForeignKeyText(text, tableName);
    if (!parsed) continue;

    const localColumns =
      Array.isArray(row.columns) && row.columns.length > 0
        ? row.columns.map((c) => String(c))
        : parsed.columns;
    const referencedSchema = parsed.referencedSchema ?? input.schema;

    // One output row per column pair, zipped positionally.
    const pairCount = Math.min(localColumns.length, parsed.referencedColumns.length);
    for (let index = 0; index < pairCount; index += 1) {
      result.push({
        constraint_name: constraintName,
        table_name: tableName,
        column_name: localColumns[index] ?? "",
        referenced_table_schema: referencedSchema,
        referenced_table_name: parsed.referencedTable,
        referenced_column_name: parsed.referencedColumns[index] ?? "",
        delete_rule: "NO ACTION",
      });
    }
  }

  return result;
});
