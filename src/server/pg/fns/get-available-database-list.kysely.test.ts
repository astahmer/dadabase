import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { getAvailableDatabaseList } from "#src/server/pg/fns/get-available-database-list.kysely.ts";
import { QueryLogger } from "#src/server/query-logger/query-logger.service.ts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

const InMemoryLayer = Layer.effect(
	KyselyPgDatabase,
	makeEffectKyselyPglite<any>({
		dataDir: "memory://",
	}),
).pipe(Layer.merge(QueryLogger.Default));

describe("getAvailableDatabaseList", () => {
	it.effect("works", () => {
		return Effect.gen(function* () {
			const dbList = yield* getAvailableDatabaseList({});

			expect(dbList.length).toBeGreaterThanOrEqual(1);
			expect(dbList.some((db) => db.datname === "postgres")).toBe(true);
		}).pipe(Effect.provide(InMemoryLayer));
	});
});
