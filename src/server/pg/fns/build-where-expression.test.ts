import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { buildWhereExpression } from "./build-where-expression.ts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { sql, type ColumnType } from "kysely";

interface TestInMemoryDbSchema {
	test_data: {
		id: ColumnType<string, string, string>;
		age: ColumnType<number | null, number, number>;
		status: ColumnType<string | null, string, string>;
		name: ColumnType<string | null, string, string>;
		email: ColumnType<string | null, string, string>;
		price: ColumnType<number | null, number, number>;
		description: ColumnType<string | null, string, string>;
		is_active: ColumnType<boolean | null, boolean, boolean>;
		is_deleted: ColumnType<boolean, boolean, boolean>;
		quantity: ColumnType<number, number, number>;
	};
}

const InMemoryLayer = Layer.effect(
	KyselyPgDatabase,
	makeEffectKyselyPglite<TestInMemoryDbSchema>({
		dataDir: "memory://",
	}),
) as Layer.Layer<KyselyPgDatabase, never, never>;

describe("buildWhereExpression", () => {
	// Helper to set up test schema
	const setupSchema = Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS test_data (
				id TEXT PRIMARY KEY,
				age INTEGER,
				status TEXT,
				name TEXT,
				email TEXT,
				price DECIMAL,
				description TEXT,
				is_active BOOLEAN,
				is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
				quantity INTEGER NOT NULL DEFAULT 0
			)
		`);
	});

	// Helper to insert test data
	const insertTestData = Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		yield* db.executeRaw(sql`
			INSERT INTO test_data (id, age, status, name, email, price, description, is_active, is_deleted, quantity)
			VALUES
			('row-1', 25, 'active', 'John Doe', 'john@example.com', 99.99, 'Test 100%', true, false, 5),
			('row-2', 30, 'pending', 'Jane Smith', 'jane@example.com', 49.99, 'Normal text', false, false, 0),
			('row-3', 35, 'inactive', 'Bob Johnson', NULL, 150.00, NULL, NULL, true, 10),
			('row-4', 18, 'active', '', 'test@example.com', 0.00, '', true, false, 0),
			('row-5', NULL, 'review', 'Alice', 'alice@example.com', NULL, 'Sample', NULL, false, 100)
		`);
	});

	it.effect("returns undefined for empty conditions", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = buildWhereExpression([], "and");
			expect(result).toBeUndefined();
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("filters out conditions with undefined values", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "age",
						operator: "equals" as const,
						value: undefined,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db
					.selectFrom("test_data")
					.selectAll()
					.where(whereExpr || sql`1=1`),
			);
			// No WHERE clause applied, so all rows returned
			expect(rows).toHaveLength(5);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"filters out conditions with null values for non-null operators",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;
				const db = yield* KyselyPgDatabase;

				const whereExpr = buildWhereExpression(
					[
						{
							column: "age",
							operator: "equals" as const,
							value: null,
						},
					],
					"and",
				);

				const rows: any[] = yield* db.execute(
					db
						.selectFrom("test_data")
						.selectAll()
						.where(whereExpr || sql`1=1`),
				);
				// No WHERE clause applied, so all rows returned
				expect(rows).toHaveLength(5);
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("handles is_null operator correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "age",
						operator: "is_null" as const,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// Only row-5 has NULL age
			expect(rows).toHaveLength(1);
			expect(rows[0]!.id).toBe("row-5");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("handles is_not_null operator correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "age",
						operator: "is_not_null" as const,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// All rows except row-5 have non-NULL age
			expect(rows).toHaveLength(4);
			expect(rows.map((r: any) => r.id).sort()).toEqual([
				"row-1",
				"row-2",
				"row-3",
				"row-4",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds equals expression correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "status",
						operator: "equals" as const,
						value: "active",
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(2);
			expect(rows.map((r: any) => r.id).sort()).toEqual(["row-1", "row-4"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds not_equals expression correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "status",
						operator: "not_equals" as const,
						value: "active",
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// Rows with status != 'active' (excludes NULL status rows)
			expect(rows).toHaveLength(3);
			expect(rows.map((r: any) => r.id).sort()).toEqual([
				"row-2",
				"row-3",
				"row-5",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds contains expression with ILIKE correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "name",
						operator: "contains" as const,
						value: "john",
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// Case-insensitive contains 'john'
			expect(rows).toHaveLength(2);
			expect(rows.map((r: any) => r.id).sort()).toEqual(["row-1", "row-3"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds not_contains expression correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "name",
						operator: "not_contains" as const,
						value: "john",
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// Rows that don't contain 'john' (excludes NULLs): row-2, row-4 (empty string), row-5
			expect(rows).toHaveLength(3);
			expect(rows.map((r: any) => r.id).sort()).toEqual([
				"row-2",
				"row-4",
				"row-5",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds starts_with expression correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "email",
						operator: "starts_with" as const,
						value: "test",
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(1);
			expect(rows[0]!.id).toBe("row-4");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds ends_with expression correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "email",
						operator: "ends_with" as const,
						value: "example.com",
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// All emails end with example.com: row-1, row-2, row-4, row-5
			expect(rows).toHaveLength(4);
			expect(rows.map((r: any) => r.id).sort()).toEqual([
				"row-1",
				"row-2",
				"row-4",
				"row-5",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds greater_than expression correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "age",
						operator: "greater_than" as const,
						value: 25,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(2);
			expect(rows.map((r: any) => r.id).sort()).toEqual(["row-2", "row-3"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds greater_than_or_equal expression correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "age",
						operator: "greater_than_or_equal" as const,
						value: 30,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(2);
			expect(rows.map((r: any) => r.id).sort()).toEqual(["row-2", "row-3"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds less_than expression correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "age",
						operator: "less_than" as const,
						value: 30,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(2);
			expect(rows.map((r: any) => r.id).sort()).toEqual(["row-1", "row-4"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds less_than_or_equal expression correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "price",
						operator: "less_than_or_equal" as const,
						value: 99.99,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(3);
			expect(rows.map((r: any) => r.id).sort()).toEqual([
				"row-1",
				"row-2",
				"row-4",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds in expression with array values correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "status",
						operator: "in" as const,
						value: ["active", "pending"],
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(3);
			expect(rows.map((r: any) => r.id).sort()).toEqual([
				"row-1",
				"row-2",
				"row-4",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("converts single value to array for in operator", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "status",
						operator: "in" as const,
						value: "active",
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(2);
			expect(rows.map((r: any) => r.id).sort()).toEqual(["row-1", "row-4"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("builds not_in expression with array values correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "status",
						operator: "not_in" as const,
						value: ["active", "pending"],
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(2);
			expect(rows.map((r: any) => r.id).sort()).toEqual(["row-3", "row-5"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("combines multiple conditions with AND operator", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "age",
						operator: "greater_than" as const,
						value: 25,
					},
					{
						column: "status",
						operator: "equals" as const,
						value: "active",
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// age > 25 AND status = 'active' => no rows (active rows are 25 and 18)
			expect(rows).toHaveLength(0);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("combines multiple conditions with OR operator", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "status",
						operator: "equals" as const,
						value: "active",
					},
					{
						column: "status",
						operator: "equals" as const,
						value: "pending",
					},
				],
				"or",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(3);
			expect(rows.map((r: any) => r.id).sort()).toEqual([
				"row-1",
				"row-2",
				"row-4",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"filters out invalid conditions and combines only valid ones",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;
				const db = yield* KyselyPgDatabase;

				const whereExpr = buildWhereExpression(
					[
						{
							column: "age",
							operator: "greater_than" as const,
							value: 25,
						},
						{
							column: "name",
							operator: "equals" as const,
							value: null, // Should be filtered out
						},
						{
							column: "status",
							operator: "equals" as const,
							value: "active",
						},
					],
					"and",
				);

				const rows: any[] = yield* db.execute(
					db.selectFrom("test_data").selectAll().where(whereExpr!),
				);
				// Only age > 25 AND status = 'active' applied
				expect(rows).toHaveLength(0);
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect(
		"returns single expression without wrapping for single condition",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;
				const db = yield* KyselyPgDatabase;

				const whereExpr = buildWhereExpression(
					[
						{
							column: "status",
							operator: "equals" as const,
							value: "active",
						},
					],
					"and",
				);

				const rows: any[] = yield* db.execute(
					db.selectFrom("test_data").selectAll().where(whereExpr!),
				);
				expect(rows).toHaveLength(2);
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("correctly handles decimal values", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "price",
						operator: "equals" as const,
						value: 99.99,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(1);
			expect(rows[0]!.id).toBe("row-1");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly handles boolean true values", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "is_active",
						operator: "equals" as const,
						value: true,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(2);
			expect(rows.map((r: any) => r.id).sort()).toEqual(["row-1", "row-4"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"handles strings with special characters like percent signs",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;
				const db = yield* KyselyPgDatabase;

				const whereExpr = buildWhereExpression(
					[
						{
							column: "description",
							operator: "contains" as const,
							value: "100%",
						},
					],
					"and",
				);

				const rows: any[] = yield* db.execute(
					db.selectFrom("test_data").selectAll().where(whereExpr!),
				);
				expect(rows).toHaveLength(1);
				expect(rows[0]!.id).toBe("row-1");
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("preserves is_null operator regardless of provided value", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "age",
						operator: "is_null" as const,
						value: undefined, // Value is ignored
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			expect(rows).toHaveLength(1);
			expect(rows[0]!.id).toBe("row-5");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"preserves is_not_null operator regardless of provided value",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;
				const db = yield* KyselyPgDatabase;

				const whereExpr = buildWhereExpression(
					[
						{
							column: "age",
							operator: "is_not_null" as const,
							value: null, // Value is ignored
						},
					],
					"and",
				);

				const rows: any[] = yield* db.execute(
					db.selectFrom("test_data").selectAll().where(whereExpr!),
				);
				expect(rows).toHaveLength(4);
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("handles empty IN array", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "status",
						operator: "in" as const,
						value: [],
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// Empty array in ANY() matches nothing
			expect(rows).toHaveLength(0);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("handles NOT IN with empty array", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "status",
						operator: "not_in" as const,
						value: [],
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// != ALL([]) matches all rows
			expect(rows).toHaveLength(5);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("combines three or more conditions with AND", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "age",
						operator: "greater_than" as const,
						value: 18,
					},
					{
						column: "age",
						operator: "less_than" as const,
						value: 35,
					},
					{
						column: "status",
						operator: "equals" as const,
						value: "active",
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// 18 < age < 35 AND status = 'active' => row-1 (age 25, active)
			expect(rows).toHaveLength(1);
			expect(rows[0]!.id).toBe("row-1");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("combines three or more conditions with OR", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "status",
						operator: "equals" as const,
						value: "active",
					},
					{
						column: "status",
						operator: "equals" as const,
						value: "pending",
					},
					{
						column: "status",
						operator: "equals" as const,
						value: "review",
					},
				],
				"or",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// status = 'active' OR status = 'pending' OR status = 'review'
			expect(rows).toHaveLength(4);
			expect(rows.map((r: any) => r.id).sort()).toEqual([
				"row-1",
				"row-2",
				"row-4",
				"row-5",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("treats zero as valid value (not falsy filtered)", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "quantity",
						operator: "equals" as const,
						value: 0,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// 0 is a valid value
			expect(rows).toHaveLength(2);
			expect(rows.map((r: any) => r.id).sort()).toEqual(["row-2", "row-4"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("treats false boolean as valid value (not falsy filtered)", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "is_deleted",
						operator: "equals" as const,
						value: false,
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// false is a valid value
			expect(rows).toHaveLength(4);
			expect(rows.map((r: any) => r.id).sort()).toEqual([
				"row-1",
				"row-2",
				"row-4",
				"row-5",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("treats empty string as valid value (not falsy filtered)", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;
			const db = yield* KyselyPgDatabase;

			const whereExpr = buildWhereExpression(
				[
					{
						column: "name",
						operator: "equals" as const,
						value: "",
					},
				],
				"and",
			);

			const rows: any[] = yield* db.execute(
				db.selectFrom("test_data").selectAll().where(whereExpr!),
			);
			// Empty string is a valid value
			expect(rows).toHaveLength(1);
			expect(rows[0]!.id).toBe("row-4");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("returns undefined when all conditions are filtered out", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = buildWhereExpression(
				[
					{
						column: "col1",
						operator: "equals" as const,
						value: null,
					},
					{
						column: "col2",
						operator: "equals" as const,
						value: undefined,
					},
				],
				"and",
			);

			expect(result).toBeUndefined();
		}).pipe(Effect.provide(InMemoryLayer));
	});
});
