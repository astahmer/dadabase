# Ideas backlog

Done items removed. Trash: dockview layout (overkill), dblclick-cell-copy (conflicts with inline edit).

## raw SQL viewer/editor

- [ ] edit in datatable with commit phase (review pending changes + translated UPDATE SQL before save) — today saves immediately on blur
- [ ] monaco `changeViewZones` for inline actions (run/explain/format/fullscreen/copy/save) — toolbar exists; viewZones optional polish
- [ ] diagnostics in editor (missing table/column/syntax) via `setModelMarkers`
- [x] real `BETWEEN` operator (NL, SQL parser, build-where, filter UI)
- [ ] unlink/detach editor from current table while keeping table context (custom SQL tab is close but not the same)

## filters

- [x] broader NOT in natural language (`NOT status = active` style)
- [x] invert toggle in filter UI + inverted operator suggestions in SQL completion
- [x] match operators to datatype (e.g. timestamps shouldn't offer contains/starts_with)
- [ ] date filter with calendar + range presets (today, last 7/30 days, this/last month, this/last year)
- [x] fix filter special values (`null`, `TODAY()` → valid SQL; build-where must not quote them)
- [ ] GROUP BY / HAVING support in filters UI (parser already understands them)

## rows table

- [ ] filters in datatable header (`th`)
- [ ] cmd+f in virtualized table → highlight/filter
- [x] store page limit in localStorage and use as default instead of hardcoded 50

## ai (future)

- use a BYOK approach with OpenAI first using the vercel ai sdk
- [ ] suggest missing indexes
- [ ] suggested queries from schema/data (e.g. distinct values for string enums)
- ask for a query in natural language → generate SQL → run → show results
- have generative UI for charts/stats etc with https://github.com/vercel-labs/json-render

## query history / favorites

- [x] favorites UI + Badge distinction
- [x] save action in SQL query bar (wires into favorites)

## new features

- [x] visualize indexes for the current table (server has `getTableIndexes`; no dedicated UI)
- [ ] zen mode (collapse chrome: filters, small status bar, hide page header)
- [ ] cmd+k command palette (new query, switch connection/table/db, indexes, FKs, query plan, …)
- [ ] cancellable queries with real AbortController (Cancel button today only resets mutation client-side)
- [x] after typing `join` / `left j` / … suggest prefilled `JOIN other ON pk = fk` snippet from FK metadata
- [ ] editor themes beyond vs-light/vs-dark (One Dark Pro etc.)
- [ ] SQL snippets library
- [ ] drag/drop tabs to reorder
- [ ] sidebar fixed icon rail (switch connection, theme, refresh, reset, saved queries, history, settings)
- [ ] column aliases end-to-end (parsing, completion, filters, visibility, sorting)
- [ ] expandable table row with nested entity inline (bottom relationship panel covers most cases)

## issues

- [ ] `hiddenColumnList` should be `{ table, column }` not bare column name strings
- [x] SQL editor maximize → menu: expand panel vs fullscreen (collapse sidebar + filters + rows)
- [x] UI to display/edit the `inverted` flag on filter conditions
- [x] SQL completion: inverted operator suggestions
- [ ] INSERT completion: `INTO` → tables → column/values snippet
- [ ] update deps (ongoing chore)
