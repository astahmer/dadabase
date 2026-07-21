# RESOLVED — E2E sample DB reset hit `SQLITE_BUSY`

| Field | Value |
| --- | --- |
| Status | **resolved** |
| Severity | medium (flake) |
| Introduced | shared fixture SQLite + long-lived Vite pool (exposed under parallel schema mutate scenarios) |
| Resolved by | `skzovpuy` — retry/backoff in `resetSampleDb` |

## Original issue

Background `Given` reset raced the app server’s open connection → `LibsqlError: SQLITE_BUSY`, failing the next scenario in ~100ms.

## Resolution

Retry loop on busy/locked with exponential-ish backoff; client always closed in `finally`.
