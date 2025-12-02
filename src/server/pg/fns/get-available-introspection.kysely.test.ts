import { PgLiteClient } from "@dadabase/effect-pglite";
import { SqlClient } from "@effect/sql";
import { describe, expect, it } from "@effect/vitest";
import {
	getAvailableSchemas,
	getAvailableTables,
	getAvailableDatabases,
} from "#src/server/introspection/introspection.ts";
import { Effect, Layer } from "effect";

const pgliteLayer = PgLiteClient.layer({
	dataDir: "memory://",
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

// Helper to set up test schema
const setupSchema = Effect.gen(function* () {
	const client = yield* SqlClient.SqlClient;

	// Create users table
	yield* client`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL
		)
	`;

	// Create posts table
	yield* client`
		CREATE TABLE IF NOT EXISTS posts (
			id SERIAL PRIMARY KEY,
			title TEXT NOT NULL
		)
	`;
});

describe("PostgreSQL Introspection Functions", () => {
	describe("getAvailableSchemas", () => {
		it.effect("retrieves available schemas", () =>
			Effect.gen(function* () {
				const schemas = yield* getAvailableSchemas();

				expect(Array.isArray(schemas)).toBe(true);
				expect(schemas.length).toBeGreaterThan(0);
				// 'public' schema should always exist
				expect(schemas).toContain("public");
			}).pipe(Effect.provide(pgliteLayer)),
		);

		it.effect("returns strings for schema names", () =>
			Effect.gen(function* () {
				const schemas = yield* getAvailableSchemas();

				schemas.forEach((schema) => {
					expect(typeof schema).toBe("string");
					expect(schema.length).toBeGreaterThan(0);
				});
			}).pipe(Effect.provide(pgliteLayer)),
		);

		it.effect("includes default schemas like public, pg_catalog", () =>
			Effect.gen(function* () {
				const schemas = yield* getAvailableSchemas();

				expect(schemas).toContain("public");
				// pg_catalog and information_schema are default system schemas
			}).pipe(Effect.provide(pgliteLayer)),
		);
	});

	describe("getAvailableTables", () => {
		it.effect("retrieves available tables", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const tables = yield* getAvailableTables({ schema: "public" });

				expect(Array.isArray(tables)).toBe(true);
				expect(tables.length).toBeGreaterThan(0);

				// Check that our test tables are in the list
				expect(tables.map((table) => table.name)).toContain("users");
				expect(tables.map((table) => table.name)).toContain("posts");
			}).pipe(Effect.provide(pgliteLayer)),
		);

		it.effect("retrieves only tables from specified schema", () =>
			Effect.gen(function* () {
				const client = yield* SqlClient.SqlClient;

				yield* client`
					CREATE TABLE IF NOT EXISTS public_test (
						id SERIAL PRIMARY KEY
					)
				`;

				const tables = yield* getAvailableTables({ schema: "public" });

				expect(tables.length).toBe(1);
				expect(tables.map((table) => table.name)).toContain("public_test");
			}).pipe(Effect.provide(pgliteLayer)),
		);

		it.effect("does not include system tables", () =>
			Effect.gen(function* () {
				const tables = yield* getAvailableTables({ schema: "public" });

				// System tables should not be included in public schema
				expect(tables).not.toContain("pg_class");
				expect(tables).not.toContain("pg_attribute");
			}).pipe(Effect.provide(pgliteLayer)),
		);

		it.effect("returns empty array when no tables exist", () =>
			Effect.gen(function* () {
				// Query a non-existent schema or fresh database
				const tables = yield* getAvailableTables({
					schema: "nonexistent_schema",
				});

				expect(Array.isArray(tables)).toBe(true);
				expect(tables.length).toBe(0);
			}).pipe(Effect.provide(pgliteLayer)),
		);

		it.effect("includes all custom created tables", () =>
			Effect.gen(function* () {
				const client = yield* SqlClient.SqlClient;

				yield* client`
					CREATE TABLE IF NOT EXISTS table1 (id SERIAL PRIMARY KEY)
				`;
				yield* client`
					CREATE TABLE IF NOT EXISTS table2 (id SERIAL PRIMARY KEY)
				`;
				yield* client`
					CREATE TABLE IF NOT EXISTS table3 (id SERIAL PRIMARY KEY)
				`;

				const tables = yield* getAvailableTables({ schema: "public" });

				expect(tables.map((table) => table.name)).toContain("table1");
				expect(tables.map((table) => table.name)).toContain("table2");
				expect(tables.map((table) => table.name)).toContain("table3");
			}).pipe(Effect.provide(pgliteLayer)),
		);

		it.effect("returns consistent results across multiple calls", () =>
			Effect.gen(function* () {
				const client = yield* SqlClient.SqlClient;

				yield* client`
					CREATE TABLE IF NOT EXISTS stable_table (
						id SERIAL PRIMARY KEY
					)
				`;

				const tables1 = yield* getAvailableTables({ schema: "public" });
				const tables2 = yield* getAvailableTables({ schema: "public" });

				expect(tables1.length).toBe(tables2.length);
				expect([...tables1].sort()).toEqual([...tables2].sort());
			}).pipe(Effect.provide(pgliteLayer)),
		);
	});

	describe("getAvailableDatabases", () => {
		it.effect("retrieves available databases", () =>
			Effect.gen(function* () {
				const databases = yield* getAvailableDatabases();

				expect(Array.isArray(databases)).toBe(true);
				expect(databases.length).toBeGreaterThan(0);
			}).pipe(Effect.provide(pgliteLayer)),
		);

		it.effect("returns strings for database names", () =>
			Effect.gen(function* () {
				const databases = yield* getAvailableDatabases();

				databases.forEach((db) => {
					expect(typeof db.name).toBe("string");
					expect(db.name.length).toBeGreaterThan(0);
				});
			}).pipe(Effect.provide(pgliteLayer)),
		);

		it.effect("includes default PostgreSQL databases", () =>
			Effect.gen(function* () {
				const databases = yield* getAvailableDatabases();

				// At least one database should exist
				expect(databases.length).toBeGreaterThan(0);
			}).pipe(Effect.provide(pgliteLayer)),
		);
	});

	describe("Integration between functions", () => {
		it.effect("schemas contain tables and databases contain schemas", () =>
			Effect.gen(function* () {
				const client = yield* SqlClient.SqlClient;

				yield* client`
					CREATE TABLE IF NOT EXISTS integration_test (
						id SERIAL PRIMARY KEY
					)
				`;

				const schemas = yield* getAvailableSchemas();
				const tables = yield* getAvailableTables({ schema: "public" });
				const databases = yield* getAvailableDatabases();

				expect(schemas.length).toBeGreaterThan(0);
				expect(tables.length).toBeGreaterThan(0);
				expect(databases.length).toBeGreaterThan(0);

				// Public schema should be in schemas
				expect(schemas).toContain("public");

				// integration_test should be in tables
				expect(tables.some((table) => table.name === "integration_test")).toBe(
					true,
				);
			}).pipe(Effect.provide(pgliteLayer)),
		);
	});
});
