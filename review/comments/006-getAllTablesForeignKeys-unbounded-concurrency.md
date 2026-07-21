# `getAllTablesForeignKeys` fans out with unbounded concurrency

| Field | Value |
| --- | --- |
| Status | **open** |
| Severity | medium |
| Introduced | `tsztloqr` |
| Relevant files | `src/server/introspection/introspection.ts` (`getAllTablesForeignKeys`, also similar patterns in other “all tables” helpers) |

## Summary

For every table in the schema, `getTableForeignKeys` is scheduled with `{ concurrency: "unbounded" }`. On large schemas this can open a burst of queries against a shared pool (max 20 for PG/MySQL) and amplify latency / lock contention. The same pattern appears elsewhere in this file for all-tables metadata.

Used by ER diagram and cascade-delete confirm (on open).

## Suggested fix

Cap concurrency (e.g. 4–8), or replace with one dialect-appropriate catalog query that returns all FK edges in a single round-trip (PG `information_schema` / SQLite walk still needs PRAGMA per table but can be bounded).
