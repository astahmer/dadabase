# Multi-Database Support Refactoring Plan

## Current Architecture Overview

### Database Abstraction Layers
1. **KyselyPgDatabase** (`src/db/postgres/kysely.pg.database.ts`)
   - Context.Tag for PostgreSQL-specific database access
   - Wraps Kysely QueryBuilder with Effect-based executor

2. **EffectKysely<DB>** (`src/db/effect-kysely.ts`)
   - Generic wrapper adding Effect methods to Kysely instances
   - Provides methods: `execute()`, `executeTakeFirstOrUndefined()`, `transaction()`, etc.
   - All queries are type-safe against a typed database schema

3. **Database Layer Creation** (`src/db/postgres/kysely.pg.database.live.ts`)
   - `makeKyselyPgDatabaseLayer(url)` creates PostgreSQL-specific layers
   - Uses connection pool caching via `PoolCache`
   - Dialect: `PostgresDialect` from Kysely

### Connection Flow
1. User connects to remote database via connection string (stored in `database_connections` SQLite table)
2. Server functions look up connection from `DatabaseConnectionRepository`
3. `withRemoteConnectionLayers()` provides two layers dynamically:
   - `RemoteConnection` (connection ID tag)
   - `KyselyPgDatabase` (database instance)
4. All `src/server/pg/fns/*.kysely.ts` files yield `KyselyPgDatabase` and execute queries

### Current Dependencies
- **Kysely**: Type-safe SQL builder, dialect-aware
- **Effect.ts**: DI, resource management, error handling
- **Dialect support**: Only PostgreSQL via `PostgresDialect`

---

## Issues with Current Architecture for Multi-Database Support

### 1. **Type Safety vs Dynamic Schemas**
- User databases have unknown schemas at compile time (dynamic table/column names)
- Current approach uses `any` for user table references: `${input.schema}.${input.table} as any`
- Kysely's type system becomes unusable for exploratory queries anyway

### 2. **Database-Specific Context Tag**
- `KyselyPgDatabase` is PostgreSQL-specific
- Adding SQLite would require new tag: `KyseliteDatabase` or similar
- Code must conditionally choose which tag to yield, breaking abstraction
- Each database needs its own layer factory function

### 3. **Dialect-Specific SQL Features**
- Foreign key introspection queries are PostgreSQL-specific (from `information_schema`)
- SQLite uses `pragma foreign_key_list()` or PRAGMA introspection
- MS SQL Server uses different system tables
- Current code in `src/server/pg/fns/` would need conditional branches per dialect

### 4. **Schema Introspection**
- Completely dialect-specific logic:
  - `get-available-schemas.kysely.ts` - PG only (no concept of schemas in SQLite)
  - `get-table-foreign-keys.kysely.ts` - Needs PG-specific info_schema queries
  - `get-table-columns.kysely.ts` - Works but column types differ per dialect

### 5. **File Organization Problem**
- All functions live in `src/server/pg/fns/` directory
- Implies PostgreSQL-only implementation
- Would need to reorganize to `src/server/introspection/fns/` with dialect detection

---

## Approach Comparison

### Option A: Continue with Kysely + Dialect Abstraction
**Pros:**
- Type safety when schema is known
- Already using Kysely, minimal new dependencies
- Can leverage Kysely's plugin system

**Cons:**
- Loose all type safety for dynamic schemas (already using `as any`)
- Each dialect needs separate introspection module
- No clear way to abstract dialect-specific SQL syntax
- Complex conditional logic for features that don't exist in all databases

**Implementation:**
```typescript
// Create generic database context
export class RemoteDatabase extends Context.Tag("@dadabase/RemoteDatabase")<
  RemoteDatabase,
  EffectKysely<any>
>() {}

// Layer factory takes dialect parameter
export const makeRemoteKyselyDatabaseLayer = (url: string, dialect: DbDialect) => {
  return Layer.effect(RemoteDatabase, Effect.gen(function* () {
    const cache = yield* PoolCache;
    const pool = yield* cache.getOrCreate(url);

    const kyselyDialect =
      dialect === "postgres" ? new PostgresDialect({ pool })
      : dialect === "sqlite" ? new SqliteDialect()
      : new MysqlDialect({ pool });

    const qb = new Kysely({ dialect: kyselyDialect });
    return makeFromKysely(qb);
  }))
}

// Would need dialect detection in each query function
const getTableColumns = (input: { schema: string; table: string }) =>
  Effect.gen(function* () {
    const db = yield* RemoteDatabase;
    const connection = yield* RemoteConnection;
    const dialect = yield* getDialectForConnection(connection.id);

    // Split logic per dialect
    if (dialect === "postgres") {
      return yield* getTableColumnsPostgres(db, input);
    } else if (dialect === "sqlite") {
      return yield* getTableColumnsSqlite(db, input);
    }
  });
```

### Option B: Use @effect/sql with Dialect Detection
**Pros:**
- Designed for multi-database support from ground up
- Built-in `onDialectOrElse()` helper for dialect-specific SQL
- Type-safe parameter handling
- Cleaner dialect-branching syntax
- Loses type safety anyway (using dynamic schemas)

**Cons:**
- Gives up Kysely's query builder composability
- Must write raw SQL strings
- More verbose dialect-specific branches
- Loss of query composition helpers we've built

**Implementation:**
```typescript
// Already has dialect parameter in layer creation
export const makeSqlDatabaseLayer = (url: string, dialect: DbDialect) => {
  return Layer.effect(
    RemoteDatabase,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // SqlClient auto-detects dialect from connection string
      return sql;
    })
  )
}

// Dialect-specific logic is cleaner
const getTableColumns = (input: { schema: string; table: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const columns = yield* sql.onDialectOrElse({
      pg: () => sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = ${input.table}
      `,
      sqlite: () => sql`
        PRAGMA table_info(${sql(input.table)})
      `,
      mysql: () => sql`
        SELECT COLUMN_NAME as column_name, COLUMN_TYPE as data_type
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ${input.table}
      `,
      orElse: () =>
        sql`SELECT * FROM ${sql(input.table)} LIMIT 0` // Fallback
    });

    return columns;
  });
```

### Option C: Hybrid Approach (Recommended)
**Architecture:**
1. Keep Kysely for **query execution** on exploratory queries (what we're already doing well)
2. Use `@effect/sql` ONLY for **dialect-specific introspection** (where Kysely can't help)
3. Create generic database context that provides both capabilities
4. Separate introspection modules by dialect

**Pros:**
- Keeps Kysely benefits for user data queries (composition, builder pattern)
- Solves dialect-specific introspection cleanly with @effect/sql
- Minimal refactoring needed
- Clear separation of concerns
- Type safety where it matters (user queries are runtime-checked anyway)

**Cons:**
- Two different query styles in same codebase
- Must install both Kysely and @effect/sql

---

## Recommended Refactoring Path (Option C Hybrid)

### Phase 1: Abstraction Layer

**1. Create Database Registry System**
```typescript
// src/server/db-connection/db-dialect.ts
export type DbDialect = "postgres" | "sqlite" | "mysql" | "mssql";

export interface DbDialectConfig {
  dialect: DbDialect;
  keywords: string[];
  hasSchemas: boolean;
  supportsForeignKeys: boolean;
  introspectionCapabilities: {
    columnInfo: boolean;
    foreignKeyInfo: boolean;
    indexInfo: boolean;
    defaultValues: boolean;
  };
}

export const DIALECT_CONFIGS: Record<DbDialect, DbDialectConfig> = {
  postgres: {
    dialect: "postgres",
    hasSchemas: true,
    supportsForeignKeys: true,
    keywords: ["RETURNING", "DISTINCT ON"],
    introspectionCapabilities: {
      columnInfo: true,
      foreignKeyInfo: true,
      indexInfo: true,
      defaultValues: true,
    },
  },
  sqlite: {
    dialect: "sqlite",
    hasSchemas: false,
    supportsForeignKeys: true,
    keywords: ["RETURNING"],
    introspectionCapabilities: {
      columnInfo: true,
      foreignKeyInfo: true,
      indexInfo: true,
      defaultValues: true,
    },
  },
  // ... mysql, mssql
};
```

**2. Enhance RemoteDatabase Context**
```typescript
// src/server/db-connection/remote-database.tag.ts
export class RemoteDatabase extends Context.Tag("@dadabase/RemoteDatabase")<
  RemoteDatabase,
  EffectKysely<any>
>() {}

export class RemoteDatabaseDialect extends Context.Tag("@dadabase/RemoteDatabaseDialect")<
  RemoteDatabaseDialect,
  DbDialect
>() {}

export class RemoteDatabaseConfig extends Context.Tag("@dadabase/RemoteDatabaseConfig")<
  RemoteDatabaseConfig,
  DbDialectConfig
>() {}
```

**3. Generic Layer Factory**
```typescript
// src/db/make-remote-database-layer.ts
export const makeRemoteDatabaseLayer = (url: string, dialect: DbDialect) => {
  const dialectConfig = DIALECT_CONFIGS[dialect];

  return Layer.mergeAll(
    Layer.succeed(RemoteDatabaseDialect, dialect),
    Layer.succeed(RemoteDatabaseConfig, dialectConfig),
    Layer.effect(
      RemoteDatabase,
      Effect.gen(function* () {
        const pool = yield* PoolCache; // Already works for multiple dialects

        const kyselyDialect =
          dialect === "postgres" ? new PostgresDialect({ pool })
          : dialect === "sqlite" ? new SqliteDialect()
          : dialect === "mysql" ? new MysqlDialect({ pool })
          : new PostgresDialect({ pool }); // fallback

        const qb = new Kysely({ dialect: kyselyDialect });
        return makeFromKysely(qb);
      })
    ),
  );
};
```

### Phase 2: Introspection Abstraction

**Problem:** Schema introspection is completely dialect-specific

**Solution:** Create interface-based introspection services

```typescript
// src/server/introspection/introspection.ts
export interface DatabaseIntrospector {
  getAvailableDatabases(): Effect.Effect<Array<string>>;
  getAvailableSchemas(): Effect.Effect<Array<string>>;
  getAvailableTables(schema?: string): Effect.Effect<Array<TableInfo>>;
  getTableColumns(schema: string, table: string): Effect.Effect<Array<ColumnInfo>>;
  getTableForeignKeys(schema: string, table: string): Effect.Effect<Array<ForeignKeyInfo>>;
  getTableIndexes(schema: string, table: string): Effect.Effect<Array<IndexInfo>>;
}

// src/server/introspection/database-introspector.tag.ts
export class DatabaseIntrospector extends Context.Tag("@dadabase/DatabaseIntrospector")<
  DatabaseIntrospector,
  DatabaseIntrospector
>() {}
```

**3. Dialect-Specific Implementations**
```typescript
// src/server/introspection/postgres-introspector.ts
export const makePostgresIntrospector = (): DatabaseIntrospector => ({
  getAvailableDatabases: () => Effect.gen(function* () {
    const db = yield* RemoteDatabase;
    // Existing logic from get-available-database-list.kysely.ts
  }),

  getTableForeignKeys: (schema, table) => Effect.gen(function* () {
    const db = yield* RemoteDatabase;
    // Existing logic from get-table-foreign-keys.kysely.ts
  }),

  // ... etc
});

// src/server/introspection/sqlite-introspector.ts
export const makeSqliteIntrospector = (): DatabaseIntrospector => ({
  getAvailableDatabases: () => Effect.succeed([]), // SQLite doesn't have this concept

  getTableForeignKeys: (schema, table) => Effect.gen(function* () {
    const db = yield* RemoteDatabase;
    const keys = yield* db.execute(
      sql`PRAGMA foreign_key_list(${table})` // Different syntax!
    );
    // Map PRAGMA result to standard format
    return keys.map(...);
  }),

  // ... etc
});

// src/server/introspection/introspector-layer-factory.ts
export const makeIntrospectorLayer = (dialect: DbDialect) =>
  Layer.succeed(
    DatabaseIntrospector,
    dialect === "postgres" ? makePostgresIntrospector()
    : dialect === "sqlite" ? makeSqliteIntrospector()
    : makePostgresIntrospector() // fallback
  );
```

### Phase 3: Update Connection Management

**1. Store dialect in database_connections table**
```sql
-- Already have: id, url, name, created_at, updated_at
-- Add: dialect: "postgres" | "sqlite" | "mysql" | "mssql"
```

**2. Update RemoteConnectionLayers**
```typescript
// src/server/create-remote-server-fn.ts (updated)
export const withRemoteConnectionLayers = (
  connectionUrl: string,
  connectionId: RemoteConnectionIdType,
) => (effect: Effect.Effect<TOutput, E, R>) =>
  Effect.gen(function* () {
    const repo = yield* DatabaseConnectionRepository;
    const connection = yield* repo.findByUrl(connectionUrl);

    if (!connection) throw new Error(`Connection not found: ${connectionUrl}`);

    const dialect = connection.dialect as DbDialect; // Now stored in DB!

    const connectionLayer = QueryLoggerPersistentLayer.pipe(
      Layer.provide(Layer.succeedContext(...)),
      Layer.provideMerge(makeRemoteConnectionLayer(connectionId)),
    );

    const program = effect.pipe(
      Effect.provide(connectionLayer),
      Effect.provide(makeRemoteDatabaseLayer(connectionUrl, dialect)),
      Effect.provide(makeIntrospectorLayer(dialect)),
    );

    return yield* program;
  });
```

**3. Update query functions to use introspector**
```typescript
// src/server/introspection/fns/get-table-columns.ts (generic)
export const getTableColumns = (input: { schema: string; table: string }) =>
  Effect.gen(function* () {
    const introspector = yield* DatabaseIntrospector;
    return yield* introspector.getTableColumns(input.schema, input.table);
  }).pipe(withQueryLogging());

// Replaces old get-table-columns.kysely.ts!
```

---

## Benefits of This Approach

1. **Minimal refactoring required**
   - Existing query execution code unchanged
   - Only introspection functions reorganized

2. **Clear abstraction boundaries**
   - Introspection services isolated by dialect
   - Query execution remains generic

3. **Scalable to new databases**
   - Add new dialect: implement `DbDialectConfig`, `Introspector`, and layer factory
   - No changes to query code needed

4. **Type safety maintained**
   - Query execution: Uses Kysely's type system
   - Introspection: Defined via interface contracts

5. **Testing easier**
   - Can mock `DatabaseIntrospector` interface
   - Each dialect has isolated implementation

---

## Specific Changes Required for SQLite

### 1. New Files
- `src/server/introspection/sqlite-introspector.ts`
- `src/server/introspection/fns/sqlite/` (dialect-specific queries if needed)

### 2. Modified Files
- `src/server/db-connection/db-dialect.ts` - Add SQLite config
- `src/server/create-remote-server-fn.ts` - Provide `DatabaseIntrospector` layer
- `src/db/app.db.schema.ts` - Add `dialect` column (if not already)
- `src/server/db-connection/fns/create-db-connection.ts` - Store dialect on creation

### 3. Removed/Deprecated
- `src/server/pg/fns/get-available-schemas.kysely.ts` → Use introspector
- `src/server/pg/fns/get-available-databases.kysely.ts` → Use introspector
- `src/server/pg/fns/get-table-columns.kysely.ts` → Use introspector
- `src/server/pg/fns/get-table-foreign-keys.kysely.ts` → Use introspector

### 4. Unchanged
- `src/server/pg/fns/query-table-data.kysely.ts` - Generic query execution
- `src/server/pg/fns/query-insert.kysely.ts` - Generic mutations
- All client components - No changes!

---

## SQLite-Specific Considerations

### Features Not Available
- Schemas (SQLite has single schema)
  - UI should hide "schema" selector for SQLite
  - Treat schema as empty string internally
- Some advanced introspection
  - Catalog queries more limited
  - Use PRAGMA statements instead

### Features That Work the Same
- Foreign keys (if enabled with `PRAGMA foreign_keys = ON`)
- Column types
- Indexes
- Table listing

### Special Handling
```typescript
// In SQLiteIntrospector
getAvailableSchemas() {
  return Effect.succeed([""]); // Single implicit schema
}

getAvailableDatabases() {
  return Effect.succeed([]); // N/A for SQLite
}

// Enable foreign keys pragma
getTableForeignKeys(schema, table) {
  return Effect.gen(function* () {
    const db = yield* RemoteDatabase;

    // Ensure foreign keys are enabled
    yield* db.execute(sql`PRAGMA foreign_keys = ON`);

    const keys = yield* db.execute(
      sql`PRAGMA foreign_key_list(${table})`
    );

    return keys.map(k => ({
      name: k.id, // PRAGMA returns numeric ID, not name
      sourceColumn: k.from,
      referencedTable: k.table,
      referencedColumn: k.to,
    }));
  });
}
```

---

## @effect/sql Option (If Chosen Instead)

If you decide to use `@effect/sql` instead of hybrid approach:

```typescript
// Install: pnpm add @effect/sql @effect/sql-sqlite
import { SqlClient } from "@effect/sql";
import { SqliteSqlClient } from "@effect/sql-sqlite";

// Layer config becomes dialect-generic
const makeSqlDatabaseLayer = (url: string, dialect: DbDialect) => {
  const sqlLayer =
    dialect === "postgres" ? PgClient.layer({ ...pgConfig })
    : dialect === "sqlite" ? SqliteSqlClient.layer({ ...sqliteConfig })
    : PgClient.layer({ ...pgConfig }); // fallback

  return sqlLayer;
};

// Queries become string-based with dialect branching
const getTableColumns = (input: { schema: string; table: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const dialect = yield* RemoteDatabaseDialect;

    const columns = yield* sql.onDialectOrElse({
      pg: () => sql`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = ${input.table}
      `,
      sqlite: () => sql`PRAGMA table_info(${input.table})`,
      mysql: () => sql`
        SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ${input.table}
      `,
      orElse: () => Effect.fail(new Error("Unsupported dialect"))
    });

    return columns;
  });
```

---

## Migration Strategy

### Step 1: Preparation (No Breaking Changes)
1. Add `DbDialect` registry and config types
2. Create `DatabaseIntrospector` interface (implementation can still be old code)
3. Create `RemoteDatabaseDialect` and `RemoteDatabaseConfig` context tags
4. Update `makeRemoteDatabaseLayer` to handle multiple dialects (backend-ready)

### Step 2: Gradual Migration
1. Implement `PostgresIntrospector` wrapping existing query functions
2. Provide both old and new services during transition
3. Update start-fns to use introspector layer
4. Update client code to detect when introspection unavailable (for pre-SQLite support)

### Step 3: SQLite Support
1. Implement `SqliteIntrospector`
2. Update connection creation to accept dialect parameter
3. Update UI to handle dialect-specific features (no schemas for SQLite)
4. Add SQLite test coverage

### Step 4: Cleanup
1. Remove old dialect-specific query functions
2. Clean up `src/server/pg/fns/` to only contain generic queries
3. Consolidate into `src/server/introspection/fns/` generic interface

---

## Testing Strategy

### Unit Tests
- Each dialect's introspector tested against fixture data
- Mock SqlClient for @effect/sql approach

### Integration Tests
- Spawn SQLite, PostgreSQL containers
- Run introspection queries, verify output matches
- Test with various schema/table configurations

### End-to-End
- UI can connect to both SQLite and PostgreSQL databases
- Navigation and querying works seamlessly
- Dialect-specific features show/hide appropriately

---

## Summary

| Aspect | Current | After Refactor |
|--------|---------|-----------------|
| Database Support | PostgreSQL only | Multi-dialect via abstraction |
| Type Safety | Kysely (broken for dynamic schemas) | Kysely for queries + Interface for introspection |
| Query Execution | `src/server/pg/fns/*.kysely.ts` | Same (generic, no changes) |
| Introspection | Dialect-specific scattered | Centralized via `DatabaseIntrospector` |
| Adding New DB | Full rewrite | Implement introspector interface + layer factory |
| Code Organization | `src/server/pg/` | `src/server/introspection/` (generic) |
| Connection Layer | PostgreSQL-only context | Multi-dialect generic context |

