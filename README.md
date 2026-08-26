# dadabase

Local-first database GUI for exploring and editing Postgres, MySQL, SQLite, and LibSQL.

## Quick start

```bash
pnpm install
pnpm dev          # http://127.0.0.1:3005
```

Optional app DB (stores saved connections / query history):

```env
DB_URL=file:./app.db
```

AI assistant (BYOK OpenAI — key stays in the browser; requests are proxied once so CORS works):

```env
# no server-side key required — paste sk-… in the AI drawer
```

## Scripts

| Command                     | Purpose                                    |
| --------------------------- | ------------------------------------------ |
| `pnpm dev`                  | Vite + TanStack Start on `127.0.0.1:3005`  |
| `pnpm build` / `pnpm start` | Production build + serve                   |
| `pnpm typecheck`            | `tsgo --noEmit`                            |
| `pnpm check`                | oxlint (type-aware); does **not** auto-fix |
| `pnpm test:run`             | Vitest unit/integration                    |
| `pnpm test:e2e`             | Playwright BDD features                    |

## Features

### Connections

- Postgres / MySQL / SQLite / LibSQL URLs
- DuckDB database files (embedded analytics engine)
- CSV files as editable databases (single `.csv` file or a directory of `*.csv`)
- Optional SSL mode + SSH tunnel markers on the URL
- Read-only mode (`dadabase_readonly`) blocks mutations
- Sidebar: databases → schemas → tables with filter

### CSV connections

- Each `*.csv` file becomes a table; column types are inferred by DuckDB's
  `read_csv_auto` (full-scan, UTF-8 / comma-delimited)
- Edits apply to an in-memory table — nothing touches your file until you press
  **Save to file** in the rows view
- Save writes atomically: previous file version is kept once as `<name>.csv.bak`
- Size guidance: total data ≥ 100 MB shows a warning at connect time; above 1 GB
  the connection is refused by default (the embedded engine holds roughly the
  uncompressed data in RAM)

### Data browsing & editing

- Paginated rows, column sort / nulls order, client-side JS filter
- Inline cell edit + pending edits bar
- Row editor sheet (incl. JSON/JSONB Monaco)
- Paste TSV/CSV rows with confirm dialog
- Bulk delete with cascade preview / dependent counts
- Foreign-key lookup selects + quick references drawer
- Relationship explorer / related-row subtables
- Join-tables dialog (multi-table query building)

### SQL editor

- Monaco SQL editor with completions + diagnostics
- Multi-statement scripts; per-statement Run/Explain zones
- Explain plan drawer, format, snippets, fullscreen
- Destructive-query confirm before write SQL

### Schema tools

- Create / alter / drop via schema mutate sheet
- SQLite table rebuild for unsupported ALTER paths
- Index / FK mutate sheet
- Schema explorer + schema diff / migration SQL preview
- Import data sheet

### AI assistant (BYOK)

- Natural-language → SQL using the **whole schema**
- Safe `LIMIT 100` unless the user asks otherwise (prompt + post-process)
- Apply / run generated SQL into the editor
- Index / query suggestions without a key

### Other

- Query history logger
- Command palette
- Zen mode, theme, export CSV/TSV/INSERT
- ER diagram layout helpers

## Architecture (short)

- **UI**: TanStack Start / Router / Query / Table
- **Server fns**: TanStack `createServerFn` → Effect SQL (pg / mysql2 / libsql)
- **App DB**: Drizzle + LibSQL for saved connections
- **Pools**: `PoolCache` with optional lazy SSH tunnel (`ssh2` not on the default graph)

## Tests

- Unit/integration: `src/**/*.test.ts` (pglite / libsql; no live Vite SSR)
- E2E: `e2e/features/*.feature` against fixture SQLite (+ unreachable PG smoke)

```bash
pnpm test:run
pnpm test:e2e
```

## Docs map

| Area                      | Where to look                      |
| ------------------------- | ---------------------------------- |
| Connection security / SSH | `src/lib/connection-security.ts`   |
| Introspection + mutations | `src/server/introspection/`        |
| AI prompts / LIMIT        | `src/lib/ai/`                      |
| SQL editor zones          | `src/lib/sql-editor-view-zones.ts` |
| E2E fixtures              | `e2e/prepare-fixtures.mjs`         |
