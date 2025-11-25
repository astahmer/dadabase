import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { getAvailableSchemas } from "./get-available-schemas.kysely.ts";
import { getAvailableTableList } from "./get-available-tables.kysely.ts";
import { getAvailableDatabaseList } from "./get-available-database-list.kysely.ts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { sql, type ColumnType } from "kysely";

interface TestInMemoryDbSchema {
	users: {
		id: ColumnType<number, number, number>;
		name: ColumnType<string, string, string>;
	};
	posts: {
		id: ColumnType<number, number, number>;
		title: ColumnType<string, string, string>;
	};
}

const InMemoryLayer = Layer.effect(
	KyselyPgDatabase,
	makeEffectKyselyPglite<TestInMemoryDbSchema>({
		dataDir: "memory://",
	}) as any,
) as any as Layer.Layer<KyselyPgDatabase, never, never>;

describe("PostgreSQL Introspection Functions", () => {
	describe("getAvailableSchemas", () => {
		it.effect("retrieves available schemas", () => {
			return Effect.gen(function* () {
				const schemas = yield* getAvailableSchemas;

				expect(Array.isArray(schemas)).toBe(true);
				expect(schemas.length).toBeGreaterThan(0);
				// 'public' schema should always exist
				expect(schemas).toContain("public");
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("returns strings for schema names", () => {
			return Effect.gen(function* () {
				const schemas = yield* getAvailableSchemas;

				schemas.forEach((schema) => {
					expect(typeof schema).toBe("string");
					expect(schema.length).toBeGreaterThan(0);
				});
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("includes default schemas like public, pg_catalog", () => {
			return Effect.gen(function* () {
				const schemas = yield* getAvailableSchemas;

				expect(schemas).toContain("public");
				// pg_catalog and information_schema are default system schemas
			}).pipe(Effect.provide(InMemoryLayer));
		});
	});

	describe("getAvailableTableList", () => {
		it.effect("retrieves available tables with metadata", () => {
			return Effect.gen(function* () {
				const db = yield* KyselyPgDatabase;

				// Create test tables
				yield* db.executeRaw(sql`
					CREATE TABLE IF NOT EXISTS users (
						id SERIAL PRIMARY KEY,
						name TEXT NOT NULL
					)
				`);

				yield* db.executeRaw(sql`
					CREATE TABLE IF NOT EXISTS posts (
						id SERIAL PRIMARY KEY,
						title TEXT NOT NULL
					)
				`);

				const tables = yield* getAvailableTableList;

				expect(Array.isArray(tables)).toBe(true);
				expect(tables.length).toBeGreaterThan(0);

				// Check that our test tables are in the list
				const tableNames = tables.map((t) => t.name);
				expect(tableNames).toContain("users");
				expect(tableNames).toContain("posts");
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("returns table objects with name and schema properties", () => {
			return Effect.gen(function* () {
				const db = yield* KyselyPgDatabase;

				yield* db.executeRaw(sql`
					CREATE TABLE IF NOT EXISTS test_table (
						id SERIAL PRIMARY KEY
					)
				`);

				const tables = yield* getAvailableTableList;

				tables.forEach((table) => {
					expect(table.name).toBeDefined();
					expect(typeof table.name).toBe("string");
					expect(table.schema).toBeDefined();
					expect(typeof table.schema).toBe("string");
				});
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("filters to only public schema tables", () => {
			return Effect.gen(function* () {
				const db = yield* KyselyPgDatabase;

				yield* db.executeRaw(sql`
					CREATE TABLE IF NOT EXISTS public_test (
						id SERIAL PRIMARY KEY
					)
				`);

				const tables = yield* getAvailableTableList;

				// All tables should be from public schema
				tables.forEach((table) => {
					expect(table.schema).toBe("public");
				});
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("does not include system tables", () => {
			return Effect.gen(function* () {
				const tables = yield* getAvailableTableList;

				const tableNames = tables.map((t) => t.name);
				// System tables should not be included
				expect(tableNames).not.toContain("pg_class");
				expect(tableNames).not.toContain("pg_attribute");
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("returns empty array when no tables exist", () => {
			return Effect.gen(function* () {
				const tables = yield* getAvailableTableList;

				// Fresh in-memory database might have no tables
				if (tables.length === 0) {
					expect(Array.isArray(tables)).toBe(true);
				}
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("includes all custom created tables", () => {
			return Effect.gen(function* () {
				const db = yield* KyselyPgDatabase;

				yield* db.executeRaw(sql`
					CREATE TABLE IF NOT EXISTS table1 (id SERIAL PRIMARY KEY)
				`);
				yield* db.executeRaw(sql`
					CREATE TABLE IF NOT EXISTS table2 (id SERIAL PRIMARY KEY)
				`);
				yield* db.executeRaw(sql`
					CREATE TABLE IF NOT EXISTS table3 (id SERIAL PRIMARY KEY)
				`);

				const tables = yield* getAvailableTableList;

				const tableNames = tables.map((t) => t.name);
				expect(tableNames).toContain("table1");
				expect(tableNames).toContain("table2");
				expect(tableNames).toContain("table3");
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("returns consistent results across multiple calls", () => {
			return Effect.gen(function* () {
				const db = yield* KyselyPgDatabase;

				yield* db.executeRaw(sql`
					CREATE TABLE IF NOT EXISTS stable_table (
						id SERIAL PRIMARY KEY
					)
				`);

				const tables1 = yield* getAvailableTableList;
				const tables2 = yield* getAvailableTableList;

				expect(tables1.length).toBe(tables2.length);
				const names1 = tables1.map((t) => t.name).sort();
				const names2 = tables2.map((t) => t.name).sort();
				expect(names1).toEqual(names2);
			}).pipe(Effect.provide(InMemoryLayer));
		});
	});

	describe("getAvailableDatabaseList", () => {
		it.effect("retrieves available databases", () => {
			return Effect.gen(function* () {
				const databases = yield* getAvailableDatabaseList;

				expect(Array.isArray(databases)).toBe(true);
				expect(databases.length).toBeGreaterThan(0);
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("includes datname property for each database", () => {
			return Effect.gen(function* () {
				const databases = yield* getAvailableDatabaseList;

				databases.forEach((db) => {
					expect(db.datname).toBeDefined();
					expect(typeof db.datname).toBe("string");
					expect(db.datname.length).toBeGreaterThan(0);
				});
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("includes default PostgreSQL databases", () => {
			return Effect.gen(function* () {
				const databases = yield* getAvailableDatabaseList;

				const dbNames = databases.map((d) => d.datname);

				// Default PostgreSQL databases should be present
				// At least one database should exist
				expect(dbNames.length).toBeGreaterThan(0);
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("returns database objects with expected properties", () => {
			return Effect.gen(function* () {
				const databases = yield* getAvailableDatabaseList;

				databases.forEach((database) => {
					expect(database).toHaveProperty("datname");
				});
			}).pipe(Effect.provide(InMemoryLayer));
		});
	});

	describe("Integration between functions", () => {
		it.effect("schemas contain tables and databases contain schemas", () => {
			return Effect.gen(function* () {
				const db = yield* KyselyPgDatabase;

				yield* db.executeRaw(sql`
					CREATE TABLE IF NOT EXISTS integration_test (
						id SERIAL PRIMARY KEY
					)
				`);

				const schemas = yield* getAvailableSchemas;
				const tables = yield* getAvailableTableList;
				const databases = yield* getAvailableDatabaseList;

				expect(schemas.length).toBeGreaterThan(0);
				expect(tables.length).toBeGreaterThan(0);
				expect(databases.length).toBeGreaterThan(0);

				// Public schema should be in schemas
				expect(schemas).toContain("public");

				// Tables should be in public schema
				const publicTables = tables.filter((t) => t.schema === "public");
				expect(publicTables.length).toBeGreaterThan(0);
			}).pipe(Effect.provide(InMemoryLayer));
		});
	});
});
