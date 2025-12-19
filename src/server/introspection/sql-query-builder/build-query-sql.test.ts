import { describe, expect, it } from "vitest";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { buildQuerySql, generateJoinAliases } from "./build-query-sql.ts";
import { buildWhereClause } from "./build-where-clause.ts";
import { buildOrderByClause, buildLimitClause } from "./build-pagination-clause.ts";

describe("SQL Query Builder", () => {
    describe("buildWhereClause", () => {
        it("should return empty string for no conditions", () => {
            const filters: QueryFilterType = {
                conditions: [],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toBe("");
        });

        it("should build a simple equals condition for PostgreSQL", () => {
            const filters: QueryFilterType = {
                conditions: [{ column: "name", operator: "equals", value: "John" }],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain("= 'John'");
        });

        it("should build a simple equals condition for SQLite", () => {
            const filters: QueryFilterType = {
                conditions: [{ column: "age", operator: "equals", value: 25 }],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.SQLite);
            expect(result).toContain("= 25");
        });

        it("should handle multiple conditions with AND operator", () => {
            const filters: QueryFilterType = {
                conditions: [
                    { column: "name", operator: "equals", value: "John" },
                    { column: "age", operator: "greater_than", value: 18 },
                ],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain(" AND ");
        });

        it("should handle multiple conditions with OR operator", () => {
            const filters: QueryFilterType = {
                conditions: [
                    { column: "status", operator: "equals", value: "active" },
                    { column: "status", operator: "equals", value: "pending" },
                ],
                logicalOperator: "or",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain(" OR ");
        });

        it("should handle ILIKE operator for PostgreSQL", () => {
            const filters: QueryFilterType = {
                conditions: [{ column: "email", operator: "contains", value: "@example" }],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain("ILIKE");
            expect(result).toContain("%");
        });

        it("should handle LIKE operator for SQLite", () => {
            const filters: QueryFilterType = {
                conditions: [{ column: "email", operator: "contains", value: "@example" }],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.SQLite);
            expect(result).toContain("LIKE");
            expect(result).toContain("COLLATE NOCASE");
        });

        it("should handle IS NULL operator", () => {
            const filters: QueryFilterType = {
                conditions: [{ column: "deleted_at", operator: "is_null" }],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain("IS NULL");
        });

        it("should handle IS NOT NULL operator", () => {
            const filters: QueryFilterType = {
                conditions: [{ column: "deleted_at", operator: "is_not_null" }],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain("IS NOT NULL");
        });

        it("should handle IN operator for PostgreSQL", () => {
            const filters: QueryFilterType = {
                conditions: [
                    { column: "status", operator: "in", value: ["active", "pending", "archived"] },
                ],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain("ANY(ARRAY");
        });

        it("should handle IN operator for SQLite", () => {
            const filters: QueryFilterType = {
                conditions: [
                    { column: "status", operator: "in", value: ["active", "pending", "archived"] },
                ],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.SQLite);
            expect(result).toContain("IN (");
        });

        it("should handle starts_with operator", () => {
            const filters: QueryFilterType = {
                conditions: [{ column: "email", operator: "starts_with", value: "admin" }],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain("admin%");
        });

        it("should handle ends_with operator", () => {
            const filters: QueryFilterType = {
                conditions: [{ column: "email", operator: "ends_with", value: "@example.com" }],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain("%@example.com");
        });

        it("should escape single quotes in values", () => {
            const filters: QueryFilterType = {
                conditions: [{ column: "name", operator: "equals", value: "O'Reilly" }],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain("''");
        });

        it("should filter out conditions with null/undefined values (except null operators)", () => {
            const filters: QueryFilterType = {
                conditions: [
                    { column: "name", operator: "equals", value: null },
                    { column: "email", operator: "equals", value: "test@example.com" },
                ],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain("test@example.com");
            expect(result).not.toContain("name");
        });

        it("should handle table-qualified conditions", () => {
            const filters: QueryFilterType = {
                conditions: [
                    { column: "id", operator: "equals", value: 1, table: "users" },
                ],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.Postgres);
            expect(result).toContain("users");
        });

        it("should handle boolean values for SQLite (converted to 0/1)", () => {
            const filters: QueryFilterType = {
                conditions: [{ column: "is_active", operator: "equals", value: true }],
                logicalOperator: "and",
            };
            const result = buildWhereClause(filters.conditions, filters.logicalOperator, DatabaseDialect.SQLite);
            expect(result).toContain(" = 1");
        });
    });

    describe("buildOrderByClause", () => {
        it("should return empty string when no orderBy specified", () => {
            const result = buildOrderByClause(undefined);
            expect(result).toBe("");
        });

        it("should build ORDER BY clause with ASC direction", () => {
            const result = buildOrderByClause("created_at", "asc");
            expect(result).toContain("ORDER BY");
            expect(result).toContain("created_at");
            expect(result).toContain("ASC");
        });

        it("should build ORDER BY clause with DESC direction", () => {
            const result = buildOrderByClause("created_at", "desc");
            expect(result).toContain("DESC");
        });

        it("should handle NULLS FIRST", () => {
            const result = buildOrderByClause("score", "desc", "first");
            expect(result).toContain("NULLS FIRST");
        });

        it("should handle NULLS LAST", () => {
            const result = buildOrderByClause("score", "asc", "last");
            expect(result).toContain("NULLS LAST");
        });
    });

    describe("buildLimitClause", () => {
        it("should return empty string when no limit specified", () => {
            const result = buildLimitClause(undefined, undefined);
            expect(result).toBe("");
        });

        it("should build LIMIT clause", () => {
            const result = buildLimitClause(50, undefined);
            expect(result).toContain("LIMIT 50");
        });

        it("should build LIMIT and OFFSET clauses", () => {
            const result = buildLimitClause(50, 100);
            expect(result).toContain("LIMIT 50");
            expect(result).toContain("OFFSET 100");
        });

        it("should ignore offset of 0", () => {
            const result = buildLimitClause(50, 0);
            expect(result).toContain("LIMIT 50");
            expect(result).not.toContain("OFFSET");
        });
    });

    describe("generateJoinAliases", () => {
        it("should return empty map for no joins", () => {
            const aliases = generateJoinAliases([]);
            expect(aliases.size).toBe(0);
        });

        it("should use user-provided aliases", () => {
            const joins = [
                {
                    table: "posts",
                    schema: "public",
                    alias: "p",
                    type: "left" as const,
                    joinCondition: {
                        mode: "standard" as const,
                        referencingColumn: "user_id",
                        referencedColumn: "id",
                    },
                    columns: "all" as const,
                },
            ];
            const aliases = generateJoinAliases(joins);
            expect(aliases.get(0)).toBe("p");
        });

        it("should auto-generate aliases for duplicate table joins", () => {
            const joins = [
                {
                    table: "posts",
                    schema: "public",
                    type: "left" as const,
                    joinCondition: {
                        mode: "standard" as const,
                        referencingColumn: "user_id",
                        referencedColumn: "id",
                    },
                    columns: "all" as const,
                },
                {
                    table: "posts",
                    schema: "public",
                    type: "left" as const,
                    joinCondition: {
                        mode: "standard" as const,
                        referencingColumn: "author_id",
                        referencedColumn: "id",
                    },
                    columns: "all" as const,
                },
            ];
            const aliases = generateJoinAliases(joins);
            expect(aliases.get(0)).toBe("posts_1");
            expect(aliases.get(1)).toBe("posts_2");
        });
    });

    describe("buildQuerySql", () => {
        it("should build a simple SELECT query", () => {
            const input = {
                schema: "public",
                table: "users",
                limit: 50,
                offset: 0,
            };
            const result = buildQuerySql(input, DatabaseDialect.Postgres);
            expect(result.sql).toContain("SELECT");
            expect(result.sql).toContain("FROM");
            expect(result.sql).toContain("users");
        });

        it("should include filters in the query", () => {
            const input = {
                schema: "public",
                table: "users",
                filters: {
                    conditions: [
                        {
                            column: "status",
                            operator: "equals" as const,
                            value: "active",
                        },
                    ],
                    logicalOperator: "and" as const,
                },
                limit: 50,
                offset: 0,
            };
            const result = buildQuerySql(input, DatabaseDialect.Postgres);
            expect(result.sql).toContain("WHERE");
            expect(result.sql).toContain("active");
        });

        it("should include ORDER BY clause", () => {
            const input = {
                schema: "public",
                table: "users",
                orderBy: "created_at",
                orderDirection: "desc" as const,
                limit: 50,
                offset: 0,
            };
            const result = buildQuerySql(input, DatabaseDialect.Postgres);
            expect(result.sql).toContain("ORDER BY");
        });

        it("should include LIMIT and OFFSET", () => {
            const input = {
                schema: "public",
                table: "users",
                limit: 25,
                offset: 50,
            };
            const result = buildQuerySql(input, DatabaseDialect.Postgres);
            expect(result.sql).toContain("LIMIT 25");
            expect(result.sql).toContain("OFFSET 50");
        });

        it("should format SQL with proper indentation", () => {
            const input = {
                schema: "public",
                table: "users",
                limit: 50,
                offset: 0,
            };
            const result = buildQuerySql(input, DatabaseDialect.Postgres);
            expect(result.formattedSql).toContain("\n");
        });

        it("should handle SQLite dialect", () => {
            const input = {
                schema: "main",
                table: "users",
                limit: 50,
                offset: 0,
            };
            const result = buildQuerySql(input, DatabaseDialect.SQLite);
            expect(result.sql).toContain("FROM");
            expect(result.sql).toContain("users");
        });

        it("should handle complex filters with multiple conditions", () => {
            const input = {
                schema: "public",
                table: "users",
                filters: {
                    conditions: [
                        {
                            column: "status",
                            operator: "equals" as const,
                            value: "active",
                        },
                        {
                            column: "age",
                            operator: "greater_than" as const,
                            value: 18,
                        },
                    ],
                    logicalOperator: "and" as const,
                },
                limit: 50,
                offset: 0,
            };
            const result = buildQuerySql(input, DatabaseDialect.Postgres);
            expect(result.sql).toContain("WHERE");
            expect(result.sql).toContain("AND");
        });

        it("should handle column selection", () => {
            const input = {
                schema: "public",
                table: "users",
                selectedColumns: ["id", "name", "email"],
                limit: 50,
                offset: 0,
            };
            const result = buildQuerySql(input, DatabaseDialect.Postgres);
            expect(result.sql).toContain("id");
            expect(result.sql).toContain("name");
            expect(result.sql).toContain("email");
        });

        it("should handle NULLS FIRST/LAST ordering", () => {
            const input = {
                schema: "public",
                table: "users",
                orderBy: "score",
                orderDirection: "desc" as const,
                nullsOrder: "first" as const,
                limit: 50,
                offset: 0,
            };
            const result = buildQuerySql(input, DatabaseDialect.Postgres);
            expect(result.sql).toContain("NULLS FIRST");
        });
    });
});
