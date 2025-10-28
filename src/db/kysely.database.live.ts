import { Effect, Layer } from "effect";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { makeFromKysely } from "./effect-kysely.ts";
import { KyselyDatabase } from "./kysely.database.ts";
import type { KyselyDbSchema } from "./kysely.schema.ts";

export const makeKyselyDatabase = (url: string) =>
	Layer.effect(
		KyselyDatabase,
		Effect.gen(function* () {
			const qb = new Kysely<KyselyDbSchema>({
				dialect: new PostgresDialect({
					pool: new Pool({ connectionString: url }),
				}),
				log: ["query"],
			});

			yield* Effect.addFinalizer(() =>
				Effect.tryPromise(() => {
					// console.log("Destroying database");
					return qb.destroy();
				}).pipe(Effect.catchAll(() => Effect.void)),
			);

			return makeFromKysely(qb);
		}).pipe(Effect.scoped),
	);
