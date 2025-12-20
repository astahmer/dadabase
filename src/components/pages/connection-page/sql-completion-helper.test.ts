import { describe, expect, it } from "vitest";
import {
	createColumnCompletion,
	createTableCompletion,
	detectCompletionContext,
	getContextualKeywords,
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
				expect(context.selectedTables).toContain("users");
			});

			it("should extract multiple tables from multiple JOINs", () => {
				const sql =
					"SELECT * FROM users JOIN orders ON users.id = orders.user_id";
				const context = detectCompletionContext(sql, sql.length);
				expect(context.selectedTables).toContain("users");
				expect(context.selectedTables).toContain("orders");
			});

			it("should extract quoted table names", () => {
				const sql = 'SELECT * FROM "user_data" JOIN "order_history"';
				const context = detectCompletionContext(sql, sql.length);
				expect(context.selectedTables).toContain("user_data");
				expect(context.selectedTables).toContain("order_history");
			});

			it("should extract tables from LEFT JOIN", () => {
				const sql =
					'SELECT * FROM "users" LEFT JOIN "orders" ON "users"."id" = "orders"."user_id"';
				const context = detectCompletionContext(sql, sql.length);
				expect(context.selectedTables).toContain("users");
				expect(context.selectedTables).toContain("orders");
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
				selectedTables: ["users"],
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
				selectedTables: ["users"],
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
	});
});
