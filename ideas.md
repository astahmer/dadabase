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
- investigate using the lib that allows to move/reorder components in a gridlike manner with snap, like dashboard widgets, for full customization -> https://dockview.dev/ ?
- expandable table row with nested entity
- SQL button to quickly preview the generated SQL query from the current filters/order by/limit (and copy it)
- store limit (50 etc) in localstorage and use that as default instead of hardcoded 50
- cmd+f in table
- cmd+k

- https://x.com/mac_hour/status/1988953549305442655
- font-variant: numeric-tabs; sur toutes tes cellules, pour améliorer le rendu
- La cellule row_id est trop large pour sa data. Tu devrais afficher les types de champs en tooltip plutôt
- Le nom de la table browsée devrait être un peu plus visible (et en haut plutôt qu'en bas)

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

---

<!-- TODO rm -->
the content you described in the right sidebar is something we already kinda have, even tho currently it is specific to a single column rather than the whole row. maybe it would be nice to have what you describe. but thats not the main focus! for now i mostly want to display ROWS rather than names/counts of the relationship tables. e.g if I have a youtube_channel table i want to easiliy see the youtube_video with a matching youtube_video.channel_id from the row im currently interested in

i think i know where i want to display the relation rows: below the main table; so that it still "in context" as in "in the current page" but not "in context" like "disturbing the main table rows visualization"

so that we can keep a similar wide datatable as in the screenshot i share but instead of being as a subrow it could just be something that is BELOW the (main) rows datatable; it could even be collapsed. then when collapsed it could show buttons for easily opening a given relationship datatable rows. ex: if im mainly looking at the youtube_channel table then on the bottom collapsed bar i could see a button to open the youtube_video rows but also another that would show another table linked to the selected (main table) youtube_channel row; like for example maybe there could be a youtube_playlist table showing all of the channel's playlist.

how to select a row? that probably be either: as simple as using the existing Checkbox that allows for row selection (that displays an ActionBar at the bottom) or by using a dedicated icon/menu item (in the action column and in the right click context menu)


-> select a row -> there's a button in the ActionBar to display the right sidebar appears with tabs: 1 to show the relationship tables from the selected row; another to show the JSON data of the selected row (with expandable relationship nodes that you can lazy-load) and that you can copy/export
