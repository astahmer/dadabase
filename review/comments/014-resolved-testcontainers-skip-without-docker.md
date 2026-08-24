# RESOLVED — Testcontainers suites failed hard without Docker

| Field       | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Status      | **resolved**                                                                |
| Severity    | medium (CI/dev UX)                                                          |
| Introduced  | long-standing `query-table-data` / `execute-custom-sql` PG container suites |
| Resolved by | `xluxzskp` — `isContainerRuntimeAvailable()` + `describe.skipIf`            |

## Original issue

No Docker daemon → ~99 `ContainerError` failures drowning real unit regressions.

## Resolution

Suites skip cleanly when `docker info` fails; still run when OrbStack/Docker is up.
