import { DADABASE_ROW_ID } from "./row-identity.ts";

/** Escape a MySQL identifier with backticks. */
export function quoteMysqlIdent(identifier: string): string {
  return `\`${identifier.replaceAll("`", "``")}\``;
}

/**
 * Stable row fingerprint for MySQL tables without a primary key.
 * MySQL does not expose a physical row id (unlike PG ctid / SQLite rowid), so we
 * hash all column values and use that as `__dadabase_rowid` for edit/delete.
 */
export function buildMysqlRowFingerprintExpr(columnNames: readonly string[]): string {
  if (columnNames.length === 0) {
    throw new Error("Cannot build MySQL row fingerprint without columns");
  }
  const parts = columnNames.map(
    (name) => `IFNULL(CAST(${quoteMysqlIdent(name)} AS CHAR), CHAR(0))`,
  );
  return `TO_BASE64(UNHEX(SHA2(CONCAT_WS(CHAR(31), ${parts.join(", ")}), 256)))`;
}

/** `fingerprint AS \`__dadabase_rowid\`` select fragment. */
export function buildMysqlSystemRowIdSelect(columnNames: readonly string[]): string {
  return `${buildMysqlRowFingerprintExpr(columnNames)} AS ${quoteMysqlIdent(DADABASE_ROW_ID)}`;
}
