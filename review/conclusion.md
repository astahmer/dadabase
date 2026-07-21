# Range review conclusion — `xumoqppz` → tip

**Range:** `xumoqppz` (`feat(server): parameterized insert/update/fk-lookup`) through `@-` (`skzovpuy` / tip empty WC).  
**Scope:** ~90 revisions spanning row-editor foundation → competitor-gap wave → post-ship fixes. Docs-only / pure chore bumps reviewed lightly; focus on security, correctness, dialect completeness, and testability.

## Verdict

Ship-quality progress on row editing, schema mutate, export/import libs, explain, and read-only guards. Several competitor-gap items are **MVP-shaped** (SSH, MySQL) and should not be treated as finished. One **SQL injection** class of bug in schema-mutate builders needs a follow-up before advertising DDL UI broadly.

## Unsolved issues (action required)

| ID | Severity | Title | Link |
| --- | --- | --- | --- |
| 001 | high | SSH tunnel never opened by pool | [comments/001-ssh-tunnel-not-wired-into-pool.md](./comments/001-ssh-tunnel-not-wired-into-pool.md) |
| 002 | high | MySQL introspection incomplete / `orElse` | [comments/002-mysql-introspection-incomplete.md](./comments/002-mysql-introspection-incomplete.md) |
| 003 | high | Unquoted `dataType` / `DEFAULT` in DDL builders | [comments/003-schema-mutate-unquoted-datatype-default.md](./comments/003-schema-mutate-unquoted-datatype-default.md) |
| 004 | medium | Paste: native confirm + non-atomic inserts | [comments/004-paste-rows-confirm-and-partial-inserts.md](./comments/004-paste-rows-confirm-and-partial-inserts.md) |
| 005 | medium | Cascade preview has no dependent row counts | [comments/005-cascade-preview-structural-only.md](./comments/005-cascade-preview-structural-only.md) |
| 006 | medium | Unbounded concurrency in all-tables FK fetch | [comments/006-getAllTablesForeignKeys-unbounded-concurrency.md](./comments/006-getAllTablesForeignKeys-unbounded-concurrency.md) |
| 007 | low | `pgSqliteHandlers` dead code | [comments/007-pgsqlitehandlers-dead-code.md](./comments/007-pgsqlitehandlers-dead-code.md) |
| 008 | medium | SQLite rebuild multi-statement / FK pragma safety | [comments/008-sqlite-rebuild-multi-statement-safety.md](./comments/008-sqlite-rebuild-multi-statement-safety.md) |
| 009 | low | Monaco e2e hook on `window` | [comments/009-json-monaco-window-hook.md](./comments/009-json-monaco-window-hook.md) |
| 010 | low | `ideas.md` overclaims SSH/MySQL completeness | [comments/010-ideas-overclaims-ssh-mysql.md](./comments/010-ideas-overclaims-ssh-mysql.md) |

## Resolved during the stack (no further action)

| ID | Resolved by | Link |
| --- | --- | --- |
| 011 | `wnslvszo` | [comments/011-resolved-cascade-hard-block.md](./comments/011-resolved-cascade-hard-block.md) |
| 012 | `mqlntknv` / `mkspvyuv` | [comments/012-resolved-row-select-vs-expand.md](./comments/012-resolved-row-select-vs-expand.md) |
| 013 | `xwxxssls` | [comments/013-resolved-json-monaco-controlled-state.md](./comments/013-resolved-json-monaco-controlled-state.md) |
| 014 | `xluxzskp` | [comments/014-resolved-testcontainers-skip-without-docker.md](./comments/014-resolved-testcontainers-skip-without-docker.md) |
| 015 | `skzovpuy` | [comments/015-resolved-e2e-sqlite-busy-reset.md](./comments/015-resolved-e2e-sqlite-busy-reset.md) |

## What looks solid

- Parameterized row mutations + read-only guards on insert/update/delete/custom SQL paths (`xumoqppz` → `mmrrzsqm`).
- Schema-mutate identifier quoting via `quoteIdent` (names/tables); rebuild approach for SQLite alters is the right product direction.
- Pure libs (export/import/explain/schema-diff/cascade graph/paste parser) are test-backed and separable from UI.
- Post-wave e2e hardening addressed real product bugs (cascade disable, expand-column targeting), not only flakes.

## Suggested merge / follow-up order

1. **003** (DDL injection allowlist) — security  
2. **001** + **002** / **007** (SSH wire-up, MySQL introspection or honest docs)  
3. **008** (rebuild execution safety)  
4. **004**, **005**, **006** (UX / perf)  
5. **009**, **010** (cleanup / docs)

## Review method note

Not every of the ~90 commits has a dedicated comment file. Commits that are tests-only, ideas parking, dependency bumps, or narrowly scoped UI polish without new risk surfaces were skimmed via message + stat and folded into the themes above when relevant.
