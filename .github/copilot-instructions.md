# Dadabase AI Coding Guide

Dadabase is a full-stack database exploration UI with dynamic table browsing, relationship visualization, and natural language query support. This guide helps AI agents understand the architecture and contribute effectively.

## Project Overview

**Tech Stack**: TypeScript, React 19, TanStack Start/Router/Query/Table/React-Form, Tailwind CSS, Effect.ts, Kysely ORM, Biome

**Key Paths**:
- `src/db/` - Database layer (Kysely, Effect integration, schema)
- `src/server/` - Backend services (connection management, query building, PG introspection)
- `src/components/` - React UI (data table, filters, relationships panel)
- `src/hooks/` - Custom React hooks (connection state, table metadata, query building)
- `src/lib/` - Utilities (query filters, natural language parser, styling)
- `src/routes/` - TanStack Router file-based routing

**Database Layers**: SQLite (stored connections metadata), PostgreSQL (connected via libSQL/Kysely)

---

## Architecture Patterns

### Effect.ts Service Layer

Database operations use Effect.ts for dependency injection, error handling, and resource management. Key patterns:

- **Service Registration**: Use `Effect.Service<T>()` to define injectable services (see `src/server/services/nano-id.ts`, `PgService`)
- **Layer Composition**: Services are composed into layers and merged in `src/server/services/app.runtime.ts`
- **Effect Generators**: Use `Effect.gen(function* () { ... })` for sequencing operations
- **Context Tags**: Define database access via `Context.Tag` (see `src/db/app.db.ts` using `AppDatabase` tag)

Example query pattern:
```typescript
// Effect.fn wraps a generator that yields dependencies and operations
export const queryTableData = <T>(input: { schema: string; table: string; ... }) =>
  Effect.gen(function* () {
    const db = yield* KyselyPgDatabase; // Inject database service
    // ... build and execute query
    return { rows, rowCount };
  });
```

### Kysely with Effect Wrapper

Database queries use **Kysely** (type-safe SQL builder) wrapped in Effect. The `EffectKysely<DB>` interface (in `src/db/effect-kysely.ts`) provides Effect-wrapped query methods:

- `execute(query)` - Execute and return all rows
- `executeTakeFirstOrUndefined(query)` - Single row or undefined
- `executeTakeFirstOrError(query)` - Single row or error
- `transaction()` - Wrap mutations in DB transactions

All queries are typed against `AppDatabaseSchema` defined in `src/db/app.db.schema.ts`.

### Query Filter Model

Structured filter representation for building WHERE clauses (`src/lib/query-filter.ts`):

```typescript
type QueryFilterType = {
  conditions: Array<{
    column: string;
    operator: "equals" | "contains" | "greater_than" | ... // 14 operators
    value?: string | number | boolean | null | string[];
  }>;
  logicalOperator: "and" | "or";
};
```

Converted to SQL via `buildWhereExpression()` in `src/server/pg/fns/build-where-expression.ts`.

### Natural Language Parsing

Separate rule-based parser (`src/lib/natural-language-parser.ts`) converts user text to structured filters without LLMs. Supports:
- Comparison: `age > 25`, `price <= 100`
- Ranges: `between 10 and 30`
- Lists: `status in (active, pending)`
- Sorting: `sort by name desc`
- Fuzzy column matching: `nam contains john` → matches "name" column

Returns `ParsedNLQuery` with filters, sort, and limit.

### React Component Composition

Components use **TanStack React Table v8** for headless table logic. Key patterns:

- **useReactTable()** hook creates table instance with columns, data, features (pagination, sorting, filtering, column visibility)
- **DataTable component** renders virtualized rows using `@dnd-kit` for drag-and-drop column reordering
- **CVA (Class Variance Authority)** for styled variants (see `data-table.styles.ts`)
- **Hooks for state**: `use-query-builder.ts`, `use-table-relationships.ts`, `use-rows-columns.tsx`

Key component hierarchy:
```
DataTable
├── ColumnHeaderContextMenu
├── DraggableColumnHeader (with dnd-kit)
├── VirtualizedTableBody (with react-virtual)
├── QueryFilterBuilder
└── RelationshipsPanel
```

---

## Developer Workflows

### Build & Dev
```bash
pnpm dev                 # Start dev server (port 3005)
pnpm build              # Build for production
pnpm test               # Run Vitest in watch mode
pnpm test:run           # Run tests once
```

### Database & Migrations
```bash
pnpm db:reset           # Recreate schema from scratch
pnpm db push            # Apply schema changes
pnpm studio             # Open Drizzle Studio
pnpm migrate:gen        # Generate migration files
```

### Code Quality
```bash
pnpm fmt                # Format with Biome (tabs)
pnpm check              # Lint and check with Biome
pnpm typecheck          # TypeScript check (ESM mode)
```

### Docker
```bash
pnpm docker:build       # Build image
pnpm docker:run         # Run container (port 3006)
```

### Shadcn UI Components
Install with: `pnpx shadcn@latest add button`

---

## File Structure & Conventions

### Import Aliases
- `#src/*` resolves to `src/` (defined in `tsconfig.json` and vite config)
- Use this for all cross-module imports

### Naming Patterns
- **Server functions**: Suffix with `.start.ts` (e.g., `update-db-connection.start.ts`)
- **Kysely query files**: Suffix with `.kysely.ts`
- **Hooks**: Prefix with `use-` (e.g., `use-connection-storage.ts`)
- **Style files**: Suffix with `.styles.ts`

### Directory Organization
```
src/
  components/
    ui/                 # Unstyled reusable components (Button, Input, etc.)
    pages/              # Page-level layouts
    form/               # Form-related components
  db/
    postgres/           # PostgreSQL-specific (connection pooling, introspection)
  server/
    db-connection/fns/  # Connection CRUD operations (Effect.fn)
    pg/fns/             # PostgreSQL introspection & queries
    services/           # Effect services (NanoId, AppRuntime)
  lib/                  # Pure utilities, parsers, styling helpers
  hooks/                # React custom hooks
  routes/               # TanStack file-based routes
```

### Schema & Types
- Database schema: `src/db/app.db.schema.ts` (Drizzle with Kyselify type conversion)
- Type inference: `src/types.ts` has helper types for inferring server function schemas
- Standard schema validation: `src/standard-schema.ts` for Zod/Schema validation in server functions

---

## Common Workflows & Examples

### Adding a Database Query

1. **Create Effect function** in `src/server/pg/fns/`:
```typescript
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { Effect } from "effect";

export const getMyData = (input: { tableId: string }) =>
  Effect.gen(function* () {
    const db = yield* KyselyPgDatabase;
    const rows = yield* db.execute(
      db.selectFrom("my_table").selectAll().where("id", "=", input.tableId)
    );
    return rows;
  });
```

2. **Import and use** in server components or route loaders via TanStack Start

### Filtering Tables

1. **Build filter config** using `QueryFilterType` shape
2. **Convert to WHERE clause**: Call `buildWhereExpression(conditions, "and")`
3. **Apply to Kysely query**: `.where(whereExpression)`
4. **For UI**: Use `QueryFilterBuilder` component or `use-query-builder.ts` hook

### Working with Relationships

- Foreign key data: `src/server/pg/fns/get-table-foreign-keys.ts`
- Cardinality detection: `get-relationship-cardinality.ts`
- Relationship counts: `get-relationships-counts.ts`
- Display: `RelationshipsPanel` and `relationship-subrow-table.tsx` components

---

## Key Dependencies & Integrations

| Package | Purpose | Key Files |
|---------|---------|-----------|
| `Effect` | Dependency injection, error handling, resources | `src/db/`, `src/server/` |
| `Kysely` | Type-safe SQL builder, wrapped in Effect | `src/db/effect-kysely.ts` |
| `TanStack React Table` | Headless table library | `src/components/data-table.tsx` |
| `@dnd-kit` | Drag-and-drop column reordering | `src/components/data-table.tsx` |
| `@tanstack/react-virtual` | Virtual scrolling for large tables | `data-table.virtualized-table-body.tsx` |
| `TanStack React Form` | Form state management | Form components in `src/components/form/` |
| `TanStack React Query` | Server state caching, mutations | Used with TanStack Start |
| `Tailwind CSS` | Utility-first CSS (with Biome `tailwindDirectives`) | Global in `src/styles.css`, component imports |
| `AI SDK` | Anthropic Claude integration (not currently active) | `@ai-sdk/anthropic`, `@ai-sdk/react` |

---

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (passWithNoTests, hideSkippedTests)
- **Test patterns**: Natural language parser tests in `src/lib/natural-language-parser.test.ts`
- **Run**: `pnpm test` (watch) or `pnpm test:run` (once)

---

## Important Gotchas & Rules

1. **Tabs for formatting**: Biome configured to use tabs (not spaces) - run `pnpm fmt` to auto-fix
2. **Effect scoping**: Database connections are scoped resources; always use `Effect.scoped` with finalizers
3. **Route-based rendering**: Use `createFileRoute()` in TanStack Router; route file paths become URL paths
4. **No unscoped imports from Effect**: Each Effect.fn, Effect.Service must be properly defined in context
5. **CVA for styling variants**: Don't use string concatenation for classes; use `cva()` with proper variants
6. **Virtual table heights**: Specify `estimateItemSize` when using virtualized tables
7. **Type safety**: Always type generic parameters (e.g., `EffectKysely<DB>`, `DataTable<TData>`)

---

## Architecture Decisions

- **Why Effect.ts?** Type-safe dependency injection, resource management, and error propagation without try-catch
- **Why Kysely?** Composable query builder with TypeScript inference from schema; supports dynamic table/schema names
- **Why virtualization?** Large tables (1000s of rows) need virtual scrolling for performance
- **Why separate natural language parser?** Offline, deterministic filtering without LLM latency/cost
- **Why CVA for styles?** Type-safe component variants with variant composition instead of conditional classnames

---

## When Adding Features

- **Database changes**: Update `src/db/app.db.schema.ts`, run `pnpm migrate:gen`, commit migrations
- **New UI component**: Create in `src/components/`, export from parent, follow CVA styling pattern
- **New query/mutation**: Create Effect.fn in `src/server/`, compose into layer if new service
- **New hook**: Place in `src/hooks/`, follow naming (use-*), document dependencies
- **Styling**: Use Tailwind classes with `cn()` helper; define variants in `.styles.ts` files for complex components

---

## Common Debugging

- **"Cannot find module"**: Check import path uses `#src/` alias or correct relative path
- **TypeScript errors on queries**: Ensure query typed against correct DB schema generic
- **Effect errors not caught**: Wrap in `Effect.catchAll()` or use `Effect.either()` to capture errors
- **Table not rendering**: Check TanStack Table columns array matches data shape; verify virtualization settings if large
- **Relationship panel empty**: Verify foreign keys exist in schema; check `get-table-foreign-keys.ts` query

