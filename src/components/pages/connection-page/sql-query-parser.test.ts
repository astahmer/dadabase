import { describe, expect, it } from "vitest";
import {
	parseCondition,
	parseWhereClause,
	parseSqlQuery,
} from "./sql-query-parser";

describe("SQL Query Parser", () => {
	const mockColumns = [
		"id",
		"name",
		"email",
		"age",
		"created_at",
		"status",
		"description",
		"is_active",
	];

	describe("parseWhereClause", () => {
		it("should parse simple equals condition", () => {
			const result = parseWhereClause('status = "active"', mockColumns);
			expect(result.conditions).toHaveLength(1);
			expect(result.conditions[0]).toEqual({
				column: "status",
				operator: "equals",
				value: "active",
			});
			expect(result.logicalOperator).toBe("and");
		});

		it("should parse single-quoted values", () => {
			const result = parseWhereClause("name = 'John'", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "name",
				operator: "equals",
				value: "John",
			});
		});

		it("should parse numeric values", () => {
			const result = parseWhereClause("age > 18", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "age",
				operator: "greater_than",
				value: 18,
			});
		});

		it("should parse multiple conditions with AND", () => {
			const result = parseWhereClause(
				'status = "active" AND age > 18',
				mockColumns,
			);
			expect(result.conditions).toHaveLength(2);
			expect(result.logicalOperator).toBe("and");
			expect(result.conditions[0].column).toBe("status");
			expect(result.conditions[1].column).toBe("age");
		});

		it("should parse multiple conditions with OR", () => {
			const result = parseWhereClause(
				'status = "active" OR status = "pending"',
				mockColumns,
			);
			expect(result.conditions).toHaveLength(2);
			expect(result.logicalOperator).toBe("or");
		});

		it("should prefer OR when more OR clauses than AND", () => {
			const result = parseWhereClause(
				'status = "a" OR status = "b" OR status = "c" AND age > 18',
				mockColumns,
			);
			expect(result.logicalOperator).toBe("or");
		});

		it("should handle IS NULL", () => {
			const result = parseWhereClause("description IS NULL", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "description",
				operator: "is_null",
			});
		});

		it("should handle IS NOT NULL", () => {
			const result = parseWhereClause("description IS NOT NULL", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "description",
				operator: "is_not_null",
			});
		});

		it("should handle IN operator", () => {
			const result = parseWhereClause(
				'status IN ("active", "pending", "archived")',
				mockColumns,
			);
			expect(result.conditions[0]).toEqual({
				column: "status",
				operator: "in",
				value: ["active", "pending", "archived"],
			});
		});

		it("should handle NOT IN operator", () => {
			const result = parseWhereClause(
				'status NOT IN ("deleted", "banned")',
				mockColumns,
			);
			expect(result.conditions[0]).toEqual({
				column: "status",
				operator: "not_in",
				value: ["deleted", "banned"],
			});
		});

		it("should handle LIKE with wildcards", () => {
			const result = parseWhereClause('name LIKE "%John%"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "name",
				operator: "contains",
				value: "John",
			});
		});

		it("should handle LIKE with prefix wildcard", () => {
			const result = parseWhereClause('name LIKE "John%"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "name",
				operator: "starts_with",
				value: "John",
			});
		});

		it("should handle LIKE with suffix wildcard", () => {
			const result = parseWhereClause('name LIKE "%Smith"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "name",
				operator: "ends_with",
				value: "Smith",
			});
		});

		it("should handle NOT LIKE", () => {
			const result = parseWhereClause('name NOT LIKE "%admin%"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "name",
				operator: "not_contains",
				value: "admin",
			});
		});

		it("should ignore invalid columns", () => {
			const result = parseWhereClause(
				'status = "active" AND invalid_column = "test"',
				mockColumns,
			);
			expect(result.conditions).toHaveLength(1);
			expect(result.conditions[0].column).toBe("status");
		});

		it("should handle != operator", () => {
			const result = parseWhereClause('status != "deleted"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "status",
				operator: "not_equals",
				value: "deleted",
			});
		});

		it("should handle <> operator (SQL not equals)", () => {
			const result = parseWhereClause('status <> "deleted"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "status",
				operator: "not_equals",
				value: "deleted",
			});
		});

		it("should handle <= operator", () => {
			const result = parseWhereClause("age <= 65", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "age",
				operator: "less_than_or_equal",
				value: 65,
			});
		});

		it("should handle >= operator", () => {
			const result = parseWhereClause("age >= 18", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "age",
				operator: "greater_than_or_equal",
				value: 18,
			});
		});

		it("should return empty conditions for empty WHERE clause", () => {
			const result = parseWhereClause("", mockColumns);
			expect(result.conditions).toHaveLength(0);
		});

		it("should handle case-insensitive keywords", () => {
			const result = parseWhereClause(
				"status = 'active' and age > 18",
				mockColumns,
			);
			expect(result.conditions).toHaveLength(2);
			expect(result.logicalOperator).toBe("and");
		});

		it("should handle whitespace variations", () => {
			const result = parseWhereClause(
				"status   =   'active'   AND   age   >   18",
				mockColumns,
			);
			expect(result.conditions).toHaveLength(2);
		});
	});

	describe("parseSqlQuery", () => {
		it("should parse complete SELECT with WHERE, ORDER BY, LIMIT", () => {
			const sql =
				'SELECT * FROM users WHERE status = "active" ORDER BY name ASC LIMIT 50';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.orderBy).toBe("name");
			expect(result.orderDirection).toBe("asc");
			expect(result.limit).toBe(50);
		});

		it("should parse LIMIT without OFFSET", () => {
			const sql = "SELECT * FROM users LIMIT 100";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.limit).toBe(100);
			expect(result.offset).toBeUndefined();
		});

		it("should parse OFFSET without LIMIT", () => {
			const sql = "SELECT * FROM users OFFSET 25";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.offset).toBe(25);
			expect(result.limit).toBeUndefined();
		});

		it("should parse both LIMIT and OFFSET", () => {
			const sql = "SELECT * FROM users LIMIT 50 OFFSET 100";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.limit).toBe(50);
			expect(result.offset).toBe(100);
		});

		it("should parse ORDER BY DESC", () => {
			const sql = "SELECT * FROM users ORDER BY created_at DESC";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.orderBy).toBe("created_at");
			expect(result.orderDirection).toBe("desc");
		});

		it("should parse ORDER BY without explicit direction (defaults to ASC)", () => {
			const sql = "SELECT * FROM users ORDER BY email";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.orderBy).toBe("email");
			expect(result.orderDirection).toBe("asc");
		});

		it("should parse specific columns in SELECT", () => {
			const sql = "SELECT id, name, email FROM users";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.hiddenColumnList).toContain("age");
			expect(result.hiddenColumnList).toContain("created_at");
			expect(result.hiddenColumnList).not.toContain("id");
			expect(result.hiddenColumnList).not.toContain("name");
			expect(result.hiddenColumnList).not.toContain("email");
		});

		it("should not set hiddenColumnList for SELECT *", () => {
			const sql = "SELECT * FROM users";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.hiddenColumnList).toBeUndefined();
		});

		it("should handle complex WHERE with multiple conditions", () => {
			const sql =
				'SELECT * FROM users WHERE status = "active" AND age > 18 ORDER BY created_at DESC LIMIT 25 OFFSET 50';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(2);
			expect(result.orderBy).toBe("created_at");
			expect(result.orderDirection).toBe("desc");
			expect(result.limit).toBe(25);
			expect(result.offset).toBe(50);
		});

		it("should handle case-insensitive SQL keywords", () => {
			const sql =
				'select * from users where status = "active" order by name limit 10';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.orderBy).toBe("name");
			expect(result.limit).toBe(10);
		});

		it("should handle multiline SQL", () => {
			const sql = `
				SELECT * FROM users
				WHERE status = 'active'
				ORDER BY created_at DESC
				LIMIT 50
			`;
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.orderBy).toBe("created_at");
			expect(result.limit).toBe(50);
		});

		it("should ignore invalid ORDER BY columns", () => {
			const sql = "SELECT * FROM users ORDER BY invalid_column ASC";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.orderBy).toBeUndefined();
		});

		it("should parse query with backtick-quoted identifiers", () => {
			const sql =
				"SELECT * FROM users WHERE `status` = 'active' ORDER BY `name`";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.orderBy).toBe("name");
		});

		it("should parse query with double-quoted identifiers", () => {
			const sql =
				'SELECT * FROM users WHERE "status" = \'active\' ORDER BY "name"';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.orderBy).toBe("name");
		});

		it("should return empty object for simple SELECT without clauses", () => {
			const sql = "SELECT * FROM users";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters).toBeUndefined();
			expect(result.orderBy).toBeUndefined();
			expect(result.limit).toBeUndefined();
			expect(result.offset).toBeUndefined();
		});

		it("should handle multiple IN conditions combined with AND", () => {
			const sql =
				'SELECT * FROM users WHERE status IN ("active", "pending") AND age IN (25, 30, 35)';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(2);
			expect(result.filters?.conditions[0].operator).toBe("in");
			expect(result.filters?.conditions[1].operator).toBe("in");
		});

		it("should handle IS NULL in WHERE clause", () => {
			const sql = "SELECT * FROM users WHERE description IS NULL";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions[0].operator).toBe("is_null");
		});

		it("should handle IS NOT NULL in WHERE clause", () => {
			const sql = "SELECT * FROM users WHERE description IS NOT NULL";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions[0].operator).toBe("is_not_null");
		});
	});

	describe("parseCondition", () => {
		it("should handle empty condition", () => {
			const result = parseCondition("", mockColumns);
			expect(result).toBeNull();
		});

		it("should handle unknown columns", () => {
			const result = parseCondition('unknown_col = "value"', mockColumns);
			expect(result).toBeNull();
		});

		it("should trim whitespace", () => {
			const result = parseCondition('   status = "active"   ', mockColumns);
			expect(result?.column).toBe("status");
			expect(result?.operator).toBe("equals");
		});
	});

	describe("edge cases", () => {
		it("should handle values with quotes inside", () => {
			const result = parseWhereClause('name = "O\'Brien"', mockColumns);
			expect(result.conditions[0]?.value).toBe("O'Brien");
		});

		it("should handle numeric strings without quotes", () => {
			const result = parseWhereClause("age > 25", mockColumns);
			expect(result.conditions[0]?.value).toBe(25);
			expect(typeof result.conditions[0]?.value).toBe("number");
		});

		it("should handle columns with underscores", () => {
			const result = parseWhereClause('created_at = "2024-01-01"', mockColumns);
			expect(result.conditions[0]?.column).toBe("created_at");
		});

		it("should ignore GROUP BY and HAVING", () => {
			const sql =
				"SELECT status, COUNT(*) FROM users GROUP BY status HAVING COUNT(*) > 5 LIMIT 10";
			const result = parseSqlQuery(sql, mockColumns);
			// Should not error and should still parse LIMIT
			expect(result.limit).toBe(10);
		});

		it("should handle LIMIT 0", () => {
			const sql = "SELECT * FROM users LIMIT 0";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.limit).toBe(0);
		});

		it("should handle very large OFFSET", () => {
			const sql = "SELECT * FROM users LIMIT 50 OFFSET 999999";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.offset).toBe(999999);
		});
	});

	describe("integration scenarios", () => {
		it("should parse real-world complex query 1", () => {
			const sql = `
				SELECT id, name, email
				FROM users
				WHERE status = 'active'
					AND age >= 18
					AND (created_at IS NOT NULL)
				ORDER BY created_at DESC
				LIMIT 25
				OFFSET 0
			`;
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions.length).toBeGreaterThan(0);
			expect(result.orderBy).toBe("created_at");
			expect(result.orderDirection).toBe("desc");
			expect(result.limit).toBe(25);
			expect(result.offset).toBe(0);
			expect(result.hiddenColumnList).toContain("age");
			expect(result.hiddenColumnList).toContain("status");
		});

		it("should parse real-world complex query 2", () => {
			const sql = `
				SELECT name, email
				FROM users
				WHERE status IN ('active', 'pending')
					AND email LIKE '%@example.com%'
				ORDER BY email ASC
				LIMIT 100
			`;
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(2);
			expect(result.filters?.conditions[0].operator).toBe("in");
			expect(result.filters?.conditions[1].operator).toBe("contains");
			expect(result.orderBy).toBe("email");
			expect(result.limit).toBe(100);
		});

		it("should handle query with only ORDER BY and LIMIT", () => {
			const sql = "SELECT * FROM users ORDER BY name LIMIT 50 OFFSET 10";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters).toBeUndefined();
			expect(result.orderBy).toBe("name");
			expect(result.limit).toBe(50);
			expect(result.offset).toBe(10);
		});
	});
});
