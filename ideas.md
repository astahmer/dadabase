# Ideas backlog

Done items removed. Trash: dockview layout (overkill), dblclick-cell-copy (conflicts with inline edit).

## raw SQL viewer/editor

- [x] edit in datatable with commit phase (review pending changes + translated UPDATE SQL before save) — today saves immediately on blur
- [x] monaco `changeViewZones` for inline actions (run/explain/format/fullscreen/copy/save) — toolbar exists; viewZones optional polish
- [x] diagnostics in editor (missing table/column/syntax) via `setModelMarkers`
- [x] real `BETWEEN` operator (NL, SQL parser, build-where, filter UI)
- [x] unlink/detach editor from current table while keeping table context (custom SQL tab is close but not the same)

## filters

- [x] broader NOT in natural language (`NOT status = active` style)
- [x] invert toggle in filter UI + inverted operator suggestions in SQL completion
- [x] match operators to datatype (e.g. timestamps shouldn't offer contains/starts_with)
- [x] date filter with calendar + range presets (today, last 7/30 days, this/last month, this/last year)
- [x] fix filter special values (`null`, `TODAY()` → valid SQL; build-where must not quote them)
- [x] GROUP BY / HAVING support in filters UI (parser already understands them)

## rows table

- [x] filters in datatable header (`th`)
- [x] cmd+f in virtualized table → highlight/filter
- [x] store page limit in localStorage and use as default instead of hardcoded 50

## ai (future)

- [x] use a BYOK approach with OpenAI first using the vercel ai sdk
- [x] suggest missing indexes
- [x] suggested queries from schema/data (e.g. distinct values for string enums)
- [x] ask for a query in natural language → generate SQL → run → show results
- [x] have generative UI for charts/stats etc with https://github.com/vercel-labs/json-render

## query history / favorites

- [x] favorites UI + Badge distinction
- [x] save action in SQL query bar (wires into favorites)

## new features

- [x] visualize indexes for the current table (server has `getTableIndexes`; no dedicated UI)
- [x] zen mode (collapse chrome: filters, small status bar, hide page header)
- [x] cmd+k command palette (new query, switch connection/table/db, indexes, FKs, query plan, …)
- [x] cancellable queries with real AbortController (Cancel button today only resets mutation client-side)
- [x] after typing `join` / `left j` / … suggest prefilled `JOIN other ON pk = fk` snippet from FK metadata
- [x] editor themes beyond vs-light/vs-dark (One Dark Pro etc.)
- [x] SQL snippets library
- [x] drag/drop tabs to reorder
- [x] sidebar fixed icon rail (switch connection, theme, refresh, reset, saved queries, history, settings)
- [x] column aliases end-to-end (parsing, completion, filters, visibility, sorting)
- [x] expandable table row with nested entity inline (bottom relationship panel covers most cases)

## issues

- [x] `hiddenColumnList` should be `{ table, column }` not bare column name strings
- [x] SQL editor maximize → menu: expand panel vs fullscreen (collapse sidebar + filters + rows)
- [x] UI to display/edit the `inverted` flag on filter conditions
- [x] SQL completion: inverted operator suggestions
- [x] INSERT completion: `INTO` → tables → column/values snippet
- [x] update deps (ongoing chore)

## Later / parked

- [ ] Views / triggers / functions browser (read + open definition) — deferred for now
- [ ] Shared saved-query sync — not needed; full URL state is already bookmarkable

## Competitor gap backlog (in progress / next)

- [x] Export result/table as CSV / JSON / SQL INSERT
- [x] Import wizard (CSV/JSON → typed columns → INSERT preview)
- [x] ER diagram (FK graph; click → open table)
- [x] SSH tunnel + SSL connection presets
- [x] Monaco `changeViewZones` per-statement actions + multi-result grids
- [x] Explain / query plan UI (enhance existing; SQLite + richer tree)
- [x] Index create/drop + FK editor
- [x] Schema compare / diff → migration SQL
- [x] SQLite ALTER COLUMN via table rebuild
- [x] Clipboard paste TSV/CSV as rows into grid
- [x] Deeper JSON / BLOB cell viewers
- [x] FK-aware delete with cascade preview
- [x] AI chat thread (multi-turn NL→SQL on whole schema)
- [x] MySQL / MariaDB dialect
- [x] Read-only connection mode + dangerous-op guards

Notes:

- SSH: URL encoding + `openSshLocalForward`; `PoolCache` opens the tunnel and rewrites the driver URL to `127.0.0.1` (closes on pool eviction). Private-key auth only.
- MySQL: dialect/pool/form/try-connection + dedicated `information_schema` / SHOW introspection branches (and `pgSqliteHandlers` where SQL is shared-safe). Joins/no-PK identity and some PG-only paths may still need follow-up.
