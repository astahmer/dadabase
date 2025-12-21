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
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "equals",
				      "value": "active",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should parse single-quoted values", () => {
			const result = parseWhereClause("name = 'John'", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "name",
				operator: "equals",
				value: "John",
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "name",
				      "operator": "equals",
				      "value": "John",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should parse numeric values", () => {
			const result = parseWhereClause("age > 18", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "age",
				operator: "greater_than",
				value: 18,
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "age",
				      "operator": "greater_than",
				      "value": 18,
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
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
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "equals",
				      "value": "active",
				    },
				    {
				      "column": "age",
				      "operator": "greater_than",
				      "value": 18,
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should parse multiple conditions with OR", () => {
			const result = parseWhereClause(
				'status = "active" OR status = "pending"',
				mockColumns,
			);
			expect(result.conditions).toHaveLength(2);
			expect(result.logicalOperator).toBe("or");
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "equals",
				      "value": "active",
				    },
				    {
				      "column": "status",
				      "operator": "equals",
				      "value": "pending",
				    },
				  ],
				  "logicalOperator": "or",
				}
			`);
		});

		it("should prefer OR when more OR clauses than AND", () => {
			const result = parseWhereClause(
				'status = "a" OR status = "b" OR status = "c" AND age > 18',
				mockColumns,
			);
			expect(result.logicalOperator).toBe("or");
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "equals",
				      "value": "a",
				    },
				    {
				      "column": "status",
				      "operator": "equals",
				      "value": "b",
				    },
				    {
				      "column": "status",
				      "operator": "equals",
				      "value": "c",
				    },
				    {
				      "column": "age",
				      "operator": "greater_than",
				      "value": 18,
				    },
				  ],
				  "logicalOperator": "or",
				}
			`);
		});

		it("should handle IS NULL", () => {
			const result = parseWhereClause("description IS NULL", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "description",
				operator: "is_null",
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "description",
				      "operator": "is_null",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle IS NOT NULL", () => {
			const result = parseWhereClause("description IS NOT NULL", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "description",
				operator: "is_not_null",
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "description",
				      "operator": "is_not_null",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
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
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "in",
				      "value": [
				        "active",
				        "pending",
				        "archived",
				      ],
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
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
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "not_in",
				      "value": [
				        "deleted",
				        "banned",
				      ],
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle LIKE with wildcards", () => {
			const result = parseWhereClause('name LIKE "%John%"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "name",
				operator: "contains",
				value: "John",
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "name",
				      "operator": "contains",
				      "value": "John",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle LIKE with prefix wildcard", () => {
			const result = parseWhereClause('name LIKE "John%"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "name",
				operator: "starts_with",
				value: "John",
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "name",
				      "operator": "starts_with",
				      "value": "John",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle LIKE with suffix wildcard", () => {
			const result = parseWhereClause('name LIKE "%Smith"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "name",
				operator: "ends_with",
				value: "Smith",
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "name",
				      "operator": "ends_with",
				      "value": "Smith",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle NOT LIKE", () => {
			const result = parseWhereClause('name NOT LIKE "%admin%"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "name",
				operator: "not_contains",
				value: "admin",
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "name",
				      "operator": "not_contains",
				      "value": "admin",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should ignore invalid columns", () => {
			const result = parseWhereClause(
				'status = "active" AND invalid_column = "test"',
				mockColumns,
			);
			expect(result.conditions).toHaveLength(1);
			expect(result.conditions[0].column).toBe("status");
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "equals",
				      "value": "active",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle != operator", () => {
			const result = parseWhereClause('status != "deleted"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "status",
				operator: "not_equals",
				value: "deleted",
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "not_equals",
				      "value": "deleted",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle <> operator (SQL not equals)", () => {
			const result = parseWhereClause('status <> "deleted"', mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "status",
				operator: "not_equals",
				value: "deleted",
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "not_equals",
				      "value": "deleted",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle <= operator", () => {
			const result = parseWhereClause("age <= 65", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "age",
				operator: "less_than_or_equal",
				value: 65,
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "age",
				      "operator": "less_than_or_equal",
				      "value": 65,
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle >= operator", () => {
			const result = parseWhereClause("age >= 18", mockColumns);
			expect(result.conditions[0]).toEqual({
				column: "age",
				operator: "greater_than_or_equal",
				value: 18,
			});
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "age",
				      "operator": "greater_than_or_equal",
				      "value": 18,
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should return empty conditions for empty WHERE clause", () => {
			const result = parseWhereClause("", mockColumns);
			expect(result.conditions).toHaveLength(0);
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle case-insensitive keywords", () => {
			const result = parseWhereClause(
				"status = 'active' and age > 18",
				mockColumns,
			);
			expect(result.conditions).toHaveLength(2);
			expect(result.logicalOperator).toBe("and");
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "equals",
				      "value": "active",
				    },
				    {
				      "column": "age",
				      "operator": "greater_than",
				      "value": 18,
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle whitespace variations", () => {
			const result = parseWhereClause(
				"status   =   'active'   AND   age   >   18",
				mockColumns,
			);
			expect(result.conditions).toHaveLength(2);
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "status",
				      "operator": "equals",
				      "value": "active",
				    },
				    {
				      "column": "age",
				      "operator": "greater_than",
				      "value": 18,
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
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
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "limit": 50,
				  "orderBy": "name",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should parse LIMIT without OFFSET", () => {
			const sql = "SELECT * FROM users LIMIT 100";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.limit).toBe(100);
			expect(result.offset).toBeUndefined();
			expect(result).toMatchInlineSnapshot(`
				{
				  "limit": 100,
				}
			`);
		});

		it("should parse OFFSET without LIMIT", () => {
			const sql = "SELECT * FROM users OFFSET 25";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.offset).toBe(25);
			expect(result.limit).toBeUndefined();
			expect(result).toMatchInlineSnapshot(`
				{
				  "offset": 25,
				}
			`);
		});

		it("should parse both LIMIT and OFFSET", () => {
			const sql = "SELECT * FROM users LIMIT 50 OFFSET 100";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.limit).toBe(50);
			expect(result.offset).toBe(100);
			expect(result).toMatchInlineSnapshot(`
				{
				  "limit": 50,
				  "offset": 100,
				}
			`);
		});

		it("should parse ORDER BY DESC", () => {
			const sql = "SELECT * FROM users ORDER BY created_at DESC";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.orderBy).toBe("created_at");
			expect(result.orderDirection).toBe("desc");
			expect(result).toMatchInlineSnapshot(`
				{
				  "orderBy": "created_at",
				  "orderDirection": "desc",
				}
			`);
		});

		it("should parse ORDER BY without explicit direction (defaults to ASC)", () => {
			const sql = "SELECT * FROM users ORDER BY email";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.orderBy).toBe("email");
			expect(result.orderDirection).toBe("asc");
			expect(result).toMatchInlineSnapshot(`
				{
				  "orderBy": "email",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should parse specific columns in SELECT", () => {
			const sql = "SELECT id, name, email FROM users";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.hiddenColumnList).toContain("age");
			expect(result.hiddenColumnList).toContain("created_at");
			expect(result.hiddenColumnList).not.toContain("id");
			expect(result.hiddenColumnList).not.toContain("name");
			expect(result.hiddenColumnList).not.toContain("email");
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				}
			`);
		});

		it("should not set hiddenColumnList for SELECT *", () => {
			const sql = "SELECT * FROM users";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.hiddenColumnList).toBeUndefined();
			expect(result).toMatchInlineSnapshot(`{}`);
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
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "value": "ACTIVE",
				      },
				      {
				        "column": "age",
				        "operator": "greater_than",
				        "value": 18,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "limit": 25,
				  "offset": 50,
				  "orderBy": "created_at",
				  "orderDirection": "desc",
				}
			`);
		});

		it("should handle case-insensitive SQL keywords", () => {
			const sql =
				'select * from users where status = "active" order by name limit 10';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.orderBy).toBe("name");
			expect(result.limit).toBe(10);
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "limit": 10,
				  "orderBy": "name",
				  "orderDirection": "asc",
				}
			`);
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
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "limit": 50,
				  "orderBy": "created_at",
				  "orderDirection": "desc",
				}
			`);
		});

		it("should ignore invalid ORDER BY columns", () => {
			const sql = "SELECT * FROM users ORDER BY invalid_column ASC";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.orderBy).toBeUndefined();
			expect(result).toMatchInlineSnapshot(`{}`);
		});

		it("should parse query with backtick-quoted identifiers", () => {
			const sql =
				"SELECT * FROM users WHERE `status` = 'active' ORDER BY `name`";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.orderBy).toBe("name");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "orderBy": "name",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should parse query with double-quoted identifiers", () => {
			const sql =
				'SELECT * FROM users WHERE "status" = \'active\' ORDER BY "name"';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.orderBy).toBe("name");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "orderBy": "name",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should return empty object for simple SELECT without clauses", () => {
			const sql = "SELECT * FROM users";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters).toBeUndefined();
			expect(result.orderBy).toBeUndefined();
			expect(result.limit).toBeUndefined();
			expect(result.offset).toBeUndefined();
			expect(result).toMatchInlineSnapshot(`{}`);
		});

		it("should handle multiple IN conditions combined with AND", () => {
			const sql =
				'SELECT * FROM users WHERE status IN ("active", "pending") AND age IN (25, 30, 35)';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(2);
			expect(result.filters?.conditions[0].operator).toBe("in");
			expect(result.filters?.conditions[1].operator).toBe("in");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "in",
				        "value": [
				          "ACTIVE",
				          "PENDING",
				        ],
				      },
				      {
				        "column": "age",
				        "operator": "in",
				        "value": [
				          "25",
				          "30",
				          "35",
				        ],
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle IS NULL in WHERE clause", () => {
			const sql = "SELECT * FROM users WHERE description IS NULL";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions[0].operator).toBe("is_null");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "description",
				        "operator": "is_null",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle IS NOT NULL in WHERE clause", () => {
			const sql = "SELECT * FROM users WHERE description IS NOT NULL";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions[0].operator).toBe("is_not_null");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "description",
				        "operator": "is_not_null",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});
	});

	describe("parseCondition", () => {
		it("should handle empty condition", () => {
			const result = parseCondition("", mockColumns);
			expect(result).toBeNull();
			expect(result).toMatchInlineSnapshot(`null`);
		});

		it("should handle unknown columns", () => {
			const result = parseCondition('unknown_col = "value"', mockColumns);
			expect(result).toBeNull();
			expect(result).toMatchInlineSnapshot(`null`);
		});

		it("should trim whitespace", () => {
			const result = parseCondition('   status = "active"   ', mockColumns);
			expect(result?.column).toBe("status");
			expect(result?.operator).toBe("equals");
			expect(result).toMatchInlineSnapshot(`
				{
				  "column": "status",
				  "operator": "equals",
				  "value": "active",
				}
			`);
		});
	});

	describe("edge cases", () => {
		it("should handle values with quotes inside", () => {
			const result = parseWhereClause('name = "O\'Brien"', mockColumns);
			expect(result.conditions[0]?.value).toBe("O'Brien");
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "name",
				      "operator": "equals",
				      "value": "O'Brien",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle numeric strings without quotes", () => {
			const result = parseWhereClause("age > 25", mockColumns);
			expect(result.conditions[0]?.value).toBe(25);
			expect(typeof result.conditions[0]?.value).toBe("number");
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "age",
				      "operator": "greater_than",
				      "value": 25,
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should handle columns with underscores", () => {
			const result = parseWhereClause('created_at = "2024-01-01"', mockColumns);
			expect(result.conditions[0]?.column).toBe("created_at");
			expect(result).toMatchInlineSnapshot(`
				{
				  "conditions": [
				    {
				      "column": "created_at",
				      "operator": "equals",
				      "value": "2024-01-01",
				    },
				  ],
				  "logicalOperator": "and",
				}
			`);
		});

		it("should ignore GROUP BY and HAVING", () => {
			const sql =
				"SELECT status, COUNT(*) FROM users GROUP BY status HAVING COUNT(*) > 5 LIMIT 10";
			const result = parseSqlQuery(sql, mockColumns);
			// Should not error and should still parse LIMIT
			expect(result.limit).toBe(10);
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "id",
				    "name",
				    "email",
				    "age",
				    "created_at",
				    "description",
				    "is_active",
				  ],
				  "limit": 10,
				}
			`);
		});

		it("should handle LIMIT 0", () => {
			const sql = "SELECT * FROM users LIMIT 0";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.limit).toBe(0);
			expect(result).toMatchInlineSnapshot(`
				{
				  "limit": 0,
				}
			`);
		});

		it("should handle very large OFFSET", () => {
			const sql = "SELECT * FROM users LIMIT 50 OFFSET 999999";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.offset).toBe(999999);
			expect(result).toMatchInlineSnapshot(`
				{
				  "limit": 50,
				  "offset": 999999,
				}
			`);
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
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "value": "ACTIVE",
				      },
				      {
				        "column": "age",
				        "operator": "greater_than_or_equal",
				        "value": 18,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "hiddenColumnList": [
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				  "limit": 25,
				  "offset": 0,
				  "orderBy": "created_at",
				  "orderDirection": "desc",
				}
			`);
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
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "in",
				        "value": [
				          "ACTIVE",
				          "PENDING",
				        ],
				      },
				      {
				        "column": "email",
				        "operator": "contains",
				        "value": "@EXAMPLE.COM",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "hiddenColumnList": [
				    "id",
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				  "limit": 100,
				  "orderBy": "email",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should handle query with only ORDER BY and LIMIT", () => {
			const sql = "SELECT * FROM users ORDER BY name LIMIT 50 OFFSET 10";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters).toBeUndefined();
			expect(result.orderBy).toBe("name");
			expect(result.limit).toBe(50);
			expect(result.offset).toBe(10);
			expect(result).toMatchInlineSnapshot(`
				{
				  "limit": 50,
				  "offset": 10,
				  "orderBy": "name",
				  "orderDirection": "asc",
				}
			`);
		});
	});

	describe("table-qualified column names", () => {
		it("should parse WHERE with unquoted table.column syntax", () => {
			const sql = 'SELECT * FROM users WHERE users.status = "active"';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].table).toBe("users");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse WHERE with fully quoted table.column syntax", () => {
			const sql = 'SELECT * FROM users WHERE "users"."status" = \'active\'';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].value).toBe("ACTIVE");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse WHERE with mixed quote styles", () => {
			const sql = "SELECT * FROM users WHERE \"users\".status = 'active'";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].table).toBe("users");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse WHERE with backtick-quoted table.column", () => {
			const sql = "SELECT * FROM users WHERE `users`.`status` = 'active'";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle table-qualified columns in IS NULL", () => {
			const sql = "SELECT * FROM users WHERE users.status IS NULL";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].table).toBe("users");
			expect(result.filters?.conditions[0].operator).toBe("is_null");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "is_null",
				        "table": "users",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle table-qualified columns in IN operator", () => {
			const sql =
				"SELECT * FROM users WHERE users.status IN ('active', 'inactive')";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].table).toBe("users");
			expect(result.filters?.conditions[0].operator).toBe("in");
			expect(result.filters?.conditions[0].value).toEqual([
				"ACTIVE",
				"INACTIVE",
			]);
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "in",
				        "table": "users",
				        "value": [
				          "ACTIVE",
				          "INACTIVE",
				        ],
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle table-qualified columns in LIKE", () => {
			const sql = "SELECT * FROM users WHERE users.name LIKE '%john%'";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("name");
			expect(result.filters?.conditions[0].table).toBe("users");
			expect(result.filters?.conditions[0].operator).toBe("contains");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "name",
				        "operator": "contains",
				        "table": "users",
				        "value": "JOHN",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse ORDER BY with unquoted table.column", () => {
			const sql = "SELECT * FROM users ORDER BY users.name ASC";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.orderBy).toBe("name");
			expect(result.orderDirection).toBe("asc");
			expect(result).toMatchInlineSnapshot(`
				{
				  "orderBy": "name",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should parse ORDER BY with quoted table.column", () => {
			const sql = 'SELECT * FROM users ORDER BY "users"."name" DESC';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.orderBy).toBe("name");
			expect(result.orderDirection).toBe("desc");
			expect(result).toMatchInlineSnapshot(`
				{
				  "orderBy": "name",
				  "orderDirection": "desc",
				}
			`);
		});

		it("should handle table-qualified columns in SELECT clause", () => {
			const sql =
				'SELECT "users"."id", "users"."name" FROM users WHERE "users"."status" = \'active\'';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.hiddenColumnList).toContain("email");
			expect(result.hiddenColumnList).toContain("status");
			expect(result.hiddenColumnList).not.toContain("id");
			expect(result.hiddenColumnList).not.toContain("name");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "hiddenColumnList": [
				    "email",
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				}
			`);
		});

		it("should parse multiple conditions with table-qualified columns", () => {
			const sql =
				"SELECT * FROM users WHERE users.status = 'active' AND users.email = 'test@example.com'";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(2);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].table).toBe("users");
			expect(result.filters?.conditions[1].column).toBe("email");
			expect(result.filters?.conditions[1].table).toBe("users");
			expect(result.filters?.logicalOperator).toBe("and");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "ACTIVE",
				      },
				      {
				        "column": "email",
				        "operator": "equals",
				        "table": "users",
				        "value": "TEST@EXAMPLE.COM",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle accounting_imports.category example", () => {
			const sql =
				'SELECT * FROM "accounting_imports" WHERE "accounting_imports"."category" = \'LEGACY\' ORDER BY "accounting_imports"."category" LIMIT 2';
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("category");
			expect(result.filters?.conditions[0].table).toBe("accounting_imports");
			expect(result.filters?.conditions[0].value).toBe("LEGACY");
			expect(result.orderBy).toBe("category");
			expect(result.limit).toBe(2);
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "category",
				        "operator": "equals",
				        "table": "accounting_imports",
				        "value": "LEGACY",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "limit": 2,
				  "orderBy": "category",
				  "orderDirection": "asc",
				}
			`);
		});
	});

	describe("schema.table.column qualified column names", () => {
		it("should parse WHERE with schema.table.column syntax", () => {
			const sql =
				"SELECT * FROM schema.users WHERE schema.users.status = 'active'";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].table).toBe("users");
			expect(result.filters?.conditions[0].value).toBe("ACTIVE");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse WHERE with fully quoted schema.table.column syntax", () => {
			const sql =
				'SELECT * FROM "schema"."users" WHERE "schema"."users"."status" = \'active\'';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].table).toBe("users");
			expect(result.filters?.conditions[0].value).toBe("ACTIVE");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle schema.table.column in IS NULL", () => {
			const sql =
				"SELECT * FROM schema.users WHERE schema.users.status IS NULL";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].table).toBe("users");
			expect(result.filters?.conditions[0].operator).toBe("is_null");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "is_null",
				        "table": "users",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle schema.table.column in IN operator", () => {
			const sql =
				"SELECT * FROM schema.users WHERE schema.users.status IN ('active', 'inactive')";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].table).toBe("users");
			expect(result.filters?.conditions[0].operator).toBe("in");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "in",
				        "table": "users",
				        "value": [
				          "ACTIVE",
				          "INACTIVE",
				        ],
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse ORDER BY with schema.table.column", () => {
			const sql = "SELECT * FROM schema.users ORDER BY schema.users.name ASC";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.orderBy).toBe("name");
			expect(result.orderDirection).toBe("asc");
			expect(result).toMatchInlineSnapshot(`
				{
				  "orderBy": "name",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should handle schema.table.column in SELECT clause", () => {
			const sql = "SELECT schema.users.id, schema.users.name FROM schema.users";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.hiddenColumnList).toContain("email");
			expect(result.hiddenColumnList).not.toContain("id");
			expect(result.hiddenColumnList).not.toContain("name");
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "email",
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				}
			`);
		});
	});

	describe("column aliases", () => {
		it("should handle AS alias in SELECT", () => {
			const sql = "SELECT id, name AS user_name, email FROM users";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.hiddenColumnList).toContain("age");
			expect(result.hiddenColumnList).not.toContain("id");
			expect(result.hiddenColumnList).not.toContain("name");
			expect(result.hiddenColumnList).not.toContain("email");
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				}
			`);
		});

		it("should handle space-separated aliases (no AS)", () => {
			const sql = "SELECT id, name user_name, email FROM users";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.hiddenColumnList).toContain("age");
			expect(result.hiddenColumnList).not.toContain("id");
			expect(result.hiddenColumnList).not.toContain("name");
			expect(result.hiddenColumnList).not.toContain("email");
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				}
			`);
		});

		it("should handle quoted column aliases", () => {
			const sql = 'SELECT id, name AS "User Name", email FROM users';
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.hiddenColumnList).toContain("age");
			expect(result.hiddenColumnList).not.toContain("id");
			expect(result.hiddenColumnList).not.toContain("name");
			expect(result.hiddenColumnList).not.toContain("email");
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				}
			`);
		});

		it("should handle table.column with alias", () => {
			const sql =
				"SELECT users.id, users.name AS user_name, users.email FROM users";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.hiddenColumnList).toContain("age");
			expect(result.hiddenColumnList).not.toContain("id");
			expect(result.hiddenColumnList).not.toContain("name");
			expect(result.hiddenColumnList).not.toContain("email");
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				}
			`);
		});

		it("should handle schema.table.column with alias", () => {
			const sql =
				"SELECT schema.users.id AS user_id, schema.users.name AS user_name FROM schema.users";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.hiddenColumnList).toContain("email");
			expect(result.hiddenColumnList).not.toContain("id");
			expect(result.hiddenColumnList).not.toContain("name");
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "email",
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				}
			`);
		});

		it("should handle multiple aliases in complex query", () => {
			const sql =
				"SELECT u.id AS user_id, u.name AS full_name, u.email AS contact_email FROM users u WHERE u.status = 'active'";
			const result = parseSqlQuery(sql, mockColumns);

			expect(result.hiddenColumnList).toContain("age");
			expect(result.hiddenColumnList).toContain("status");
			expect(result.hiddenColumnList).not.toContain("id");
			expect(result.hiddenColumnList).not.toContain("name");
			expect(result.hiddenColumnList).not.toContain("email");
			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("status");
			expect(result.filters?.conditions[0].table).toBe("u");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "u",
				        "value": "ACTIVE",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "hiddenColumnList": [
				    "age",
				    "created_at",
				    "status",
				    "description",
				    "is_active",
				  ],
				}
			`);
		});
	});

	describe("mixed quoting in schema.table.column references", () => {
		it('should handle fully quoted: "public"."accounting_imports"."category"', () => {
			const sql =
				'SELECT "public"."accounting_imports"."category" FROM "public"."accounting_imports" LIMIT 2';
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.hiddenColumnList).toContain("id");
			expect(result.hiddenColumnList).toContain("amount");
			expect(result.hiddenColumnList).toContain("date");
			expect(result.hiddenColumnList).not.toContain("category");
			expect(result.limit).toBe(2);
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "id",
				    "amount",
				    "date",
				  ],
				  "limit": 2,
				}
			`);
		});

		it('should handle mixed quoting: "public".accounting_imports."category"', () => {
			const sql =
				'SELECT "public".accounting_imports."category" FROM "public".accounting_imports LIMIT 2';
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.hiddenColumnList).toContain("id");
			expect(result.hiddenColumnList).not.toContain("category");
			expect(result.limit).toBe(2);
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "id",
				    "amount",
				    "date",
				  ],
				  "limit": 2,
				}
			`);
		});

		it('should handle mixed quoting: public."accounting_imports".category', () => {
			const sql =
				'SELECT public."accounting_imports".category FROM accounting_imports LIMIT 2';
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.hiddenColumnList).toContain("id");
			expect(result.hiddenColumnList).not.toContain("category");
			expect(result.limit).toBe(2);
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "id",
				    "amount",
				    "date",
				  ],
				  "limit": 2,
				}
			`);
		});

		it("should handle unquoted: public.accounting_imports.category", () => {
			const sql =
				"SELECT public.accounting_imports.category FROM accounting_imports LIMIT 2";
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.hiddenColumnList).toContain("id");
			expect(result.hiddenColumnList).not.toContain("category");
			expect(result.limit).toBe(2);
			expect(result).toMatchInlineSnapshot(`
				{
				  "hiddenColumnList": [
				    "id",
				    "amount",
				    "date",
				  ],
				  "limit": 2,
				}
			`);
		});

		it("should handle WHERE with fully quoted mixed schema.table.column", () => {
			const sql =
				'SELECT * FROM "public"."accounting_imports" WHERE "public"."accounting_imports"."category" = \'LEGACY\'';
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("category");
			expect(result.filters?.conditions[0].table).toBe("accounting_imports");
			expect(result.filters?.conditions[0].value).toBe("LEGACY");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "category",
				        "operator": "equals",
				        "table": "accounting_imports",
				        "value": "LEGACY",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it('should handle WHERE with mixed quoting: "public".accounting_imports."category"', () => {
			const sql =
				'SELECT * FROM "public".accounting_imports WHERE "public".accounting_imports."category" = \'LEGACY\'';
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("category");
			expect(result.filters?.conditions[0].table).toBe("accounting_imports");
			expect(result.filters?.conditions[0].value).toBe("LEGACY");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "category",
				        "operator": "equals",
				        "table": "accounting_imports",
				        "value": "LEGACY",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it('should handle WHERE with mixed quoting: public."accounting_imports".category', () => {
			const sql =
				"SELECT * FROM accounting_imports WHERE public.\"accounting_imports\".category = 'LEGACY'";
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("category");
			expect(result.filters?.conditions[0].table).toBe("accounting_imports");
			expect(result.filters?.conditions[0].value).toBe("LEGACY");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "category",
				        "operator": "equals",
				        "table": "accounting_imports",
				        "value": "LEGACY",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle WHERE with unquoted schema.table.column", () => {
			const sql =
				"SELECT * FROM accounting_imports WHERE public.accounting_imports.category = 'LEGACY'";
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("category");
			expect(result.filters?.conditions[0].value).toBe("LEGACY");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "category",
				        "operator": "equals",
				        "table": "accounting_imports",
				        "value": "LEGACY",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle ORDER BY with fully quoted schema.table.column", () => {
			const sql =
				'SELECT * FROM "public"."accounting_imports" ORDER BY "public"."accounting_imports"."category" ASC';
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.orderBy).toBe("category");
			expect(result.orderDirection).toBe("asc");
			expect(result).toMatchInlineSnapshot(`
				{
				  "orderBy": "category",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should handle ORDER BY with mixed quoting", () => {
			const sql =
				'SELECT * FROM public."accounting_imports" ORDER BY public."accounting_imports".category DESC';
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.orderBy).toBe("category");
			expect(result.orderDirection).toBe("desc");
			expect(result).toMatchInlineSnapshot(`
				{
				  "orderBy": "category",
				  "orderDirection": "desc",
				}
			`);
		});

		it("should handle IN operator with mixed quoting", () => {
			const sql =
				"SELECT * FROM accounting_imports WHERE public.accounting_imports.category IN ('LEGACY', 'CURRENT')";
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("category");
			expect(result.filters?.conditions[0].operator).toBe("in");
			expect(result.filters?.conditions[0].value).toEqual([
				"LEGACY",
				"CURRENT",
			]);
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "category",
				        "operator": "in",
				        "table": "accounting_imports",
				        "value": [
				          "LEGACY",
				          "CURRENT",
				        ],
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should handle IS NULL with mixed quoting", () => {
			const sql =
				'SELECT * FROM "public".accounting_imports WHERE public."accounting_imports"."category" IS NULL';
			const result = parseSqlQuery(sql, ["id", "category", "amount", "date"]);

			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("category");
			expect(result.filters?.conditions[0].operator).toBe("is_null");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "category",
				        "operator": "is_null",
				        "table": "accounting_imports",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});
	});

	describe("LEFT JOIN parsing", () => {
		const accountingColumns = ["id", "category", "amount", "date"];
		const expensesColumns = ["id", "planned_outcome_id", "name", "amount"];

		it("should parse simple LEFT JOIN without alias", () => {
			const sql =
				'SELECT * FROM "accounting_line_planned_outcomes" LEFT JOIN "expenses" ON "expenses"."planned_outcome_id" = "accounting_line_planned_outcomes"."id"';
			const result = parseSqlQuery(sql, accountingColumns);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("expenses");
			expect(result.joins?.[0].alias).toBeUndefined();
			expect(result.joins?.[0].schema).toBe("");
			expect(result.joins?.[0].type).toBe("left");
			expect(result.joins?.[0].columns).toBe("all");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "planned_outcome_id",
				              "operator": "equals",
				              "table": "expenses",
				              "value": "ACCOUNTING_LINE_PLANNED_OUTCOMES"."ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "expenses",
				      "type": "left",
				    },
				  ],
				}
			`);
		});

		it("should parse LEFT JOIN with AS alias", () => {
			const sql =
				'SELECT * FROM "accounting_line_planned_outcomes" LEFT JOIN "expenses" AS "aliased" ON "aliased"."planned_outcome_id" = "accounting_line_planned_outcomes"."id"';
			const result = parseSqlQuery(sql, accountingColumns);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("expenses");
			expect(result.joins?.[0].alias).toBe("aliased");
			expect(result.joins?.[0].schema).toBe("");
			expect(result.joins?.[0].type).toBe("left");
			expect(result.joins?.[0].columns).toBe("all");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "alias": "aliased",
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "planned_outcome_id",
				              "operator": "equals",
				              "table": "aliased",
				              "value": "ACCOUNTING_LINE_PLANNED_OUTCOMES"."ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "expenses",
				      "type": "left",
				    },
				  ],
				}
			`);
		});

		it("should parse LEFT JOIN with implicit alias (no AS keyword)", () => {
			const sql =
				"SELECT * FROM accounting_line_planned_outcomes LEFT JOIN expenses e ON e.planned_outcome_id = accounting_line_planned_outcomes.id";
			const result = parseSqlQuery(sql, accountingColumns);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("expenses");
			expect(result.joins?.[0].alias).toBe("e");
			expect(result.joins?.[0].schema).toBe("");
			expect(result.joins?.[0].type).toBe("left");
			expect(result.joins?.[0].columns).toBe("all");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "alias": "e",
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "planned_outcome_id",
				              "operator": "equals",
				              "table": "e",
				              "value": "ACCOUNTING_LINE_PLANNED_OUTCOMES.ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "expenses",
				      "type": "left",
				    },
				  ],
				}
			`);
		});

		it("should parse LEFT JOIN with ON conditions", () => {
			const sql =
				"SELECT * FROM accounting_line_planned_outcomes LEFT JOIN expenses AS e ON e.planned_outcome_id = accounting_line_planned_outcomes.id";
			const result = parseSqlQuery(sql, accountingColumns);

			expect(result.joins).toBeDefined();
			expect(result.joins?.[0].joinCondition.mode).toBe("filters");
			if (result.joins?.[0].joinCondition.mode === "filters") {
				expect(
					result.joins?.[0].joinCondition.filters?.conditions,
				).toHaveLength(1);
				expect(
					result.joins?.[0].joinCondition.filters?.conditions[0].column,
				).toBe("planned_outcome_id");
				expect(
					result.joins?.[0].joinCondition.filters?.conditions[0].table,
				).toBe("e");
			}
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "alias": "e",
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "planned_outcome_id",
				              "operator": "equals",
				              "table": "e",
				              "value": "ACCOUNTING_LINE_PLANNED_OUTCOMES.ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "expenses",
				      "type": "left",
				    },
				  ],
				}
			`);
		});

		it("should parse multiple LEFT JOINs", () => {
			const sql =
				"SELECT * FROM accounting_line_planned_outcomes LEFT JOIN expenses e ON e.planned_outcome_id = accounting_line_planned_outcomes.id LEFT JOIN other_table o ON o.id = accounting_line_planned_outcomes.id";
			const result = parseSqlQuery(sql, accountingColumns);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(2);
			expect(result.joins?.[0].table).toBe("expenses");
			expect(result.joins?.[0].alias).toBe("e");
			expect(result.joins?.[1].table).toBe("other_table");
			expect(result.joins?.[1].alias).toBe("o");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "alias": "e",
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "planned_outcome_id",
				              "operator": "equals",
				              "table": "e",
				              "value": "ACCOUNTING_LINE_PLANNED_OUTCOMES.ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "expenses",
				      "type": "left",
				    },
				    {
				      "alias": "o",
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "id",
				              "operator": "equals",
				              "table": "o",
				              "value": "ACCOUNTING_LINE_PLANNED_OUTCOMES.ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "other_table",
				      "type": "left",
				    },
				  ],
				}
			`);
		});

		it("should parse LEFT JOIN with multiple ON conditions", () => {
			const sql =
				"SELECT * FROM accounting_line_planned_outcomes LEFT JOIN expenses e ON e.planned_outcome_id = accounting_line_planned_outcomes.id AND e.amount > 100";
			const result = parseSqlQuery(sql, accountingColumns);

			if (result.joins?.[0].joinCondition.mode === "filters") {
				expect(
					result.joins?.[0].joinCondition.filters?.conditions,
				).toHaveLength(2);
				expect(result.joins?.[0].joinCondition.filters?.logicalOperator).toBe(
					"and",
				);
			}

			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "alias": "e",
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "planned_outcome_id",
				              "operator": "equals",
				              "table": "e",
				              "value": "ACCOUNTING_LINE_PLANNED_OUTCOMES.ID",
				            },
				            {
				              "column": "amount",
				              "operator": "greater_than",
				              "table": "e",
				              "value": 100,
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "expenses",
				      "type": "left",
				    },
				  ],
				}
			`);
		});

		it("should parse LEFT JOIN without ON conditions", () => {
			const sql =
				"SELECT * FROM accounting_line_planned_outcomes LEFT JOIN expenses WHERE amount > 100";
			const result = parseSqlQuery(sql, accountingColumns);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("expenses");
			expect(result.joins?.[0].joinCondition.mode).toBe("custom");
			expect(result.filters?.conditions).toHaveLength(1);
			expect(result.filters?.conditions[0].column).toBe("amount");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "amount",
				        "operator": "greater_than",
				        "value": 100,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "joins": [
				    {
				      "columns": "all",
				      "joinCondition": {
				        "conditions": [],
				        "mode": "custom",
				      },
				      "schema": "",
				      "table": "expenses",
				      "type": "left",
				    },
				  ],
				}
			`);
		});

		it("should parse LEFT JOIN with explicit schema", () => {
			const sql =
				"SELECT * FROM accounting_line_planned_outcomes LEFT JOIN public.expenses ON expenses.planned_outcome_id = accounting_line_planned_outcomes.id";
			const result = parseSqlQuery(sql, accountingColumns);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("expenses");
			expect(result.joins?.[0].schema).toBe("public");
			expect(result.joins?.[0].alias).toBeUndefined();
			expect(result.joins?.[0].type).toBe("left");
			expect(result.joins?.[0].columns).toBe("all");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "planned_outcome_id",
				              "operator": "equals",
				              "table": "expenses",
				              "value": "ACCOUNTING_LINE_PLANNED_OUTCOMES.ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "public",
				      "table": "expenses",
				      "type": "left",
				    },
				  ],
				}
			`);
		});
	});
});
