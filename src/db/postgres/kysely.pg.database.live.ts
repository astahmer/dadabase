import { Effect } from "effect";
import { PoolCache } from "./pool-cache.ts";

export const makeKyselyPgDatabaseLayer = (url: string) =>
	Effect.gen(function* () {
		const cache = yield* PoolCache;
		const pool = yield* cache.getOrCreate(url);

		return pool;
	});
