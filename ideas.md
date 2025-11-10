- copy/export row or whole data (csv, json, tsv, toon) or even as INSERT SQL statement
- copy/export table structure (csv, json, tsv, toon)
- switch filter from query builder to SQL raw input (switch with icon buttons like the view mode buttons)
- easy to use JSON filters -> search in path / contains string; eval JS expression (row.nested.prop.name.includes('test') or rows.filter(r => r.nested.prop.name === 'test') ) / use JSON path to navigate to nested objects
- when clicking a table row -> JSON viewer that auto fetch nested entities with foreign keys (up to a limit of 50 rows per relation)
- when clicking a table row -> add a way to copy as JSON (with nested entities based on foreign keys)
- when clicking a table row -> show related entities based on that id + foreign keys
- filters in datatable header (th) ?
- edit in datatable line? double click triggers the edit UI with a commit phase (nothing is persisted until you click save with the count + list of changes available to review / the translated raw SQL update)
- support NOT operator in natural language search
- try to match possible operators based on datatype; ex: timestamps shouldnt have
- add a way to see the query plan for the current query
- add a way to visualize indexes for the current table
- add a way to visualize foreign keys for the current table
- suggested queries based on the current table schema and data -> find all possible values for a column (helps with enums stored as strings)
- suggest missing indexes to add
- date filter with calendar/date range with presets (today, last 7 days, last 30 days, this month, last month, this year, last year)
- double clicking a cell value should copy it to the clipboard
- zen mode (collapsible everything, filters, small status bar, no page header with connection name etc)
- value listbox > null / today
- query logger on the bottom (collapsible), shows the current session queries with status (success/fail/running) / type (table and schemas / enums / constraints / rows for public.xxx / total for public.xxxx / columns for public.xxx) / execution time + query preview (slice it, then open the full details on click in a dialog with the query on the left (and parameters below) and the results on the right, or top/bottom) + rows returned/affected
- query history (persisted across sessions; only saves successful queries that were made by a user action) with a Badge distinction for the saved/favorites queries
- investigate using the lib that allows to move/reorder components in a gridlike manner with snap, like dashboard widgets, for full customization
- expandable table row with nested entity
- right click on column header to show context menu with options (sort asc/desc, filter, hide column, resize column to fit content/to minimum)
- SQL button to quickly preview the generated SQL query from the current filters/order by/limit (and copy it)
- virtualizing the datatable rows for performance

- add a way to favorite/save queries
- add a way to view query history
- generative UI for queries (?) https://vercel.com/blog/ai-sdk-3-generative-ui


---

- the filter "column" dropdown should show informations like data type badge etc (like the column header) next to each column name, align it to the right
- the filter "column" dropdown should be prefixed with the table name (because later on we will add the ability to filter with joins)

---
VSCode inspiration:

✅ Cmd+click to follow reference (but make it prominent in UI too since not everyone uses KB)
✅ Side panel is better than massive modal for relationships
🎯 Consider breadcrumb trail at top: "User 5 → Order 42 → Invoice 101" to show navigation history

---

💡 Quick compare: Select two rows or two cells → compare (show git diff with inline/side-by-side)
--

Phase 4: Polish & Advanced Features (optional)
├─ Relationship explorer side panel
├─ Breadcrumb navigation trail
├─ Keyboard shortcuts
├─ Performance optimization for large datasets
└─ Graph visualization (if useful)
