import { Effect } from "effect";
import type { DatabaseDialect } from "../dialect.ts";
import { PoolCache } from "./pool-cache.ts";

export const makeRemoteSqlClientLayer = (
	url: string,
	dialect: DatabaseDialect,
) =>
	Effect.gen(function* () {
		const cache = yield* PoolCache;
		const pool = yield* cache.getOrCreate(url, dialect);

		return pool;
	});
