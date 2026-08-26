export enum DatabaseDialect {
  Postgres = "postgres",
  SQLite = "sqlite",
  LibSQL = "libsql",
  MySQL = "mysql",
  DuckDB = "duckdb",
  /** CSV file(s) queried through an in-memory DuckDB engine (see csv-client.ts). */
  Csv = "csv",
  Mssql = "mssql",
  /** Queried via @clickhouse/client over HTTP (see clickhouse-client.ts). Read-only. */
  Clickhouse = "clickhouse",
}

export const getDialectDefaultSchema = (dialect: DatabaseDialect) => {
  switch (dialect) {
    case DatabaseDialect.SQLite:
    case DatabaseDialect.LibSQL:
    case DatabaseDialect.DuckDB:
    case DatabaseDialect.Csv:
      return "main";
    case DatabaseDialect.Mssql:
      return "dbo";
    case DatabaseDialect.Clickhouse:
      return "default";
    case DatabaseDialect.MySQL:
      return "";
    default:
      return "public";
  }
};

export const onDialectOrElse = <T>(
  dialect: DatabaseDialect,
  dialects: Partial<Record<DatabaseDialect, () => T>> & { orElse: () => T },
): T => {
  const handler = dialects[dialect];
  return handler ? handler() : dialects.orElse();
};
