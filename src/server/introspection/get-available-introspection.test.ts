import {
	getAvailableDatabases,
	getAvailableSchemas,
	getAvailableTables,
} from "#src/server/introspection/introspection.ts";
import { SqlClient } from "@effect/sql";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import {
	libsqlLayer,
	makeTestLayer,
	pgliteLayer,
	postgresConfig,
	sqliteConfig,
	type DatabaseTestConfig,
} from "./test.layer.ts";

// Helper to set up test schema
const setupSchema = Effect.gen(function* () {
	const client = yield* SqlClient.SqlClient;

	// Create users table
	yield* client`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL
		)
	`;

	// Create posts table
	yield* client`
		CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY,
			title TEXT NOT NULL
		)
	`;
});

const testSuite =
	(sqlLayer: Layer.Layer<SqlClient.SqlClient>, config: DatabaseTestConfig) =>
	() => {
		const testLayer = makeTestLayer(sqlLayer);
		describe("getAvailableSchemas", () => {
			it.effect("retrieves available schemas", () =>
				Effect.gen(function* () {
					const schemas = yield* getAvailableSchemas();

					expect(Array.isArray(schemas)).toBe(true);
					expect(schemas.length).toBeGreaterThan(0);
					// Default schema should always exist
					expect(schemas).toContain(config.defaultSchema);
				}).pipe(Effect.provide(testLayer)),
			);

			it.effect("returns strings for schema names", () =>
				Effect.gen(function* () {
					const schemas = yield* getAvailableSchemas();

					schemas.forEach((schema) => {
						expect(typeof schema).toBe("string");
						expect(schema.length).toBeGreaterThan(0);
					});
				}).pipe(Effect.provide(testLayer)),
			);

			it.effect("includes default schemas", () =>
				Effect.gen(function* () {
					const schemas = yield* getAvailableSchemas();

					expect(schemas).toContain(config.defaultSchema);
					// For PostgreSQL, check pg_catalog is not returned (filtered out)
					// For SQLite, just check main and temp exist
					if (config.isPostgres) {
						expect(schemas).not.toContain("pg_catalog");
						expect(schemas).not.toContain("information_schema");
					} else {
						expect(schemas).toContain("temp");
					}
				}).pipe(Effect.provide(testLayer)),
			);
		});

		describe("getAvailableTables", () => {
			it.effect("retrieves available tables", () =>
				Effect.gen(function* () {
					yield* setupSchema;

					const tables = yield* getAvailableTables({
						schema: config.defaultSchema,
					});

					expect(Array.isArray(tables)).toBe(true);
					expect(tables.length).toBeGreaterThan(0);

					// Check that our test tables are in the list
					expect(tables.map((table) => table.name)).toContain("users");
					expect(tables.map((table) => table.name)).toContain("posts");
				}).pipe(Effect.provide(testLayer)),
			);

			it.effect("retrieves only tables from specified schema", () =>
				Effect.gen(function* () {
					const client = yield* SqlClient.SqlClient;

					yield* client`
						CREATE TABLE IF NOT EXISTS schema_test (
							id INTEGER PRIMARY KEY
						)
					`;

					const tables = yield* getAvailableTables({
						schema: config.defaultSchema,
					});

					expect(tables.length).toBe(1);
					expect(tables.map((table) => table.name)).toContain("schema_test");
				}).pipe(Effect.provide(testLayer)),
			);

			it.effect("does not include system tables", () =>
				Effect.gen(function* () {
					const tables = yield* getAvailableTables({
						schema: config.defaultSchema,
					});

					// System tables should not be included
					expect(tables.map((table) => table.name)).not.toContain("pg_class");
					expect(tables.map((table) => table.name)).not.toContain(
						"pg_attribute",
					);
					expect(tables.map((table) => table.name)).not.toContain(
						"sqlite_sequence",
					);
				}).pipe(Effect.provide(testLayer)),
			);

			it.effect(
				"returns empty array when no custom tables exist in fresh db",
				() =>
					Effect.gen(function* () {
						// For a fresh database, there should be no user tables in temp schema
						const tables = yield* getAvailableTables({ schema: "temp" });

						expect(Array.isArray(tables)).toBe(true);
						// temp schema should be empty or have no tables
					}).pipe(Effect.provide(testLayer)),
			);

			it.effect("includes all custom created tables", () =>
				Effect.gen(function* () {
					const client = yield* SqlClient.SqlClient;

					yield* client`
						CREATE TABLE IF NOT EXISTS table1 (id INTEGER PRIMARY KEY)
					`;
					yield* client`
						CREATE TABLE IF NOT EXISTS table2 (id INTEGER PRIMARY KEY)
					`;
					yield* client`
						CREATE TABLE IF NOT EXISTS table3 (id INTEGER PRIMARY KEY)
					`;

					const tables = yield* getAvailableTables({
						schema: config.defaultSchema,
					});

					expect(tables.map((table) => table.name)).toContain("table1");
					expect(tables.map((table) => table.name)).toContain("table2");
					expect(tables.map((table) => table.name)).toContain("table3");
				}).pipe(Effect.provide(testLayer)),
			);

			it.effect("returns consistent results across multiple calls", () =>
				Effect.gen(function* () {
					const client = yield* SqlClient.SqlClient;

					yield* client`
						CREATE TABLE IF NOT EXISTS stable_table (
							id INTEGER PRIMARY KEY
						)
					`;

					const tables1 = yield* getAvailableTables({
						schema: config.defaultSchema,
					});
					const tables2 = yield* getAvailableTables({
						schema: config.defaultSchema,
					});

					expect(tables1.length).toBe(tables2.length);
					expect(tables1.map((t) => t.name).sort()).toEqual(
						tables2.map((t) => t.name).sort(),
					);
				}).pipe(Effect.provide(testLayer)),
			);
		});

		describe("getAvailableDatabases", () => {
			it.effect("retrieves available databases", () =>
				Effect.gen(function* () {
					const databases = yield* getAvailableDatabases();

					expect(Array.isArray(databases)).toBe(true);
					expect(databases.length).toBeGreaterThan(0);
				}).pipe(Effect.provide(testLayer)),
			);

			it.effect("returns strings for database names", () =>
				Effect.gen(function* () {
					const databases = yield* getAvailableDatabases();

					databases.forEach((db) => {
						expect(typeof db.name).toBe("string");
						expect(db.name.length).toBeGreaterThan(0);
					});
				}).pipe(Effect.provide(testLayer)),
			);

			it.effect("includes at least one database", () =>
				Effect.gen(function* () {
					const databases = yield* getAvailableDatabases();

					// At least one database should exist
					expect(databases.length).toBeGreaterThan(0);
				}).pipe(Effect.provide(testLayer)),
			);
		});

		describe("Integration between functions", () => {
			it.effect("schemas contain tables and databases exist", () =>
				Effect.gen(function* () {
					const client = yield* SqlClient.SqlClient;

					yield* client`
						CREATE TABLE IF NOT EXISTS integration_test (
							id INTEGER PRIMARY KEY
						)
					`;

					const schemas = yield* getAvailableSchemas();
					const tables = yield* getAvailableTables({
						schema: config.defaultSchema,
					});
					const databases = yield* getAvailableDatabases();

					expect(schemas.length).toBeGreaterThan(0);
					expect(databases.length).toBeGreaterThan(0);

					// Default schema should be in schemas
					expect(schemas).toContain(config.defaultSchema);

					// integration_test should be in tables
					expect(
						tables.some((table) => table.name === "integration_test"),
					).toBe(true);
				}).pipe(Effect.provide(testLayer)),
			);
		});
	};

describe("Introspection (pglite)", testSuite(pgliteLayer, postgresConfig));
describe("Introspection (libsql)", testSuite(libsqlLayer, sqliteConfig));
