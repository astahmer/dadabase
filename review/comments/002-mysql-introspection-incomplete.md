# MySQL dialect connects, but introspection still falls through `orElse`

| Field | Value |
| --- | --- |
| Status | **open** |
| Severity | high |
| Introduced | `kkposnzo` |
| Relevant files | `src/db/postgres/pool-cache.ts`, `src/server/introspection/pg-sqlite-handlers.ts`, `src/server/introspection/introspection.ts`, `ideas.md` |

## Summary

MySQL gets a real pool (`MysqlClient.layer`) and try-connection path, but `introspection.ts` still uses `sql.onDialectOrElse({ pg, sqlite, orElse })` without a `mysql` branch. `pgSqliteHandlers` was added to map MySQL → PG handlers and is **unused** anywhere in the tree.

`ideas.md` claims “information_schema reuse via `pgSqliteHandlers`,” which is inaccurate until that helper is actually applied (or native MySQL queries are written).

## Suggested fix

Either:

- Wire `pgSqliteHandlers` into every `onDialectOrElse` call site that is information_schema-compatible, **and** add MySQL-focused unit/integration coverage; or
- Implement dedicated MySQL branches (types, `SHOW` / `information_schema` quirks, identifier quoting).

Until then, treat MySQL as “connect-only MVP” in docs/UI, not a checked-off dialect.
