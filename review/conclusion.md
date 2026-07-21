# Range review conclusion — `xumoqppz` → tip

**Range:** `xumoqppz` through tip (includes competitor-gap wave + post-review fixes).  
**Scope:** ~90 revisions spanning row-editor foundation → competitor-gap wave → post-ship / review fixes.

## Verdict

Open review items **001–010** are addressed in follow-up revisions (`pmltpwry` … tip). Remaining comment files are resolved-only notes (011–015).

## Fixed in follow-ups

| ID | Severity | Fix revision (message) |
| --- | --- | --- |
| 003 | high | `pmltpwry` — allowlist `dataType` / `DEFAULT` in DDL builders |
| 002 / 007 | high / low | `vkrmtpou` — MySQL introspection branches + `pgSqliteHandlers` usage |
| 006 | medium | `vkrmtpou` — cap all-tables FK concurrency at 6 |
| 001 | high | `kzprzxll` — PoolCache opens SSH local forward |
| 008 | medium | `zzskpksv` — reserved-connection SQLite rebuild + FK pragma `finally` |
| 004 | medium | `vtvmtxmx` — paste confirm dialog + transactional bulk insert |
| 005 | medium | `ympslmwz` — dependent row counts on cascade preview |
| 009 | low | Monaco window hook cleared on unmount (+ review file removed) |
| 010 | low | `ideas.md` notes updated for SSH/MySQL honesty |

## Resolved earlier in the stack

| ID | Resolved by | Link |
| --- | --- | --- |
| 011 | `wnslvszo` | [comments/011-resolved-cascade-hard-block.md](./comments/011-resolved-cascade-hard-block.md) |
| 012 | `mqlntknv` / `mkspvyuv` | [comments/012-resolved-row-select-vs-expand.md](./comments/012-resolved-row-select-vs-expand.md) |
| 013 | `xwxxssls` | [comments/013-resolved-json-monaco-controlled-state.md](./comments/013-resolved-json-monaco-controlled-state.md) |
| 014 | `xluxzskp` | [comments/014-resolved-testcontainers-skip-without-docker.md](./comments/014-resolved-testcontainers-skip-without-docker.md) |
| 015 | `skzovpuy` | [comments/015-resolved-e2e-sqlite-busy-reset.md](./comments/015-resolved-e2e-sqlite-busy-reset.md) |

## Residual risk (acceptable follow-ups)

- MySQL: no-PK system row identity, some PG-catalog-only helpers, and join quoting edge cases.
- Cascade counts: direct single-column FKs only; transitive hops stay structural.
- SSH: private-key auth only; concurrent `getOrCreate` races discard the losing tunnel.
