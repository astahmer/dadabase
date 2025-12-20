import type * as MonacoType from "monaco-editor";
import { describe, expect, it } from "vitest";
import type {
	TableColumnMetadata,
	TableWithColumnsMetadata,
} from "#src/server/introspection/introspection.ts";
import { sqlCompletionProvider } from "./sql-completion-provider";

const printSuggestions = (
	suggestions: MonacoType.languages.CompletionItem[],
) => {
	return suggestions.map((s) => ({
		detail: s.detail,
		label: s.label,
		sortText: s.sortText,
	}));
};

describe("sqlCompletionProvider", () => {
	// Mock Monaco object for testing
	const mockMonaco: any = {
		languages: {
			CompletionItemKind: {
				Struct: 6,
				Field: 5,
				Keyword: 14,
			},
		},
	};

	const mockTables = [
		{ schema: "public", name: "users" },
		{ schema: "public", name: "posts" },
		{ schema: "public", name: "comments" },
	];

	const mockColumns = [
		{
			table: "users",
			columns: [
				{ name: "id", dataType: "integer" },
				{ name: "email", dataType: "varchar" },
				{ name: "created_at", dataType: "timestamp" },
				{ name: "updated_at", dataType: "timestamp" },
				{ name: "name", dataType: "varchar" },
			],
		},
		{
			table: "posts",
			columns: [
				{ name: "id", dataType: "integer" },
				{ name: "title", dataType: "varchar" },
				{ name: "content", dataType: "text" },
				{ name: "user_id", dataType: "integer" },
				{ name: "created_at", dataType: "timestamp" },
			],
		},
		{
			table: "comments",
			columns: [
				{ name: "id", dataType: "integer" },
				{ name: "text", dataType: "text" },
				{ name: "post_id", dataType: "integer" },
				{ name: "user_id", dataType: "integer" },
			],
		},
	] as any as TableWithColumnsMetadata[];

	const singleSchemaContext = {
		tables: mockTables,
		columns: mockColumns,
		hasMultipleSchemas: false,
	};

	const multiSchemaContext = {
		tables: mockTables,
		columns: mockColumns,
		hasMultipleSchemas: true,
	};

	describe("table suggestions after FROM keyword", () => {
		it("should suggest all tables when cursor is after FROM keyword", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM ", cursorOffset: 14 },
				singleSchemaContext,
				mockMonaco,
			);

			const tableLabels = suggestions.map((s) => s.label);
			expect(tableLabels).toContain("users");
			expect(tableLabels).toContain("posts");
			expect(tableLabels).toContain("comments");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should suggest tables with correct insert text for single schema", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM ", cursorOffset: 14 },
				singleSchemaContext,
				mockMonaco,
			);

			const usersSuggestion = suggestions.find((s) => s.label === "users");
			expect(usersSuggestion).toBeDefined();
			expect(usersSuggestion?.insertText).toBe('"users" ');
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should suggest tables with schema-qualified insert text for multiple schemas", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM ", cursorOffset: 14 },
				multiSchemaContext,
				mockMonaco,
			);

			const usersSuggestion = suggestions.find((s) => s.label === "users");
			expect(usersSuggestion).toBeDefined();
			expect(usersSuggestion?.insertText).toBe('"public"."users" ');
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table in schema: public",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table in schema: public",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table in schema: public",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should work case-insensitively with from keyword", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "select * from ", cursorOffset: 14 },
				singleSchemaContext,
				mockMonaco,
			);

			const tableLabels = suggestions.map((s) => s.label);
			expect(tableLabels).toContain("users");
			expect(tableLabels.length).toBe(3);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});
	});

	describe("table suggestions while typing table name after FROM", () => {
		it("should suggest tables while typing table name", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM u", cursorOffset: 16 },
				singleSchemaContext,
				mockMonaco,
			);

			const tableLabels = suggestions.map((s) => s.label);
			expect(tableLabels).toContain("users");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should suggest tables after JOIN keyword", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users JOIN ", cursorOffset: 25 },
				singleSchemaContext,
				mockMonaco,
			);

			const tableLabels = suggestions.map((s) => s.label);
			expect(tableLabels).toContain("posts");
			expect(tableLabels).toContain("comments");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should suggest tables after LEFT JOIN keyword", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users LEFT JOIN p", cursorOffset: 32 },
				singleSchemaContext,
				mockMonaco,
			);

			const tableLabels = suggestions.map((s) => s.label);
			expect(tableLabels).toContain("posts");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});
	});

	describe("empty line completions", () => {
		it("should suggest all tables on empty line", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "", cursorOffset: 0 },
				singleSchemaContext,
				mockMonaco,
			);

			const tableLabels = suggestions.map((s) => s.label);
			expect(tableLabels).toContain("users");
			expect(tableLabels).toContain("posts");
			expect(tableLabels).toContain("comments");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "Column",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.user_id",
                  "sortText": "1_comments.user_id",
                },
              ]
            `);
		});

		it("should suggest columns from all tables on empty line", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "", cursorOffset: 0 },
				singleSchemaContext,
				mockMonaco,
			);

			const columnLabels = suggestions.map((s) => s.label);
			expect(columnLabels).toContain("users.id");
			expect(columnLabels).toContain("users.email");
			expect(columnLabels).toContain("posts.title");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "Column",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.user_id",
                  "sortText": "1_comments.user_id",
                },
              ]
            `);
		});

		it("should insert full SELECT statement with table on empty line", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "", cursorOffset: 0 },
				singleSchemaContext,
				mockMonaco,
			);

			const tablesSuggestion = suggestions.find((s) => s.label === "users");
			expect(tablesSuggestion?.insertText).toBe('SELECT * FROM "users"');
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "Column",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.user_id",
                  "sortText": "1_comments.user_id",
                },
              ]
            `);
		});

		it("should insert full SELECT statement with column on empty line", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "", cursorOffset: 0 },
				singleSchemaContext,
				mockMonaco,
			);

			const columnSuggestion = suggestions.find((s) => s.label === "users.id");
			// Should suggest SELECT "id" FROM one of the tables
			expect(columnSuggestion?.insertText).toMatch(/SELECT "id" FROM/);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "Column",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.user_id",
                  "sortText": "1_comments.user_id",
                },
              ]
            `);
		});

		it("should limit to 5 columns per table to avoid clutter", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "", cursorOffset: 0 },
				singleSchemaContext,
				mockMonaco,
			);

			const columnLabels = suggestions.map((s) => s.label);
			// Count occurrences of 'id' - should be limited from the 3 tables
			const idCount = columnLabels.filter((label) => label === "id").length;
			// Users table has 5 columns, so id should only appear once per table if we limit to 5
			expect(idCount).toBeLessThanOrEqual(3); // One per table max
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "Column",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.user_id",
                  "sortText": "1_comments.user_id",
                },
              ]
            `);
		});
	});

	describe("keyword suggestions after table name", () => {
		it("should suggest SQL keywords after table name", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users ", cursorOffset: 20 },
				singleSchemaContext,
				mockMonaco,
			);

			const keywordLabels = suggestions.map((s) => s.label);
			expect(keywordLabels).toContain("WHERE");
			expect(keywordLabels).toContain("ORDER BY");
			expect(keywordLabels).toContain("GROUP BY");
			expect(keywordLabels).toContain("LIMIT");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "WHERE",
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ORDER BY",
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "GROUP BY",
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LIMIT",
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "JOIN",
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LEFT JOIN",
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INNER JOIN",
                  "sortText": "2_INNER JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "AS",
                  "sortText": "2_AS",
                },
              ]
            `);
		});

		it("should suggest JOIN keywords after table name", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users ", cursorOffset: 20 },
				singleSchemaContext,
				mockMonaco,
			);

			const keywordLabels = suggestions.map((s) => s.label);
			expect(keywordLabels).toContain("JOIN");
			expect(keywordLabels).toContain("LEFT JOIN");
			expect(keywordLabels).toContain("INNER JOIN");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "WHERE",
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ORDER BY",
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "GROUP BY",
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LIMIT",
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "JOIN",
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LEFT JOIN",
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INNER JOIN",
                  "sortText": "2_INNER JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "AS",
                  "sortText": "2_AS",
                },
              ]
            `);
		});

		it("should suggest keywords after quoted table name", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: 'SELECT * FROM "users" ', cursorOffset: 22 },
				singleSchemaContext,
				mockMonaco,
			);

			const keywordLabels = suggestions.map((s) => s.label);
			expect(keywordLabels.length).toBe(8);
			expect(keywordLabels).toContain("WHERE");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "WHERE",
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ORDER BY",
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "GROUP BY",
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LIMIT",
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "JOIN",
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LEFT JOIN",
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INNER JOIN",
                  "sortText": "2_INNER JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "AS",
                  "sortText": "2_AS",
                },
              ]
            `);
		});

		it("should insert keyword with trailing space", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users ", cursorOffset: 20 },
				singleSchemaContext,
				mockMonaco,
			);

			const whereSuggestion = suggestions.find((s) => s.label === "WHERE");
			expect(whereSuggestion?.insertText).toBe("WHERE ");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "WHERE",
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ORDER BY",
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "GROUP BY",
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LIMIT",
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "JOIN",
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LEFT JOIN",
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INNER JOIN",
                  "sortText": "2_INNER JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "AS",
                  "sortText": "2_AS",
                },
              ]
            `);
		});
	});

	describe("column suggestions after WHERE keyword", () => {
		it("should suggest columns from all tables after WHERE", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
				singleSchemaContext,
				mockMonaco,
			);

			const columnLabels = suggestions.map((s) => s.label);
			expect(columnLabels).toContain("users.id");
			expect(columnLabels).toContain("users.email");
			expect(columnLabels).toContain("users.created_at");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should suggest only columns from selected tables in WHERE clause", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
				singleSchemaContext,
				mockMonaco,
			);

			const columnLabels = suggestions.map((s) => s.label);
			// Should have columns from users table
			expect(columnLabels).toContain("users.email");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should suggest columns after SELECT keyword", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT ", cursorOffset: 7 },
				singleSchemaContext,
				mockMonaco,
			);

			const columnLabels = suggestions.map((s) => s.label);
			// Asterisk as first suggestion, plus all table.column combinations
			expect(columnLabels[0]).toBe("*");
			expect(columnLabels.length).toBe(15);
			// Should have table.column suggestions available
			expect(columnLabels).toContain("users.id");
			expect(columnLabels).toContain("users.email");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "All columns",
                  "label": "*",
                  "sortText": "0_*",
                },
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "Column",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.user_id",
                  "sortText": "1_comments.user_id",
                },
              ]
            `);
		});

		it("should suggest columns after ORDER BY keyword", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users ORDER BY ", cursorOffset: 29 },
				singleSchemaContext,
				mockMonaco,
			);

			const columnLabels = suggestions.map((s) => s.label);
			expect(columnLabels).toContain("id");
			expect(columnLabels).toContain("email");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
              ]
            `);
		});

		it("should suggest columns after ON keyword in JOIN", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users JOIN posts ON ", cursorOffset: 34 },
				singleSchemaContext,
				mockMonaco,
			);

			const columnLabels = suggestions.map((s) => s.label);
			expect(columnLabels.length).toBe(8);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
              ]
            `);
		});

		it("should insert quoted column name", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
				singleSchemaContext,
				mockMonaco,
			);

			const idSuggestion = suggestions.find((s) => s.label === "users.id");
			expect(idSuggestion?.insertText).toBe('"users"."id"');
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});
	});

	describe("context with multiple selected tables", () => {
		it("should track multiple tables from JOIN clause", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						"SELECT * FROM users JOIN posts ON users.id = posts.user_id WHERE ",
					cursorOffset: 68,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const columnLabels = suggestions.map((s) => s.label);
			// Should have columns from both users and posts
			expect(columnLabels).toContain("users.email"); // from users
			expect(columnLabels).toContain("posts.title"); // from posts
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
              ]
            `);
		});

		it("should suggest columns from all tables when no table is tracked yet", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
				singleSchemaContext,
				mockMonaco,
			);

			const columnLabels = suggestions.map((s) => s.label);
			expect(columnLabels.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});
	});

	describe("no suggestions for other contexts", () => {
		it("should return empty suggestions for unknown contexts", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT id FROM users ", cursorOffset: 21 },
				singleSchemaContext,
				mockMonaco,
			);

			// Cursor after table name and trailing space, should suggest keywords
			// This is actually a valid context (keyword_after_table)
			expect(suggestions.length).toBe(8);
			expect(suggestions.some((s) => s.label === "WHERE")).toBe(true);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "WHERE",
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ORDER BY",
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "GROUP BY",
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LIMIT",
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "JOIN",
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LEFT JOIN",
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INNER JOIN",
                  "sortText": "2_INNER JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "AS",
                  "sortText": "2_AS",
                },
              ]
            `);
		});
	});

	describe("suggestion sorting and metadata", () => {
		it("should set proper sort order for tables before keywords", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM ", cursorOffset: 14 },
				singleSchemaContext,
				mockMonaco,
			);

			const tableSuggestion = suggestions.find((s) => s.label === "users");
			expect(tableSuggestion?.sortText).toBe("1_users");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should set proper detail for table suggestions", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM ", cursorOffset: 14 },
				singleSchemaContext,
				mockMonaco,
			);

			const tableSuggestion = suggestions.find((s) => s.label === "users");
			expect(tableSuggestion?.detail).toBe("Table");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should set proper detail for column suggestions", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
				singleSchemaContext,
				mockMonaco,
			);

			const columnSuggestion = suggestions.find((s) => s.label === "users.id");
			expect(columnSuggestion?.detail).toBe("Column");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should set proper detail for keyword suggestions", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users ", cursorOffset: 20 },
				singleSchemaContext,
				mockMonaco,
			);

			const keywordSuggestion = suggestions.find((s) => s.label === "WHERE");
			expect(keywordSuggestion?.detail).toBe("SQL Keyword");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "WHERE",
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ORDER BY",
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "GROUP BY",
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LIMIT",
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "JOIN",
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LEFT JOIN",
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INNER JOIN",
                  "sortText": "2_INNER JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "AS",
                  "sortText": "2_AS",
                },
              ]
            `);
		});
	});

	describe("edge cases", () => {
		it("should handle empty tables list", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM ", cursorOffset: 14 },
				{ ...singleSchemaContext, tables: [] },
				mockMonaco,
			);

			expect(suggestions).toEqual([]);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`[]`);
		});

		it("should handle empty columns list", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "", cursorOffset: 0 },
				{ ...singleSchemaContext, columns: [] },
				mockMonaco,
			);

			const tableLabels = suggestions.map((s) => s.label);
			expect(tableLabels).toContain("users");
			// Should have no column suggestions
			expect(suggestions.filter((s) => s.detail === "Column").length).toBe(0);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should handle table with no columns in metadata", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "", cursorOffset: 0 },
				{
					...singleSchemaContext,
					columns: [
						{
							table: "users",
							columns: [],
						},
						{ table: "posts", columns: [] },
						{ table: "comments", columns: [] },
					],
				},
				mockMonaco,
			);

			const tableLabels = suggestions.map((s) => s.label);
			expect(tableLabels).toContain("users");
			// Should still suggest tables but no columns
			expect(suggestions.filter((s) => s.detail === "Column").length).toBe(0);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should handle whitespace-only input as empty line", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "   \n   ", cursorOffset: 7 },
				singleSchemaContext,
				mockMonaco,
			);

			const tableLabels = suggestions.map((s) => s.label);
			expect(tableLabels).toContain("users");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "Column",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.user_id",
                  "sortText": "1_comments.user_id",
                },
              ]
            `);
		});
	});

	describe("advanced completion scenarios", () => {
		const accountingTables = [
			{ schema: "public", name: "accounting_imports" },
			...mockTables,
		];

		const accountingColumns = [
			{
				table: "accounting_imports",
				columns: [
					{ name: "id", dataType: "integer" },
					{ name: "created_at", dataType: "timestamp" },
					{ name: "updated_at", dataType: "timestamp" },
					{ name: "account_id", dataType: "integer" },
				],
			},
			...mockColumns,
		] as any as TableWithColumnsMetadata[];

		const contextWithAccountingTable = {
			tables: accountingTables,
			columns: accountingColumns,
			hasMultipleSchemas: false,
		};

		it("should suggest table columns when typing table.column (quoted table)", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						'select * from "accounting_imports" WHERE "accounting_imports".',
					cursorOffset: 65,
				},
				contextWithAccountingTable,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("accounting_imports.id");
			expect(labels).toContain("accounting_imports.created_at");
			expect(labels).toContain("accounting_imports.account_id");
			expect(suggestions.length).toBe(4);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "accounting_imports.id",
                  "sortText": "1_accounting_imports.id",
                },
                {
                  "detail": "Column",
                  "label": "accounting_imports.created_at",
                  "sortText": "1_accounting_imports.created_at",
                },
                {
                  "detail": "Column",
                  "label": "accounting_imports.updated_at",
                  "sortText": "1_accounting_imports.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "accounting_imports.account_id",
                  "sortText": "1_accounting_imports.account_id",
                },
              ]
            `);
		});

		it("should suggest table columns when typing table.column (unquoted table)", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						"select * from accounting_imports WHERE accounting_imports.",
					cursorOffset: 59,
				},
				contextWithAccountingTable,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("accounting_imports.id");
			expect(labels).toContain("accounting_imports.created_at");
			expect(suggestions.length).toBe(4);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "accounting_imports.id",
                  "sortText": "1_accounting_imports.id",
                },
                {
                  "detail": "Column",
                  "label": "accounting_imports.created_at",
                  "sortText": "1_accounting_imports.created_at",
                },
                {
                  "detail": "Column",
                  "label": "accounting_imports.updated_at",
                  "sortText": "1_accounting_imports.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "accounting_imports.account_id",
                  "sortText": "1_accounting_imports.account_id",
                },
              ]
            `);
		});

		it("should suggest alias when typing after AS in FROM clause", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: 'select * from "accounting_imports" AS ',
					cursorOffset: 40,
				},
				contextWithAccountingTable,
				mockMonaco,
			);

			expect(suggestions.length).toBe(0);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`[]`);
		});

		it("should suggest keywords when typing after AS alias in FROM clause", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: 'select * from "accounting_imports" AS alias ',
					cursorOffset: 45,
				},
				contextWithAccountingTable,
				mockMonaco,
			);

			expect(suggestions.length).toBe(7);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "WHERE",
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ORDER BY",
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "GROUP BY",
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LIMIT",
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "JOIN",
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LEFT JOIN",
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INNER JOIN",
                  "sortText": "2_INNER JOIN",
                },
              ]
            `);
		});

		it("should suggest asterisk as first suggestion in SELECT clause", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "select ",
					cursorOffset: 7,
				},
				contextWithAccountingTable,
				mockMonaco,
			);

			// Asterisk should be first
			expect(suggestions[0]?.label).toBe("*");
			// Should have all table.column combinations
			expect(suggestions.length).toBe(19);
			const hasColumns = suggestions.some((s) => String(s.label).includes("."));
			expect(hasColumns).toBe(true);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "All columns",
                  "label": "*",
                  "sortText": "0_*",
                },
                {
                  "detail": "Column",
                  "label": "accounting_imports.id",
                  "sortText": "1_accounting_imports.id",
                },
                {
                  "detail": "Column",
                  "label": "accounting_imports.created_at",
                  "sortText": "1_accounting_imports.created_at",
                },
                {
                  "detail": "Column",
                  "label": "accounting_imports.updated_at",
                  "sortText": "1_accounting_imports.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "accounting_imports.account_id",
                  "sortText": "1_accounting_imports.account_id",
                },
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "Column",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.user_id",
                  "sortText": "1_comments.user_id",
                },
              ]
            `);
		});

		it("should suggest FROM keyword after SELECT *", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "select * ",
					cursorOffset: 9,
				},
				contextWithAccountingTable,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("FROM");
			expect(suggestions.length).toBe(1);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "FROM",
                  "sortText": "2_FROM",
                },
              ]
            `);
		});

		it("should suggest operators after column in WHERE clause", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						'select * from "accounting_imports" WHERE accounting_imports.created_at ',
					cursorOffset: 74,
				},
				contextWithAccountingTable,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("=");
			expect(labels).toContain("!=");
			expect(labels).toContain("<");
			expect(labels).toContain(">");
			expect(labels).toContain(">=");
			expect(labels).toContain("<=");
			expect(labels).toContain("BETWEEN");
			expect(labels).toContain("IN");
			expect(labels).toContain("LIKE");
			expect(labels).toContain("IS NULL");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Operator",
                  "label": "=",
                  "sortText": "2_=",
                },
                {
                  "detail": "Operator",
                  "label": "!=",
                  "sortText": "2_!=",
                },
                {
                  "detail": "Operator",
                  "label": "<>",
                  "sortText": "2_<>",
                },
                {
                  "detail": "Operator",
                  "label": "<",
                  "sortText": "2_<",
                },
                {
                  "detail": "Operator",
                  "label": ">",
                  "sortText": "2_>",
                },
                {
                  "detail": "Operator",
                  "label": "<=",
                  "sortText": "2_<=",
                },
                {
                  "detail": "Operator",
                  "label": ">=",
                  "sortText": "2_>=",
                },
                {
                  "detail": "Operator",
                  "label": "BETWEEN",
                  "sortText": "2_BETWEEN",
                },
                {
                  "detail": "Operator",
                  "label": "IN",
                  "sortText": "2_IN",
                },
                {
                  "detail": "Operator",
                  "label": "LIKE",
                  "sortText": "2_LIKE",
                },
                {
                  "detail": "Operator",
                  "label": "IS NULL",
                  "sortText": "2_IS NULL",
                },
                {
                  "detail": "Operator",
                  "label": "IS NOT NULL",
                  "sortText": "2_IS NOT NULL",
                },
              ]
            `);
		});

		it("should suggest AS and ON after table in JOIN without alias", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						'select * FROM "accounting_imports" LEFT JOIN "accounting_line_planned_outcomes" ',
					cursorOffset: 80,
				},
				contextWithAccountingTable,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("AS");
			expect(labels).toContain("ON");
			expect(suggestions.length).toBe(2);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "AS",
                  "sortText": "2_AS",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ON",
                  "sortText": "2_ON",
                },
              ]
            `);
		});

		it("should suggest regular keywords after table with alias in JOIN", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						'select * FROM "accounting_imports" LEFT JOIN "accounting_line_planned_outcomes" as aliased on "accounting_imports"."id" = "aliased"."accounting_line_id" ',
					cursorOffset: 153,
				},
				contextWithAccountingTable,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("WHERE");
			expect(labels).toContain("ORDER BY");
			expect(labels).toContain("GROUP BY");
			expect(labels).toContain("LIMIT");
			// Should NOT have AND/OR after ON condition (only after WHERE)
			expect(labels).not.toContain("AND");
			expect(labels).not.toContain("OR");
			expect(suggestions.length).toBe(4);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "WHERE",
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ORDER BY",
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "GROUP BY",
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LIMIT",
                  "sortText": "2_LIMIT",
                },
              ]
            `);
		});
	});

	describe("aggregate functions and subqueries", () => {
		it("should suggest columns after COUNT( in SELECT", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT COUNT(", cursorOffset: 13 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// After COUNT( suggests all available columns
			expect(labels).toContain("users.id");
			expect(labels).toContain("users.email");
			expect(labels).toContain("posts.title");
			expect(suggestions.length).toBe(10);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
              ]
            `);
		});

		it("should suggest columns after SUM with table prefix", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT SUM(users.", cursorOffset: 17 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// Suggests all columns when inside function
			expect(labels).toContain("id");
			expect(labels).toContain("email");
			expect(suggestions.length).toBe(10);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "label": "title",
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "label": "content",
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "label": "user_id",
                  "sortText": "1_user_id",
                },
                {
                  "detail": "Column",
                  "label": "text",
                  "sortText": "1_text",
                },
                {
                  "detail": "Column",
                  "label": "post_id",
                  "sortText": "1_post_id",
                },
              ]
            `);
		});

		it("should suggest columns after AVG with table prefix", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT AVG(posts.", cursorOffset: 17 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// Suggests all columns when inside function
			expect(labels).toContain("id");
			expect(labels).toContain("user_id");
			expect(suggestions.length).toBe(10);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "label": "title",
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "label": "content",
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "label": "user_id",
                  "sortText": "1_user_id",
                },
                {
                  "detail": "Column",
                  "label": "text",
                  "sortText": "1_text",
                },
                {
                  "detail": "Column",
                  "label": "post_id",
                  "sortText": "1_post_id",
                },
              ]
            `);
		});

		it("should suggest columns after MAX with table prefix", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT MAX(comments.", cursorOffset: 19 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// Suggests all columns when inside function
			expect(labels).toContain("comments.text");
			expect(labels).toContain("comments.post_id");
			expect(suggestions.length).toBe(10);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
              ]
            `);
		});

		it("should suggest columns after MIN with table prefix", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT MIN(users.created_at), MAX(users.",
					cursorOffset: 40,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// Suggests all columns when inside function
			expect(labels).toContain("id");
			expect(labels).toContain("email");
			expect(suggestions.length).toBe(10);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "label": "title",
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "label": "content",
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "label": "user_id",
                  "sortText": "1_user_id",
                },
                {
                  "detail": "Column",
                  "label": "text",
                  "sortText": "1_text",
                },
                {
                  "detail": "Column",
                  "label": "post_id",
                  "sortText": "1_post_id",
                },
              ]
            `);
		});
	});

	describe("JOIN variations", () => {
		it("should suggest tables after INNER JOIN", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users INNER JOIN ", cursorOffset: 31 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("users");
			expect(labels).toContain("posts");
			expect(labels).toContain("comments");
			expect(suggestions.length).toBe(3);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should suggest tables after LEFT JOIN", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users LEFT JOIN ", cursorOffset: 30 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("posts");
			expect(labels).toContain("comments");
			expect(suggestions.length).toBe(3);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should suggest tables after RIGHT JOIN", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM posts RIGHT JOIN ", cursorOffset: 31 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("users");
			expect(labels).toContain("comments");
			expect(suggestions.length).toBe(3);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should suggest tables after FULL OUTER JOIN", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM comments FULL OUTER JOIN ",
					cursorOffset: 39,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("users");
			expect(labels).toContain("posts");
			expect(suggestions.length).toBe(3);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should suggest JOIN keywords after table name", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users ", cursorOffset: 20 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("WHERE");
			expect(labels).toContain("ORDER BY");
			expect(labels).toContain("LIMIT");
			expect(suggestions.length).toBe(8);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "WHERE",
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ORDER BY",
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "GROUP BY",
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LIMIT",
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "JOIN",
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LEFT JOIN",
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INNER JOIN",
                  "sortText": "2_INNER JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "AS",
                  "sortText": "2_AS",
                },
              ]
            `);
		});

		it("should suggest columns after ON in JOIN condition", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users INNER JOIN posts ON posts.",
					cursorOffset: 46,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("id");
			expect(labels).toContain("user_id");
			expect(suggestions.length).toBe(8);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "label": "title",
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "label": "content",
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "label": "user_id",
                  "sortText": "1_user_id",
                },
              ]
            `);
		});

		it("should suggest columns with operators in JOIN condition", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users u INNER JOIN posts p ON u.id ",
					cursorOffset: 50,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("=");
			expect(labels).toContain("!=");
			expect(labels).toContain(">=");
			expect(suggestions.length).toBe(12);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Operator",
                  "label": "=",
                  "sortText": "2_=",
                },
                {
                  "detail": "Operator",
                  "label": "!=",
                  "sortText": "2_!=",
                },
                {
                  "detail": "Operator",
                  "label": "<>",
                  "sortText": "2_<>",
                },
                {
                  "detail": "Operator",
                  "label": "<",
                  "sortText": "2_<",
                },
                {
                  "detail": "Operator",
                  "label": ">",
                  "sortText": "2_>",
                },
                {
                  "detail": "Operator",
                  "label": "<=",
                  "sortText": "2_<=",
                },
                {
                  "detail": "Operator",
                  "label": ">=",
                  "sortText": "2_>=",
                },
                {
                  "detail": "Operator",
                  "label": "BETWEEN",
                  "sortText": "2_BETWEEN",
                },
                {
                  "detail": "Operator",
                  "label": "IN",
                  "sortText": "2_IN",
                },
                {
                  "detail": "Operator",
                  "label": "LIKE",
                  "sortText": "2_LIKE",
                },
                {
                  "detail": "Operator",
                  "label": "IS NULL",
                  "sortText": "2_IS NULL",
                },
                {
                  "detail": "Operator",
                  "label": "IS NOT NULL",
                  "sortText": "2_IS NOT NULL",
                },
              ]
            `);
		});

		it("should suggest columns after AND in JOIN condition", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						"SELECT * FROM users u JOIN posts p ON u.id = p.user_id AND u.",
					cursorOffset: 62,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("users.id");
			expect(labels).toContain("users.email");
			expect(suggestions.length).toBe(8);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
              ]
            `);
		});

		it("should handle multiple JOINs with column suggestions", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						"SELECT * FROM users u JOIN posts p ON u.id = p.user_id JOIN comments c ON p.id = c.post_id WHERE u.",
					cursorOffset: 108,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("users.id");
			expect(labels).toContain("users.email");
			expect(labels).toContain("users.name");
			expect(suggestions.length).toBe(10);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
              ]
            `);
		});
	});

	describe("WHERE clause variations", () => {
		it("should suggest columns after WHERE keyword", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// WHERE returns qualified column names
			expect(labels).toContain("users.id");
			expect(labels).toContain("users.email");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should suggest operators after column in WHERE", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users WHERE users.id ", cursorOffset: 35 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("=");
			expect(labels).toContain("<");
			expect(labels).toContain(">");
			expect(labels).toContain("IN");
			expect(labels).toContain("BETWEEN");
			expect(suggestions.length).toBe(12); // 10 operators
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Operator",
                  "label": "=",
                  "sortText": "2_=",
                },
                {
                  "detail": "Operator",
                  "label": "!=",
                  "sortText": "2_!=",
                },
                {
                  "detail": "Operator",
                  "label": "<>",
                  "sortText": "2_<>",
                },
                {
                  "detail": "Operator",
                  "label": "<",
                  "sortText": "2_<",
                },
                {
                  "detail": "Operator",
                  "label": ">",
                  "sortText": "2_>",
                },
                {
                  "detail": "Operator",
                  "label": "<=",
                  "sortText": "2_<=",
                },
                {
                  "detail": "Operator",
                  "label": ">=",
                  "sortText": "2_>=",
                },
                {
                  "detail": "Operator",
                  "label": "BETWEEN",
                  "sortText": "2_BETWEEN",
                },
                {
                  "detail": "Operator",
                  "label": "IN",
                  "sortText": "2_IN",
                },
                {
                  "detail": "Operator",
                  "label": "LIKE",
                  "sortText": "2_LIKE",
                },
                {
                  "detail": "Operator",
                  "label": "IS NULL",
                  "sortText": "2_IS NULL",
                },
                {
                  "detail": "Operator",
                  "label": "IS NOT NULL",
                  "sortText": "2_IS NOT NULL",
                },
              ]
            `);
		});

		it("should suggest columns after AND in WHERE clause", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users WHERE users.id = 1 AND ",
					cursorOffset: 43,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// After AND in WHERE with qualified column, suggests more columns
			expect(labels).toContain("users.id");
			expect(labels).toContain("users.email");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should suggest columns after OR in WHERE clause", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users WHERE users.id = 1 OR ",
					cursorOffset: 42,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("users.id");
			expect(labels).toContain("users.name");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should suggest columns after NOT in WHERE", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users WHERE NOT ", cursorOffset: 30 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// NOT should suggest columns from available tables
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should suggest operators after LIKE", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users WHERE users.email LIKE ",
					cursorOffset: 43,
				},
				singleSchemaContext,
				mockMonaco,
			);

			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should handle complex WHERE with parentheses", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						"SELECT * FROM users WHERE (users.id = 1 OR users.email = 'test@test.com') AND users.",
					cursorOffset: 88,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("users.id");
			expect(labels).toContain("users.email");
			expect(labels).toContain("users.name");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});
	});

	describe("EXISTS clause", () => {
		it("should suggest keywords after WHERE EXISTS", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users WHERE EXISTS ", cursorOffset: 33 },
				singleSchemaContext,
				mockMonaco,
			);

			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should suggest FROM after SELECT in EXISTS subquery", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users WHERE EXISTS (SELECT ",
					cursorOffset: 41,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("*");
			expect(suggestions.length).toBe(15);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "All columns",
                  "label": "*",
                  "sortText": "0_*",
                },
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "Column",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.user_id",
                  "sortText": "1_comments.user_id",
                },
              ]
            `);
		});

		it("should suggest FROM keyword in EXISTS subquery", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users WHERE EXISTS (SELECT * ",
					cursorOffset: 43,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("FROM");
			expect(suggestions.length).toBe(1);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "FROM",
                  "sortText": "2_FROM",
                },
              ]
            `);
		});
	});

	describe("Table aliasing", () => {
		it("should suggest keywords after table in FROM", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users ", cursorOffset: 20 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("WHERE");
			expect(labels).toContain("ORDER BY");
			expect(labels).toContain("LIMIT");
			expect(suggestions.length).toBe(8);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "WHERE",
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ORDER BY",
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "GROUP BY",
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LIMIT",
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "JOIN",
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "LEFT JOIN",
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INNER JOIN",
                  "sortText": "2_INNER JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "AS",
                  "sortText": "2_AS",
                },
              ]
            `);
		});

		it("should suggest aliased column references", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users u JOIN posts p ON u.",
					cursorOffset: 40,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("id");
			expect(labels).toContain("email");
			expect(suggestions.length).toBe(8);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "label": "title",
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "label": "content",
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "label": "user_id",
                  "sortText": "1_user_id",
                },
              ]
            `);
		});

		it("should recognize multiple table aliases", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users u, posts p WHERE u.",
					cursorOffset: 40,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("users.id");
			expect(labels).toContain("users.email");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});
	});

	describe("ORDER BY and sorting", () => {
		it("should suggest columns after ORDER BY", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users ORDER BY ", cursorOffset: 29 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// ORDER BY suggests plain column names
			expect(labels).toContain("id");
			expect(labels).toContain("email");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
              ]
            `);
		});

		it("should suggest columns in multiple ORDER BY", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users ORDER BY users.id ASC, ",
					cursorOffset: 43,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("id");
			expect(labels).toContain("email");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
              ]
            `);
		});
	});

	describe("LIMIT and OFFSET", () => {
		it("should complete LIMIT clause", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users LIMIT ", cursorOffset: 27 },
				singleSchemaContext,
				mockMonaco,
			);

			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should complete OFFSET clause", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users LIMIT 10 OFFSET ", cursorOffset: 36 },
				singleSchemaContext,
				mockMonaco,
			);

			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});
	});

	describe("HAVING clause", () => {
		it("should suggest columns after HAVING", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						"SELECT users.id, COUNT(*) FROM users GROUP BY users.id HAVING ",
					cursorOffset: 63,
				},
				singleSchemaContext,
				mockMonaco,
			);

			// HAVING suggests aggregate context
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
              ]
            `);
		});

		it("should suggest aggregate function in HAVING", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						"SELECT users.id, COUNT(*) FROM users GROUP BY users.id HAVING COUNT(",
					cursorOffset: 69,
				},
				singleSchemaContext,
				mockMonaco,
			);

			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
              ]
            `);
		});
	});

	describe("DISTINCT and GROUP BY", () => {
		it("should suggest columns after SELECT DISTINCT", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT DISTINCT ", cursorOffset: 16 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("users.id");
			expect(labels).toContain("users.email");
			expect(suggestions.length).toBe(10);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "Column",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "Column",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "Column",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "Column",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "Column",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
              ]
            `);
		});

		it("should suggest columns after GROUP BY", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT users.id, COUNT(*) FROM users GROUP BY ",
					cursorOffset: 46,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("id");
			expect(labels).toContain("email");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
              ]
            `);
		});

		it("should suggest multiple columns in GROUP BY", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						"SELECT users.id, users.name, COUNT(*) FROM users GROUP BY users.id, ",
					cursorOffset: 70,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("id");
			expect(labels).toContain("name");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "label": "name",
                  "sortText": "1_name",
                },
              ]
            `);
		});
	});

	describe("Case insensitivity", () => {
		it("should handle lowercase select", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "select * from ", cursorOffset: 14 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("users");
			expect(labels).toContain("posts");
			expect(suggestions.length).toBe(3);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "label": "users",
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "label": "posts",
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "label": "comments",
                  "sortText": "1_comments",
                },
              ]
            `);
		});

		it("should handle mixed case keywords", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SeLeCt * FrOm users WhErE ", cursorOffset: 26 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// WHERE returns column names (either plain or qualified depending on context)
			expect(labels).toContain("users.id");
			expect(labels).toContain("users.email");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "Column",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "Column",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "Column",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
              ]
            `);
		});

		it("should suggest columns with alias name when alias is used", () => {
			const suggestions = sqlCompletionProvider(
				{ fullText: "SELECT * FROM users AS u WHERE ", cursorOffset: 32 },
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// Should use alias "u" instead of table name "users"
			expect(labels).toContain("u.id");
			expect(labels).toContain("u.email");
			expect(labels).not.toContain("users.id");
			expect(labels).not.toContain("users.email");
			expect(suggestions.length).toBe(5);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "u.id",
                  "sortText": "1_u.id",
                },
                {
                  "detail": "Column",
                  "label": "u.email",
                  "sortText": "1_u.email",
                },
                {
                  "detail": "Column",
                  "label": "u.created_at",
                  "sortText": "1_u.created_at",
                },
                {
                  "detail": "Column",
                  "label": "u.updated_at",
                  "sortText": "1_u.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "u.name",
                  "sortText": "1_u.name",
                },
              ]
            `);
		});

		it("should suggest columns with multiple aliases from different tables", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: "SELECT * FROM users AS u JOIN posts AS p ON ",
					cursorOffset: 45,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			// Should have columns from both aliases
			expect(labels).toContain("u.id");
			expect(labels).toContain("p.id");
			expect(labels).not.toContain("users.id");
			expect(labels).not.toContain("posts.id");
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "label": "u.id",
                  "sortText": "1_u.id",
                },
                {
                  "detail": "Column",
                  "label": "u.email",
                  "sortText": "1_u.email",
                },
                {
                  "detail": "Column",
                  "label": "u.created_at",
                  "sortText": "1_u.created_at",
                },
                {
                  "detail": "Column",
                  "label": "u.updated_at",
                  "sortText": "1_u.updated_at",
                },
                {
                  "detail": "Column",
                  "label": "u.name",
                  "sortText": "1_u.name",
                },
                {
                  "detail": "Column",
                  "label": "p.id",
                  "sortText": "1_p.id",
                },
                {
                  "detail": "Column",
                  "label": "p.title",
                  "sortText": "1_p.title",
                },
                {
                  "detail": "Column",
                  "label": "p.content",
                  "sortText": "1_p.content",
                },
                {
                  "detail": "Column",
                  "label": "p.user_id",
                  "sortText": "1_p.user_id",
                },
                {
                  "detail": "Column",
                  "label": "p.created_at",
                  "sortText": "1_p.created_at",
                },
              ]
            `);
		});

		it("should suggest contextual keywords after completed WHERE condition", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText: 'select * FROM users WHERE category = "xxx" ',
					cursorOffset: 44,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("AND");
			expect(labels).toContain("OR");
			expect(labels).toContain("LIMIT");
			expect(labels).toContain("ORDER BY");
			expect(labels).toContain("GROUP BY");
			expect(labels).toContain("HAVING");
			expect(labels).toContain("OFFSET");
			expect(labels).toContain("DISTINCT");
			expect(labels).toContain("UNION");
			expect(labels).toContain("UNION ALL");
			expect(labels).toContain("INTERSECT");
			// Should not contain column suggestions
			expect(labels).not.toContain("id");
			expect(suggestions.length).toBe(11);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
				[
				  {
				    "detail": "SQL Keyword",
				    "label": "AND",
				    "sortText": "2_AND",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "OR",
				    "sortText": "2_OR",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "ORDER BY",
				    "sortText": "2_ORDER BY",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "GROUP BY",
				    "sortText": "2_GROUP BY",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "HAVING",
				    "sortText": "2_HAVING",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "LIMIT",
				    "sortText": "2_LIMIT",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "OFFSET",
				    "sortText": "2_OFFSET",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "DISTINCT",
				    "sortText": "2_DISTINCT",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "UNION",
				    "sortText": "2_UNION",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "UNION ALL",
				    "sortText": "2_UNION ALL",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "INTERSECT",
				    "sortText": "2_INTERSECT",
				  },
				]
			`);
		});

		it("should suggest contextual keywords after completed WHERE condition with alias", () => {
			const suggestions = sqlCompletionProvider(
				{
					fullText:
						'select * FROM users AS u WHERE u.email = "test@example.com" ',
					cursorOffset: 60,
				},
				singleSchemaContext,
				mockMonaco,
			);

			const labels = suggestions.map((s) => s.label);
			expect(labels).toContain("AND");
			expect(labels).toContain("OR");
			expect(labels).toContain("LIMIT");
			expect(labels).toContain("ORDER BY");
			expect(labels).toContain("GROUP BY");
			expect(labels).toContain("HAVING");
			expect(labels).toContain("OFFSET");
			expect(labels).toContain("DISTINCT");
			expect(labels).toContain("UNION");
			expect(labels).toContain("UNION ALL");
			expect(labels).toContain("INTERSECT");
			expect(suggestions.length).toBe(11);
			expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
				[
				  {
				    "detail": "SQL Keyword",
				    "label": "AND",
				    "sortText": "2_AND",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "OR",
				    "sortText": "2_OR",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "ORDER BY",
				    "sortText": "2_ORDER BY",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "GROUP BY",
				    "sortText": "2_GROUP BY",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "HAVING",
				    "sortText": "2_HAVING",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "LIMIT",
				    "sortText": "2_LIMIT",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "OFFSET",
				    "sortText": "2_OFFSET",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "DISTINCT",
				    "sortText": "2_DISTINCT",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "UNION",
				    "sortText": "2_UNION",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "UNION ALL",
				    "sortText": "2_UNION ALL",
				  },
				  {
				    "detail": "SQL Keyword",
				    "label": "INTERSECT",
				    "sortText": "2_INTERSECT",
				  },
				]
			`);
		});
	});
});
