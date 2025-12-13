import { describe, expect, it } from "vitest";
import type {
	JoinedTable,
	JoinTablesConfig,
} from "#src/components/pages/connection-page/join-tables/join-tables.types";
import { DatabaseDialect } from "#src/db/dialect.ts";
import {
	buildJoinSqlClauses,
	buildJoinSqlPreview,
	buildPgJoinFilters,
	buildPgSelectWithJoins,
	buildSqliteJoinFilters,
	buildSqliteSelectWithJoins,
} from "./join-builder.ts";

describe("sql-join-builder", () => {
	describe("buildJoinSqlClauses", () => {
		it("builds standard FK-based join for PostgreSQL", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
					},
				},
			];

			const clauses = buildJoinSqlClauses(
				joins,
				"public",
				"commitments",
				DatabaseDialect.Postgres,
			);
			expect(clauses).toMatchInlineSnapshot(`
				[
				  "LEFT JOIN public."lineItems" ON public."lineItems"."commitment_id" = public."commitments"."id"",
				]
			`);
			expect(clauses).toHaveLength(1);
			expect(clauses[0]).toContain("LEFT JOIN");
			expect(clauses[0]).toContain("commitment_id");
			expect(clauses[0]).toContain('"id"');
		});

		it("builds standard FK-based join for SQLite", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "main",
					type: "inner",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
					},
				},
			];

			const clauses = buildJoinSqlClauses(
				joins,
				"main",
				"commitments",
				DatabaseDialect.SQLite,
			);
			expect(clauses).toMatchInlineSnapshot(`
				[
				  "INNER JOIN "lineItems" ON "lineItems"."commitment_id" = "commitments"."id"",
				]
			`);
			expect(clauses).toHaveLength(1);
			expect(clauses[0]).toContain("INNER JOIN");
			expect(clauses[0]).toContain("commitment_id");
			// SQLite should not have schema prefix in table reference
			expect(clauses[0]).not.toContain("main.");
		});

		it("builds custom SQL join conditions", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "custom",
						conditions: [
							"lineItems.commitment_id = commitments.id",
							"lineItems.quantity > 0",
						],
					},
				},
			];

			const clauses = buildJoinSqlClauses(
				joins,
				"public",
				"commitments",
				DatabaseDialect.Postgres,
			);
			expect(clauses).toMatchInlineSnapshot(`
				[
				  "LEFT JOIN public."lineItems" ON lineItems.commitment_id = commitments.id AND lineItems.quantity > 0",
				]
			`);
			expect(clauses[0]).toContain("commitment_id = commitments.id");
			expect(clauses[0]).toContain("quantity > 0");
			expect(clauses[0]).toContain("AND");
		});

		it("builds pure custom SQL join without FK requirement", () => {
			const joins: JoinedTable[] = [
				{
					table: "products",
					schema: "public",
					type: "inner",
					columns: "all",
					joinCondition: {
						mode: "custom",
						// No referencingColumn or referencedColumn - pure custom condition
						conditions: [
							"products.id = (procurement_projects.entity_id)::uuid",
							"products.deleted_at IS NULL",
						],
					},
				},
			];

			const clauses = buildJoinSqlClauses(
				joins,
				"public",
				"procurement_projects",
				DatabaseDialect.Postgres,
			);
			expect(clauses).toMatchInlineSnapshot(`
				[
				  "INNER JOIN public."products" ON products.id = (procurement_projects.entity_id)::uuid AND products.deleted_at IS NULL",
				]
			`);
			expect(clauses).toHaveLength(1);
			expect(clauses[0]).toContain("INNER JOIN");
			expect(clauses[0]).toContain("(procurement_projects.entity_id)::uuid");
			expect(clauses[0]).toContain("products.deleted_at IS NULL");
			// Should NOT contain referencingColumn or referencedColumn
			expect(clauses[0]).not.toContain("undefined");
		});

		it("builds pure custom SQL join for SQLite without FK requirement", () => {
			const joins: JoinedTable[] = [
				{
					table: "products",
					schema: "main",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "custom",
						conditions: [
							"products.vendor_id = vendors.id",
							"vendors.status = 'active'",
						],
					},
				},
			];

			const clauses = buildJoinSqlClauses(
				joins,
				"main",
				"vendors",
				DatabaseDialect.SQLite,
			);
			expect(clauses).toMatchInlineSnapshot(`
				[
				  "LEFT JOIN "products" ON products.vendor_id = vendors.id AND vendors.status = 'active'",
				]
			`);
			expect(clauses).toHaveLength(1);
			expect(clauses[0]).toContain("LEFT JOIN");
			expect(clauses[0]).toContain("vendor_id = vendors.id");
			expect(clauses[0]).toContain("status = 'active'");
			expect(clauses[0]).not.toContain("main.products");
		});

		it("throws error when custom join has no conditions and no FK info", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "custom",
						conditions: [], // Empty conditions
						// No FK info
					},
				},
			];

			expect(() => {
				buildJoinSqlClauses(
					joins,
					"public",
					"commitments",
					DatabaseDialect.Postgres,
				);
			}).toThrow();
		});

		it("falls back to FK when custom join has no conditions but FK info is provided", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "custom",
						conditions: [], // Empty conditions
						referencingColumn: "id",
						referencedColumn: "commitment_id",
					},
				},
			];

			const clauses = buildJoinSqlClauses(
				joins,
				"public",
				"commitments",
				DatabaseDialect.Postgres,
			);
			// Should fallback to FK join
			expect(clauses[0]).toContain('"commitment_id" = ');
			expect(clauses[0]).toContain('"id"');
		});

		it("builds filter-based join conditions with FK prefix", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "inner",
					columns: "all",
					joinCondition: {
						mode: "filters",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
						filters: {
							conditions: [
								{ column: "quantity", operator: "equals" as const, value: "1" },
							],
							logicalOperator: "and",
						},
					},
				},
			];

			const clauses = buildJoinSqlClauses(
				joins,
				"public",
				"commitments",
				DatabaseDialect.Postgres,
			);
			expect(clauses).toMatchInlineSnapshot(`
				[
				  "INNER JOIN public."lineItems" ON public."lineItems"."commitment_id" = public."commitments"."id" AND "public"."lineItems"."quantity" = '1'",
				]
			`);
			expect(clauses[0]).toContain("AND");
			expect(clauses[0]).toContain("commitment_id");
			expect(clauses[0]).toContain("quantity");
		});

		it("handles multiple joins", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
					},
				},
				{
					table: "products",
					schema: "public",
					type: "inner",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "product_id",
					},
				},
			];

			const clauses = buildJoinSqlClauses(
				joins,
				"public",
				"commitments",
				DatabaseDialect.Postgres,
			);
			expect(clauses).toMatchInlineSnapshot(`
				[
				  "LEFT JOIN public."lineItems" ON public."lineItems"."commitment_id" = public."commitments"."id"",
				  "INNER JOIN public."products" ON public."products"."product_id" = public."commitments"."id"",
				]
			`);
			expect(clauses).toHaveLength(2);
			expect(clauses[0]).toContain("LEFT JOIN");
			expect(clauses[1]).toContain("INNER JOIN");
		});
	});

	describe("buildPgJoinFilters & buildSqliteJoinFilters", () => {
		it("returns empty string when no joins have filters", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
					},
				},
			];

			const pgResult = buildPgJoinFilters(joins);
			const sqliteResult = buildSqliteJoinFilters(joins);

			expect(pgResult).toMatchInlineSnapshot(`""`);
			expect(sqliteResult).toMatchInlineSnapshot(`""`);
		});

		it("builds WHERE clause for single join filter (PostgreSQL)", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "filters",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
						filters: {
							conditions: [
								{
									column: "quantity",
									operator: "equals" as const,
									value: "10",
								},
							],
							logicalOperator: "and",
						},
					},
				},
			];

			const result = buildPgJoinFilters(joins);
			expect(result).toMatchInlineSnapshot(`""`);
			expect(result).toBe("");
		});

		it("builds WHERE clause for single join filter (SQLite)", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "main",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "filters",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
						filters: {
							conditions: [
								{
									column: "quantity",
									operator: "equals" as const,
									value: "10",
								},
							],
							logicalOperator: "and",
						},
					},
				},
			];

			const result = buildSqliteJoinFilters(joins);
			expect(result).toMatchInlineSnapshot(`""`);
			expect(result).toBe("");
		});

		it("combines multiple join filters with AND", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "filters",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
						filters: {
							conditions: [
								{
									column: "quantity",
									operator: "greater_than" as const,
									value: "5",
								},
							],
							logicalOperator: "and",
						},
					},
				},
				{
					table: "products",
					schema: "public",
					type: "inner",
					columns: "all",
					joinCondition: {
						mode: "filters",
						referencingColumn: "id",
						referencedColumn: "product_id",
						filters: {
							conditions: [
								{
									column: "active",
									operator: "equals" as const,
									value: "true",
								},
							],
							logicalOperator: "and",
						},
					},
				},
			];

			const result = buildPgJoinFilters(joins);
			expect(result).toMatchInlineSnapshot(`""`);
		});
		it("builds complex filter with multiple conditions (PostgreSQL)", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "filters",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
						filters: {
							conditions: [
								{
									column: "quantity",
									operator: "greater_than" as const,
									value: "0",
								},
								{
									column: "status",
									operator: "equals" as const,
									value: "active",
								},
							],
							logicalOperator: "and",
						},
					},
				},
			];

			const result = buildPgJoinFilters(joins);
			expect(result).toMatchInlineSnapshot(`""`);
		});

		it("handles filter with OR logical operator", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "filters",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
						filters: {
							conditions: [
								{
									column: "status",
									operator: "equals" as const,
									value: "pending",
								},
								{
									column: "status",
									operator: "equals" as const,
									value: "active",
								},
							],
							logicalOperator: "or",
						},
					},
				},
			];

			const result = buildPgJoinFilters(joins);
			expect(result).toMatchInlineSnapshot(`""`);
		});
	});

	describe("buildJoinSqlPreview", () => {
		it("generates SELECT with FROM for single join", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
					},
				},
			];

			const preview = buildJoinSqlPreview(
				"public",
				"commitments",
				joins,
				DatabaseDialect.Postgres,
			);
			expect(preview).toMatchInlineSnapshot(`
				"SELECT public."commitments".*, public."lineItems".*
				FROM public."commitments"
				LEFT JOIN public."lineItems" ON public."lineItems"."commitment_id" = public."commitments"."id""
			`);
			expect(preview).toContain("SELECT");
			expect(preview).toContain('public."commitments".*');
			expect(preview).toContain('public."lineItems".*');
			expect(preview).toContain("FROM");
			expect(preview).toContain("LEFT JOIN");
		});

		it("handles empty joins array", () => {
			const preview = buildJoinSqlPreview(
				"public",
				"commitments",
				[],
				DatabaseDialect.Postgres,
			);
			expect(preview).toMatchInlineSnapshot(`
				"SELECT public."commitments".*
				FROM public."commitments""
			`);
			expect(preview).toContain("SELECT");
			expect(preview).toContain("FROM");
			expect(preview).not.toContain("JOIN");
		});

		it("generates SQLite compatible preview without schema prefix in FROM", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "main",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "commitment_id",
					},
				},
			];

			const preview = buildJoinSqlPreview(
				"main",
				"commitments",
				joins,
				DatabaseDialect.SQLite,
			);
			expect(preview).toMatchInlineSnapshot(`
				"SELECT "commitments".*, "lineItems".*
				FROM "commitments"
				LEFT JOIN "lineItems" ON "lineItems"."commitment_id" = "commitments"."id""
			`);
			expect(preview).toContain('FROM "commitments"');
			expect(preview).toContain("LEFT JOIN");
			expect(preview).not.toContain('FROM main."commitments"');
		});
	});
});

describe("buildPgSelectWithJoins", () => {
	it("builds select with base table columns when metadata available", () => {
		const tableColumnsMap = new Map([
			["public.users", [{ name: "id" }, { name: "name" }, { name: "email" }]],
		]);
		const joins: JoinTablesConfig["joins"] = [];
		const result = buildPgSelectWithJoins(
			"public",
			"users",
			joins,
			tableColumnsMap,
		);
		expect(result).toMatchInlineSnapshot(
			`"public."users"."id" as "users.id", public."users"."name" as "users.name", public."users"."email" as "users.email""`,
		);
		expect(result).toContain('public."users"."id" as "users.id"');
		expect(result).toContain('public."users"."name" as "users.name"');
		expect(result).toContain('public."users"."email" as "users.email"');
	});

	it("falls back to * when base table metadata not available", () => {
		const tableColumnsMap = new Map();
		const joins: JoinTablesConfig["joins"] = [];
		const result = buildPgSelectWithJoins(
			"public",
			"users",
			joins,
			tableColumnsMap,
		);
		expect(result).toMatchInlineSnapshot(`"public."users".*"`);
		expect(result).toBe('public."users".*');
	});

	it("includes joined table columns with all columns selection", () => {
		const tableColumnsMap = new Map([
			["public.users", [{ name: "id" }, { name: "name" }]],
			[
				"public.posts",
				[{ name: "id" }, { name: "title" }, { name: "published" }],
			],
		]);
		const joins: JoinTablesConfig["joins"] = [
			{
				schema: "public",
				table: "posts",
				type: "inner" as const,
				columns: "all" as const,
				joinCondition: {
					mode: "standard" as const,
					referencingColumn: "user_id",
					referencedColumn: "id",
				},
			},
		];
		const result = buildPgSelectWithJoins(
			"public",
			"users",
			joins,
			tableColumnsMap,
		);
		expect(result).toMatchInlineSnapshot(
			`"public."users"."id" as "users.id", public."users"."name" as "users.name", public."posts"."id" as "posts.id", public."posts"."title" as "posts.title", public."posts"."published" as "posts.published""`,
		);
		expect(result).toContain('public."posts"."id" as "posts.id"');
		expect(result).toContain('public."posts"."title" as "posts.title"');
		expect(result).toContain('public."posts"."published" as "posts.published"');
	});

	it("includes only selected columns from joined table", () => {
		const tableColumnsMap = new Map([
			["public.users", [{ name: "id" }, { name: "name" }]],
			[
				"public.posts",
				[{ name: "id" }, { name: "title" }, { name: "content" }],
			],
		]);
		const joins: JoinTablesConfig["joins"] = [
			{
				schema: "public",
				table: "posts",
				type: "inner",
				columns: ["id", "title"] as string[],
				joinCondition: {
					mode: "standard" as const,
					referencingColumn: "user_id",
					referencedColumn: "id",
				},
			},
		];
		const result = buildPgSelectWithJoins(
			"public",
			"users",
			joins,
			tableColumnsMap,
		);
		expect(result).toMatchInlineSnapshot(
			`"public."users"."id" as "users.id", public."users"."name" as "users.name", public."posts"."id" as "posts.id", public."posts"."title" as "posts.title""`,
		);
		expect(result).toContain('public."posts"."id" as "posts.id"');
		expect(result).toContain('public."posts"."title" as "posts.title"');
		expect(result).not.toContain("posts.content");
	});

	it("falls back to * for joined table when metadata not available", () => {
		const tableColumnsMap = new Map([["public.users", [{ name: "id" }]]]);
		const joins: JoinTablesConfig["joins"] = [
			{
				schema: "public",
				table: "posts",
				type: "inner",
				columns: "all" as const,
				joinCondition: {
					mode: "standard" as const,
					referencingColumn: "user_id",
					referencedColumn: "id",
				},
			},
		];
		const result = buildPgSelectWithJoins(
			"public",
			"users",
			joins,
			tableColumnsMap,
		);
		expect(result).toMatchInlineSnapshot(
			`"public."users"."id" as "users.id", public."posts".*"`,
		);
		expect(result).toContain('public."posts".*');
	});

	it("handles empty columns array for joined table", () => {
		const tableColumnsMap = new Map([
			["public.users", [{ name: "id" }, { name: "name" }]],
			["public.posts", [{ name: "id" }, { name: "title" }]],
		]);
		const joins: JoinTablesConfig["joins"] = [
			{
				schema: "public",
				table: "posts",
				type: "inner",
				columns: [] as string[],
				joinCondition: {
					mode: "standard" as const,
					referencingColumn: "user_id",
					referencedColumn: "id",
				},
			},
		];
		const result = buildPgSelectWithJoins(
			"public",
			"users",
			joins,
			tableColumnsMap,
		);
		expect(result).toMatchInlineSnapshot(
			`"public."users"."id" as "users.id", public."users"."name" as "users.name", "`,
		);
		expect(result).toContain('public."users"."id"');
		expect(result).toContain('public."users"."name"');
	});
});

describe("buildSqliteSelectWithJoins", () => {
	it("builds select with base table columns when metadata available", () => {
		const tableColumnsMap = new Map([
			["users", [{ name: "id" }, { name: "name" }, { name: "email" }]],
		]);
		const joins: JoinTablesConfig["joins"] = [];
		const result = buildSqliteSelectWithJoins("users", joins, tableColumnsMap);
		expect(result).toMatchInlineSnapshot(
			`""users"."id" as "users.id", "users"."name" as "users.name", "users"."email" as "users.email""`,
		);
		expect(result).toContain('"users"."id" as "users.id"');
		expect(result).toContain('"users"."name" as "users.name"');
		expect(result).toContain('"users"."email" as "users.email"');
	});

	it("falls back to * when base table metadata not available", () => {
		const tableColumnsMap = new Map();
		const joins: JoinTablesConfig["joins"] = [];
		const result = buildSqliteSelectWithJoins("users", joins, tableColumnsMap);
		expect(result).toMatchInlineSnapshot(`""users".*"`);
		expect(result).toBe('"users".*');
	});

	it("includes joined table columns with all columns selection (no schema prefix)", () => {
		const tableColumnsMap = new Map([
			["users", [{ name: "id" }, { name: "name" }]],
			["posts", [{ name: "id" }, { name: "title" }, { name: "published" }]],
		]);
		const joins: JoinTablesConfig["joins"] = [
			{
				schema: "main",
				table: "posts",
				type: "inner",
				columns: "all" as const,
				joinCondition: {
					mode: "standard" as const,
					referencingColumn: "user_id",
					referencedColumn: "id",
				},
			},
		];
		const result = buildSqliteSelectWithJoins("users", joins, tableColumnsMap);
		expect(result).toMatchInlineSnapshot(
			`""users"."id" as "users.id", "users"."name" as "users.name", "posts"."id" as "posts.id", "posts"."title" as "posts.title", "posts"."published" as "posts.published""`,
		);
		expect(result).toContain('"posts"."id" as "posts.id"');
		expect(result).toContain('"posts"."title" as "posts.title"');
		expect(result).toContain('"posts"."published" as "posts.published"');
		// Should not have schema prefix for SQLite
		expect(result).not.toContain("main.posts");
	});

	it("includes only selected columns from joined table", () => {
		const tableColumnsMap = new Map([
			["users", [{ name: "id" }, { name: "name" }]],
			["posts", [{ name: "id" }, { name: "title" }, { name: "content" }]],
		]);
		const joins: JoinTablesConfig["joins"] = [
			{
				schema: "main",
				table: "posts",
				type: "inner",
				columns: ["id", "title"] as string[],
				joinCondition: {
					mode: "standard" as const,
					referencingColumn: "user_id",
					referencedColumn: "id",
				},
			},
		];
		const result = buildSqliteSelectWithJoins("users", joins, tableColumnsMap);
		expect(result).toMatchInlineSnapshot(
			`""users"."id" as "users.id", "users"."name" as "users.name", "posts"."id" as "posts.id", "posts"."title" as "posts.title""`,
		);
		expect(result).toContain('"posts"."id" as "posts.id"');
		expect(result).toContain('"posts"."title" as "posts.title"');
		expect(result).not.toContain("posts.content");
	});

	it("falls back to * for joined table when metadata not available", () => {
		const tableColumnsMap = new Map([["users", [{ name: "id" }]]]);
		const joins: JoinTablesConfig["joins"] = [
			{
				schema: "main",
				table: "posts",
				type: "inner",
				columns: "all" as const,
				joinCondition: {
					mode: "standard" as const,
					referencingColumn: "user_id",
					referencedColumn: "id",
				},
			},
		];
		const result = buildSqliteSelectWithJoins("users", joins, tableColumnsMap);
		expect(result).toMatchInlineSnapshot(
			`""users"."id" as "users.id", "posts".*"`,
		);
		expect(result).toContain('"posts".*');
	});

	it("handles empty columns array for joined table (SQLite)", () => {
		const tableColumnsMap = new Map([
			["users", [{ name: "id" }, { name: "name" }]],
			["posts", [{ name: "id" }, { name: "title" }]],
		]);
		const joins: JoinTablesConfig["joins"] = [
			{
				schema: "main",
				table: "posts",
				type: "inner",
				columns: [] as string[],
				joinCondition: {
					mode: "standard" as const,
					referencingColumn: "user_id",
					referencedColumn: "id",
				},
			},
		];
		const result = buildSqliteSelectWithJoins("users", joins, tableColumnsMap);
		expect(result).toMatchInlineSnapshot(
			`""users"."id" as "users.id", "users"."name" as "users.name", "`,
		);
	});

	it("differs from PostgreSQL by not including schema prefix", () => {
		const tableColumnsMap = new Map([
			["users", [{ name: "id" }]],
			["posts", [{ name: "id" }]],
		]);
		const joins: JoinTablesConfig["joins"] = [
			{
				schema: "public",
				table: "posts",
				type: "inner",
				columns: "all" as const,
				joinCondition: {
					mode: "standard" as const,
					referencingColumn: "user_id",
					referencedColumn: "id",
				},
			},
		];
		// SQLite version should not have schema prefix
		const sqliteResult = buildSqliteSelectWithJoins(
			"users",
			joins,
			tableColumnsMap,
		);
		expect(sqliteResult).not.toContain("public.");

		// PostgreSQL version should have schema prefix
		const pgResult = buildPgSelectWithJoins(
			"public",
			"users",
			joins,
			tableColumnsMap,
		);
		expect(pgResult).toMatchInlineSnapshot(
			`"public."users".*, public."posts".*"`,
		);
		expect(pgResult).toContain("public.");
		expect(sqliteResult).toMatchInlineSnapshot(
			`""users"."id" as "users.id", "posts"."id" as "posts.id""`,
		);
		expect(sqliteResult).toContain('"posts"."id"');
		expect(sqliteResult).not.toContain("public.");
	});
});
