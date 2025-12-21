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
				        "value": "active",
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
				        "value": "active",
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
				        "value": "active",
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
				        "value": "active",
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
				        "value": "active",
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
				        "value": "active",
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
				          "active",
				          "pending",
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

		it("should parse GROUP BY and HAVING", () => {
			const sql =
				"SELECT status, COUNT(*) FROM users GROUP BY status HAVING COUNT(*) > 5 LIMIT 10";
			const result = parseSqlQuery(sql, mockColumns);
			expect(result.limit).toBe(10);
			expect(result.groupBy).toBeDefined();
			expect(result.groupBy).toContain("status");
			expect(result.having).toBeDefined();
			expect(result.having?.conditions.length).toBeGreaterThan(0);
			expect(result).toMatchInlineSnapshot(`
				{
				  "groupBy": [
				    "status",
				  ],
				  "having": {
				    "conditions": [
				      {
				        "column": "COUNT(*)",
				        "operator": "greater_than",
				        "value": 5,
				      },
				    ],
				    "logicalOperator": "and",
				  },
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
				        "value": "active",
				      },
				      {
				        "column": "age",
				        "operator": "greater_than_or_equal",
				        "value": 18,
				      },
				      {
				        "column": "created_at",
				        "operator": "is_not_null",
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
				          "active",
				          "pending",
				        ],
				      },
				      {
				        "column": "email",
				        "operator": "contains",
				        "value": "@example.com",
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
				        "value": "active",
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
			expect(result.filters?.conditions[0].value).toBe("active");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "active",
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
				        "value": "active",
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
				        "value": "active",
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
				"active",
				"inactive",
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
				          "active",
				          "inactive",
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
				        "value": "john",
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
				        "value": "active",
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
				        "value": "active",
				      },
				      {
				        "column": "email",
				        "operator": "equals",
				        "table": "users",
				        "value": "test@example.com",
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
			expect(result.filters?.conditions[0].value).toBe("active");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "active",
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
			expect(result.filters?.conditions[0].value).toBe("active");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "equals",
				        "table": "users",
				        "value": "active",
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
				          "active",
				          "inactive",
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
				        "value": "active",
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

		it("should parse INNER JOIN", () => {
			const sql =
				"SELECT * FROM users INNER JOIN posts ON users.id = posts.user_id";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("posts");
			expect(result.joins?.[0].type).toBe("inner");
			expect(result.joins?.[0].joinCondition.mode).toBe("filters");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "id",
				              "operator": "equals",
				              "table": "users",
				              "value": "POSTS.USER_ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "posts",
				      "type": "inner",
				    },
				  ],
				}
			`);
		});

		it("should parse RIGHT JOIN", () => {
			const sql =
				"SELECT * FROM users RIGHT JOIN posts ON users.id = posts.user_id";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("posts");
			expect(result.joins?.[0].type).toBe("right");
			expect(result.joins?.[0].joinCondition.mode).toBe("filters");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "id",
				              "operator": "equals",
				              "table": "users",
				              "value": "POSTS.USER_ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "posts",
				      "type": "right",
				    },
				  ],
				}
			`);
		});

		it("should parse FULL OUTER JOIN", () => {
			const sql =
				"SELECT * FROM users FULL OUTER JOIN posts ON users.id = posts.user_id";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("posts");
			expect(result.joins?.[0].type).toBe("full");
			expect(result.joins?.[0].joinCondition.mode).toBe("filters");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "id",
				              "operator": "equals",
				              "table": "users",
				              "value": "POSTS.USER_ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "posts",
				      "type": "full",
				    },
				  ],
				}
			`);
		});

		it("should parse CROSS JOIN", () => {
			const sql = "SELECT * FROM users CROSS JOIN posts";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("posts");
			expect(result.joins?.[0].type).toBe("cross");
			expect(result.joins?.[0].joinCondition.mode).toBe("custom");
			if (result.joins?.[0].joinCondition.mode === "custom") {
				expect(result.joins[0].joinCondition.conditions).toHaveLength(0);
			}
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "columns": "all",
				      "joinCondition": {
				        "conditions": [],
				        "mode": "custom",
				      },
				      "schema": "",
				      "table": "posts",
				      "type": "cross",
				    },
				  ],
				}
			`);
		});

		it("should parse multiple different JOIN types in sequence", () => {
			const sql =
				"SELECT * FROM users LEFT JOIN posts ON users.id = posts.user_id INNER JOIN comments ON posts.id = comments.post_id RIGHT JOIN categories ON comments.category_id = categories.id";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(3);
			expect(result.joins?.[0].type).toBe("left");
			expect(result.joins?.[0].table).toBe("posts");
			expect(result.joins?.[1].type).toBe("inner");
			expect(result.joins?.[1].table).toBe("comments");
			expect(result.joins?.[2].type).toBe("right");
			expect(result.joins?.[2].table).toBe("categories");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "id",
				              "operator": "equals",
				              "table": "users",
				              "value": "POSTS.USER_ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "posts",
				      "type": "left",
				    },
				    {
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "id",
				              "operator": "equals",
				              "table": "posts",
				              "value": "COMMENTS.POST_ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "comments",
				      "type": "inner",
				    },
				    {
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "category_id",
				              "operator": "equals",
				              "table": "comments",
				              "value": "CATEGORIES.ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "categories",
				      "type": "right",
				    },
				  ],
				}
			`);
		});

		it("should parse INNER JOIN with alias", () => {
			const sql =
				"SELECT * FROM users u INNER JOIN posts p ON u.id = p.user_id";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("posts");
			expect(result.joins?.[0].alias).toBe("p");
			expect(result.joins?.[0].type).toBe("inner");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "alias": "p",
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "id",
				              "operator": "equals",
				              "table": "u",
				              "value": "P.USER_ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "",
				      "table": "posts",
				      "type": "inner",
				    },
				  ],
				}
			`);
		});

		it("should parse RIGHT JOIN with schema and alias", () => {
			const sql =
				"SELECT * FROM users u RIGHT JOIN public.posts p ON u.id = p.user_id";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("posts");
			expect(result.joins?.[0].schema).toBe("public");
			expect(result.joins?.[0].alias).toBe("p");
			expect(result.joins?.[0].type).toBe("right");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "alias": "p",
				      "columns": "all",
				      "joinCondition": {
				        "filters": {
				          "conditions": [
				            {
				              "column": "id",
				              "operator": "equals",
				              "table": "u",
				              "value": "P.USER_ID",
				            },
				          ],
				          "logicalOperator": "and",
				        },
				        "mode": "filters",
				      },
				      "schema": "public",
				      "table": "posts",
				      "type": "right",
				    },
				  ],
				}
			`);
		});

		it("should parse CROSS JOIN with alias", () => {
			const sql = "SELECT * FROM users u CROSS JOIN posts p";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.joins).toBeDefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins?.[0].table).toBe("posts");
			expect(result.joins?.[0].alias).toBe("p");
			expect(result.joins?.[0].type).toBe("cross");
			expect(result).toMatchInlineSnapshot(`
				{
				  "joins": [
				    {
				      "alias": "p",
				      "columns": "all",
				      "joinCondition": {
				        "conditions": [],
				        "mode": "custom",
				      },
				      "schema": "",
				      "table": "posts",
				      "type": "cross",
				    },
				  ],
				}
			`);
		});
	});

	describe("GROUP BY and HAVING parsing", () => {
		it("should parse simple GROUP BY", () => {
			const sql = "SELECT status, COUNT(*) FROM users GROUP BY status";
			const result = parseSqlQuery(sql, ["id", "status", "name"]);

			expect(result.groupBy).toBeDefined();
			expect(result.groupBy).toHaveLength(1);
			expect(result.groupBy?.[0]).toBe("status");
			expect(result).toMatchInlineSnapshot(`
				{
				  "groupBy": [
				    "status",
				  ],
				  "hiddenColumnList": [
				    "id",
				    "name",
				  ],
				}
			`);
		});

		it("should parse multiple column GROUP BY", () => {
			const sql =
				"SELECT status, department, COUNT(*) FROM users GROUP BY status, department";
			const result = parseSqlQuery(sql, ["id", "status", "department", "name"]);

			expect(result.groupBy).toBeDefined();
			expect(result.groupBy).toHaveLength(2);
			expect(result.groupBy).toContain("status");
			expect(result.groupBy).toContain("department");
			expect(result).toMatchInlineSnapshot(`
				{
				  "groupBy": [
				    "status",
				    "department",
				  ],
				  "hiddenColumnList": [
				    "id",
				    "name",
				  ],
				}
			`);
		});

		it("should parse HAVING with aggregate condition", () => {
			const sql =
				"SELECT status, COUNT(*) FROM users GROUP BY status HAVING COUNT(*) > 5";
			const result = parseSqlQuery(sql, ["id", "status", "name"]);

			expect(result.groupBy).toBeDefined();
			expect(result.groupBy?.[0]).toBe("status");
			expect(result.having).toBeDefined();
			expect(result.having?.conditions).toHaveLength(1);
			expect(result.having?.conditions[0].column).toBe("COUNT(*)");
			expect(result.having?.conditions[0].operator).toBe("greater_than");
			expect(result.having?.conditions[0].value).toBe(5);
			expect(result).toMatchInlineSnapshot(`
				{
				  "groupBy": [
				    "status",
				  ],
				  "having": {
				    "conditions": [
				      {
				        "column": "COUNT(*)",
				        "operator": "greater_than",
				        "value": 5,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "hiddenColumnList": [
				    "id",
				    "name",
				  ],
				}
			`);
		});

		it("should parse HAVING with SUM aggregate", () => {
			const sql =
				"SELECT category, SUM(amount) FROM expenses GROUP BY category HAVING SUM(amount) > 1000";
			const result = parseSqlQuery(sql, ["id", "category", "amount"]);

			expect(result.groupBy).toBeDefined();
			expect(result.groupBy?.[0]).toBe("category");
			expect(result.having).toBeDefined();
			expect(result.having?.conditions[0].column).toBe("SUM(AMOUNT)");
			expect(result.having?.conditions[0].value).toBe(1000);
			expect(result).toMatchInlineSnapshot(`
				{
				  "groupBy": [
				    "category",
				  ],
				  "having": {
				    "conditions": [
				      {
				        "column": "SUM(AMOUNT)",
				        "operator": "greater_than",
				        "value": 1000,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "hiddenColumnList": [
				    "id",
				    "amount",
				  ],
				}
			`);
		});

		it("should parse HAVING with multiple conditions", () => {
			const sql =
				"SELECT status, COUNT(*) FROM users GROUP BY status HAVING COUNT(*) > 5 AND COUNT(*) < 100";
			const result = parseSqlQuery(sql, ["id", "status", "name"]);

			expect(result.having).toBeDefined();
			expect(result.having?.conditions).toHaveLength(2);
			expect(result.having?.logicalOperator).toBe("and");
			expect(result).toMatchInlineSnapshot(`
				{
				  "groupBy": [
				    "status",
				  ],
				  "having": {
				    "conditions": [
				      {
				        "column": "COUNT(*)",
				        "operator": "greater_than",
				        "value": 5,
				      },
				      {
				        "column": "COUNT(*)",
				        "operator": "less_than",
				        "value": 100,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "hiddenColumnList": [
				    "id",
				    "name",
				  ],
				}
			`);
		});

		it("should parse GROUP BY with WHERE clause", () => {
			const sql =
				"SELECT status, COUNT(*) FROM users WHERE created_at > '2024-01-01' GROUP BY status";
			const result = parseSqlQuery(sql, ["id", "status", "created_at", "name"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions[0].column).toBe("created_at");
			expect(result.groupBy).toBeDefined();
			expect(result.groupBy?.[0]).toBe("status");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "created_at",
				        "operator": "greater_than",
				        "value": "2024-01-01",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "groupBy": [
				    "status",
				  ],
				  "hiddenColumnList": [
				    "id",
				    "created_at",
				    "name",
				  ],
				}
			`);
		});

		it("should parse GROUP BY with WHERE and HAVING clauses", () => {
			const sql =
				"SELECT status, COUNT(*) FROM users WHERE active = true GROUP BY status HAVING COUNT(*) > 10";
			const result = parseSqlQuery(sql, ["id", "status", "active", "name"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions[0].column).toBe("active");
			expect(result.groupBy).toBeDefined();
			expect(result.groupBy?.[0]).toBe("status");
			expect(result.having).toBeDefined();
			expect(result.having?.conditions[0].column).toBe("COUNT(*)");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "active",
				        "operator": "equals",
				        "value": "true",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "groupBy": [
				    "status",
				  ],
				  "having": {
				    "conditions": [
				      {
				        "column": "COUNT(*)",
				        "operator": "greater_than",
				        "value": 10,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "hiddenColumnList": [
				    "id",
				    "active",
				    "name",
				  ],
				}
			`);
		});

		it("should parse GROUP BY with ORDER BY and LIMIT", () => {
			const sql =
				"SELECT status, COUNT(*) FROM users GROUP BY status ORDER BY status ASC LIMIT 10";
			const result = parseSqlQuery(sql, ["id", "status", "name"]);

			expect(result.groupBy).toBeDefined();
			expect(result.groupBy?.[0]).toBe("status");
			expect(result.orderBy).toBe("status");
			expect(result.orderDirection).toBe("asc");
			expect(result.limit).toBe(10);
			expect(result).toMatchInlineSnapshot(`
				{
				  "groupBy": [
				    "status",
				  ],
				  "hiddenColumnList": [
				    "id",
				    "name",
				  ],
				  "limit": 10,
				  "orderBy": "status",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should parse HAVING with AVG aggregate", () => {
			const sql =
				"SELECT department, AVG(salary) FROM employees GROUP BY department HAVING AVG(salary) > 50000";
			const result = parseSqlQuery(sql, ["id", "department", "salary"]);

			expect(result.groupBy).toBeDefined();
			expect(result.groupBy?.[0]).toBe("department");
			expect(result.having).toBeDefined();
			expect(result.having?.conditions[0].column).toBe("AVG(SALARY)");
			expect(result).toMatchInlineSnapshot(`
				{
				  "groupBy": [
				    "department",
				  ],
				  "having": {
				    "conditions": [
				      {
				        "column": "AVG(SALARY)",
				        "operator": "greater_than",
				        "value": 50000,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "hiddenColumnList": [
				    "id",
				    "salary",
				  ],
				}
			`);
		});

		it("should parse GROUP BY with schema-qualified columns", () => {
			const sql =
				"SELECT users.status, COUNT(*) FROM users GROUP BY users.status HAVING COUNT(*) > 5";
			const result = parseSqlQuery(sql, ["id", "status", "name"]);

			expect(result.groupBy).toBeDefined();
			expect(result.groupBy?.[0]).toBe("status");
			expect(result.having).toBeDefined();
			expect(result).toMatchInlineSnapshot(`
				{
				  "groupBy": [
				    "status",
				  ],
				  "having": {
				    "conditions": [
				      {
				        "column": "COUNT(*)",
				        "operator": "greater_than",
				        "value": 5,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "hiddenColumnList": [
				    "id",
				    "name",
				  ],
				}
			`);
		});
	});

	describe("NOT operator", () => {
		// NOT operator tests
		it("should parse NOT with IS NULL", () => {
			const sql = "SELECT * FROM users WHERE NOT id IS NULL";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions[0].operator).toBe("is_not_null");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "id",
				        "operator": "is_not_null",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse NOT with equals operator", () => {
			const sql = "SELECT * FROM users WHERE NOT status = 'active'";
			const result = parseSqlQuery(sql, ["id", "status", "name"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions[0].operator).toBe("not_equals");
			expect(result.filters?.conditions[0].value).toBe("active");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "not_equals",
				        "value": "active",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse NOT with IN operator", () => {
			const sql =
				"SELECT * FROM users WHERE NOT status IN ('active', 'pending')";
			const result = parseSqlQuery(sql, ["id", "status", "name"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions[0].operator).toBe("not_in");
			expect(Array.isArray(result.filters?.conditions[0].value)).toBe(true);
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "not_in",
				        "value": [
				          "active",
				          "pending",
				        ],
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse NOT with LIKE operator", () => {
			const sql = "SELECT * FROM users WHERE NOT name LIKE '%John%'";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions[0].operator).toBe("not_contains");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "name",
				        "operator": "not_contains",
				        "value": "John",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse NOT with comparison operators", () => {
			const sql = "SELECT * FROM users WHERE NOT age > 18";
			const result = parseSqlQuery(sql, ["id", "age", "name"]);

			expect(result.filters).toBeDefined();
			// NOT (age > 18) should become age <= 18
			expect(result.filters?.conditions[0].operator).toBe("less_than_or_equal");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "age",
				        "operator": "less_than_or_equal",
				        "value": 18,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});
	});

	describe("parenthesized conditions, and NULLS FIRST/LAST", () => {
		it("should parse parenthesized single condition", () => {
			const sql = "SELECT * FROM users WHERE (id = 1)";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions[0].column).toBe("id");
			expect(result.filters?.conditions[0].operator).toBe("equals");
			expect(result.filters?.conditions[0].value).toBe(1);
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "id",
				        "operator": "equals",
				        "value": 1,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse multiple parenthesized conditions with AND", () => {
			const sql = "SELECT * FROM users WHERE (id = 1) AND (status = 'active')";
			const result = parseSqlQuery(sql, ["id", "status", "name"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions.length).toBe(2);
			expect(result.filters?.logicalOperator).toBe("and");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "id",
				        "operator": "equals",
				        "value": 1,
				      },
				      {
				        "column": "status",
				        "operator": "equals",
				        "value": "active",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse multiple parenthesized conditions with OR", () => {
			const sql =
				"SELECT * FROM users WHERE (status = 'active') OR (status = 'pending')";
			const result = parseSqlQuery(sql, ["status", "id", "name"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions.length).toBe(2);
			expect(result.filters?.logicalOperator).toBe("or");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
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
				  },
				}
			`);
		});

		it("should parse parenthesized NOT condition", () => {
			const sql = "SELECT * FROM users WHERE (NOT status = 'inactive')";
			const result = parseSqlQuery(sql, ["status", "id", "name"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions[0].operator).toBe("not_equals");
			expect(result.filters?.conditions[0].value).toBe("inactive");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "not_equals",
				        "value": "inactive",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});

		it("should parse nested parenthesized conditions", () => {
			const sql = "SELECT * FROM users WHERE ((id = 1))";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.filters).toBeDefined();
			expect(result.filters?.conditions[0].column).toBe("id");
			expect(result.filters?.conditions[0].value).toBe(1);
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "id",
				        "operator": "equals",
				        "value": 1,
				      },
				    ],
				    "logicalOperator": "and",
				  },
				}
			`);
		});
	});

	describe("NULLS FIRST/LAST", () => {
		it("should parse ORDER BY with NULLS FIRST", () => {
			const sql = "SELECT * FROM users ORDER BY name ASC NULLS FIRST";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.orderBy).toBe("name");
			expect(result.orderDirection).toBe("asc");
			expect(result.nullsOrder).toBe("first");
			expect(result).toMatchInlineSnapshot(`
				{
				  "nullsOrder": "first",
				  "orderBy": "name",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should parse ORDER BY with NULLS LAST", () => {
			const sql = "SELECT * FROM users ORDER BY status DESC NULLS LAST";
			const result = parseSqlQuery(sql, ["id", "status", "name"]);

			expect(result.orderBy).toBe("status");
			expect(result.orderDirection).toBe("desc");
			expect(result.nullsOrder).toBe("last");
			expect(result).toMatchInlineSnapshot(`
				{
				  "nullsOrder": "last",
				  "orderBy": "status",
				  "orderDirection": "desc",
				}
			`);
		});

		it("should parse ORDER BY without NULLS clause", () => {
			const sql = "SELECT * FROM users ORDER BY name ASC";
			const result = parseSqlQuery(sql, ["id", "name", "email"]);

			expect(result.orderBy).toBe("name");
			expect(result.orderDirection).toBe("asc");
			expect(result.nullsOrder).toBeUndefined();
			expect(result).toMatchInlineSnapshot(`
				{
				  "orderBy": "name",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should parse ORDER BY with NULLS FIRST and default direction", () => {
			const sql = "SELECT * FROM users ORDER BY created_at NULLS FIRST";
			const result = parseSqlQuery(sql, ["id", "created_at", "name"]);

			expect(result.orderBy).toBe("created_at");
			expect(result.nullsOrder).toBe("first");
			expect(result).toMatchInlineSnapshot(`
				{
				  "nullsOrder": "first",
				  "orderBy": "created_at",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should parse NULLS LAST with DESC", () => {
			const sql = "SELECT * FROM products ORDER BY price DESC NULLS LAST";
			const result = parseSqlQuery(sql, ["id", "price", "name"]);

			expect(result.orderBy).toBe("price");
			expect(result.orderDirection).toBe("desc");
			expect(result.nullsOrder).toBe("last");
			expect(result).toMatchInlineSnapshot(`
				{
				  "nullsOrder": "last",
				  "orderBy": "price",
				  "orderDirection": "desc",
				}
			`);
		});

		it("should combine NOT, parentheses, and ORDER BY with NULLS", () => {
			const sql =
				"SELECT * FROM users WHERE (NOT status = 'inactive') ORDER BY name ASC NULLS FIRST";
			const result = parseSqlQuery(sql, ["id", "status", "name"]);

			expect(result.filters?.conditions[0].operator).toBe("not_equals");
			expect(result.orderBy).toBe("name");
			expect(result.nullsOrder).toBe("first");
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "status",
				        "operator": "not_equals",
				        "value": "inactive",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "nullsOrder": "first",
				  "orderBy": "name",
				  "orderDirection": "asc",
				}
			`);
		});

		it("should parse complex query with all three features", () => {
			const sql =
				"SELECT * FROM users WHERE (NOT (id = 1)) AND (status = 'active') ORDER BY created_at DESC NULLS LAST LIMIT 10";
			const result = parseSqlQuery(sql, ["id", "status", "name", "created_at"]);

			expect(result.filters?.conditions.length).toBe(2);
			expect(result.filters?.conditions[0].operator).toBe("not_equals");
			expect(result.orderBy).toBe("created_at");
			expect(result.orderDirection).toBe("desc");
			expect(result.nullsOrder).toBe("last");
			expect(result.limit).toBe(10);
			expect(result).toMatchInlineSnapshot(`
				{
				  "filters": {
				    "conditions": [
				      {
				        "column": "id",
				        "operator": "not_equals",
				        "value": 1,
				      },
				      {
				        "column": "status",
				        "operator": "equals",
				        "value": "active",
				      },
				    ],
				    "logicalOperator": "and",
				  },
				  "limit": 10,
				  "nullsOrder": "last",
				  "orderBy": "created_at",
				  "orderDirection": "desc",
				}
			`);
		});
	});
});
