import { describe, expect, it } from "vitest";
import { buildPgWhereFragment, buildSqliteWhereFragment } from "./build-where.ts";

describe("buildPgWhereFragment", () => {
	it("builds equals condition", () => {
		const conditions = [
			{ column: "age", operator: "equals" as const, value: "25" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"age" = \'25\'');
	});

	it("builds not_equals condition", () => {
		const conditions = [
			{ column: "status", operator: "not_equals" as const, value: "inactive" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"status" != \'inactive\'');
	});

	it("builds contains condition with ILIKE", () => {
		const conditions = [
			{ column: "name", operator: "contains" as const, value: "alice" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"name" ILIKE \'%alice%\'');
	});

	it("builds not_contains condition", () => {
		const conditions = [
			{ column: "name", operator: "not_contains" as const, value: "test" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"name" NOT ILIKE \'%test%\'');
	});

	it("builds starts_with condition", () => {
		const conditions = [
			{ column: "email", operator: "starts_with" as const, value: "admin@" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"email" ILIKE \'admin@%\'');
	});

	it("builds ends_with condition", () => {
		const conditions = [
			{ column: "domain", operator: "ends_with" as const, value: ".com" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"domain" ILIKE \'%.com\'');
	});

	it("builds greater_than condition", () => {
		const conditions = [
			{ column: "price", operator: "greater_than" as const, value: "100" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"price" > \'100\'');
	});

	it("builds greater_than_or_equal condition", () => {
		const conditions = [
			{
				column: "count",
				operator: "greater_than_or_equal" as const,
				value: "10",
			},
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"count" >= \'10\'');
	});

	it("builds less_than condition", () => {
		const conditions = [
			{ column: "stock", operator: "less_than" as const, value: "5" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"stock" < \'5\'');
	});

	it("builds less_than_or_equal condition", () => {
		const conditions = [
			{
				column: "age",
				operator: "less_than_or_equal" as const,
				value: "18",
			},
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"age" <= \'18\'');
	});

	it("builds is_null condition", () => {
		const conditions = [
			{ column: "deleted_at", operator: "is_null" as const },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"deleted_at" IS NULL');
	});

	it("builds is_not_null condition", () => {
		const conditions = [
			{ column: "published_at", operator: "is_not_null" as const },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"published_at" IS NOT NULL');
	});

	it("builds in condition with array values", () => {
		const conditions = [
			{ column: "status", operator: "in" as const, value: ["active", "pending"] },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"status" = ANY(ARRAY[\'active\',\'pending\'])');
	});

	it("builds not_in condition with array values", () => {
		const conditions = [
			{
				column: "role",
				operator: "not_in" as const,
				value: ["guest", "banned"],
			},
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"role" != ALL(ARRAY[\'guest\',\'banned\'])');
	});

	it("combines multiple conditions with AND", () => {
		const conditions = [
			{ column: "age", operator: "greater_than" as const, value: "25" },
			{ column: "status", operator: "equals" as const, value: "active" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"age" > \'25\' AND "status" = \'active\'');
	});

	it("combines multiple conditions with OR", () => {
		const conditions = [
			{ column: "role", operator: "equals" as const, value: "admin" },
			{ column: "role", operator: "equals" as const, value: "moderator" },
		];
		const result = buildPgWhereFragment(conditions, "or");
		expect(result).toBe('"role" = \'admin\' OR "role" = \'moderator\'');
	});

	it("handles empty conditions array", () => {
		const result = buildPgWhereFragment([], "and");
		expect(result).toBeUndefined();
	});

	it("filters out conditions with undefined values", () => {
		const conditions = [
			{ column: "age", operator: "equals" as const, value: undefined },
			{ column: "status", operator: "equals" as const, value: "active" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"status" = \'active\'');
	});

	it("escapes single quotes in values", () => {
		const conditions = [
			{ column: "name", operator: "equals" as const, value: "O'Brien" },
		];
		const result = buildPgWhereFragment(conditions, "and");
		expect(result).toBe('"name" = \'O\'\'Brien\'');
	});
});

describe("buildSqliteWhereFragment", () => {
	it("builds equals condition with unquoted numbers", () => {
		const conditions = [
			{ column: "age", operator: "equals" as const, value: 25 },
		];
		const result = buildSqliteWhereFragment(conditions, "and");
		expect(result).toBe('"age" = 25');
	});

	it("builds equals condition with quoted strings", () => {
		const conditions = [
			{ column: "name", operator: "equals" as const, value: "alice" },
		];
		const result = buildSqliteWhereFragment(conditions, "and");
		expect(result).toBe('"name" = \'alice\'');
	});

	it("builds contains condition with LIKE and COLLATE NOCASE", () => {
		const conditions = [
			{ column: "name", operator: "contains" as const, value: "test" },
		];
		const result = buildSqliteWhereFragment(conditions, "and");
		expect(result).toBe('"name" LIKE \'%test%\' COLLATE NOCASE');
	});

	it("builds starts_with condition with LIKE and COLLATE NOCASE", () => {
		const conditions = [
			{ column: "email", operator: "starts_with" as const, value: "admin" },
		];
		const result = buildSqliteWhereFragment(conditions, "and");
		expect(result).toBe('"email" LIKE \'admin%\' COLLATE NOCASE');
	});

	it("converts boolean true to 1 in equals", () => {
		const conditions = [
			{ column: "published", operator: "equals" as const, value: true },
		];
		const result = buildSqliteWhereFragment(conditions, "and");
		expect(result).toBe('"published" = 1');
	});

	it("converts boolean false to 0 in equals", () => {
		const conditions = [
			{ column: "archived", operator: "equals" as const, value: false },
		];
		const result = buildSqliteWhereFragment(conditions, "and");
		expect(result).toBe('"archived" = 0');
	});

	it("builds in condition with IN operator", () => {
		const conditions = [
			{ column: "status", operator: "in" as const, value: ["active", "pending"] },
		];
		const result = buildSqliteWhereFragment(conditions, "and");
		expect(result).toBe('"status" IN (\'active\',\'pending\')');
	});

	it("builds not_in condition with NOT IN operator", () => {
		const conditions = [
			{ column: "role", operator: "not_in" as const, value: ["guest", "banned"] },
		];
		const result = buildSqliteWhereFragment(conditions, "and");
		expect(result).toBe('"role" NOT IN (\'guest\',\'banned\')');
	});

	it("combines multiple conditions with AND", () => {
		const conditions = [
			{ column: "age", operator: "greater_than" as const, value: 25 },
			{ column: "status", operator: "equals" as const, value: "active" },
		];
		const result = buildSqliteWhereFragment(conditions, "and");
		expect(result).toBe('"age" > 25 AND "status" = \'active\'');
	});

	it("combines multiple conditions with OR", () => {
		const conditions = [
			{ column: "published", operator: "equals" as const, value: true },
			{ column: "featured", operator: "equals" as const, value: true },
		];
		const result = buildSqliteWhereFragment(conditions, "or");
		expect(result).toBe('"published" = 1 OR "featured" = 1');
	});

	it("handles empty conditions array", () => {
		const result = buildSqliteWhereFragment([], "and");
		expect(result).toBe("");
	});

	it("escapes single quotes in values", () => {
		const conditions = [
			{ column: "name", operator: "equals" as const, value: "O'Brien" },
		];
		const result = buildSqliteWhereFragment(conditions, "and");
		expect(result).toBe('"name" = \'O\'\'Brien\'');
	});
});
