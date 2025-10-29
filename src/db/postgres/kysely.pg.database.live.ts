import { Effect, Layer } from "effect";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { makeFromKysely } from "../effect-kysely.ts";
import { KyselyPgDatabase } from "./kysely.pg.database.ts";
import type { KyselyPgSchema } from "./kysely.pg.schema.ts";

export const makeKyselyPgDatabaseLayer = (url: string) =>
	Layer.effect(
		KyselyPgDatabase,
		Effect.gen(function* () {
			const qb = new Kysely<KyselyPgSchema>({
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
