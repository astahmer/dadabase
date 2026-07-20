# Ideas backlog

Done items removed. Trash: generative UI (too vague), dockview layout (overkill), dblclick-cell-copy (conflicts with inline edit).

## raw SQL viewer/editor

- [ ] edit in datatable with commit phase (review pending changes + translated UPDATE SQL before save) — today saves immediately on blur
- [ ] monaco `changeViewZones` for inline actions (run/explain/format/fullscreen/copy/save) — toolbar exists; viewZones optional polish
- [ ] diagnostics in editor (missing table/column/syntax) via `setModelMarkers`
- [ ] real `BETWEEN` operator (NL currently expands to gte+lte only)
- [ ] unlink/detach editor from current table while keeping table context (custom SQL tab is close but not the same)

## filters

- [ ] broader NOT in natural language (`NOT status = active` style) + invert toggle in filter UI
- [ ] match operators to datatype (e.g. timestamps shouldn't offer contains/starts_with)
- [ ] date filter with calendar + range presets (today, last 7/30 days, this/last month, this/last year)
- [ ] fix filter special values (`null`, `TODAY()` → valid SQL; build-where must not quote them)
- [ ] GROUP BY / HAVING support in filters UI (parser already understands them)

## rows table

- [ ] filters in datatable header (`th`)
- [ ] cmd+f in virtualized table → highlight/filter
- [ ] store page limit in localStorage and use as default instead of hardcoded 50

## ai (future)

- [ ] suggest missing indexes
- [ ] suggested queries from schema/data (e.g. distinct values for string enums)

## query history / favorites

- [ ] favorites UI + Badge distinction (backend `query_favorites` exists; no client save/list yet)
- [ ] save action in SQL query bar (wires into favorites)

## new features

- [ ] visualize indexes for the current table (server has `getTableIndexes`; no dedicated UI)
- [ ] zen mode (collapse chrome: filters, small status bar, hide page header)
- [ ] cmd+k command palette (new query, switch connection/table/db, indexes, FKs, query plan, …)
- [ ] cancellable queries with real AbortController (Cancel button today only resets mutation client-side)
- [ ] after typing `join` / `left j` / … suggest prefilled `JOIN other ON pk = fk` snippet from FK metadata
- [ ] editor themes beyond vs-light/vs-dark (One Dark Pro etc.)
- [ ] SQL snippets library
- [ ] drag/drop tabs to reorder
- [ ] sidebar fixed icon rail (switch connection, theme, refresh, reset, saved queries, history, settings)
- [ ] column aliases end-to-end (parsing, completion, filters, visibility, sorting)
- [ ] expandable table row with nested entity inline (bottom relationship panel covers most cases)

## issues

- [ ] `hiddenColumnList` should be `{ table, column }` not bare column name strings
- [ ] SQL editor maximize → menu: expand panel vs fullscreen (collapse sidebar + filters + rows)
- [ ] UI to display/edit the `inverted` flag on filter conditions
- [ ] SQL completion: inverted operator suggestions
- [ ] INSERT completion: `INTO` → tables → column/values snippet
- [ ] update deps (ongoing chore)
