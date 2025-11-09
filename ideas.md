- copy/export data (csv, json, tsv, toon)
- copy/export table structure (csv, json, tsv, toon)
- switch filter from query builder to SQL raw input (switch with icon buttons like the view mode buttons)
- JSON viewer available when clicking a table row -> show JSON data in a side panel
- when clicking a table row -> JSON viewer that auto fetch nested entities with foreign keys (up to a limit of 50 rows per relation)
- when clicking a table row -> add a way to copy as JSON (with nested entities based on foreign keys)
- when clicking a table row -> show related entities based on that id + foreign keys
- filters in datatable header (th) ?
- edit in datatable line? double click triggers the edit UI with a commit phase (nothing is persisted until you click save with the count + list of changes available to review / the translated raw SQL update)
- support NOT operator in natural language search
- try to match possible operators based on datatype; ex: timestamps shouldnt have
- rows count (in muted text) for each table in the sidebar like `{tableName} ({rowsCount})`
- add a way to see the query plan for the current query
- add a way to visualize indexes for the current table
- add a way to visualize foreign keys for the current table
- suggested queries based on the current table schema and data -> find all possible values for a column (helps with enums stored as strings)

- add a way to favorite/save queries
- add a way to view query history
- generative UI for queries (?) https://vercel.com/blog/ai-sdk-3-generative-ui


---

- current tab is showing the wrong one when using different filters leading to another table (with the "follow to X" right click feature), the current tab should always come from the URL rather than its internal state (that we could maybe remove entirely? up to you)
- the column sizes are too small and seem fixed, it should be dynamic based on column header or content size but still resizable if needed and with a min/max width
- we need to prefetch the data needed by the "view all relationships" when opening the right click menu to make it faster
- the filter "column" dropdown should show informations like data type badge etc (like the column header) next to each column name, align it to the right
- the filter "column" dropdown should be prefixed with the table name (because later on we will add the ability to filter with joins)
- forwardRef render functions accept exactly two parameters: props and ref. Did you forget to use the ref parameter?
overrideMethod @ installHook.js:1
exports.forwardRef @ chunk-SDBL6XOS.js?v=08d9c5c8:807
(anonymous) @ listbox-menu.tsx:14Understand this error
- remove any reference to `<ark.xxx` and instead just use the raw `<xxx` tag, this only means you can remove any HTMLArkProps and instead use React.HTMLAttributes or even ExposedComponentProps for the allowed tags, this will lead to a way better tsc perf as there will be a lot less properties (and also better autocompletions when using these components)
- remove any forwardRef and just pass props/refs directly (React 19 works fine like this)


- select to sort the list of references by count or A-Z
- data table size "minimal" even smaller than compact


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
