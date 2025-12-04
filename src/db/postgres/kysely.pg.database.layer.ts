// import { Effect, Layer } from "effect";
// import { Kysely, PostgresDialect } from "kysely";
// import { makeFromKysely } from "../effect-kysely.ts";
// import { KyselyPgDatabase } from "./kysely.pg.database.ts";
// import type { KyselyPgSchema } from "./kysely.pg.schema.ts";
// import { PoolCache } from "./pool-cache.ts";

// export const makeKyselyPgDatabaseLayer = (url: string) =>
// 	Layer.effect(
// 		KyselyPgDatabase,
// 		Effect.gen(function* () {
// 			const cache = yield* PoolCache;
// 			const pool = yield* cache.getOrCreate(url, "postgres");

// 			const qb = new Kysely<KyselyPgSchema>({
// 				dialect: new PostgresDialect({
// 					pool: pool,
// 					// log(...messages) {
// 					// 	console.log(`[KyselyPgDatabase] ${messages.join(" ")}`);
// 					// },
// 				}),
// 				// log: (event) => {
// 				// 	console.log(`[KyselyPgDatabase] ${event.query.sql}`);
// 				// },
// 				// log: ["query"],
// 			});

// 			// Don't destroy the pool - it's managed by the cache
// 			// yield* Effect.addFinalizer(() =>
// 			// 	Effect.tryPromise(() => {
// 			// 		return qb.destroy();
// 			// 	}).pipe(Effect.catchAll(() => Effect.void)),
// 			// );

// 			return makeFromKysely(qb);
// 		}).pipe(Effect.scoped),
// 	);
