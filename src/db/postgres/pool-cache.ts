import { Effect, Ref, Layer, Context, Schedule } from "effect";
import { Pool } from "pg";

class PoolCache extends Context.Tag("@dadabase/PoolCache")<
	PoolCache,
	{
		readonly getOrCreate: (url: string) => Effect.Effect<Pool, Error>;
		readonly getMetrics: () => Effect.Effect<{
			poolCount: number;
			urls: string[];
		}>;
	}
>() {}

type CacheEntry = { pool: Pool; lastUsed: number };
const POOL_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const makePoolCacheLive = Layer.effect(
	PoolCache,
	Effect.gen(function* () {
		const cacheRef = yield* Ref.make<Map<string, CacheEntry>>(new Map());
		console.log("init makePoolCacheLive", cacheRef);

		// Spawn cleanup fiber that runs every 60 seconds
		const cleanupRoutine = Effect.gen(function* () {
			yield* Ref.modify(cacheRef, (cache) => {
				const now = Date.now();
				const newCache = new Map(cache);

				for (const [url, { pool, lastUsed }] of newCache.entries()) {
					if (now - lastUsed > POOL_TTL_MS) {
						// Fire and forget cleanup
						pool.end().catch(() => {});
						newCache.delete(url);
						console.log(`[PoolCache] Evicted pool for ${url}`);
					}
				}

				return [undefined, newCache];
			});
		});
		yield* Effect.fork(
			cleanupRoutine.pipe(Effect.repeat(Schedule.spaced("60 seconds"))),
		);

		return {
			getOrCreate: (url: string) =>
				Ref.modify(cacheRef, (cache) => {
					const existing = cache.get(url);
					if (existing) {
						return [
							existing.pool,
							new Map(cache).set(url, {
								...existing,
								lastUsed: Date.now(),
							}),
						];
					}

					console.log(`[PoolCache] Creating new pool for ${url}`);
					const pool = new Pool({
						connectionString: url,
						max: 20,
						idleTimeoutMillis: 30000,
					});

					const newCache = new Map(cache);
					newCache.set(url, { pool, lastUsed: Date.now() });
					return [pool, newCache];
				}),

			getMetrics: () =>
				Ref.get(cacheRef).pipe(
					Effect.map((cache) => ({
						poolCount: cache.size,
						urls: Array.from(cache.keys()),
					})),
				),
		};
	}),
);

export { PoolCache };
