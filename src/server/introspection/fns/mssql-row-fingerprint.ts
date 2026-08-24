import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { DADABASE_ROW_ID } from "./row-identity.ts";

/** Escape an identifier with T-SQL brackets. */
export function quoteMssqlIdent(identifier: string): string {
  return `[${identifier.replaceAll("]", "]]")}]`;
}

/**
 * Stable row fingerprint for SQL Server tables without a primary key.
 * MSSQL has no physical row id exposed to DML (RID_LOOKUP only works through
 * filtered indexes), so — like MySQL — we hash all column values and use the
 * base64 digest as `__dadabase_rowid` for edit/delete.
 * HASHBYTES input is capped at 8000 bytes by SQL Server.
 */
export function buildMssqlRowFingerprintExpr(columnNames: readonly string[]): string {
  if (columnNames.length === 0) {
    throw new Error("Cannot build MSSQL row fingerprint without columns");
  }
  const parts = columnNames.map(
    (name) => `ISNULL(CAST(${quoteMssqlIdent(name)} AS NVARCHAR(MAX)), N'')`,
  );
  return `CONVERT(NVARCHAR(512), HASHBYTES('SHA2_256', CONCAT_WS(NCHAR(31), ${parts.join(", ")})), 2)`;
}

/** `fingerprint AS [__dadabase_rowid]` select fragment. */
export function buildMssqlSystemRowIdSelect(columnNames: readonly string[]): string {
  return `${buildMssqlRowFingerprintExpr(columnNames)} AS ${quoteMssqlIdent(DADABASE_ROW_ID)}`;
}

/**
 * Fetch ordered column names for a SQL Server table (for no-PK fingerprint
 * WHERE clauses). information_schema.COLUMNS is portable across pg/mysql/mssql.
 */
export const listMssqlTableColumnNames = (input: { schema: string; table: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const query = sql<{ name: string }>`
				SELECT COLUMN_NAME as name
				FROM INFORMATION_SCHEMA.COLUMNS
				WHERE TABLE_SCHEMA = ${input.schema || "dbo"}
					AND TABLE_NAME = ${input.table}
				ORDER BY ORDINAL_POSITION
			`;
    const rows = yield* query;
    return rows.map((r) => r.name);
  });
