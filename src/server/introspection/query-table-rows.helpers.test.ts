import { describe, expect, it } from "vitest";
import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import {
	buildColumnList,
	buildTableColumnsMap,
	filterTableColumns,
	formatSchemaTable,
	getQualifiedName,
	remapJoins,
	remapSchema,
	shouldFilterColumns,
} from "./query-table-rows.helpers.ts";

describe("query-table-rows helpers", () => {
	describe("remapSchema", () => {
		it("converts default schema to empty string", () => {
			expect(remapSchema("public", "public")).toBe("");
		});

		it("keeps non-default schema unchanged", () => {
			expect(remapSchema("other_schema", "public")).toBe("other_schema");
		});

		it("handles empty string schema", () => {
			expect(remapSchema("", "public")).toBe("");
		});
	});

	describe("remapJoins", () => {
		it("remaps join schemas to empty string if default", () => {
			const joins: JoinedTable[] = [
				{
					table: "posts",
					schema: "public",
					type: "inner",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "user_id",
					},
				},
			];

			const remapped = remapJoins(joins, "public");

			expect(remapped[0].schema).toBe("");
			expect(remapped[0].table).toBe("posts");
		});

		it("preserves non-default schemas", () => {
			const joins: JoinedTable[] = [
				{
					table: "posts",
					schema: "other_db",
					type: "inner",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "user_id",
					},
				},
			];

			const remapped = remapJoins(joins, "public");

			expect(remapped[0].schema).toBe("other_db");
		});

		it("remaps joinFrom schema if present", () => {
			const joins: JoinedTable[] = [
				{
					table: "comments",
					schema: "public",
					type: "inner",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "post_id",
						referencedColumn: "id",
					},
					joinFrom: {
						table: "posts",
						schema: "public",
					},
				},
			];

			const remapped = remapJoins(joins, "public");

			expect(remapped[0].schema).toBe("");
			expect(remapped[0].joinFrom?.schema).toBe("");
		});
	});

	describe("formatSchemaTable", () => {
		it("returns just table name when schema is empty", () => {
			expect(formatSchemaTable("", "users")).toBe("users");
		});

		it("returns schema.table when schema is not empty", () => {
			expect(formatSchemaTable("public", "users")).toBe("public.users");
		});

		it("handles non-default schemas", () => {
			expect(formatSchemaTable("other_db", "posts")).toBe("other_db.posts");
		});
	});

	describe("getQualifiedName", () => {
		it("builds qualified column name with dot notation", () => {
			expect(getQualifiedName("users", "id")).toBe("users.id");
		});

		it("handles alias prefixes", () => {
			expect(getQualifiedName("p_1", "title")).toBe("p_1.title");
		});
	});

	describe("shouldFilterColumns", () => {
		it("returns true for base table when qualified columns exist", () => {
			expect(shouldFilterColumns(true, true)).toBe(true);
		});

		it("returns true for base table regardless of qualification", () => {
			expect(shouldFilterColumns(true, false)).toBe(true);
		});

		it("returns true for non-base table with qualified columns", () => {
			expect(shouldFilterColumns(false, true)).toBe(true);
		});

		it("returns false for non-base table without qualified columns", () => {
			expect(shouldFilterColumns(false, false)).toBe(false);
		});
	});

	describe("filterTableColumns", () => {
		const columns = [{ name: "id" }, { name: "name" }, { name: "email" }];

		it("returns all columns when no filtering specified", () => {
			const result = filterTableColumns(columns, "users", [], [], false);
			expect(result).toEqual(columns);
		});

		it("applies whitelist filtering with simple column names", () => {
			const result = filterTableColumns(
				columns,
				"users",
				["id", "name"],
				[],
				false,
			);
			expect(result).toEqual([{ name: "id" }, { name: "name" }]);
		});

		it("applies whitelist filtering with qualified column names", () => {
			const result = filterTableColumns(
				columns,
				"users",
				["users.id", "users.name"],
				[],
				true,
			);
			expect(result).toEqual([{ name: "id" }, { name: "name" }]);
		});

		it("applies blacklist filtering with simple column names", () => {
			const result = filterTableColumns(columns, "users", [], ["email"], false);
			expect(result).toEqual([{ name: "id" }, { name: "name" }]);
		});

		it("applies blacklist filtering with qualified column names", () => {
			const result = filterTableColumns(
				columns,
				"users",
				[],
				["users.email"],
				true,
			);
			expect(result).toEqual([{ name: "id" }, { name: "name" }]);
		});

		it("prefers whitelist over blacklist when both provided", () => {
			const result = filterTableColumns(
				columns,
				"users",
				["id"],
				["email"],
				false,
			);
			expect(result).toEqual([{ name: "id" }]);
		});
	});

	describe("buildTableColumnsMap", () => {
		const columnResults = [
			{
				schemaTable: "users",
				tableOnly: "users",
				columns: [{ name: "id" }, { name: "name" }, { name: "email" }],
			},
			{
				schemaTable: "posts",
				tableOnly: "posts",
				columns: [{ name: "id" }, { name: "title" }, { name: "content" }],
			},
		];

		it("creates map with both schemaTable and tableOnly keys", () => {
			const map = buildTableColumnsMap(columnResults, [], []);

			expect(map.has("users")).toBe(true);
			expect(map.has("posts")).toBe(true);
			expect(map.get("users")).toHaveLength(3);
			expect(map.get("posts")).toHaveLength(3);
		});

		it("applies column filtering to base table only (index 0)", () => {
			const map = buildTableColumnsMap(columnResults, ["id", "name"], []);

			// Base table (index 0) is filtered
			expect(map.get("users")).toEqual([{ name: "id" }, { name: "name" }]);
			// Joined table (index 1) is NOT filtered when selectedColumns has no qualified names
			expect(map.get("posts")).toEqual([
				{ name: "id" },
				{ name: "title" },
				{ name: "content" },
			]);
		});

		it("applies qualified column filtering to all tables", () => {
			const map = buildTableColumnsMap(
				columnResults,
				["users.id", "posts.title"],
				[],
			);

			expect(map.get("users")).toEqual([{ name: "id" }]);
			expect(map.get("posts")).toEqual([{ name: "title" }]);
		});

		it("applies blacklist filtering to base table only when not qualified", () => {
			const map = buildTableColumnsMap(columnResults, [], ["email", "content"]);

			// Base table is filtered
			expect(map.get("users")).toEqual([{ name: "id" }, { name: "name" }]);
			// Joined table is NOT filtered because excludedColumns has no qualified names
			expect(map.get("posts")).toEqual([
				{ name: "id" },
				{ name: "title" },
				{ name: "content" },
			]);
		});
	});

	describe("buildColumnList", () => {
		const baseColumns = [{ name: "id" }, { name: "name" }, { name: "email" }];
		const postColumns = [
			{ name: "id" },
			{ name: "title" },
			{ name: "content" },
		];

		it("returns simple column names for base table without joins", () => {
			const columnResults = [
				{
					schemaTable: "users",
					tableOnly: "users",
					columns: baseColumns,
				},
			];

			const result = buildColumnList({
				columnResults,
				baseTable: "users",
				joins: [],
				joinAliases: new Map(),
				tableColumnsMap: new Map([["users", baseColumns]]),
			});

			expect(result).toEqual(["id", "name", "email"]);
		});

		it("prefixes base table columns when joins present", () => {
			const columnResults = [
				{
					schemaTable: "users",
					tableOnly: "users",
					columns: baseColumns,
				},
				{
					schemaTable: "posts",
					tableOnly: "posts",
					columns: postColumns,
				},
			];

			const joins: JoinedTable[] = [
				{
					table: "posts",
					schema: "public",
					type: "inner",
					columns: "all",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "user_id",
					},
				},
			];

			const result = buildColumnList({
				columnResults,
				baseTable: "users",
				joins,
				joinAliases: new Map(),
				tableColumnsMap: new Map([
					["users", baseColumns],
					["posts", postColumns],
				]),
			});

			expect(result).toEqual([
				"users.id",
				"users.name",
				"users.email",
				"posts.id",
				"posts.title",
				"posts.content",
			]);
		});

		it("uses join aliases in column names", () => {
			const columnResults = [
				{
					schemaTable: "users",
					tableOnly: "users",
					columns: baseColumns,
				},
				{
					schemaTable: "posts",
					tableOnly: "posts",
					columns: postColumns,
				},
			];

			const joins: JoinedTable[] = [
				{
					table: "posts",
					schema: "public",
					type: "inner",
					columns: "all",
					alias: "p",
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "user_id",
					},
				},
			];

			const result = buildColumnList({
				columnResults,
				baseTable: "users",
				joins,
				joinAliases: new Map([[0, "p"]]),
				tableColumnsMap: new Map([
					["users", baseColumns],
					["posts", postColumns],
				]),
			});

			expect(result).toEqual([
				"users.id",
				"users.name",
				"users.email",
				"p.id",
				"p.title",
				"p.content",
			]);
		});

		it("respects join-specific column selection", () => {
			const columnResults = [
				{
					schemaTable: "users",
					tableOnly: "users",
					columns: baseColumns,
				},
				{
					schemaTable: "posts",
					tableOnly: "posts",
					columns: postColumns,
				},
			];

			const joins: JoinedTable[] = [
				{
					table: "posts",
					schema: "public",
					type: "inner",
					columns: ["title", "id"],
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "user_id",
					},
				},
			];

			const result = buildColumnList({
				columnResults,
				baseTable: "users",
				joins,
				joinAliases: new Map(),
				tableColumnsMap: new Map([
					["users", baseColumns],
					["posts", postColumns],
				]),
			});

			expect(result).toEqual([
				"users.id",
				"users.name",
				"users.email",
				"posts.id",
				"posts.title",
			]);
		});

		it("combines global column filtering with join-specific selection", () => {
			const columnResults = [
				{
					schemaTable: "users",
					tableOnly: "users",
					columns: baseColumns,
				},
				{
					schemaTable: "posts",
					tableOnly: "posts",
					columns: postColumns,
				},
			];

			const joins: JoinedTable[] = [
				{
					table: "posts",
					schema: "public",
					type: "inner",
					columns: ["title", "id", "content"],
					joinCondition: {
						mode: "standard",
						referencingColumn: "id",
						referencedColumn: "user_id",
					},
				},
			];

			// Exclude 'content' globally but join config includes it
			// Join config should be more restrictive
			const filteredPostColumns = [{ name: "id" }, { name: "title" }];

			const result = buildColumnList({
				columnResults,
				baseTable: "users",
				joins,
				joinAliases: new Map(),
				tableColumnsMap: new Map([
					["users", baseColumns],
					["posts", filteredPostColumns],
				]),
			});

			expect(result).toEqual([
				"users.id",
				"users.name",
				"users.email",
				"posts.id",
				"posts.title",
			]);
		});
	});
});
