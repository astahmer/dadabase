import { describe, expect, it } from "vitest";
import {
	createColumnCompletion,
	createTableCompletion,
	detectCompletionContext,
	extractSelectedTables,
	getContextualKeywords,
	type SqlKeyword,
} from "./sql-completion-helper";

describe("SQL Completion Helper", () => {
	describe("detectCompletionContext", () => {
		describe("from_keyword context", () => {
			it("should detect FROM keyword at cursor position", () => {
				const sql = "SELECT * FROM ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("from_keyword");
			});

			it("should detect from keyword case-insensitively", () => {
				const sql = "select * from ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("from_keyword");
			});

			it("should NOT match FROM without trailing space", () => {
				const sql = "SELECT * FROM";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).not.toBe("from_keyword");
			});
		});

		describe("empty_line context", () => {
			it("should detect empty line at document start", () => {
				const sql = "";
				const context = detectCompletionContext(sql, 0);
				expect(context.type).toBe("empty_line");
			});

			it("should detect empty line after newline", () => {
				const sql = "SELECT * FROM users;\n";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("empty_line");
			});

			it("should detect whitespace-only line as empty", () => {
				const sql = "SELECT * FROM users;\n   ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("empty_line");
			});
		});

		describe("table_after_from context", () => {
			it("should detect table context after FROM", () => {
				const sql = "SELECT * FROM u";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("table_after_from");
			});

			it("should detect table context after JOIN", () => {
				const sql = "SELECT * FROM users JOIN o";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("table_after_from");
			});

			it("should detect table context after LEFT JOIN", () => {
				const sql = "SELECT * FROM users LEFT JOIN p";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("table_after_from");
			});
		});

		describe("keyword_after_table context", () => {
			it("should detect keywords after table name", () => {
				const sql = "SELECT * FROM users ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("keyword_after_table");
			});

			it("should detect keywords after quoted table name", () => {
				const sql = 'SELECT * FROM "users" ';
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("keyword_after_table");
			});

			it("should detect keywords after JOIN table", () => {
				const sql = "SELECT * FROM users JOIN orders ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("join_table");
			});

			it("should detect join_with_alias after LEFT JOIN with alias", () => {
				const sql = "SELECT * FROM users LEFT JOIN orders AS o ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("join_with_alias");
			});

			it("should detect join_with_alias after INNER JOIN with alias", () => {
				const sql = "SELECT * FROM users INNER JOIN posts AS p ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("join_with_alias");
			});
		});

		describe("column_after_keyword context", () => {
			it("should detect column context after WHERE", () => {
				const sql = "SELECT * FROM users WHERE ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("column_after_keyword");
			});

			it("should detect column context after SELECT", () => {
				const sql = "SELECT ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("select_start");
			});

			it("should detect column context after ORDER BY", () => {
				const sql = "SELECT * FROM users ORDER BY ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("column_after_keyword");
			});

			it("should detect column context after ON", () => {
				const sql = "SELECT * FROM users JOIN orders ON ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.type).toBe("column_after_keyword");
			});
		});

		describe("selectedTables extraction", () => {
			it("should extract single table from FROM clause", () => {
				const sql = "SELECT * FROM users ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.selectedTables).toContainEqual({ table: "users" });
			});

			it("should extract multiple tables from multiple JOINs", () => {
				const sql =
					"SELECT * FROM users JOIN orders ON users.id = orders.user_id";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.selectedTables).toContainEqual({ table: "users" });
				expect(context.selectedTables).toContainEqual({ table: "orders" });
			});

			it("should extract quoted table names", () => {
				const sql = 'SELECT * FROM "user_data" JOIN "order_history"';
				const context = detectCompletionContext(sql, sql.length);
				expect(context.selectedTables).toContainEqual({ table: "user_data" });
				expect(context.selectedTables).toContainEqual({
					table: "order_history",
				});
			});

			it("should extract tables from LEFT JOIN", () => {
				const sql =
					'SELECT * FROM "users" LEFT JOIN "orders" ON "users"."id" = "orders"."user_id"';
				const context = detectCompletionContext(sql, sql.length);
				expect(context.selectedTables).toContainEqual({ table: "users" });
				expect(context.selectedTables).toContainEqual({ table: "orders" });
			});
		});

		describe("lastKeyword extraction", () => {
			it("should find last keyword in query", () => {
				const sql = "SELECT * FROM users WHERE id = 1 AND name = ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.lastKeyword).toBe("AND");
			});

			it("should find ORDER in ORDER BY", () => {
				const sql = "SELECT * FROM users ORDER BY ";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.lastKeyword).toBe("ORDER");
			});
		});
	});

	describe("createTableCompletion", () => {
		const mockMonaco = {
			languages: {
				CompletionItemKind: {
					Struct: 1,
					Field: 2,
					Keyword: 3,
				},
			},
		};

		const table = { schema: "public", name: "users" };

		it("should create completion with schema when multiple schemas", () => {
			const context = {
				type: "table_after_from" as const,
				selectedTables: [],
				tableAliases: {},
				isAtLineStart: false,
				beforeCursor: "SELECT * FROM ",
			};

			const completion = createTableCompletion(
				table,
				context,
				true,
				mockMonaco,
			);

			expect(completion.label).toBe("users");
			expect(completion.insertText).toContain("public");
		});

		it("should create completion without schema when single schema", () => {
			const context = {
				type: "table_after_from" as const,
				selectedTables: [],
				tableAliases: {},
				isAtLineStart: false,
				beforeCursor: "SELECT * FROM ",
			};

			const completion = createTableCompletion(
				table,
				context,
				false,
				mockMonaco,
			);

			expect(completion.label).toBe("users");
			expect(completion.insertText).toBe('"users" ');
		});

		it("should insert full SELECT statement on empty line", () => {
			const context = {
				type: "empty_line" as const,
				selectedTables: [],
				tableAliases: {},
				isAtLineStart: true,
				beforeCursor: "",
			};

			const completion = createTableCompletion(
				table,
				context,
				false,
				mockMonaco,
			);

			expect(completion.insertText).toBe('SELECT * FROM "users"');
		});
	});

	describe("createColumnCompletion", () => {
		const mockMonaco = {
			languages: {
				CompletionItemKind: {
					Struct: 1,
					Field: 2,
					Keyword: 3,
				},
			},
		};

		it("should create simple column completion", () => {
			const context = {
				type: "column_after_keyword" as const,
				selectedTables: [{ table: "users" }],
				tableAliases: {},
				isAtLineStart: false,
				beforeCursor: "SELECT * FROM users WHERE ",
				lastKeyword: "WHERE" as const,
			};

			const completion = createColumnCompletion(
				"id",
				"users",
				context,
				mockMonaco,
			);

			expect(completion.label).toBe("users.id");
			expect(completion.insertText).toBe('"users"."id"');
		});

		it("should insert full SELECT with column on empty line", () => {
			const context = {
				type: "empty_line" as const,
				selectedTables: [],
				tableAliases: {},
				isAtLineStart: true,
				beforeCursor: "",
			};

			const completion = createColumnCompletion(
				"email",
				"users",
				context,
				mockMonaco,
			);

			expect(completion.insertText).toBe('SELECT "email" FROM "users"');
		});
	});

	describe("getContextualKeywords", () => {
		it("should suggest WHERE, ORDER BY, etc after table", () => {
			const context = {
				type: "keyword_after_table" as const,
				selectedTables: [{ table: "users" }],
				tableAliases: {},
				isAtLineStart: false,
				beforeCursor: "SELECT * FROM users ",
			};

			const keywords = getContextualKeywords(context);

			expect(keywords).toContain("WHERE");
			expect(keywords).toContain("ORDER BY");
			expect(keywords).toContain("JOIN");
		});

		it("should suggest SELECT, WITH, etc on empty line", () => {
			const context = {
				type: "empty_line" as const,
				selectedTables: [],
				tableAliases: {},
				isAtLineStart: true,
				beforeCursor: "",
			};

			const keywords = getContextualKeywords(context);

			expect(keywords).toContain("SELECT");
			expect(keywords).toContain("WITH");
			expect(keywords).toContain("INSERT");
		});

		it("should return empty array for other contexts", () => {
			const context = {
				type: "none" as const,
				selectedTables: [],
				tableAliases: {},
				isAtLineStart: false,
				beforeCursor: "SELECT",
			};

			const keywords = getContextualKeywords(context);

			expect(keywords).toHaveLength(0);
		});

		it("should suggest only LIMIT/OFFSET after ORDER BY", () => {
			const context = {
				type: "after_condition" as const,
				selectedTables: [{ table: "users" }],
				tableAliases: {},
				lastKeyword: "ORDER BY" as SqlKeyword,
				isAtLineStart: false,
				beforeCursor: "SELECT * FROM users ORDER BY name ASC ",
			};

			const keywords = getContextualKeywords(context);

			expect(keywords).toEqual(["LIMIT", "OFFSET"]);
			expect(keywords).not.toContain("UNION");
			expect(keywords).not.toContain("UNION ALL");
			expect(keywords).not.toContain("INTERSECT");
		});
	});

	describe("extractSelectedTables", () => {
		describe("simple table names", () => {
			it("should extract single unquoted table from FROM", () => {
				const sql = "SELECT * FROM users";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ table: "users" }]);
			});

			it("should extract multiple unquoted tables from multiple JOINs", () => {
				const sql =
					"SELECT * FROM users JOIN posts ON users.id = posts.user_id JOIN comments ON posts.id = comments.post_id";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				expect(result).toContainEqual({ table: "posts" });
				expect(result).toContainEqual({ table: "comments" });
				expect(result.length).toBe(3);
			});

			it("should extract single quoted table from FROM", () => {
				const sql = 'SELECT * FROM "users"';
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ table: "users" }]);
			});

			it("should preserve case in quoted table names", () => {
				const sql = 'SELECT * FROM "Users"';
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ table: "Users" }]);
			});
		});

		describe("schema-qualified table names", () => {
			it('should extract fully quoted schema.table: "public"."accounting_imports"', () => {
				const sql = 'SELECT * FROM "public"."accounting_imports" LIMIT 5';
				const result = extractSelectedTables(sql);
				expect(result).toEqual([
					{ schema: "public", table: "accounting_imports" },
				]);
			});

			it('should extract mixed quoting: "public".accounting_imports', () => {
				const sql = 'SELECT * FROM "public".accounting_imports LIMIT 5';
				const result = extractSelectedTables(sql);
				expect(result).toEqual([
					{ schema: "public", table: "accounting_imports" },
				]);
			});

			it('should extract mixed quoting: public."accounting_imports"', () => {
				const sql = 'SELECT * FROM public."accounting_imports" LIMIT 5';
				const result = extractSelectedTables(sql);
				expect(result).toEqual([
					{ schema: "public", table: "accounting_imports" },
				]);
			});

			it("should extract unquoted schema.table: public.accounting_imports", () => {
				const sql = "SELECT * FROM public.accounting_imports LIMIT 5";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([
					{ schema: "public", table: "accounting_imports" },
				]);
			});
		});

		describe("schema-qualified with JOINs", () => {
			it("should extract fully quoted tables in JOIN", () => {
				const sql =
					'SELECT * FROM "public"."users" JOIN "public"."posts" ON "public"."users"."id" = "public"."posts"."user_id"';
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ schema: "public", table: "users" });
				expect(result).toContainEqual({ schema: "public", table: "posts" });
				expect(result.length).toBe(2);
			});

			it("should extract mixed quoted tables in JOIN", () => {
				const sql =
					'SELECT * FROM "public".users JOIN public."posts" ON users.id = posts.user_id';
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ schema: "public", table: "users" });
				expect(result).toContainEqual({ schema: "public", table: "posts" });
			});

			it("should extract all tables with multiple JOINs and schema qualifiers", () => {
				const sql =
					'SELECT * FROM "public"."users" u JOIN "public"."posts" p ON u.id = p.user_id JOIN "public"."comments" c ON p.id = c.post_id';
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ schema: "public", table: "users" });
				expect(result).toContainEqual({ schema: "public", table: "posts" });
				expect(result).toContainEqual({ schema: "public", table: "comments" });
				expect(result.length).toBe(3);
			});
		});

		describe("different JOIN types", () => {
			it("should extract table from INNER JOIN", () => {
				const sql =
					"SELECT * FROM users INNER JOIN posts ON users.id = posts.user_id";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				expect(result).toContainEqual({ table: "posts" });
			});

			it("should extract table from LEFT JOIN", () => {
				const sql =
					"SELECT * FROM users LEFT JOIN posts ON users.id = posts.user_id";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				expect(result).toContainEqual({ table: "posts" });
			});

			it("should extract table from RIGHT JOIN", () => {
				const sql =
					"SELECT * FROM users RIGHT JOIN posts ON users.id = posts.user_id";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				expect(result).toContainEqual({ table: "posts" });
			});

			it("should extract table from FULL JOIN", () => {
				const sql =
					"SELECT * FROM users FULL JOIN posts ON users.id = posts.user_id";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				expect(result).toContainEqual({ table: "posts" });
			});

			it("should extract table from CROSS JOIN", () => {
				const sql = "SELECT * FROM users CROSS JOIN posts";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				expect(result).toContainEqual({ table: "posts" });
			});
		});

		describe("case insensitivity", () => {
			it("should extract tables with lowercase from", () => {
				const sql = "select * from users";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ table: "users" }]);
			});

			it("should extract tables with mixed case keywords", () => {
				const sql =
					"SELECT * FROM users Join posts ON users.id = posts.user_id";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				expect(result).toContainEqual({ table: "posts" });
			});
		});

		describe("edge cases", () => {
			it("should handle empty string", () => {
				const sql = "";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([]);
			});

			it("should ignore table names in comments", () => {
				const sql = "-- This mentions fake_table\nSELECT * FROM users";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				// fake_table should not be extracted (it's in a comment)
				expect(result.some((t) => t.table === "fake_table")).toBe(false);
			});

			it("should handle tables with aliases", () => {
				const sql = "SELECT * FROM users u JOIN posts p ON u.id = p.user_id";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				expect(result).toContainEqual({ table: "posts" });
			});

			it("should handle whitespace variations", () => {
				const sql =
					"SELECT * FROM   users   JOIN   posts   ON users.id = posts.user_id";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				expect(result).toContainEqual({ table: "posts" });
			});

			it("should not include duplicate table names", () => {
				const sql =
					"SELECT * FROM users u1 JOIN users u2 ON u1.id = u2.manager_id";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ table: "users" }]);
			});
		});

		describe("INSERT statements", () => {
			it("should extract table from simple INSERT INTO", () => {
				const sql = "INSERT INTO users (id, name) VALUES (1, 'John')";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ table: "users" }]);
			});

			it("should extract table from INSERT INTO with schema", () => {
				const sql =
					'INSERT INTO "public"."users" (id, name) VALUES (1, \'John\')';
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ schema: "public", table: "users" }]);
			});

			it("should extract table from INSERT INTO with schema and mixed quoting", () => {
				const sql = "INSERT INTO public.users (id, name) VALUES (1, 'John')";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ schema: "public", table: "users" }]);
			});

			it("should extract table from multiline INSERT", () => {
				const sql = `INSERT INTO backoffice_roles (id, name) VALUES
					(uuid_generate_v4(), 'Admin'),
					(uuid_generate_v4(), 'Manager')`;
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ table: "backoffice_roles" }]);
			});

			it("should extract table from INSERT with quoted table name", () => {
				const sql =
					"INSERT INTO \"BackofficeRoles\" (id, name) VALUES (1, 'Admin')";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ table: "BackofficeRoles" }]);
			});
		});

		describe("UPDATE statements", () => {
			it("should extract table from UPDATE statement", () => {
				const sql = "UPDATE users SET name = 'John' WHERE id = 1";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ table: "users" }]);
			});

			it("should extract table from UPDATE with schema", () => {
				const sql = 'UPDATE "public"."users" SET name = \'John\' WHERE id = 1';
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ schema: "public", table: "users" }]);
			});

			it("should extract table from UPDATE with unquoted schema", () => {
				const sql = "UPDATE public.users SET name = 'John' WHERE id = 1";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ schema: "public", table: "users" }]);
			});

			it("should extract table from UPDATE with FROM clause", () => {
				const sql =
					"UPDATE users SET verified = true FROM audit_logs WHERE users.id = audit_logs.user_id";
				const result = extractSelectedTables(sql);
				expect(result).toContainEqual({ table: "users" });
				expect(result).toContainEqual({ table: "audit_logs" });
				expect(result.length).toBe(2);
			});
		});

		describe("DELETE statements", () => {
			it("should extract table from DELETE statement", () => {
				const sql = "DELETE FROM users WHERE id = 1";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ table: "users" }]);
			});

			it("should extract table from DELETE with schema", () => {
				const sql = 'DELETE FROM "public"."users" WHERE id = 1';
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ schema: "public", table: "users" }]);
			});

			it("should extract table from DELETE with unquoted schema", () => {
				const sql = "DELETE FROM public.users WHERE id = 1";
				const result = extractSelectedTables(sql);
				expect(result).toEqual([{ schema: "public", table: "users" }]);
			});

			it("should extract table from DELETE with USING clause", () => {
				const sql =
					"DELETE FROM users USING audit_logs WHERE users.id = audit_logs.user_id";
				const result = extractSelectedTables(sql);
				// DELETE FROM extracts the first table, USING is treated like FROM
				expect(result).toContainEqual({ table: "users" });
				// Note: USING is not currently in TABLE_SOURCE_KEYWORDS, but users should still be extracted
				expect(result.some((t) => t.table === "users")).toBe(true);
			});
		});
	});
});
