## raw SQL viewer/editor
- edit in datatable line? double click triggers the edit UI with a commit phase (nothing is persisted until you click save with the count + list of changes available to review / the translated raw SQL update)
- monaco editor editor.changeViewZones for inline actions (run/explain/format/fullscreen/copy/save)
- diagnostics in editor for SQL issues (missing table, missing column, syntax error etc?)
- support BETWEEN operand AND operand
- unlink/detach editor from current table = allows to write arbitrary queries without changing the table context/while viewing results using UI controls or another editor = kinda like a tab inside another


## filters
- support NOT operator in natural language search
- support IN operator
- try to match possible operators based on datatype; ex: timestamps shouldnt have
- date filter with calendar/date range with presets (today, last 7 days, last 30 days, this month, last month, this year, last year)


## json viewer/editor
- copy button should use the <Clipboard> component with a temp success state

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


## new features
- add a way to see the query plan for the current query
- add a way to visualize indexes for the current table
- add a way to visualize foreign keys for the current table
- add a way to favorite/save queries
- zen mode (collapsible everything, filters, small status bar, no page header with connection name etc)
- cmd+k command palette for all actions (new query, switch connection, table, switch db, view indexes, view foreign keys, view query plan etc)
- investigate using the lib that allows to move/reorder components in a gridlike manner with snap, like dashboard widgets, for full customization -> https://dockview.dev/ ?
- expandable table row with nested entity -> kinda solved already with bottom relationship panel but some people might prefer inline expansion
- cancellable queries (+ rm disabled state for buttons while a query is running)
- after a `select {selection} from {table} j` (or `jo`/`joi`/`join`/`l`/`le`/`lef`/`left`/`left j`/etc) we should suggest a prefilled line of `join {otherTableWithForeignKeysOnTheCurrentFromTable} ON {table}.{primaryKey} = {otherTableWithForeignKeysOnTheCurrentFromTable}.{foreignKey}`
- editor themes (one dark pro etc)
- autosave manually executed queries
- SQL snippets
- add save action in SQL query bar actions
- drag/drop tabs to reorder
- sidebar fixed part with icons cant be collapsed: icons ideas -> switch connection, dark mode, refresh results, reset page, saved queries, query history, settings (localstorage saved prefs that are used as defaults for url params?)
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
- log affected rows for mutation queries (visible in the detail dialog)
- completion provider -> insert {here} suggest "into" / insert into {here} suggest tables and insert snippet with prefilled column names / values?
- when updating the SQL through the UI (ex: adding a join); if currently looking at the SQL editor we should update its content
- replace biome with oxc
