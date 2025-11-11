# Connection Pooling Optimization Plan

## Problem Analysis

**Current State:**
- Total query time: 167.276ms
- Actual SQL execution: 6.507ms
- Overhead: **160.769ms (96% of total time)**
- Per-query cost: Creating and destroying a `Pool` instance every single query adds ~100ms minimum

**Root Cause:**
In `makeKyselyPgDatabaseLayer()`, a new `Pool` is created for each query:
```typescript
pool: new Pool({
  connectionString: url,
})
```

The connection is then destroyed in the finalizer:
```typescript
yield* Effect.addFinalizer(() =>
  Effect.tryPromise(() => {
    return qb.destroy();
  }).pipe(Effect.catchAll(() => Effect.void)),
);
```

This means:
1. Connection pool initialization: ~50-100ms
2. TCP handshake with database
3. Authentication
4. Connection establishment
5. Query execution: 6.5ms
6. Pool destruction: ~50ms

## Solutions (Priority Order)

### Option 1: Global Connection Pool Cache (RECOMMENDED) ⭐⭐⭐
**Approach:** Maintain a Map of URL → Pool instances in memory, reuse existing pools

**Pros:**
- Simple implementation (20 lines of code)
- Immediate 90%+ performance improvement
- Reuses TCP connections
- Eliminates ~150ms overhead per query
- Pools handle connection lifecycle

**Cons:**
- Requires careful cleanup strategy
- Need to handle connection invalidation
- Memory overhead (negligible for typical use cases)

**Implementation:**
```typescript
const poolCache = new Map<string, Pool>();

export const makeKyselyPgDatabaseLayer = (url: string) => {
  let pool = poolCache.get(url);

  if (!pool) {
    pool = new Pool({ connectionString: url });
    poolCache.set(url, pool);
  }

  return Layer.effect(
    KyselyPgDatabase,
    Effect.gen(function* () {
      const qb = new Kysely<KyselyPgSchema>({
        dialect: new PostgresDialect({ pool }),
      });

      // NO finalizer destroying pool, keep it alive
      return makeFromKysely(qb);
    }).pipe(Effect.scoped),
  );
};
```

**Performance Impact:**
- First query: 167ms (one-time setup)
- Subsequent queries: 10-20ms (6.5ms SQL + 5-10ms overhead)
- **84x improvement** for repeated queries

---

### Option 2: Global Singleton Pool
**Approach:** Single pool for all connections, switch databases per query

**Pros:**
- Minimal memory overhead
- Maximum connection reuse

**Cons:**
- Only works for single database
- Not flexible for multi-database scenarios
- Requires altering queries per database

**Not recommended** for this use case

---

### Option 3: Lazy Pool Initialization with TTL
**Approach:** Cache pools with auto-cleanup after idle timeout

**Pros:**
- Balances performance and memory
- Automatic cleanup prevents stale connections
- Good for long-running applications

**Cons:**
- More complex
- Potential race conditions
- Added complexity for marginal gains

**Implementation sketch:**
```typescript
const poolCache = new Map<
  string,
  { pool: Pool; lastUsed: number }
>();

const POOL_TTL = 5 * 60 * 1000; // 5 minutes

// Cleanup every minute
setInterval(() => {
  const now = Date.now();
  for (const [url, { pool, lastUsed }] of poolCache.entries()) {
    if (now - lastUsed > POOL_TTL) {
      pool.end();
      poolCache.delete(url);
    }
  }
}, 60 * 1000);
```

---

### Option 4: Use PgBouncer (Infrastructure)
**Approach:** Deploy external connection pooler

**Pros:**
- Language-agnostic
- Can pool across multiple apps
- Advanced features (statement pooling, etc.)

**Cons:**
- Requires infrastructure changes
- Additional service to manage
- Adds network hop

**Not recommended** as first step

---

## Recommended Implementation Path

### Phase 1: Global Pool Cache (Immediate - 1 hour)
1. Create `src/db/postgres/pool-cache.ts` - maintain URL → Pool map
2. Update `makeKyselyPgDatabaseLayer()` - reuse pools
3. Add pool cleanup strategy
4. Measure: expect 10-20ms per query

### Phase 2: Advanced Monitoring (If needed)
1. Track pool utilization metrics
2. Log slow queries
3. Add connection pool stats endpoint

### Phase 3: Pool Configuration Tuning
1. Adjust pool size based on workload
2. Fine-tune idle timeout
3. Add connection validation

## Monitoring & Validation

**Before:**
```
[KyselyPgDatabase] checking client timeout
[KyselyPgDatabase] connecting new client
[KyselyPgDatabase] new client connected
[KyselyPgDatabase] pulse queue
<-- Main SQL: 6.507ms
queryTableDataServerFn: 167.276ms
```

**After (expected):**
```
<-- Main SQL: 6.507ms
queryTableDataServerFn: 12.507ms  ← 93% faster
```

## Pool Configuration Reference

The `pg` Pool accepts these options:
```typescript
new Pool({
  connectionString: url,
  max: 20,                 // max connections (default 10)
  min: 0,                  // min connections (default 2)
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 2000,
  max_overflow: 10,        // pending connections allowed
})
```

## Edge Cases to Handle

1. **Connection errors during pool creation**
   - Implement retry logic with exponential backoff
   - Fail fast if database is unreachable

2. **Stale connections**
   - Monitor via connection validation
   - Implement connection reset on error

3. **Memory leaks**
   - Track pool count in dev tools
   - Log warning if too many pools created

4. **Multiple databases via single connection**
   - Cache per URL (already handles this)
   - Handle database switching via `SET search_path` if needed

## Questions to Answer

1. How many unique database URLs are typically active?
   - If < 10, global cache is perfect
   - If > 100, might need eviction strategy

2. How long do requests live?
   - Shorter requests: can destroy after query
   - Longer requests: must keep pool alive

3. Should pools be cleaned up on app shutdown?
   - Yes, add cleanup in app exit handler
   - Important for graceful shutdown

## Success Criteria

- ✅ Query time reduced from 167ms to <20ms
- ✅ No memory leaks over 24 hours
- ✅ Graceful handling of connection errors
- ✅ Backward compatible (no API changes)

---

## Effect.js Integration - Best Practices

Based on Effect-TS documentation, here are the patterns we can use:

### Pattern 1: Using `Ref` for Thread-Safe Pool Cache (Recommended)

Effect provides `Ref` for safe, concurrent mutable references. This is perfect for our pool cache:

```typescript
import { Effect, Ref, Layer, Context } from "effect"
import { Pool } from "pg"
import { Kysely, PostgresDialect } from "kysely"
import { makeFromKysely } from "../effect-kysely.ts"
import { KyselyPgDatabase } from "./kysely.pg.database.ts"
import type { KyselyPgSchema } from "./kysely.pg.schema.ts"

// Create a service to manage the pool cache
class PoolCache extends Context.Tag("@dadabase/PoolCache")<
  PoolCache,
  {
    readonly getOrCreate: (url: string) => Effect.Effect<Pool, Error>
  }
>() {}

// Initializes the pool cache with a Ref
const makePoolCacheLive = Layer.effect(
  PoolCache,
  Effect.gen(function* () {
    const cacheRef = yield* Ref.make<Map<string, Pool>>(new Map())

    return {
      getOrCreate: (url: string) =>
        Ref.modify(cacheRef, (cache) => {
          const existing = cache.get(url)
          if (existing) {
            return [existing, cache]
          }

          const pool = new Pool({
            connectionString: url,
            max: 20,
            idleTimeoutMillis: 30000,
          })

          const newCache = new Map(cache)
          newCache.set(url, pool)

          return [pool, newCache]
        })
    }
  })
)

// Use it in makeKyselyPgDatabaseLayer
export const makeKyselyPgDatabaseLayer = (url: string) =>
  Layer.effect(
    KyselyPgDatabase,
    Effect.gen(function* () {
      const cache = yield* PoolCache
      const pool = yield* cache.getOrCreate(url)

      const qb = new Kysely<KyselyPgSchema>({
        dialect: new PostgresDialect({ pool }),
      })

      // NO finalizer - keep pool alive for reuse
      return makeFromKysely(qb)
    }).pipe(Effect.scoped)
  ).pipe(Layer.provide(makePoolCacheLive))
```

**Advantages:**
- ✅ Type-safe concurrent access via `Ref`
- ✅ Automatic serialization of cache modifications
- ✅ Works with Effect's dependency injection system
- ✅ Easy to test and mock
- ✅ Integrates cleanly with existing Effect code

### Pattern 2: With TTL using Ref + Scheduled Cleanup

For automatic pool eviction, use `Effect.fork` + `Schedule`:

```typescript
import { Effect, Ref, Layer, Context, Schedule } from "effect"

class PoolCacheWithTTL extends Context.Tag("@dadabase/PoolCacheWithTTL")<
  PoolCacheWithTTL,
  {
    readonly getOrCreate: (url: string) => Effect.Effect<Pool, Error>
  }
>() {}

type CacheEntry = {
  pool: Pool
  lastUsed: number
}

const POOL_TTL_MS = 5 * 60 * 1000 // 5 minutes

const makePoolCacheLiveWithTTL = Layer.effect(
  PoolCacheWithTTL,
  Effect.gen(function* () {
    const cacheRef = yield* Ref.make<Map<string, CacheEntry>>(new Map())

    // Spawn cleanup fiber that runs every minute
    yield* Effect.fork(
      Effect.repeatWithSchedule(
        Effect.gen(function* () {
          yield* Ref.modify(cacheRef, (cache) => {
            const now = Date.now()
            const newCache = new Map(cache)

            for (const [url, { pool, lastUsed }] of newCache.entries()) {
              if (now - lastUsed > POOL_TTL_MS) {
                Effect.runSync(
                  Effect.tryPromise(() => pool.end()).pipe(
                    Effect.catchAll(() => Effect.void)
                  )
                )
                newCache.delete(url)
                console.log(`[PoolCache] Cleaned up pool for ${url}`)
              }
            }

            return [undefined, newCache]
          })
        }),
        Schedule.spaced("60 seconds")
      )
    )

    return {
      getOrCreate: (url: string) =>
        Ref.modify(cacheRef, (cache) => {
          const existing = cache.get(url)
          if (existing) {
            // Update lastUsed timestamp
            return [
              existing.pool,
              new Map(cache).set(url, { ...existing, lastUsed: Date.now() })
            ]
          }

          const pool = new Pool({
            connectionString: url,
            max: 20,
            idleTimeoutMillis: 30000,
          })

          const newCache = new Map(cache)
          newCache.set(url, { pool, lastUsed: Date.now() })

          return [pool, newCache]
        })
    }
  })
)
```

**Why this works well:**
- ✅ Combines Effect's `Ref` (thread-safe) + `Schedule` (automatic cleanup)
- ✅ Fibers run in background without blocking queries
- ✅ TTL prevents unbounded memory growth
- ✅ `Ref.modify` ensures atomic read-modify-write
- ✅ Respects Effect's scoped resource management

### Why `Ref` over vanilla Map?

| Concern | Vanilla Map | Effect Ref |
|---------|-----------|-----------|
| Concurrent access | ⚠️ Race conditions | ✅ Safe |
| TypeScript safety | ⚠️ Could be invalidated | ✅ Type tracked |
| Integration with Effects | ❌ Not an Effect | ✅ Returns Effect |
| Testing | ⚠️ Hard to mock | ✅ Easy via Layer |
| Fiber safety | ❌ Unaware of fibers | ✅ Fiber-aware |

### The "Unknown URL Problem" You Mentioned

The challenge: we don't know which URLs ahead of time, so we can't create pools eagerly.

**Solution:** Lazy creation on-demand (what we do above)
- First query to `postgres://db1`: Create pool, cache it → 167ms
- Second query to `postgres://db1`: Reuse pool → 12ms ✅
- First query to `postgres://db2`: Create pool, cache it → 167ms
- Second query to `postgres://db2`: Reuse pool → 12ms ✅

This is **automatic** and requires no upfront configuration.

### Implementation Steps

1. **Create `src/db/postgres/pool-cache.ts`**
   - Define `PoolCache` service
   - Implement `makePoolCacheLive` Layer
   - Handle cleanup with TTL (optional but recommended)

2. **Update `src/db/postgres/kysely.pg.database.live.ts`**
   - Change `makeKyselyPgDatabaseLayer` to use `PoolCache`
   - Remove finalizer that destroys pool
   - Provide `makePoolCacheLive` in Layer.provide chain

3. **Test incrementally**
   - Single query: 167ms (expected, first connection)
   - Second query same URL: 12-15ms (should see improvement)
   - Multiple URLs: Each gets its own pool, cached separately

### Monitoring & Debugging

Add logging to track pool lifecycle:

```typescript
// In getOrCreate
if (existing) {
  console.log(`[PoolCache] Cache hit for ${url}`)
  return [existing.pool, cache]
}

console.log(`[PoolCache] Creating new pool for ${url}`)
// ... create pool
```

Result in logs:
```
[PoolCache] Creating new pool for postgres://localhost/db1
<-- Main SQL: 6.5ms
queryTableDataServerFn: 167ms

[PoolCache] Cache hit for postgres://localhost/db1
<-- Main SQL: 6.5ms
queryTableDataServerFn: 12ms  ← 93% improvement!
```
