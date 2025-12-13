import { describe, expect, it } from "vitest";
import {
	buildJoinSqlPreview,
	buildJoinSummary,
} from "./build-join-sql-preview";
import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types";

describe("buildJoinSqlPreview", () => {
	it("generates preview for single standard join", () => {
		const joins: JoinedTable[] = [
			{
				table: "lineItems",
				schema: "public",
				type: "left",
				columns: ["id", "quantity"],
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

		expect(preview).toContain('SELECT public."commitments".*');
		expect(preview).toContain('public."lineItems".*');
		expect(preview).toContain('FROM public."commitments"');
		expect(preview).toContain("LEFT JOIN");
		expect(preview).toContain(
			'public."lineItems"."commitment_id" = public."commitments"."id"',
		);
	});

	it("generates preview for multiple joins", () => {
		const joins: JoinedTable[] = [
			{
				table: "lineItems",
				schema: "public",
				type: "inner",
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
				type: "left",
				columns: "all",
				joinCondition: {
					mode: "standard",
					referencingColumn: "id",
					referencedColumn: "product_id",
				},
			},
		];

		const preview = buildJoinSqlPreview(
			"public",
			"commitments",
			joins,
			"postgres",
		);

		expect(preview).toContain("INNER JOIN");
		expect(preview).toContain("LEFT JOIN");
		expect(preview).toContain('public."products"');
	});

	it("generates preview for filter-based join", () => {
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
								operator: "equals",
								value: "1",
							},
						],
						logicalOperator: "and",
					},
				},
			},
		];

		const preview = buildJoinSqlPreview(
			"public",
			"commitments",
			joins,
			"postgres",
		);

		expect(preview).toContain("LEFT JOIN");
		expect(preview).toContain('public."lineItems"."commitment_id"');
		expect(preview).toContain(`"public"."lineItems"."quantity" = '1'`);
	});

	it("generates preview for custom SQL join", () => {
		const joins: JoinedTable[] = [
			{
				table: "lineItems",
				schema: "public",
				type: "inner",
				columns: "all",
				joinCondition: {
					mode: "custom",
					conditions: [
						"lineItems.commitment_id = commitments.id",
						"lineItems.deleted_at IS NULL",
					],
				},
			},
		];

		const preview = buildJoinSqlPreview(
			"public",
			"commitments",
			joins,
			"postgres",
		);

		expect(preview).toContain("INNER JOIN");
		expect(preview).toContain("lineItems.commitment_id = commitments.id");
		expect(preview).toContain("lineItems.deleted_at IS NULL");
	});

	it("generates sqlite-compatible preview", () => {
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

		const preview = buildJoinSqlPreview("main", "commitments", joins, "sqlite");

		expect(preview).toContain('SELECT "commitments".*');
		expect(preview).toContain('FROM "commitments"');
		// SQLite should not have schema prefix in FROM/JOIN
		expect(preview).not.toContain('FROM main."commitments"');
		expect(preview).toContain("LEFT JOIN");
	});

	it("handles empty joins array", () => {
		const preview = buildJoinSqlPreview(
			"public",
			"commitments",
			[],
			"postgres",
		);

		expect(preview).toContain('SELECT public."commitments".*');
		expect(preview).toContain('FROM public."commitments"');
		expect(preview).not.toContain("JOIN");
	});

	it("handles multiple filter conditions with AND", () => {
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
							{
								column: "quantity",
								operator: "equals",
								value: "1",
							},
							{
								column: "deleted_at",
								operator: "is_null",
							},
						],
						logicalOperator: "and",
					},
				},
			},
		];

		const preview = buildJoinSqlPreview(
			"public",
			"commitments",
			joins,
			"postgres",
		);

		expect(preview).toContain("AND");
		expect(preview).toContain(`"public"."lineItems"."quantity" = '1'`);
		expect(preview).toContain(`"public"."lineItems"."deleted_at" IS NULL`);
	});
});

describe("buildJoinSummary", () => {
	it("returns 'No joins configured' for empty joins", () => {
		const summary = buildJoinSummary([]);
		expect(summary).toBe("No joins configured");
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

	it("generates summary for filter-based join with conditions", () => {
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
							{
								column: "quantity",
								operator: "equals",
								value: "1",
							},
							{
								column: "status",
								operator: "equals",
								value: "active",
							},
						],
						logicalOperator: "and",
					},
				},
			},
		];

		const summary = buildJoinSummary(joins);

		expect(summary).toContain("1. public.lineItems");
		expect(summary).toContain("INNER");
		expect(summary).toContain("filters (2 conditions)");
	});

	it("generates summary for custom SQL join", () => {
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
						"lineItems.deleted_at IS NULL",
					],
				},
			},
		];

		const summary = buildJoinSummary(joins);

		expect(summary).toContain("custom (2 conditions)");
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
								column: "status",
								operator: "equals",
								value: "active",
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

	it("correctly pluralizes 'condition' vs 'conditions'", () => {
		const joinsWithOne: JoinedTable[] = [
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
							{
								column: "quantity",
								operator: "equals",
								value: "1",
							},
						],
						logicalOperator: "and",
					},
				},
			},
		];

		const summary = buildJoinSummary(joinsWithOne);
		expect(summary).toContain("filters (1 condition)");
	});
});
