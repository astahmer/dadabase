/**
 * Effect `SqlClient.onDialectOrElse` handlers with MySQL treated like Postgres
 * for information_schema-compatible introspection queries.
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
