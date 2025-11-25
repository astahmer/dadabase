import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { type ColumnType } from "kysely";
import { getAvailableDatabaseList } from "./get-available-database-list.kysely.ts";

interface TestInMemoryDbSchema {
	users: {
		id: ColumnType<number, number, number>;
		name: ColumnType<string, string, string>;
	};
}

const InMemoryLayer = Layer.effect(
	KyselyPgDatabase,
	makeEffectKyselyPglite<TestInMemoryDbSchema>({
		dataDir: "memory://",
	}) as any,
) as any as Layer.Layer<KyselyPgDatabase, never, never>;

describe("getAvailableDatabaseList", () => {
	it.effect("returns array of database objects", () => {
		return Effect.gen(function* () {
			const databases = yield* getAvailableDatabaseList;

			expect(Array.isArray(databases)).toBe(true);
			expect(databases.length).toBeGreaterThan(0);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"each database object has datname property with string value",
		() => {
			return Effect.gen(function* () {
				const databases = yield* getAvailableDatabaseList;

				databases.forEach((database) => {
					expect(database).toHaveProperty("datname");
					expect(typeof database.datname).toBe("string");
				});
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);
});
