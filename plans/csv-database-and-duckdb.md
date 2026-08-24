# Plan: DuckDB driver + CSV-as-database

Status: **planned** · Created: 2026-08-24 · Order: **A (DuckDB) first, B (CSV) depends on it**

Two features sharing one architectural insight: dadabase's per-dialect dispatch
(`sql.onDialectOrElse` over `@effect/sql` clients) has no `duckdb` driver in the
`@effect/sql` family, so DuckDB arrives as a **custom client shim**; once it exists,
CSV connections become nearly free by riding on DuckDB as their query engine.

---

## 0. Current architecture (measured)

| Concern | File | Mechanism |
|---|---|---|
| Dialect enum | `src/db/dialect.ts` | `DatabaseDialect` (`postgres\|sqlite\|libsql\|mysql`), `getDialectDefaultSchema`, app-level `onDialectOrElse` |
| Per-dialect SQL dispatch | `src/server/introspection/introspection.ts` (2720 lines) | `yield* sql.onDialectOrElse({ pg, mysql, sqlite, orElse })` — 57 call sites; `mysql → pg` mapping via `pgSqliteHandlers` helper (`src/server/introspection/pg-sqlite-handlers.ts`) |
| SqlClient surface actually used | grep across `src/server`, `src/db` | `unsafe` ×22, builder helpers (`insert/update/or/and/raw/withTransaction/reserve/length/ts`) concentrated in `src/server/introspection/fns/{update-row,insert-row,insert-rows,bulk-delete-rows,count-cascade-dependents}.ts`, `src/server/custom-sql/start-fns/execute-custom-sql.start.ts`, `explain-query.start.ts`, `get-query-sql.start.ts`. Everything else is `onDialectOrElse` + `unsafe` |
| Connection persistence | `src/db/app.db.schema.ts:18` + `src/db/database-connection.repository.ts` | `database_connections` row = `{id, name, url: TEXT, dialect: TEXT}` — a new dialect needs **no schema migration**, only a new enum value |
| Connection creation UI | `src/components/pages/connection.form.tsx` | `z.enum(DatabaseDialect)` drives the form switch (`connectionType`); per-dialect URL/file-path branches at lines ~332–567 |
| Row read path | `src/server/introspection/query-table-data.test.ts` (+ adapter interface at `connection-adapter.ts:140`) | `{rows, rowCount, hasNextPage}` with limit/offset/orderBy/filters |
| Row edit paths | `src/server/introspection/fns/*` | kysely-style builders compiled to raw SQL against `SqlClient.SqlClient` |

**Key constraint discovered:** all start-fns declare `SqlClient.SqlClient` in their R
channel and call `.onDialectOrElse` / `.unsafe` / builder helpers on it. A DuckDB
integration must therefore either (1) shim enough of that surface, or (2) fork every
affected start-fn. This plan chooses **(1) — a shim** (see §A.2), because the used
surface is small and mostly mechanical.

---

## A. Feature A — DuckDB driver

### A.1 Dependency

```jsonc
// package.json (exact pins, no ^)
"@duckdb/node-api": "1.5.5-r.4",        // latest stable as of 2026-08-24 (verified via npm dist-tags)
"@duckdb/node-bindings": "1.5.5-r.4",   // transitive but pin explicitly: platform binaries resolve through it
```

### A.2 Client integration — `DuckDbClient` shim (the spike)

**Problem:** no official `@effect/sql` driver for duckdb exists.
**Approach:** new module `src/server/db-connection/duckdb/duckdb-client.ts`:

- `DuckDbConnection` Effect service wrapping `@duckdb/node-api`:
  - `duckdb.DuckDBInstance.create(pathOrMemory)` per open connection;
    cache instances by resolved file path (mirrors `src/db/postgres/pool-cache.ts` intent).
  - expose `run(sql, params)` / `all(sql, params)` mapped onto
    `connect.run` / `connect.getAll` (node-api async API).
- `makeDuckDbSqlClient(): SqlClient.SqlClient`-compatible object implementing **only
  the verified-used surface**: `unsafe`, `onDialectOrElse` (adds a `duckdb:` branch,
  falls back to `orElse` otherwise), and the query-builder helpers listed in §0.
  Builder helpers compile to parameterized SQL text — DuckDB speaks Postgres-flavored
  SQL well enough for `INSERT INTO ... VALUES`, `UPDATE ... SET`, `DELETE FROM`,
  `WHERE col = $n` style placeholders (verify `$n` vs `?` placeholder syntax during
  the spike; node-api uses positional arrays).
- **Spike gate before mass wiring:** one throwaway test proving
  `unsafe("SELECT 42")`, insert/update/delete round-trip, and transaction semantics
  (`BEGIN/COMMIT` manual, or skip `withTransaction` for v1 — single-writer embedded DB).

**Kysely note:** remote-connection paths do NOT go through EffectKysely (that is the
internal metadata DB + `src/db/postgres/kysely.pg.database.ts` pool). No kysely
dialect needed for DuckDB — the shim covers everything remote start-fns touch.
Where a fns-builder output shape doesn't fit duckdb, fall back to explicit raw SQL
in a `duckdb:` branch (same pattern as `pg-sqlite-handlers.ts` maps mysql→pg).

### A.3 Dialect plumbing

- `src/db/dialect.ts`: add `DuckDB = "duckdb"` to `DatabaseDialect`;
  `getDialectDefaultSchema(DuckDB) → "main"`.
- `introspection.ts`: add `duckdb:` keys where behavior differs; initially map
  `duckdb → pg` handler wherever the SQL is plain `information_schema`
  (tables/columns/schemata queries at lines ~76, ~123, ~190 are compatible).
- Known divergences needing explicit `duckdb:` branches:
  - **Constraints/FKs:** DuckDB does not enforce FKs; constraint metadata lives in
    `duckdb_constraints()` (table function), not reliably in `information_schema`.
    Relationship panels should degrade gracefully (empty FK list) in v1.
  - **EXPLAIN:** `EXPLAIN SELECT ...` returns a different column shape
    (`explain_key`/`explain_value`) → dedicated branch in `explain-query.start.ts`.
  - **Schema list:** `SELECT schema_name FROM information_schema.schemata` works;
    filter out `'pg_catalog'`, `'information_schema'`, `'temp'`.

### A.4 Introspection verification task

During implementation, verify empirically (throwaway script or vitest against
`:memory:`): which of `information_schema.tables/columns/schemata` vs
`duckdb_tables()/duckdb_columns()/duckdb_schemata()` return stable shapes for
column types/nullability/defaults. Record findings in this doc's checkbox notes.
Expected outcome: information_schema first (max reuse of pg handlers),
`duckdb_constraints()` only for constraints.

### A.5 Row paging & editing

- Paging/filtering reuses the existing `query-table-data` path verbatim
  (`LIMIT/OFFSET`, quoted identifiers — DuckDB accepts `"schema"."table"` quoting).
- `update-row.ts` / `insert-row(s).ts` / `bulk-delete-rows.ts`: verify generated
  placeholders; if kysely-built SQL uses `?` placeholders, node-api accepts arrays
  directly — likely zero changes; if it emits `$1..$n`, add a placeholder rewriter
  in the shim's `unsafe`.
- Type display: map DuckDB types (`INTEGER/BIGINT/DOUBLE/DECIMAL/VARCHAR/TIMESTAMP/
  TIMESTAMP WITH TIME ZONE/BOOLEAN/BLOB/LIST/STRUCT`) into the existing column-type
  display util (follow `format-table-value.ts` conventions; LIST/STRUCT render as
  JSON strings like pg jsonb does today).
- Error surfacing: catch duckdb exceptions → wrap into `SqlError` equivalents so
  existing error drawers keep working.

### A.6 Connection UX

- `connection.form.tsx`: new `connectionType === "duckdb"` branch — fields:
  name, file path (absolute; validate extension `.duckdb`/`.db` optional),
  `:memory:` toggle for scratch databases. `url` stored as `file:/abs/path` or
  `duckdb://memory` (keep `findByUrl` prefix logic in mind:
  `database-connection.repository.ts` splits URLs on `/` — use a scheme that
  survives that split, e.g. store the raw absolute path with no `://`).
- `try-connection.start.ts`: duckdb probe = `SELECT 1`.

---

## B. Feature B — CSV files as a database

### B.1 Decision: ride on DuckDB — option (a) ✅

**Chosen:** CSV connection = an in-memory DuckDB instance registering files via
`read_csv_auto`; edits materialize then export atomically.

Reasoning vs pure-JS parsing (option b):
- Type inference, `LIMIT/OFFSET` paging, filtering, ORDER BY, aggregates come free
  and identical to every other dialect — no second read/edit code path.
- Pure-JS would need its own parser (csv-parse/papaparse), its own inference, its own
  filter engine, its own pagination over unbounded memory — a whole parallel stack
  reimplementing what the table view already gets from SQL.
- Bonus capability nearly free: parquet/tsv/json files work with the same mechanism.

### B.2 Data model

- New dialect value: `Csv = "csv"` in `DatabaseDialect`; stored `url` = absolute
  file OR directory path (no scheme, survives `findByUrl`'s split-on-`/` logic).
- Engine: `DuckDbConnection` opened with `:memory:`; tables registered lazily:
  - Single file → one table named from filename stem (sanitized: `[a-z0-9_]`,
    lowercased, leading digit prefixed).
  - Directory → each `*.csv` becomes one table (same naming rule); directory listing
    re-scanned on connect, not live.
- Registration: `CREATE TABLE t AS SELECT * FROM read_csv_auto('path', header=true,
  sample_size=-1)` — **materialize on connect** (not a view) so edits have a stable
  target and huge-file sampling happens once. `sample_size=-1` scans fully for
  accurate inference; gate behind size check (§B.5).

### B.3 Edit & save semantics

- Edits happen against materialized in-memory tables via the standard row-edit fns
  (identical UX/code path as any other dialect — this is the payoff of (a)).
- Dirty tracking: connection page shows "unsaved changes" badge. Simplest correct
  mechanism: compare `COUNT(*)` + a cheap checksum? No — track edit operations count
  client-side per table since last save (the UI already knows when it issued
  update/insert/delete calls).
- **Save** (explicit button, per-table):
  1. Write to temp file `<name>.csv.tmp-<nanoid>` via
     `COPY t TO 'tmp' (FORMAT csv, HEADER)`.
  2. Atomic swap: `rename(tmp, target)`; keep previous file as `<name>.csv.bak`
     (single rolling backup — no backup accumulation in v1).
  3. Toast confirmation with rows-written count.
- No auto-save. Closing tab with staged edits prompts confirm (existing destructive-
  query confirm dialog pattern, `destructive-query-confirm.dialog.tsx`).

### B.4 Connection UX

- `connection.form.tsx`: `connectionType === "csv"` — name + path picker:
  - Server-side file picker server-fn returning candidate paths (browser cannot
    stat local fs); accept pasted absolute path too.
  - Accept single file or directory; show detected table list preview after
    validation (dry-run `read_csv_auto` with `LIMIT 0`).
- Drag-drop onto home page creates prefilled form (stretch, cut if it slows the
  phase down).

### B.5 Huge files (>100 MB guidance)

- On connect: `stat` size. ≤100 MB → full-inference materialization.
- >100 MB → still materialize but warn in connection status bar with elapsed time;
  >1 GB → refuse by default with explanation (embedded OLAP will consume RAM ≈
  uncompressed size), offer override flag stored on the connection record? v1:
  hard limit 1 GB, warning ≥100 MB, documented in README section.

### B.6 E2E smoke scenario

Playwright (existing e2e setup): create temp dir with `people.csv` (10 rows, mixed
types incl. NULLs) → connect → browse table → filter+sort → edit a cell → insert
row → delete row → Save → reload page → assert persisted file content matches
(backup exists, tmp gone) → delete connection.

---

## Shared touch points (both features)

| Touch point | Files |
|---|---|
| Dialect enum + defaults | `src/db/dialect.ts` |
| Introspection dispatch branches | `src/server/introspection/introspection.ts` (add `duckdb:`; csv inherits via engine=dialect-duckdb mapping in the client layer) |
| Handler helper | `src/server/introspection/pg-sqlite-handlers.ts` (extend to include `duckdb` passthrough) |
| Client construction | new `src/server/db-connection/duckdb/` module |
| Connection CRUD | `src/components/pages/connection.form.tsx`, `src/server/db-connection/fns/create-db-connection.ts` (no repo change needed — `url`/`dialect` are TEXT) |
| Row editing reuse | `src/server/introspection/fns/*` (verify placeholders only) |
| Tests | `src/server/introspection/test.layer.ts` gains a duckdb layer for test DI |

## Gates (per phase)

- `pnpm typecheck` — 0 errors
- `pnpm lint` — never worse than the 8 pre-existing errors (`src/hooks/*`)
- `pnpm test --run` scoped to touched areas; full suite before jj describe

---

## Phases

### Phase A1 — dependency + spike
- [ ] Add pinned deps (§A.1), install
- [ ] `DuckDbConnection` service + minimal shim; spike test proves unsafe/select/
      insert/update/delete/placeholder-syntax on `:memory:`; record placeholder
      finding here: ________
- [ ] Gate: typecheck + scoped tests green

### Phase A2 — dialect plumbing + introspection
- [ ] Enum + default schema + `duckdb→pg` mappings; explicit branches for
      constraints/explain/schema-list (§A.3)
- [ ] Empirical introspection verification (§A.4) recorded in doc
- [ ] Connection form branch + try-connection probe (§A.6)
- [ ] Gate: typecheck/lint/scoped tests; manual smoke on a real `.duckdb` file

### Phase A3 — row editing parity + polish
- [ ] Placeholder compatibility confirmed for update/insert/bulk-delete (§A.5);
      type-mapping additions; error surfacing wrapper
- [ ] Full suite + jj describe `feat: duckdb driver`

### Phase B1 — CSV dialect on duckdb engine
- [ ] `Csv` enum value; csv connection resolution → in-memory duckdb +
      materializing registration incl. directory mode (§B.2)
- [ ] Connection form: path picker/validation/table-list preview (§B.4)
- [ ] Gate: scoped tests incl. fixture-csv round-trip

### Phase B2 — save semantics + guards
- [ ] Staged-edit tracking, Save flow (tmp → atomic rename → .bak), unsaved badge
      + close-prompt (§B.3)
- [ ] Size guardrails (§B.5)
- [ ] E2E smoke scenario (§B.6)
- [ ] Full suite + jj describe `feat: csv-as-database`

## Risks

| Risk | Mitigation |
|---|---|
| Shim drift: future start-fns use deeper SqlClient surface | Keep §0 surface list updated; shim throws descriptive error on unknown method |
| DuckDB placeholder syntax differs from generated SQL | Resolved in A1 spike; rewriter isolated in shim |
| node-api native binary install issues in CI/docker | `@duckdb/node-bindings` pinned; docker image rebuild tested in A2 |
| Materialized CSV tables lose formatting quirks (delimiters, encoding) | `read_csv_auto` options surfaced later; v1 documents UTF-8/comma-only support |
| Two writers historically SIGKILL under heavy gates | Batched edits, scoped test runs (standing instruction) |
