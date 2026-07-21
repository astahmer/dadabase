# Schema mutate interpolates `dataType` / `DEFAULT` without validation

| Field | Value |
| --- | --- |
| Status | **open** |
| Severity | high |
| Introduced | `uqpprnqo` (builders), used by `lyxnokyk` / `tytpwzst` / `qqsplosw` |
| Relevant files | `src/lib/schema-mutate/build-create-table-sql.ts`, `build-add-column-sql.ts`, `build-alter-column-sql.ts`, `build-sqlite-rebuild-alter-sql.ts` |

## Summary

Identifiers are correctly double-quoted via `quoteIdent`, but column **data types** and **DEFAULT** expressions are concatenated raw:

```ts
parts.push(col.dataType.trim() || "text");
parts.push(`DEFAULT ${col.defaultValue}`);
```

A crafted type like ``TEXT); DROP TABLE "users";--`` (or a hostile default) becomes executable DDL when the sheet submits through `executeCustomSqlServerFn`. This is an authenticated-admin surface, but still SQL injection via form fields that users reasonably expect to be identifiers/types, not free SQL.

## Suggested fix

- Allowlist type tokens (e.g. `TEXT`, `INTEGER`, `VARCHAR(n)`, `NUMERIC(p,s)`, dialect-specific set), or
- Parse/validate types with a small grammar and reject anything outside it.
- For defaults: require literals (quoted string / number / `NULL` / known functions) or parameterize where the dialect allows.

Add adversarial unit tests on each builder.
