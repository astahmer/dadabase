import { createClient } from "@libsql/client";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Effect, Layer, Redacted } from "effect";
import { Kysely } from "kysely";
import { DatabaseUrl } from "./app.db.config.ts";
import type { AppDatabaseSchema } from "./app.db.schema.ts";
import { AppDatabase } from "./app.db.ts";
import { makeFromKysely } from "./effect-kysely.ts";

const makeAppDatabaseLayer = (url: string) =>
	Layer.effect(
		AppDatabase,
		Effect.gen(function* () {
			const client = createClient({ url });
			console.log("Connecting to database:", url);

			const qb = new Kysely<AppDatabaseSchema>({
				dialect: new LibsqlDialect({ client: client as any }),
				// dialect: new LibsqlDialect({
				// 	url: url,
				// 	// authToken: "<token>", // optional
				// }),
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

export const makeAppDatabaseLayerFromEnv = Layer.unwrapEffect(
	Effect.gen(function* () {
		const url = yield* DatabaseUrl;
		const rawValue = Redacted.value(url);
		return makeAppDatabaseLayer(rawValue);
	}),
);
