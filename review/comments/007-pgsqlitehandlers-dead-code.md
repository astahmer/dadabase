# `pgSqliteHandlers` is dead code

| Field | Value |
| --- | --- |
| Status | **open** |
| Severity | low |
| Introduced | `kkposnzo` |
| Relevant files | `src/server/introspection/pg-sqlite-handlers.ts` |

## Summary

Helper exists solely to inject `mysql: handlers.pg` into `onDialectOrElse`, but nothing imports it. Either wire it (see comment 002) or delete it to avoid a false sense of MySQL parity.

## Suggested fix

Use it at introspection call sites, or remove the file until MySQL work resumes.
