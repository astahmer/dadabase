import type { PGliteOptions } from "@electric-sql/pglite";
import { Effect } from "effect";
import { CamelCasePlugin, Kysely } from "kysely";
import { makeFromKysely } from "./effect-kysely.ts";

export const makeEffectKyselyPglite = <T>(pgLiteOptions?: PGliteOptions) =>
	Effect.gen(function* () {
		const { KyselyPGlite } = yield* Effect.tryPromise(
			() => import("kysely-pglite"),
		);
		const { dialect } = yield* Effect.tryPromise(() =>
			KyselyPGlite.create(pgLiteOptions),
		);

		const qb = new Kysely<T>({
			dialect,
			plugins: [new CamelCasePlugin()],
		});

		return makeFromKysely(qb);
	});
