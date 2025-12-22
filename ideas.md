## raw SQL viewer/editor
- edit in datatable line? double click triggers the edit UI with a commit phase (nothing is persisted until you click save with the count + list of changes available to review / the translated raw SQL update)
- monaco editor editor.changeViewZones for inline actions (run/explain/format/fullscreen/copy/save)
- diagnostics in editor for SQL issues (missing table, missing column, syntax error etc?)
- suggest keywords like SELECT/CREATE/UPDATE/DELETE/DROP/ALTER
- warning/confirmation dialog on execute queries with DROP/ALTER
- support `<>` operator (same as !=)
- support BETWEEN operand AND operand


## exports

- copy/export row or whole data (csv, json, tsv, toon) or even as INSERT SQL statement
- copy/export table structure (csv, json, tsv, toon)

## filters
- support NOT operator in natural language search
- support IN operator
- try to match possible operators based on datatype; ex: timestamps shouldnt have
- the filter "column" dropdown should show informations like data type badge etc (like the column header) next to each column name, align it to the right
- the filter "column" dropdown should be prefixed with the table name (because later on we will add the ability to filter with joins)
- date filter with calendar/date range with presets (today, last 7 days, last 30 days, this month, last month, this year, last year)
- value listbox > handle special values like `null` / today / now() / ...


## json viewer/editor
- easy to use JSON filters -> search in path / contains string; eval JS expression (row.nested.prop.name.includes('test') or rows.filter(r => r.nested.prop.name === 'test') ) / use JSON path to navigate to nested objects
- copy button should use the <Clipboard> component with a temp success state
- when clicking a table row -> JSON viewer that auto fetch nested entities with foreign keys (up to a limit of 50 rows per relation)
- inline popover + expanded view copy button should also include expanded nested entities (relationships based on foreign keys)
- JSON viewer like chrome console evaluated array

## rows table
- chrome-like JS repl for visible rows
- filters in datatable header (th) ?
- double clicking a cell value should copy it to the clipboard (?)
- cmd+f in table (virtualized rows needs it) -> highlight/filter?
- store limit (50 etc) in localstorage and use that as default instead of hardcoded 50

## ai

- suggest missing indexes to add
- suggested queries based on the current table schema and data -> find all possible values for a column (helps with enums stored as strings)
- generative UI for queries (?) https://vercel.com/blog/ai-sdk-3-generative-ui

## query history/logger
- query history (persisted across sessions; only saves successful queries that were made by a user action) with a Badge distinction for the saved/favorites queries
- query logger -> show results on the right, or top/bottom + rows returned/affected
- add a way to view (explicit/manual) query history


## new features
- add a way to see the query plan for the current query
- add a way to visualize indexes for the current table
- add a way to visualize foreign keys for the current table
- add a way to favorite/save queries
- zen mode (collapsible everything, filters, small status bar, no page header with connection name etc)
- cmd+k command palette for all actions (new query, switch connection, table, switch db, view indexes, view foreign keys, view query plan etc)
- investigate using the lib that allows to move/reorder components in a gridlike manner with snap, like dashboard widgets, for full customization -> https://dockview.dev/ ?
- expandable table row with nested entity -> kinda solved already with bottom relationship panel but some people might prefer inline expansion
- row selection with checkboxes + bulk actions (delete, export, copy etc)
- cancellable queries (+ rm disabled state for buttons while a query is running)
- after a `select {selection} from {table} j` (or `jo`/`joi`/`join`/`l`/`le`/`lef`/`left`/`left j`/etc) we should suggest a prefilled line of `join {otherTableWithForeignKeysOnTheCurrentFromTable} ON {table}.{primaryKey} = {otherTableWithForeignKeysOnTheCurrentFromTable}.{foreignKey}`
- editor themes (one dark pro etc)
- autosave manually executed queries
- SQL snippets
- add save action in SQL query bar actions

- handle column aliases: SQL parsing, SQL completion, filters, column visibility, sorting etc

## issues
- group by/having support in filters UI
- hiddenColumnList should use an object with the column AND the table name
- SQL editor maximize button should be open a menu with multiple options:
    - expand panel (collapse rows content)
    - fullscreen (collapse sidebar + hide connectionpagefilters + collapse rows content)
- Update UI components to display/edit the inverted flag
- Update SQL completion provider for inverted operator suggestions
- update deps
