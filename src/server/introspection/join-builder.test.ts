import { describe, expect, it } from "vitest";
import {
	buildJoinSqlClauses,
	buildJoinSqlPreview,
	buildJoinSummary,
	buildWhereExpressionFromFilters,
} from "./join-builder.ts";
import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types";

describe("sql-join-builder", () => {
	describe("buildWhereExpressionFromFilters", () => {
		it("builds simple equals condition", () => {
			const conditions = [
				{ column: "quantity", operator: "equals" as const, value: "1" },
			];
			const result = buildWhereExpressionFromFilters(
				conditions,
				"and",
				"public",
				"lineItems",
			);
			expect(result).toContain('"public"."lineItems"."quantity" = \'1\'');
		});

		it("builds not_equals condition with null handling", () => {
			const conditions = [
				{ column: "status", operator: "not_equals" as const, value: null },
			];
			const result = buildWhereExpressionFromFilters(
				conditions,
				"and",
				"public",
				"products",
			);
			expect(result).toContain('"public"."products"."status" IS NOT NULL');
		});

		it("builds contains condition with LIKE", () => {
			const conditions = [
				{ column: "name", operator: "contains" as const, value: "john" },
			];
			const result = buildWhereExpressionFromFilters(
				conditions,
				"and",
				"public",
				"users",
			);
			expect(result).toContain("LIKE '%john%'");
		});
		it("combines multiple conditions with AND", () => {
			const conditions = [
				{ column: "quantity", operator: "greater_than" as const, value: "5" },
				{ column: "status", operator: "equals" as const, value: "active" },
			];
			const result = buildWhereExpressionFromFilters(
				conditions,
				"and",
				"public",
				"orders",
			);
			expect(result).toContain("AND");
			expect(result).toContain("> '5'");
			expect(result).toContain("= 'active'");
		});

		it("combines multiple conditions with OR", () => {
			const conditions = [
				{ column: "type", operator: "equals" as const, value: "premium" },
				{ column: "type", operator: "equals" as const, value: "standard" },
			];
			const result = buildWhereExpressionFromFilters(
				conditions,
				"or",
				"public",
				"accounts",
			);
			expect(result).toContain(" OR ");
		});

		it("handles is_null operator", () => {
			const conditions = [
				{ column: "deleted_at", operator: "is_null" as const },
			];
			const result = buildWhereExpressionFromFilters(
				conditions,
				"and",
				"public",
				"users",
			);
			expect(result).toContain("IS NULL");
		});

		it("handles is_not_null operator", () => {
			const conditions = [
				{ column: "verified_at", operator: "is_not_null" as const },
			];
			const result = buildWhereExpressionFromFilters(
				conditions,
				"and",
				"public",
				"users",
			);
			expect(result).toContain("IS NOT NULL");
		});

		it("handles in operator with array values", () => {
			const conditions = [
				{
					column: "status",
					operator: "in" as const,
					value: ["active", "pending"],
				},
			];
			const result = buildWhereExpressionFromFilters(
				conditions,
				"and",
				"public",
				"tasks",
			);
			expect(result).toContain("IN");
			expect(result).toContain("'active'");
			expect(result).toContain("'pending'");
		});

		it("returns empty string for empty conditions", () => {
			const result = buildWhereExpressionFromFilters(
				[],
				"and",
				"public",
				"items",
			);
			expect(result).toBe("");
		});

		it("handles special characters and escapes single quotes", () => {
			const conditions = [
				{ column: "name", operator: "equals" as const, value: "O'Reilly" },
			];
			const result = buildWhereExpressionFromFilters(
				conditions,
				"and",
				"public",
				"authors",
			);
			expect(result).toContain("O''Reilly");
		});
	});

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
				"postgres",
			);
			expect(clauses).toHaveLength(1);
			expect(clauses[0]).toContain("LEFT JOIN");
			expect(clauses[0]).toContain('"commitment_id"');
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
				"sqlite",
			);
			expect(clauses).toHaveLength(1);
			expect(clauses[0]).toContain("INNER JOIN");
			// SQLite should not have schema prefix in table reference
			expect(clauses[0]).toMatch(/"lineItems"/);
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
				"postgres",
			);
			expect(clauses[0]).toContain("commitment_id = commitments.id");
			expect(clauses[0]).toContain("quantity > 0");
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
				"postgres",
			);
			expect(clauses[0]).toContain("AND");
			expect(clauses[0]).toContain("commitment_id");
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
				"postgres",
			);
			expect(clauses).toHaveLength(2);
			expect(clauses[0]).toContain("LEFT JOIN");
			expect(clauses[1]).toContain("INNER JOIN");
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
				"postgres",
			);
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
				"postgres",
			);
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
				"sqlite",
			);
			expect(preview).toContain('FROM "commitments"');
			expect(preview).not.toContain('FROM main."commitments"');
		});
	});

	describe("buildJoinSummary", () => {
		it("returns 'No joins configured' for empty array", () => {
			expect(buildJoinSummary([])).toBe("No joins configured");
		});

		it("generates summary for single standard join", () => {
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

			const summary = buildJoinSummary(joins);
			expect(summary).toContain("1. public.lineItems");
			expect(summary).toContain("LEFT");
			expect(summary).toContain("standard FK");
		});

		it("generates summary with filter condition count", () => {
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

			const summary = buildJoinSummary(joins);
			expect(summary).toContain("filters (2 conditions)");
		});

		it("correctly pluralizes condition singular form", () => {
			const joins: JoinedTable[] = [
				{
					table: "lineItems",
					schema: "public",
					type: "left",
					columns: "all",
					joinCondition: {
						mode: "custom",
						conditions: ["lineItems.id = commitments.line_id"],
					},
				},
			];

			const summary = buildJoinSummary(joins);
			expect(summary).toContain("custom (1 condition)");
		});

		it("generates summary for multiple joins", () => {
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

			const summary = buildJoinSummary(joins);
			expect(summary).toContain("1. public.lineItems [LEFT standard FK]");
			expect(summary).toContain(
				"2. public.products [INNER filters (1 condition)]",
			);
		});
	});
});
