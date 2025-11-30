# Query Logger - Automatic Persistence Setup

This document explains how to set up automatic database persistence for query logs.

## Overview

The Query Logger has two modes:

1. **In-Memory Only** (default) - Logs stored in Ref, cleared on session end
2. **Persistent** (optional) - Logs automatically saved to SQLite database

## Architecture

### Components

- **`query-logger.service.ts`** - Core service managing in-memory logs via Ref
- **`query-logger.kysely.ts`** - Database persistence functions
- **`with-query-logging.ts`** - Wrappers that add logging to any Effect
- **`query-persistence.start.ts`** - Server functions for client access to persistent logs
- **Database Schema** - `query_logs` and `query_favorites` tables

### Tables

```sql
-- All query executions
query_logs (
  id, connection_id, sql, params, type, schema, table,
  status, start_time, end_time, time_taken,
  rows_returned, rows_affected, error, created_at
)

-- Saved favorite queries
query_favorites (
  id, connection_id, label, sql, description, created_at, updated_at
)
```

## Usage

### Option 1: In-Memory Logging Only (Default)

No setup needed. Logs are automatically tracked in memory and available via:

```typescript
// Get all logged queries in current session
const queryHistory = yield* logger.history;

// Clear all logs
yield* logger.clearHistory();

// Remove specific log
yield* logger.removeEntry(entryId);
```

### Option 2: Automatic Database Persistence

To enable automatic persistence when queries are logged:

#### Step 1: Run Migration

```bash
pnpm migrate:gen  # Generate migration files
pnpm db push      # Apply migrations
```

The migration creates `query_logs` and `query_favorites` tables.

#### Step 2: Update Query Wrapper

Replace `withQueryLoggingAndRowCount` with `withQueryLoggingAndRowCountPersistent`:

```typescript
// Before (in-memory only)
const result = yield* withQueryLoggingAndRowCount(
  queryTableData(...),
  {
    type: "table",
    sql: "SELECT ...",
    schema: "public",
    table: "users"
  }
);

// After (with persistence)
import {
  persistQueryLog,
  updatePersistedQueryLog
} from "#src/server/query-logger/query-logger.kysely.ts";

const result = yield* withQueryLoggingAndRowCountPersistent(
  queryTableData(...),
  {
    type: "table",
    sql: "SELECT ...",
    schema: "public",
    table: "users",
    connectionId: connection.id,  // Add connection ID
    persistFn: persistQueryLog,
    updatePersistFn: updatePersistedQueryLog
  }
);
```

### Option 3: Fetch Persisted Logs

Use server functions to fetch logs from database:

```typescript
// Client-side
import { getPersistedQueryLogsServerFn } from "#src/server/pg/start-fns/query-persistence.start.ts";

const logs = await getPersistedQueryLogsServerFn({
  connectionId: connection.id,
  limit: 100
});
```

## Query Favorites Feature

Save frequently-used queries:

```typescript
import { saveQueryFavoriteServerFn } from "#src/server/pg/start-fns/query-persistence.start.ts";

// Save favorite
const id = await saveQueryFavoriteServerFn({
  connectionId: connection.id,
  label: "Active Users",
  sql: "SELECT * FROM users WHERE status = 'active'",
  description: "Find all active users"
});

// List favorites
const favorites = await getQueryFavoritesServerFn({
  connectionId: connection.id
});

// Delete favorite
await deleteQueryFavoriteServerFn({ id });
```

## Query History Management

```typescript
// Get in-memory session logs
const sessionLogs = await getQueryHistoryServerFn();

// Get persisted database logs
const persistedLogs = await getPersistedQueryLogsServerFn({
  connectionId: connection.id,
  limit: 50
});

// Delete specific log
await deleteQueryLogServerFn({ id });

// Clear all in-memory logs
yield* logger.clearHistory();
```

## Error Handling

Persistence errors are caught and logged to console but don't fail the query:

```typescript
// If persistence fails:
// Console: "Failed to persist query log ql_xxx123 to database"
// Result: Query still succeeds, in-memory log still added
```

## Performance Considerations

- **In-Memory**: No I/O overhead, instant logging
- **Persistent**: Each query adds ~1-2ms database write
  - Writes are non-blocking (errors don't fail query)
  - Consider batching for high-throughput scenarios
  - Indexes on `(connection_id, created_at)` optimize queries

## Migration from In-Memory to Persistent

1. Deploy new tables (migration)
2. Update query wrappers to use persistent versions
3. New logs save to database automatically
4. Old in-memory logs clear on session refresh
5. Old logs can be imported via manual process if needed

## Cleanup Strategies

For long-running sessions, implement log retention:

```typescript
// Keep only last N days
const keepDays = 7;
const threshold = Date.now() - (keepDays * 24 * 60 * 60 * 1000);

yield* db.execute(
  db.deleteFrom("query_logs")
    .where("created_at", "<", threshold)
);
```

## API Reference

### Logger Service

```typescript
// In-memory operations (always available)
logger.history               // Get all logs
logger.addEntry(entry)      // Add new log
logger.updateEntry(id, updates)  // Update status/result
logger.removeEntry(id)      // Delete log
logger.clearHistory()       // Clear all logs
```

### Persistence Functions

```typescript
// In query-logger.kysely.ts
persistQueryLog(connectionId, entry)           // Save to DB
updatePersistedQueryLog(id, updates)           // Update in DB
deleteQueryLog(id)                             // Delete from DB
getQueryLogs(connectionId, limit?)             // Read from DB
saveFavorite(connectionId, label, sql, desc)   // Save favorite
deleteFavorite(id)                             // Delete favorite
getFavorites(connectionId)                     // List favorites
```

### Server Functions

```typescript
// In query-persistence.start.ts
getPersistedQueryLogsServerFn({ connectionId, limit })
getQueryFavoritesServerFn({ connectionId })
saveQueryFavoriteServerFn({ connectionId, label, sql, description })
deleteQueryFavoriteServerFn({ id })
deleteQueryLogServerFn({ id })
```

### Wrapper Functions

```typescript
// In with-query-logging.ts
withQueryLogging(effect, options)  // Basic logging
withQueryLoggingAndRowCount(effect, options)  // Logs row counts

// With persistence:
withQueryLoggingPersistent(effect, options & persistFns)
withQueryLoggingAndRowCountPersistent(effect, options & persistFns)
```

## Examples

### Example 1: Query with Automatic Persistence

```typescript
// In query-table-data.start.ts
const result = yield* withQueryLoggingAndRowCountPersistent(
  queryTableData({
    schema: input.schema,
    table: input.table,
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
    filters: validatedFilters ?? { conditions: [], logicalOperator: "and" }
  }),
  {
    type: "table",
    sql: `SELECT * FROM "${input.schema}"."${input.table}"`,
    schema: input.schema,
    table: input.table,
    connectionId: connection.id,
    persistFn: persistQueryLog,
    updatePersistFn: updatePersistedQueryLog
  }
).pipe(Effect.provide(makeKyselyPgDatabaseLayer(connection.url)));
```

### Example 2: Fetch & Display Logs in UI

```typescript
// Client component
const { data: logs } = useQuery({
  queryKey: ["query-logs", connectionId],
  queryFn: () => getPersistedQueryLogsServerFn({ connectionId, limit: 100 })
});

return (
  <div>
    {logs?.map(log => (
      <div key={log.id}>
        <code>{log.sql}</code>
        <span>{log.status}</span>
        <span>{log.time_taken}ms</span>
      </div>
    ))}
  </div>
);
```

### Example 3: Save & Load Query Favorite

```typescript
// Save
const id = await saveQueryFavoriteServerFn({
  connectionId,
  label: "My Saved Query",
  sql: "SELECT * FROM users WHERE status = 'active'"
});

// Load and execute
const favorites = await getQueryFavoritesServerFn({ connectionId });
const favorite = favorites[0];
const result = await queryTableDataServerFn({
  url: connection.url,
  schema: "public",
  table: "users",
  filters: { ... }  // Parse from favorite.sql if needed
});
```

## Testing

Mock the persistence functions for testing:

```typescript
const mockPersistFn = Effect.sync(() => {/* no-op */});
const mockUpdatePersistFn = Effect.sync(() => {/* no-op */});

const result = yield* withQueryLoggingAndRowCountPersistent(
  testEffect,
  {
    type: "table",
    sql: "SELECT ...",
    connectionId: "test-connection",
    persistFn: mockPersistFn,
    updatePersistFn: mockUpdatePersistFn
  }
);
```
