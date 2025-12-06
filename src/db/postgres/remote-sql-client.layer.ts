import { Effect } from "effect";
import { PoolCache } from "./pool-cache.ts";
import type { DatabaseDialect } from "../dialect.ts";

export const makeRemoteSqlClientLayer = (
	url: string,
	dialect: DatabaseDialect,
) =>
	Effect.gen(function* () {
		const cache = yield* PoolCache;
		const pool = yield* cache.getOrCreate(url, dialect);

		return pool;
	});
