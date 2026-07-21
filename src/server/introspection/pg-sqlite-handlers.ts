/**
 * Effect `SqlClient.onDialectOrElse` helpers for MySQL.
 *
 * - `pgSqliteHandlers`: map MySQL onto the Postgres handler when the SQL is
 *   information_schema-compatible (tables/FKs that already use information_schema).
 * - Prefer an explicit `mysql:` branch for pg_catalog / PRAGMA-specific queries.
 */
export const pgSqliteHandlers = <T>(handlers: {
  pg: () => T;
  sqlite: () => T;
  orElse: () => T;
}) => ({
  pg: handlers.pg,
  mysql: handlers.pg,
  sqlite: handlers.sqlite,
  orElse: handlers.orElse,
});

/** Cap fan-out when introspecting every table in a schema (FKs, columns, etc.). */
export const ALL_TABLES_INTROSPECTION_CONCURRENCY = 6;
