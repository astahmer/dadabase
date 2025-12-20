import { describe, it, expect } from "vitest";
import {
    parseSqlContext,
    type SqlContext,
} from "./sql-context-parser";

describe("parseSqlContext", () => {
    describe("table context detection", () => {
        it("should detect table context after FROM", () => {
            const result = parseSqlContext("SELECT * FROM ", 14);
            expect(result.type).toBe("table");
            expect(result).toHaveProperty("keyword", "FROM");
        });

        it("should detect table context after JOIN", () => {
            const result = parseSqlContext("SELECT * FROM t1 JOIN ", 22);
            expect(result.type).toBe("table");
            expect(result).toHaveProperty("keyword", "JOIN");
        });

        it("should detect table context after INNER JOIN", () => {
            const result = parseSqlContext("SELECT * FROM t1 INNER JOIN ", 28);
            expect(result.type).toBe("table");
            expect(result).toHaveProperty("keyword", "INNER JOIN");
        });

        it("should detect table context after LEFT JOIN", () => {
            const result = parseSqlContext("SELECT * FROM t1 LEFT JOIN ", 27);
            expect(result.type).toBe("table");
            expect(result).toHaveProperty("keyword", "LEFT JOIN");
        });

        it("should detect table context after RIGHT JOIN", () => {
            const result = parseSqlContext("SELECT * FROM t1 RIGHT JOIN ", 28);
            expect(result.type).toBe("table");
            expect(result).toHaveProperty("keyword", "RIGHT JOIN");
        });

        it("should detect table context after FULL JOIN", () => {
            const result = parseSqlContext("SELECT * FROM t1 FULL JOIN ", 27);
            expect(result.type).toBe("table");
            expect(result).toHaveProperty("keyword", "FULL JOIN");
        });

        it("should detect table context after CROSS JOIN", () => {
            const result = parseSqlContext("SELECT * FROM t1 CROSS JOIN ", 28);
            expect(result.type).toBe("table");
            expect(result).toHaveProperty("keyword", "CROSS JOIN");
        });

        it("should detect table context with partial table name", () => {
            const result = parseSqlContext("SELECT * FROM user", 18);
            expect(result.type).toBe("table");
        });

        it("should handle case-insensitive FROM keyword", () => {
            const result = parseSqlContext("SELECT * from ", 14);
            expect(result.type).toBe("table");
        });

        it("should handle multiple spaces after FROM", () => {
            const result = parseSqlContext("SELECT * FROM   ", 16);
            expect(result.type).toBe("table");
        });
    });

    describe("column context detection", () => {
        it("should detect column context after SELECT", () => {
            const result = parseSqlContext("SELECT ", 7);
            expect(result.type).toBe("column");
            expect(result).toHaveProperty("tableNames");
        });

        it("should detect column context after WHERE", () => {
            const result = parseSqlContext("SELECT * FROM users WHERE ", 26);
            expect(result.type).toBe("column");
        });

        it("should detect column context after ON", () => {
            const result = parseSqlContext(
                "SELECT * FROM users JOIN posts ON ",
                34
            );
            expect(result.type).toBe("column");
        });

        it("should detect column context after ORDER BY", () => {
            const result = parseSqlContext(
                "SELECT * FROM users ORDER BY ",
                30
            );
            expect(result.type).toBe("column");
        });

        it("should detect column context after GROUP BY", () => {
            const result = parseSqlContext(
                "SELECT * FROM users GROUP BY ",
                30
            );
            expect(result.type).toBe("column");
        });

        it("should handle case-insensitive SELECT keyword", () => {
            const result = parseSqlContext("select ", 7);
            expect(result.type).toBe("column");
        });

        it("should extract table names for column context", () => {
            const result = parseSqlContext(
                'SELECT * FROM "users" WHERE ',
                28
            );
            expect(result.type).toBe("column");
            if (result.type === "column") {
                expect(result.tableNames).toContain("users");
            }
        });

        it("should extract multiple table names", () => {
            const result = parseSqlContext(
                'SELECT * FROM "users" JOIN "posts" WHERE ',
                42
            );
            expect(result.type).toBe("column");
            if (result.type === "column") {
                expect(result.tableNames).toContain("users");
                expect(result.tableNames).toContain("posts");
            }
        });

        it("should extract schema-qualified table names", () => {
            const result = parseSqlContext(
                'SELECT * FROM "public"."users" WHERE ',
                38
            );
            expect(result.type).toBe("column");
            if (result.type === "column") {
                expect(result.tableNames).toContain("public.users");
            }
        });
    });

    describe("no context detection", () => {
        it("should return no context at start of query", () => {
            const result = parseSqlContext("SE", 2);
            expect(result.type).toBe("none");
        });

        it("should return no context in middle of keyword", () => {
            const result = parseSqlContext("SELECT", 3);
            expect(result.type).toBe("none");
        });

        it("should return no context with unknown text", () => {
            const result = parseSqlContext("xyz abc def", 11);
            expect(result.type).toBe("none");
        });
    });

    describe("edge cases", () => {
        it("should handle empty string", () => {
            const result = parseSqlContext("", 0);
            expect(result.type).toBe("none");
        });

        it("should handle cursor at position 0", () => {
            const result = parseSqlContext("SELECT * FROM users", 0);
            expect(result.type).toBe("none");
        });

        it("should handle quoted identifiers in table names", () => {
            const result = parseSqlContext(
                'SELECT * FROM "user_table" WHERE ',
                34
            );
            expect(result.type).toBe("column");
            if (result.type === "column") {
                expect(result.tableNames).toContain("user_table");
            }
        });

        it("should handle quoted identifiers with spaces", () => {
            const result = parseSqlContext(
                'SELECT * FROM "user table" WHERE ',
                34
            );
            expect(result.type).toBe("column");
            if (result.type === "column") {
                expect(result.tableNames).toContain("user table");
            }
        });

        it("should handle unquoted table names", () => {
            const result = parseSqlContext(
                "SELECT * FROM public.users WHERE ",
                34
            );
            expect(result.type).toBe("column");
            if (result.type === "column") {
                expect(result.tableNames).toContain("public.users");
            }
        });

        it("should handle mixed quoted and unquoted tables", () => {
            const result = parseSqlContext(
                'SELECT * FROM "public".users WHERE ',
                36
            );
            expect(result.type).toBe("column");
            if (result.type === "column") {
                expect(result.tableNames).toContain("public.users");
            }
        });

        it("should handle multiple spaces between keywords", () => {
            const result = parseSqlContext("SELECT   *   FROM   users   WHERE   ", 36);
            expect(result.type).toBe("column");
        });

        it("should not match partial keywords", () => {
            const result = parseSqlContext("SELECTFROM users", 16);
            expect(result.type).toBe("none");
        });

        it("should handle semicolon at end of query", () => {
            const result = parseSqlContext(
                'SELECT * FROM "users" WHERE ;',
                29
            );
            expect(result.type).toBe("column");
        });

        it("should handle newlines in query", () => {
            const sql = `SELECT *
FROM users
WHERE `;
            const result = parseSqlContext(sql, sql.length);
            expect(result.type).toBe("column");
        });

        it("should handle tabs in query", () => {
            const sql = "SELECT\t*\tFROM\tusers\tWHERE\t";
            const result = parseSqlContext(sql, sql.length);
            expect(result.type).toBe("column");
        });
    });

    describe("complex queries", () => {
        it("should handle query with multiple JOINs", () => {
            const sql = `SELECT u.id, p.title
FROM users u
JOIN posts p ON u.id = p.user_id
JOIN comments c ON p.id = c.post_id
WHERE `;
            const result = parseSqlContext(sql, sql.length);
            expect(result.type).toBe("column");
            if (result.type === "column") {
                expect(result.tableNames.length).toBeGreaterThanOrEqual(3);
            }
        });

        it("should detect table context in nested query", () => {
            const sql = "SELECT * FROM (SELECT * FROM users) AS u JOIN ";
            const result = parseSqlContext(sql, sql.length);
            expect(result.type).toBe("table");
        });

        it("should handle SELECT with alias after table", () => {
            const sql = 'SELECT * FROM "users" u WHERE ';
            const result = parseSqlContext(sql, sql.length);
            expect(result.type).toBe("column");
            if (result.type === "column") {
                expect(result.tableNames).toContain("users");
            }
        });

        it("should handle ORDER BY with multiple columns", () => {
            const sql = "SELECT * FROM users ORDER BY name, ";
            const result = parseSqlContext(sql, sql.length);
            expect(result.type).toBe("column");
        });
    });

    describe("return type validation", () => {
        it("should return correct SqlContext type for table", () => {
            const result = parseSqlContext("SELECT * FROM ", 14);
            expect(result).toHaveProperty("type");
            expect(result.type).toBe("table");
            if (result.type === "table") {
                expect(result).toHaveProperty("keyword");
                expect(typeof result.keyword).toBe("string");
            }
        });

        it("should return correct SqlContext type for column", () => {
            const result = parseSqlContext("SELECT ", 7);
            expect(result).toHaveProperty("type");
            expect(result.type).toBe("column");
            if (result.type === "column") {
                expect(result).toHaveProperty("tableNames");
                expect(Array.isArray(result.tableNames)).toBe(true);
            }
        });

        it("should return correct SqlContext type for none", () => {
            const result = parseSqlContext("abc def ghi", 11);
            expect(result).toHaveProperty("type");
            expect(result.type).toBe("none");
        });
    });
});
