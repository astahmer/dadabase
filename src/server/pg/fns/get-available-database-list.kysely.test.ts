import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { sql, type ColumnType } from "kysely";

interface TestInMemoryDbSchema {
	pg_database: {
		datname: ColumnType<string, string, string>;
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
			const db = yield* KyselyPgDatabase;

			// Create a temporary table to simulate pg_database
			yield* db.executeRaw(sql`
				CREATE TABLE IF NOT EXISTS pg_database_test (
					datname TEXT NOT NULL
				)
			`);

			yield* db.executeRaw(sql`
				INSERT INTO pg_database_test (datname)
				VALUES ('postgres'), ('template0'), ('template1'), ('myapp_dev'), ('myapp_test')
			`);

			// Test that we can query it
			const result: any[] = yield* db.execute(
				db.selectFrom("pg_database_test").select("datname"),
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"each database object has datname property with string value",
		() => {
			return Effect.gen(function* () {
				const db = yield* KyselyPgDatabase;

				yield* db.executeRaw(sql`
				CREATE TABLE IF NOT EXISTS pg_database_test2 (
					datname TEXT NOT NULL
				)
			`);

				yield* db.executeRaw(sql`
				INSERT INTO pg_database_test2 (datname)
				VALUES ('postgres'), ('template0'), ('template1'), ('myapp_dev'), ('myapp_test')
			`);

				const result: any[] = yield* db.execute(
					db.selectFrom("pg_database_test2").select("datname"),
				);

				result.forEach((database: any) => {
					expect(database).toHaveProperty("datname");
					expect(typeof database.datname).toBe("string");
				});
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("returns all databases including system databases", () => {
		return Effect.gen(function* () {
			const db = yield* KyselyPgDatabase;

			yield* db.executeRaw(sql`
				CREATE TABLE IF NOT EXISTS pg_database_test3 (
					datname TEXT NOT NULL
				)
			`);

			yield* db.executeRaw(sql`
				INSERT INTO pg_database_test3 (datname)
				VALUES ('postgres'), ('template0'), ('template1'), ('myapp_dev'), ('myapp_test')
			`);

			const result: any[] = yield* db.execute(
				db.selectFrom("pg_database_test3").select("datname"),
			);

			const datnames = result.map((db: any) => db.datname).sort();
			expect(datnames).toContain("postgres");
			expect(datnames).toContain("myapp_dev");
			expect(datnames).toContain("myapp_test");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("returns exactly the databases that were created", () => {
		return Effect.gen(function* () {
			const db = yield* KyselyPgDatabase;

			yield* db.executeRaw(sql`
				CREATE TABLE IF NOT EXISTS pg_database_test4 (
					datname TEXT NOT NULL
				)
			`);

			yield* db.executeRaw(sql`
				INSERT INTO pg_database_test4 (datname)
				VALUES ('postgres'), ('template0'), ('template1'), ('myapp_dev'), ('myapp_test')
			`);

			const result: any[] = yield* db.execute(
				db.selectFrom("pg_database_test4").select("datname"),
			);

			expect(result).toHaveLength(5);
			const datnames = result.map((db: any) => db.datname).sort();
			expect(datnames).toEqual([
				"myapp_dev",
				"myapp_test",
				"postgres",
				"template0",
				"template1",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("only returns datname column", () => {
		return Effect.gen(function* () {
			const db = yield* KyselyPgDatabase;

			yield* db.executeRaw(sql`
				CREATE TABLE IF NOT EXISTS pg_database_test5 (
					datname TEXT NOT NULL
				)
			`);

			yield* db.executeRaw(sql`
				INSERT INTO pg_database_test5 (datname)
				VALUES ('postgres'), ('template0'), ('template1'), ('myapp_dev'), ('myapp_test')
			`);

			const result: any[] = yield* db.execute(
				db.selectFrom("pg_database_test5").select("datname"),
			);

			// Verify each database object only has the datname property selected
			result.forEach((database: any) => {
				const keys = Object.keys(database);
				expect(keys).toEqual(["datname"]);
			});
		}).pipe(Effect.provide(InMemoryLayer));
	});
});
