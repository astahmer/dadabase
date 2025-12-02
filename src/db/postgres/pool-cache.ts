import { redactConnectionUrl } from "#src/lib/redact-connection-url.ts";
import {
	Effect,
	Ref,
	Layer,
	Context,
	Schedule,
	Redacted,
	Duration,
} from "effect";
import { PgClient } from "@effect/sql-pg";
import { SqlClient } from "@effect/sql";
import type { SqlError } from "@effect/sql/SqlError";

export class PoolCache extends Context.Tag("@dadabase/PoolCache")<
	PoolCache,
	{
		readonly getOrCreate: (
			url: string,
		) => Effect.Effect<Layer.Layer<SqlClient.SqlClient, SqlError>>;
		readonly getMetrics: () => Effect.Effect<{
			poolCount: number;
			urls: string[];
		}>;
	}
>() {}

type CacheEntry = {
	layer: Layer.Layer<SqlClient.SqlClient, SqlError>;
	lastUsed: number;
};
const POOL_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const makePoolCacheLive = Layer.effect(
	PoolCache,
	Effect.gen(function* () {
		const cacheRef = yield* Ref.make<Map<string, CacheEntry>>(new Map());

		// Spawn a single cleanup fiber that repeats every X seconds
		// This fiber is part of the layer's scope, so it lives for the entire app lifetime
		const cleanupRoutine = Effect.gen(function* () {
			// console.log("PoolCache cleanupRoutine");
			yield* Ref.modify(cacheRef, (cache) => {
				const now = Date.now();
				const newCache = new Map(cache);

				for (const [url, { layer, lastUsed }] of newCache.entries()) {
					if (now - lastUsed > POOL_TTL_MS) {
						// Fire and forget cleanup
						// layer.end().catch(() => {});
						newCache.delete(url);
						// console.log(`[PoolCache] Evicted pool for ${url}`);
					}
				}

				return [undefined, newCache];
			});
		}).pipe(Effect.repeat(Schedule.spaced("3 seconds")));

		// Fork as daemon so it runs in background, managed by app scope
		yield* Effect.forkDaemon(cleanupRoutine);

		return {
			getOrCreate: (url: string) =>
				Ref.modify(cacheRef, (cache) => {
					const existing = cache.get(url);
					if (existing) {
						return [
							existing.layer,
							new Map(cache).set(url, {
								...existing,
								lastUsed: Date.now(),
							}),
						];
					}

					console.log(
						`[PoolCache] Creating new pool for ${redactConnectionUrl(url)}`,
					);
					const layer = PgClient.layer({
						url: Redacted.make(url),
						maxConnections: 20,
						idleTimeout: Duration.seconds(30),
					});
					// PgClient.make
					// Layer.extendScope

					const newCache = new Map(cache);
					newCache.set(url, { layer, lastUsed: Date.now() });
					return [layer, newCache];
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
