# Plan: dadabase Effect 3.22.1 → Effect 4 migration

Status: **planned** · Target: `effect@4.0.0-rc.111` line · Created: 2026-08-24

Reference implementation for v4 idioms: `/Users/astahmer/dev/emi-healthfit`
(runs `effect@4.0.0-beta.88`; its installed package sources were used to verify every
API mapping below against the actual v4 code).

---

## 1. Current inventory (measured on this repo)

**Import volume:** 190 effect-family import statements across 113 files in `src/`.

| Package | Import sites | Notes |
|---|---|---|
| `effect` | 112 | core runtime |
| `@effect/sql` (+ `/SqlError`, `/SqlClient`) | ~50 | entire DB access layer |
| `@effect/vitest` | 18 test files | `describe/it.effect/it.scoped` |
| `@effect/sql-libsql` | 3 | `LibsqlClient.layer` |
| `@effect/sql-pg` | 2 | `PgClient.layer` |
| `@effect/sql-mysql2` | 1 | `MysqlClient.layer` |
| `@effect/platform-node` | 2 | `NodeContext.layer` (`src/dotenv.runtime.ts:2`, `src/sandbox/remote-pg.ts:14`) |
| `@effect/platform` | 2 | `PlatformConfigProvider.layerDotEnvAdd` (same two files) |

**Installed but never imported in `src/` (candidates for removal):**
`@effect/rpc`, `@effect/experimental`, `@effect/workflow`, `@effect/opentelemetry`,
`@effect/cluster`, `@effect/sql-sqlite-node`, `@effect/platform-browser`,
`@effect/platform-node-shared`.

**Core API usage counts (`rg -o "Effect\.[A-Za-z]+" src/`):**

| API | Count | | API | Count |
|---|---|---|---|---|
| `Effect.gen` | 402 | | `Effect.fn` | 17 |
| `Effect.provide` | 267 | | `Effect.tryPromise` | 13 |
| `Effect.fail` | 54 | | `Effect.catchAll` | 11 ⚠️ removed in v4 |
| `Effect.Effect` (type) | 47 | | `Effect.either` | 7 ✅ still exists |
| `Effect.runPromise` | 39 | | `Effect.scoped` | 5 |
| `Effect.succeed` | 33 | | `Effect.Service` | 4 sites ⚠️ removed |

**Schema usage (~460 total):** `Schema.String` 171, `Schema.optional` 83,
`Schema.Struct` 52, **`Schema.standardSchemaV1` 38 ⚠️ renamed**, `Schema.Literal` 32,
`Schema.Array` 29, **`Schema.optionalWith` 14 ⚠️ removed**, **module-level
`Schema.pipe(...)` ~13 ⚠️ style changed**, `Schema.safeParse` 3 ⚠️ removed,
`Schema.Enums` 2 ⚠️ renamed, plus `mutable/Record/Null/URL/transform/brand`
(all verified present in v4).

**Service/Layer patterns:**

- `class X extends Context.Tag("key")<X, Shape>() {}` × **7** ⚠️ `Context.Tag` removed:
  - `src/db/app.db.ts:7` (`AppDatabase`)
  - `src/db/postgres/kysely.pg.database.ts:5` (`KyselyPgDatabase`)
  - `src/db/postgres/pool-cache.ts:13` (`PoolCache`)
  - `src/db/effect-kysely.pglite.test.ts:10` (`InMemoryPgliteDb`)
  - `src/server/db-connection/remote-connection.tag.ts:6` (`RemoteConnection`)
  - `src/server/query-logger/query-logger.ts:22` (`QueryLogger`)
  - `src/server/introspection/connection-adapter.ts:157` (`DatabaseConnectionAdapter`)
- `class X extends Effect.Service<X>()("Key", { ... })` × **3** ⚠️ removed:
  - `src/server/services/nano-id.ts:9` (uses the `succeed:` shorthand)
  - `src/db/database-connection.repository.ts:9`
  - `src/db/custom-sql-execution.repository.ts:9`
- `Data.TaggedError` × 1 (`ContainerError`) ✅ still exists in v4
- `ManagedRuntime.make` × 2 (`src/server/services/app.runtime.ts:19`,
  `src/dotenv.runtime.ts:12`) ✅ still exists
- `Layer.mergeAll/provideMerge/succeedContext/succeed/effect` ✅ all still exist
- `Logger.pretty` / `Logger.minimumLogLevel` (`src/dotenv.runtime.ts:15-17`),
  `Logger.withMinimumLogLevel` (~20× in `src/server/query-logger/query-logger.layer.test.ts`)
  ⚠️ all three removed
- `Config.string/redacted/withDefault` (`src/db/postgres/kysely.pg.database.layer.ts`,
  libsql layer) ✅ still exists

---

## 2. Breaking changes mapped to call sites

Verified against the shipped v4 source (`effect@4.0.0-beta.88` in emi-healthfit's
node_modules) and npm dist-tags:

### 2.1 Package topology changes (the big one)

- **`@effect/sql` no longer exists for v4** (npm has zero 4.x prereleases of it;
  latest stays `0.52.1` with peer `effect ^3.22.1`). The SQL core moved **into**
  `effect`: `import { SqlClient } from "@effect/sql"` →
  `import { SqlClient } from "effect/unstable/sql"` (same for `SqlError`,
  `Statement`, `SqlResolver`, `SqlSchema`, `Migrator` — barrel confirmed at
  `effect/src/unstable/sql/index.ts`).
  - `@effect/sql/SqlError` → `effect/unstable/sql/SqlError`
    (17 files: `src/db/effect-kysely.ts`, all row-mutation & custom-SQL start fns
    under `src/server/introspection/start-fns/`, etc.)
  - Driver packages DO publish v4: `@effect/sql-pg`, `@effect/sql-libsql`,
    `@effect/sql-mysql2` all have dist-tag **rc = 4.0.0-rc.111**, peer
    `effect ^4.0.0-rc.111`, and no longer depend on `@effect/sql`.
    Sites: `src/db/postgres/pool-cache.ts:1-5`, `src/server/introspection/test.layer.ts`.
- **`@effect/platform` has no v4 release at all** (latest remains `0.97.1`).
  Its pieces moved into core `effect`:
  - `PlatformConfigProvider.layerDotEnvAdd(path)` →
    `ConfigProvider.fromDotEnv({ path })` (core `ConfigProvider.ts:1297`;
    returns an `Effect` requiring `FileSystem`, see 2.6).
  - Sites: `src/dotenv.runtime.ts:1,8-10`, `src/sandbox/remote-pg.ts:13`.
- **`NodeContext.layer` gone from `@effect/platform-node`** (the god-module was
  split into per-module layers: `NodeFileSystem.layer`, `NodeRuntime`, …).
  Sites: `src/dotenv.runtime.ts:11`, `src/sandbox/remote-pg.ts:14`.
- **Packages with no v4 line** (all unused by us → delete from package.json):
  `@effect/rpc` → `effect/unstable/rpc`, `@effect/workflow` →
  `effect/unstable/workflow`, `@effect/experimental`, `@effect/cluster`
  (→ `effect/unstable/cluster`), `@effect/opentelemetry` *does* have rc.111 but we
  don't use it.
- `@effect/vitest` has rc.111 (peer `vitest >=4.1 <5` — ours is 4.1.11 ✅).

### 2.2 Service definition rewrite (7 Tag + 3 Service sites)

- `Context.Tag` removed entirely (0 occurrences in v4 source). Replacement:
  `class AppDatabase extends Context.Service<AppDatabase, Shape>()("key") {}`
  or `Context.Reference` where a default exists.
- `Effect.Service` removed. `Context.Service` has **no `succeed:` shorthand and no
  auto `.Default` static**: each service needs an explicit default layer, e.g.
  `export const NanoIdDefault = Layer.succeed(NanoId, makeNanoId())`.
  Affected composition sites keep working otherwise: `app.runtime.ts:10-16`
  uses `DatabaseConnectionRepository.Default` / `CustomSqlExecutionRepository.Default`
  / `NanoId.Default` — those statics become hand-written exports with the same names.

### 2.3 Schema drift (≈70 mechanical touch points)

| v3 | v4 | dadabase call sites |
|---|---|---|
| `Schema.standardSchemaV1` | `Schema.toStandardSchemaV1(schema)` (v4 `Schema.ts:1107`) | 38×: route `validateSearch`/`validator` in `src/routes/**`, server-fn `.validator` (e.g. `src/server/ai/generate-sql-text.start.ts:13`) |
| `X.pipe(Schema.optionalWith({ default }))` | `X.pipe(Schema.optional, Schema.withDecodingDefault(...))` (v4 exports `withDecodingDefault` at `Schema.ts:5806`) | 14×: mostly `src/routes/connections/$connectionName.tsx:16-58` search schema |
| module-level `Schema.pipe(A, B)` | instance `.pipe()` survives (Pipeable), but filter lambdas are now standalone constructors used via `.check(Schema.isPattern(...))` etc. (emi-healthfit idiom) | ~13× — review each during mechanical pass |
| `Schema.safeParse` | `Schema.decodeUnknownSync` / `decodeUnknownOption` | `src/lib/ai/ai-stats.ts:23`, `src/components/pages/connection.form.tsx:118,280` |
| `Schema.Enums` | `Schema.Enum` (singular, v4 `Schema.ts:2848`) | 2× |
| `optionalWith` positional flags (`onNil`-style options) | restructure as `UndefinedOr` + `withDecoding*` | any site not covered above |

Survivors verified present in v4: `Struct, Array, Literal, Union, Record, Null,
Boolean, Number, mutable, URL, transform, brand, decodeUnknownSync,
decodeUnknownOption, is` ✅.

### 2.4 Effect combinator drift

- **`Effect.catchAll` removed** (0 hits in v4) → `Effect.catch((error) => ...)`
  (the v4 idiom; emi-healthfit uses it 32×). 11 call sites in dadabase.
  `Effect.catchIf/catchTag/catchCause` also exist; `Effect.either` survives.
- Everything else we use survives: `gen, provide, provideService, fail, succeed,
  map, flatMap, all, tap, tapError, tryPromise, try, sync, promise, async?,
  repeat, void, die, orDie, ignore, orElseSucceed, logWarning, context, asVoid,
  ensuring, addFinalizer, withSpan, forEach, acquireRelease, scoped, runPromise, fn`
  (⚠️ `async` not found in v4 beta.88 top-level greps — single call site, verify;
  candidate replacement: `suspend` + `tryPromise`).

### 2.5 Logger

- Removed: `Logger.pretty`, `Logger.minimumLogLevel`, `Logger.withMinimumLogLevel`
  (all 0 hits in v4).
- Replacements verified to exist: `Logger.consolePretty(options)` (`Logger.ts:1036`),
  `References.MinimumLogLevel` (`Context.Reference`, `References.ts:433` — provide
  via `Layer.succeed(References.MinimumLogLevel, LogLevel.All)`).
- Sites: `src/dotenv.runtime.ts:15-17`, `query-logger.layer.test.ts` (~20 pipes).
- Note: emi-healthfit sets no log level itself, so this mapping must be smoke-tested
  (dev server boot + one query-log test run) rather than copied from a known-good use.

### 2.6 FileSystem / dotenv bootstrap rewrite

`src/dotenv.runtime.ts` becomes roughly:

```ts
// v4 sketch — final shape verified at implementation time
import { ConfigProvider, Layer } from "effect";
import { NodeFileSystem } from "@effect/platform-node";

export const DotEnvProvider = Layer.unwrapEffect(
  Effect.map(
    ConfigProvider.fromDotEnv({ path: envFilePath }),
    ConfigProvider.setConfigProvider, // wrap as layer
  ),
).pipe(Layer.provide(NodeFileSystem.layer));
```

(`fromDotEnv` requires `FileSystem.FileSystem` in context — that service now lives
in core `effect`, implemented by `NodeFileSystem.layer`.)

---

## 3. Target versions (exact pins, matching dist-tags as of 2026-08-24)

> Decision point: the **RC line (rc.111)** is newer than emi-healthfit's proven
> **beta.88** combo, published 2026-08-20, and is the only line where all driver
> packages align. If rc.111 shows regressions, fall back to beta.107/beta.88 across
> the board (all packages below have those tags too).

| Package | From | To (pinned) |
|---|---|---|
| `effect` | 3.22.1 | `4.0.0-rc.111` |
| `@effect/sql-pg` | catalog 0.52.x→ | `4.0.0-rc.111` |
| `@effect/sql-libsql` | 0.42.0 | `4.0.0-rc.111` |
| `@effect/sql-mysql2` | 0.53.0 | `4.0.0-rc.111` |
| `@effect/vitest` | 0.30.0 | `4.0.0-rc.111` |
| `@effect/platform-node` | 0.108.1 | `4.0.0-rc.111` |
| `@effect/platform` | 0.97.1 | **remove** |
| `@effect/sql` | 0.52.1 | **remove** (merged into `effect/unstable/sql`) |
| `@effect/rpc`, `@effect/workflow`, `@effect/experimental`, `@effect/cluster`, `@effect/opentelemetry`, `@effect/sql-sqlite-node`, `@effect/platform-browser`, `@effect/platform-node-shared` | — | **remove** (unused; no v4 line or superseded) |

Also update `pnpm-workspace.yaml` catalog entries accordingly (dadabase pins
several `@effect/*` through `catalog:`).

---

## 4. Phased execution

Work on a **fresh jj change** (`jj new -m "effect-4 migration"`); never mix with
unrelated work so `jj restore`/`jj abandon` is a clean rollback.

### Phase 0 — types-only preparation (no runtime bump)
- [ ] Add codemod-friendly shims: create `src/db/effect-compat.ts` re-exporting the
      ~10 v3 symbols that get renamed, and import from there in the affected files
      (optional but makes phase 2 nearly mechanical; skip if it fights oxlint rules).
- [ ] Snapshot baseline gates: `pnpm typecheck`, `pnpm test --run`, `pnpm check`
      all green before starting.

### Phase 1 — package bumps (one change, expect red typecheck)
- [ ] Update `package.json` + `pnpm-workspace.yaml` catalog to the pinned versions
      in §3 (removals included). `pnpm install --no-frozen-lockfile`.
- [ ] Do NOT fix code yet; record `pnpm typecheck` error count as the work backlog.

### Phase 2 — mechanical import rewrites (codemod-able, sed-safe)
- [ ] `"@effect/sql"` → `"effect/unstable/sql"`; `"@effect/sql/SqlError"` →
      `"effect/unstable/sql/SqlError"` (~50 imports, keep `SqlClient.SqlClient`
      type usage unchanged).
- [ ] `Schema.standardSchemaV1` → pipe through `Schema.toStandardSchemaV1(...)`
      (38 sites — check each: some are `.pipe(Schema.standardSchemaV1)` which
      becomes `.pipe(Schema.toStandardSchemaV1)` only if arity matches; otherwise
      wrap the finished schema).
- [ ] `Effect.catchAll(handler)` → `Effect.catch(handler)` (11 sites).

### Phase 3 — structural rewrites (hand-done, small blast radius each)
- [ ] 7 × `Context.Tag` classes → `Context.Service`/`Context.Reference`
      (`§1` list). Update every `yield* X` / `Layer.succeed(X, …)` /
      `Context.make` reference; typecheck drives discovery.
- [ ] 3 × `Effect.Service` classes → plain class + hand-written
      `<Name>.Default` layer export (keeps `app.runtime.ts` diff minimal).
- [ ] `Schema.optionalWith({ default })` → `optional + withDecodingDefault`
      (14 sites, concentrated in two route files).
- [ ] `Schema.safeParse` → `decodeUnknownSync`/`decodeUnknownOption` (3 sites).
- [ ] `Schema.Enums` → `Schema.Enum` (2 sites).
- [ ] Logger rewrite in `dotenv.runtime.ts` + `Logger.withMinimumLogLevel` in
      `query-logger.layer.test.ts` (per §2.5).
- [ ] `dotenv.runtime.ts` / `sandbox/remote-pg.ts` bootstrap rewrite (per §2.6);
      delete `NodeContext` usage.
- [ ] Review remaining module-level `Schema.pipe` sites flagged in §2.3.
- [ ] Verify the single `Effect.async` site (grep `Effect.async`).

### Phase 4 — gate
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm check` — lint clean
- [ ] `pnpm test --run` — full suite green (**always `--run`, never watch mode**)
- [ ] `pnpm dev` manual smoke: connections list, table browse, NL→SQL panel,
      query-logger panel render.
- [ ] `pnpm db:reset` still works (drizzle unaffected, but the Effect layers feed it).
- [ ] Only after green: fold the jj change / open for review.

---

## 5. Risks & rollback

| Risk | Mitigation |
|---|---|
| rc.111 vs healthfit's proven beta.88 behavioral drift | All APIs above were verified in beta.88 source; rc.111 changelog check before starting; fallback pin set = beta.107 everywhere (single-line catalog change) |
| `Context.Tag` → `Context.Service` subtle typing differences (service shapes are inferred differently in the two-stage form) | Migrate one tag first (`NanoId`, smallest), run suite, then batch the rest |
| Hidden reliance on removed `@effect/platform` utilities beyond the two known files | grep gate in Phase 2: `rg "@effect/platform" src/` must be empty post-migration |
| `EffectKysely` wrapper (`src/db/effect-kysely.ts`, PR #5156 pattern) may lean on internals | It only uses `Effect`/`Option`/`SqlError` public API — verified; watch its tests |
| vitest peer range of `@effect/vitest@4` requires vitest `>=4.1 <5` | We're on 4.1.11 ✅ (verify again at dep-refresh time — coordinate with dependency-refresh plan) |
| Beta/RC instability generally (pre-GA) | Single jj change; rollback = `jj abandon` + restore lockfile; do not stack other feature work on top until green |

## 6. Coordination notes

- Run **after** the dependency-refresh plan lands or coordinate with it — both touch
  `package.json` / lockfile. Suggested order: dep refresh first (stays on effect 3),
  then this migration.
- The chat-runtime vendoring plan (from `@emi/core`) adds `xstate`, unrelated to
  Effect — safe to parallelize, but same rule: separate jj change.
