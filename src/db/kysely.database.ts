import { Context, Effect, Layer } from "effect";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { type EffectKysely, makeFromKysely } from "./effect-kysely.ts";
import type { KyselyDbSchema } from "./kysely.schema.ts";

export class KyselyDatabase extends Context.Tag("@dadabase/Database")<
	KyselyDatabase,
	EffectKysely<KyselyDbSchema>
>() {
	// static make = (url: string) =>
	// 	Layer.effect(
	// 		KyselyDatabase,
	// 		Effect.gen(function* () {
	// 			const qb = new Kysely<KyselyDbSchema>({
	// 				dialect: new PostgresDialect({
	// 					pool: new Pool({ connectionString: url }),
	// 				}),
	// 				log: ["query"],
	// 			});
	// 			yield* Effect.addFinalizer(() =>
	// 				Effect.tryPromise(() => qb.destroy()).pipe(
	// 					Effect.catchAll(() => Effect.void),
	// 				),
	// 			);
	// 			return makeFromKysely(qb);
	// 		}).pipe(Effect.scoped),
	// 	);
	// private static makeClient = (url: string) =>
	// 	Layer.unwrapEffect(
	// 		Effect.gen(function* () {
	// 			return PgClient.layer({ url: Redacted.make(url) });
	// 		}),
	// 	);
}
