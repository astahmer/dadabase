# Dependency refresh plan — dadabase

Status: **planned** · Written: 2026-08-24
Rules from owner:

- Every dep pinned **exactly** (no `^`/`~`).
- If latest is broken/incompatible → pin the latest **working** version instead.
- Gates after each batch: `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test --run` (**always `--run`**). Frontend-only bumps skip tests per project instructions (typecheck + lint only).
- Rollback = one jj change per batch (`jj new` before each batch, describe + abandon on failure).

## Current-state findings (audited 2026-08-24)

- The repo is already almost fully current. `pnpm outdated` reports only 7 packages; a manual `npm view <pkg> version` sweep of every entry in `package.json` + catalog confirmed everything else is at its latest published version.
- `saveExact: true` is already set in `pnpm-workspace.yaml`, so all pins are exact today. No range cleanup needed.
- Catalog deps live in `pnpm-workspace.yaml` under `catalog:`; effect-family entries are handled by a separate plan.

## Batch 0 — deferred / out of scope

| Package                                   | Current                           | Latest                                  | Target                                                                                                       | Notes                                                                                                         |
| ----------------------------------------- | --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `effect`, all `@effect/*` catalog entries | `effect 3.22.1` (+14 `@effect/*`) | Effect **4 beta** line (`4.0.0-beta.*`) | **DEFERRED**                                                                                                 | Handled by `plans/effect-4-migration.md`. Latest stable 3.x is `3.22.x`; stay there until that plan executes. |
| `xstate`                                  | not installed                     | 5.x latest (~5.32+)                     | **ADDED later** by chat-runtime vendoring work (from emi-healthfit `@emi/core`). Pin exact at addition time. |

## Batch 1 — devtooling / lint / format (nothing to do)

All already latest: `oxlint 1.79.0`, `oxfmt 0.64.0`, `lefthook 2.1.10`, `vitest 4.1.11`, `@playwright/test 1.62.1`, `playwright-bdd 9.2.0`, `chrome-devtools-mcp 1.7.0`.

**Pairing rule:** `oxlint-tsgolint 7.0.2001` ↔ `@typescript/native-preview 7.0.0-dev.20260707.2` ↔ `typescript 7.0.2` are a working trio for the type-aware lint setup. Never bump one alone; bump all three together and re-run `pnpm check` (`oxlint --type-aware --type-check`) as the gate. No newer compatible set verified as of this audit → keep current pins.

Gates: n/a (no-op batch).

## Batch 2 — build tooling (small)

| Package                                                                                              | Current | Latest | Target pin | Notes                                       |
| ---------------------------------------------------------------------------------------------------- | ------- | ------ | ---------- | ------------------------------------------- |
| `@electric-sql/pglite` _(catalog)_                                                                   | 0.5.6   | 0.5.7  | `0.5.7`    | Patch bump; used by kysely-pglite test rig. |
| `@electric-sql/pglite-tools` _(catalog)_                                                             | 0.4.6   | 0.4.7  | `0.4.7`    | Patch bump; bump with pglite above.         |
| `vite`, `nitro`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `unplugin-jsx-source`, `drizzle-kit` | current | same   | no change  | Already latest.                             |

Gates: typecheck + lint + `pnpm test --run` (pglite is in the test path).

## Batch 3 — TanStack framework trio (bump together)

The Start/Router/router-plugin versions are cross-pinned; they must move as one commit.

| Package                           | Current  | Latest   | Target pin | Notes                         |
| --------------------------------- | -------- | -------- | ---------- | ----------------------------- |
| `@tanstack/react-router`          | 1.170.31 | 1.170.32 | `1.170.32` | Patch.                        |
| `@tanstack/react-start`           | 1.168.48 | 1.168.49 | `1.168.49` | Patch.                        |
| `@tanstack/router-plugin`         | 1.168.34 | 1.168.35 | `1.168.35` | Patch. Regenerates routeTree. |
| `@tanstack/react-query`           | 5.101.4  | 5.102.0  | `5.102.0`  | Minor.                        |
| `@tanstack/react-query-devtools`  | 5.101.4  | 5.102.0  | `5.102.0`  | Bump with query.              |
| `@tanstack/react-router-devtools` | 1.167.1  | 1.167.1  | no change  | Already latest.               |

Peer check done: react-query 5.102.0 peers `react ^18 || ^19` ✓.

Gates: typecheck + lint + dev-server smoke (router/start affect routing & SSR) + `pnpm test --run` if any server fns touched.

## Batch 4 — UI / data-grid libs

| Package                                                                                                                                                                                                                                                                                                                       | Current | Latest | Target pin                | Notes                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tanstack/match-sorter-utils`                                                                                                                                                                                                                                                                                                | 8.19.4  | 9.1.2  | `9.1.2`                   | **Safe major**: v9 `.d.ts` still exports identical `rankItem`/`rankings`/`compareItems` API used in `natural-language-parser.ts` + `query-state-machine.ts`. Independent of react-table version.                                                                                                                                                        |
| `@tanstack/react-table`                                                                                                                                                                                                                                                                                                       | 8.21.3  | 9.1.2  | **stay `8.21.3` for now** | v9 is a real breaking restructure (new `createTableHook` model; v8-style `useReactTable`/`ColumnDef` moved to legacy surface). Used across ~20 files in `src/components/data-table/**`. Do NOT mix into this batch — schedule a dedicated migration change; until then 8.21.3 **is** the latest working 8.x (verified against published versions list). |
| `ag-grid-community` / `ag-grid-react`, `@ark-ui/react`, `monaco-editor`, `@monaco-editor/react`, `lucide-react`, `cmdk`, `react-markdown`, `rehype-*`, `remark-gfm`, `highlight.js`, `tm-themes`, `tw-animate-css`, `tailwindcss`, `tailwind-merge`, `class-variance-authority`, `clsx`, `@dnd-kit/*`, `react-error-boundary` | current | same   | no change                 | All already latest.                                                                                                                                                                                                                                                                                                                                     |
| `@json-render/core` / `@json-render/react`                                                                                                                                                                                                                                                                                    | 0.20.0  | 0.20.0 | no change                 | Already latest.                                                                                                                                                                                                                                                                                                                                         |

Gates: typecheck + lint only (frontend-only).

## Batch 5 — server / runtime libs

| Package                                                                                                                                                                                                                                           | Current                           | Latest | Target pin | Notes                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `mysql2`                                                                                                                                                                                                                                          | 3.23.4                            | 3.24.1 | `3.24.1`   | Only outdated runtime dep.                                                                                                                  |
| `ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`, `@ai-sdk/openai`                                                                                                                                                                                      | 7.0.77 / 4.0.80 / 4.0.41 / 4.0.46 | same   | no change  | Already latest. Note: chat vendoring work will touch these surfaces — re-check freshness when it starts.                                    |
| `pg`, `pg-connection-string`, `ssh2`, `@libsql/client`, `@libsql/kysely-libsql`, `kysely`, `srvx`, `zipson`, `nanoid`, `sql-formatter`, `@modelcontextprotocol/sdk`, `@faker-js/faker`, `@testcontainers/postgresql`, `kysely-pglite`, `@types/*` | current                           | same   | no change  | All already latest. `kysely-pglite 0.6.1` stays patched (`patches/kysely-pglite@0.6.1.patch`) — re-verify patch applies on any future bump. |

Gates: typecheck + lint + `pnpm test --run` (server deps) + quick `pnpm dev` connection smoke against a local Postgres.

## Execution order & rollback

Run batches top→bottom (2 → 3 → 4 → 5); batch 1 is informational. Before each batch: `jj new -m "deps: batch N ..."`. If gates fail and can't be fixed trivially: `jj abandon` the batch change and record the failed pair in this doc's table notes ("latest broken, pinned back to X").

## Follow-ups spawned by this audit

1. **`@tanstack/react-table` v9 migration** — separate planned change; ~20 files in `src/components/data-table/**`, plus relationships sub-row tables. Blocked until scheduled; keep 8.21.3 until then.
2. **effect family** — see `plans/effect-4-migration.md`.
3. **xstate** — added exactly-pinned by chat-runtime vendoring.
