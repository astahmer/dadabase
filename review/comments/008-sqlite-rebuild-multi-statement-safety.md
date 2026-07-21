# SQLite rebuild ALTER depends on multi-statement `executeRaw` + global FK pragma

| Field | Value |
| --- | --- |
| Status | **open** |
| Severity | medium |
| Introduced | `qqsplosw` / `tytpwzst` |
| Relevant files | `src/lib/schema-mutate/build-sqlite-rebuild-alter-sql.ts`, `schema-mutate-sheet.tsx`, `executeCustomSql` |

## Summary

Rebuild SQL is a script:

```sql
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
...
COMMIT;
PRAGMA foreign_keys=ON;
```

It is submitted as one string via `executeCustomSql` → `conn.executeRaw`. Risks:

1. Driver / libsql may not run the whole batch atomically the way SQLite CLI does.
2. `PRAGMA foreign_keys=OFF` is connection-scoped; if the batch fails after OFF and before ON, later queries on a reused connection can run with FKs disabled.
3. Shadow table name `${table}__dadabase_rebuild` can collide if that name already exists.

## Suggested fix

- Execute steps explicitly in order on a reserved connection; always `PRAGMA foreign_keys=ON` in a `finally`.
- Use a unique shadow name (`__dadabase_rebuild_<uuid>`).
- Add an integration test that forces a mid-script failure and asserts FK pragma is restored.
