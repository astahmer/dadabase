import { describe, it, expect, beforeEach, vi } from "vitest";
import { sqlCompletionProvider } from "./sql-completion-provider";

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

    const mockColumns = {
        users: [
            { name: "id", dataType: "integer" },
            { name: "email", dataType: "varchar" },
            { name: "created_at", dataType: "timestamp" },
            { name: "updated_at", dataType: "timestamp" },
            { name: "name", dataType: "varchar" },
        ],
        posts: [
            { name: "id", dataType: "integer" },
            { name: "title", dataType: "varchar" },
            { name: "content", dataType: "text" },
            { name: "user_id", dataType: "integer" },
            { name: "created_at", dataType: "timestamp" },
        ],
        comments: [
            { name: "id", dataType: "integer" },
            { name: "text", dataType: "text" },
            { name: "post_id", dataType: "integer" },
            { name: "user_id", dataType: "integer" },
        ],
    };

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
                mockMonaco
            );

            const tableLabels = suggestions.map((s) => s.label);
            expect(tableLabels).toContain("users");
            expect(tableLabels).toContain("posts");
            expect(tableLabels).toContain("comments");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": ""users" ",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": ""posts" ",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": ""comments" ",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });

        it("should suggest tables with correct insert text for single schema", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM ", cursorOffset: 14 },
                singleSchemaContext,
                mockMonaco
            );

            const usersSuggestion = suggestions.find((s) => s.label === "users");
            expect(usersSuggestion).toBeDefined();
            expect(usersSuggestion?.insertText).toBe('"users" ');
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": ""users" ",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": ""posts" ",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": ""comments" ",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });

        it("should suggest tables with schema-qualified insert text for multiple schemas", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM ", cursorOffset: 14 },
                multiSchemaContext,
                mockMonaco
            );

            const usersSuggestion = suggestions.find((s) => s.label === "users");
            expect(usersSuggestion).toBeDefined();
            expect(usersSuggestion?.insertText).toBe('"public"."users" ');
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table in schema: public",
                  "insertText": ""public"."users" ",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table in schema: public",
                  "insertText": ""public"."posts" ",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table in schema: public",
                  "insertText": ""public"."comments" ",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });

        it("should work case-insensitively with from keyword", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "select * from ", cursorOffset: 14 },
                singleSchemaContext,
                mockMonaco
            );

            const tableLabels = suggestions.map((s) => s.label);
            expect(tableLabels).toContain("users");
            expect(tableLabels.length).toBe(3);
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": ""users" ",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": ""posts" ",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": ""comments" ",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });
    });

    describe("table suggestions while typing table name after FROM", () => {
        it("should suggest tables while typing table name", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM u", cursorOffset: 16 },
                singleSchemaContext,
                mockMonaco
            );

            const tableLabels = suggestions.map((s) => s.label);
            expect(tableLabels).toContain("users");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": ""users" ",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": ""posts" ",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": ""comments" ",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });

        it("should suggest tables after JOIN keyword", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users JOIN ", cursorOffset: 25 },
                singleSchemaContext,
                mockMonaco
            );

            const tableLabels = suggestions.map((s) => s.label);
            expect(tableLabels).toContain("posts");
            expect(tableLabels).toContain("comments");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": ""users" ",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": ""posts" ",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": ""comments" ",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });

        it("should suggest tables after LEFT JOIN keyword", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users LEFT JOIN p", cursorOffset: 32 },
                singleSchemaContext,
                mockMonaco
            );

            const tableLabels = suggestions.map((s) => s.label);
            expect(tableLabels).toContain("posts");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": ""users" ",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": ""posts" ",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": ""comments" ",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });
    });

    describe("empty line completions", () => {
        it("should suggest all tables on empty line", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "", cursorOffset: 0 },
                singleSchemaContext,
                mockMonaco
            );

            const tableLabels = suggestions.map((s) => s.label);
            expect(tableLabels).toContain("users");
            expect(tableLabels).toContain("posts");
            expect(tableLabels).toContain("comments");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "users"",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "posts"",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "comments"",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "users"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "email" FROM "users"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "users"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "updated_at" FROM "users"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "name" FROM "users"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "posts"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "title" FROM "posts"",
                  "kind": 5,
                  "label": "title",
                  "range": undefined,
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "content" FROM "posts"",
                  "kind": 5,
                  "label": "content",
                  "range": undefined,
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "posts"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "posts"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "comments"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "text" FROM "comments"",
                  "kind": 5,
                  "label": "text",
                  "range": undefined,
                  "sortText": "1_text",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "post_id" FROM "comments"",
                  "kind": 5,
                  "label": "post_id",
                  "range": undefined,
                  "sortText": "1_post_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "comments"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
              ]
            `)
        });

        it("should suggest columns from all tables on empty line", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "", cursorOffset: 0 },
                singleSchemaContext,
                mockMonaco
            );

            const columnLabels = suggestions.map((s) => s.label);
            expect(columnLabels).toContain("id");
            expect(columnLabels).toContain("email");
            expect(columnLabels).toContain("title");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "users"",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "posts"",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "comments"",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "users"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "email" FROM "users"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "users"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "updated_at" FROM "users"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "name" FROM "users"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "posts"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "title" FROM "posts"",
                  "kind": 5,
                  "label": "title",
                  "range": undefined,
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "content" FROM "posts"",
                  "kind": 5,
                  "label": "content",
                  "range": undefined,
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "posts"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "posts"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "comments"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "text" FROM "comments"",
                  "kind": 5,
                  "label": "text",
                  "range": undefined,
                  "sortText": "1_text",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "post_id" FROM "comments"",
                  "kind": 5,
                  "label": "post_id",
                  "range": undefined,
                  "sortText": "1_post_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "comments"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
              ]
            `)
        });

        it("should insert full SELECT statement with table on empty line", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "", cursorOffset: 0 },
                singleSchemaContext,
                mockMonaco
            );

            const tablesSuggestion = suggestions.find((s) => s.label === "users");
            expect(tablesSuggestion?.insertText).toBe('SELECT * FROM "users"');
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "users"",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "posts"",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "comments"",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "users"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "email" FROM "users"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "users"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "updated_at" FROM "users"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "name" FROM "users"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "posts"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "title" FROM "posts"",
                  "kind": 5,
                  "label": "title",
                  "range": undefined,
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "content" FROM "posts"",
                  "kind": 5,
                  "label": "content",
                  "range": undefined,
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "posts"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "posts"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "comments"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "text" FROM "comments"",
                  "kind": 5,
                  "label": "text",
                  "range": undefined,
                  "sortText": "1_text",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "post_id" FROM "comments"",
                  "kind": 5,
                  "label": "post_id",
                  "range": undefined,
                  "sortText": "1_post_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "comments"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
              ]
            `)
        });

        it("should insert full SELECT statement with column on empty line", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "", cursorOffset: 0 },
                singleSchemaContext,
                mockMonaco
            );

            const columnSuggestion = suggestions.find((s) => s.label === "id");
            // Should suggest SELECT "id" FROM one of the tables
            expect(columnSuggestion?.insertText).toMatch(/SELECT "id" FROM/);
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "users"",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "posts"",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "comments"",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "users"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "email" FROM "users"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "users"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "updated_at" FROM "users"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "name" FROM "users"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "posts"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "title" FROM "posts"",
                  "kind": 5,
                  "label": "title",
                  "range": undefined,
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "content" FROM "posts"",
                  "kind": 5,
                  "label": "content",
                  "range": undefined,
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "posts"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "posts"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "comments"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "text" FROM "comments"",
                  "kind": 5,
                  "label": "text",
                  "range": undefined,
                  "sortText": "1_text",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "post_id" FROM "comments"",
                  "kind": 5,
                  "label": "post_id",
                  "range": undefined,
                  "sortText": "1_post_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "comments"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
              ]
            `)
        });

        it("should limit to 5 columns per table to avoid clutter", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "", cursorOffset: 0 },
                singleSchemaContext,
                mockMonaco
            );

            const columnLabels = suggestions.map((s) => s.label);
            // Count occurrences of 'id' - should be limited from the 3 tables
            const idCount = columnLabels.filter((label) => label === "id").length;
            // Users table has 5 columns, so id should only appear once per table if we limit to 5
            expect(idCount).toBeLessThanOrEqual(3); // One per table max
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "users"",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "posts"",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "comments"",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "users"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "email" FROM "users"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "users"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "updated_at" FROM "users"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "name" FROM "users"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "posts"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "title" FROM "posts"",
                  "kind": 5,
                  "label": "title",
                  "range": undefined,
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "content" FROM "posts"",
                  "kind": 5,
                  "label": "content",
                  "range": undefined,
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "posts"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "posts"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "comments"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "text" FROM "comments"",
                  "kind": 5,
                  "label": "text",
                  "range": undefined,
                  "sortText": "1_text",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "post_id" FROM "comments"",
                  "kind": 5,
                  "label": "post_id",
                  "range": undefined,
                  "sortText": "1_post_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "comments"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
              ]
            `)
        });
    });

    describe("keyword suggestions after table name", () => {
        it("should suggest SQL keywords after table name", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users ", cursorOffset: 20 },
                singleSchemaContext,
                mockMonaco
            );

            const keywordLabels = suggestions.map((s) => s.label);
            expect(keywordLabels).toContain("WHERE");
            expect(keywordLabels).toContain("ORDER BY");
            expect(keywordLabels).toContain("GROUP BY");
            expect(keywordLabels).toContain("LIMIT");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "insertText": "WHERE ",
                  "kind": 14,
                  "label": "WHERE",
                  "range": undefined,
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "ORDER BY ",
                  "kind": 14,
                  "label": "ORDER BY",
                  "range": undefined,
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "GROUP BY ",
                  "kind": 14,
                  "label": "GROUP BY",
                  "range": undefined,
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LIMIT ",
                  "kind": 14,
                  "label": "LIMIT",
                  "range": undefined,
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "JOIN ",
                  "kind": 14,
                  "label": "JOIN",
                  "range": undefined,
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LEFT JOIN ",
                  "kind": 14,
                  "label": "LEFT JOIN",
                  "range": undefined,
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "INNER JOIN ",
                  "kind": 14,
                  "label": "INNER JOIN",
                  "range": undefined,
                  "sortText": "2_INNER JOIN",
                },
              ]
            `)
        });

        it("should suggest JOIN keywords after table name", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users ", cursorOffset: 20 },
                singleSchemaContext,
                mockMonaco
            );

            const keywordLabels = suggestions.map((s) => s.label);
            expect(keywordLabels).toContain("JOIN");
            expect(keywordLabels).toContain("LEFT JOIN");
            expect(keywordLabels).toContain("INNER JOIN");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "insertText": "WHERE ",
                  "kind": 14,
                  "label": "WHERE",
                  "range": undefined,
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "ORDER BY ",
                  "kind": 14,
                  "label": "ORDER BY",
                  "range": undefined,
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "GROUP BY ",
                  "kind": 14,
                  "label": "GROUP BY",
                  "range": undefined,
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LIMIT ",
                  "kind": 14,
                  "label": "LIMIT",
                  "range": undefined,
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "JOIN ",
                  "kind": 14,
                  "label": "JOIN",
                  "range": undefined,
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LEFT JOIN ",
                  "kind": 14,
                  "label": "LEFT JOIN",
                  "range": undefined,
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "INNER JOIN ",
                  "kind": 14,
                  "label": "INNER JOIN",
                  "range": undefined,
                  "sortText": "2_INNER JOIN",
                },
              ]
            `)
        });

        it("should suggest keywords after quoted table name", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: 'SELECT * FROM "users" ', cursorOffset: 22 },
                singleSchemaContext,
                mockMonaco
            );

            const keywordLabels = suggestions.map((s) => s.label);
            expect(keywordLabels.length).toBe(7);
            expect(keywordLabels).toContain("WHERE");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "insertText": "WHERE ",
                  "kind": 14,
                  "label": "WHERE",
                  "range": undefined,
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "ORDER BY ",
                  "kind": 14,
                  "label": "ORDER BY",
                  "range": undefined,
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "GROUP BY ",
                  "kind": 14,
                  "label": "GROUP BY",
                  "range": undefined,
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LIMIT ",
                  "kind": 14,
                  "label": "LIMIT",
                  "range": undefined,
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "JOIN ",
                  "kind": 14,
                  "label": "JOIN",
                  "range": undefined,
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LEFT JOIN ",
                  "kind": 14,
                  "label": "LEFT JOIN",
                  "range": undefined,
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "INNER JOIN ",
                  "kind": 14,
                  "label": "INNER JOIN",
                  "range": undefined,
                  "sortText": "2_INNER JOIN",
                },
              ]
            `)
        });

        it("should insert keyword with trailing space", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users ", cursorOffset: 20 },
                singleSchemaContext,
                mockMonaco
            );

            const whereSuggestion = suggestions.find((s) => s.label === "WHERE");
            expect(whereSuggestion?.insertText).toBe("WHERE ");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "insertText": "WHERE ",
                  "kind": 14,
                  "label": "WHERE",
                  "range": undefined,
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "ORDER BY ",
                  "kind": 14,
                  "label": "ORDER BY",
                  "range": undefined,
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "GROUP BY ",
                  "kind": 14,
                  "label": "GROUP BY",
                  "range": undefined,
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LIMIT ",
                  "kind": 14,
                  "label": "LIMIT",
                  "range": undefined,
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "JOIN ",
                  "kind": 14,
                  "label": "JOIN",
                  "range": undefined,
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LEFT JOIN ",
                  "kind": 14,
                  "label": "LEFT JOIN",
                  "range": undefined,
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "INNER JOIN ",
                  "kind": 14,
                  "label": "INNER JOIN",
                  "range": undefined,
                  "sortText": "2_INNER JOIN",
                },
              ]
            `)
        });
    });

    describe("column suggestions after WHERE keyword", () => {
        it("should suggest columns from all tables after WHERE", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
                singleSchemaContext,
                mockMonaco
            );

            const columnLabels = suggestions.map((s) => s.label);
            expect(columnLabels).toContain("id");
            expect(columnLabels).toContain("email");
            expect(columnLabels).toContain("created_at");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "insertText": ""id"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": ""email"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": ""created_at"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""updated_at"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""name"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
              ]
            `)
        });

        it("should suggest only columns from selected tables in WHERE clause", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
                singleSchemaContext, mockMonaco,
            );

            const columnLabels = suggestions.map((s) => s.label);
            // Should have columns from users table
            expect(columnLabels).toContain("email");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "insertText": ""id"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": ""email"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": ""created_at"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""updated_at"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""name"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
              ]
            `)
        });

        it("should suggest columns after SELECT keyword", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT ", cursorOffset: 7 },
                singleSchemaContext, mockMonaco,
            );

            const columnLabels = suggestions.map((s) => s.label);
            expect(columnLabels.length).toBe(10);
            // Should have some columns available
            expect(columnLabels).toContain("id");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "insertText": ""id"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": ""email"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": ""created_at"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""updated_at"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""name"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "insertText": ""title"",
                  "kind": 5,
                  "label": "title",
                  "range": undefined,
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "insertText": ""content"",
                  "kind": 5,
                  "label": "content",
                  "range": undefined,
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "insertText": ""user_id"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
                {
                  "detail": "Column",
                  "insertText": ""text"",
                  "kind": 5,
                  "label": "text",
                  "range": undefined,
                  "sortText": "1_text",
                },
                {
                  "detail": "Column",
                  "insertText": ""post_id"",
                  "kind": 5,
                  "label": "post_id",
                  "range": undefined,
                  "sortText": "1_post_id",
                },
              ]
            `)
        });

        it("should suggest columns after ORDER BY keyword", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users ORDER BY ", cursorOffset: 29 },
                singleSchemaContext, mockMonaco,
            );

            const columnLabels = suggestions.map((s) => s.label);
            expect(columnLabels).toContain("id");
            expect(columnLabels).toContain("email");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "insertText": ""id"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": ""email"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": ""created_at"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""updated_at"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""name"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
              ]
            `)
        });

        it("should suggest columns after ON keyword in JOIN", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users JOIN posts ON ", cursorOffset: 34 },
                singleSchemaContext, mockMonaco,
            );

            const columnLabels = suggestions.map((s) => s.label);
            expect(columnLabels.length).toBe(8);
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "insertText": ""id"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": ""email"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": ""created_at"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""updated_at"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""name"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "insertText": ""title"",
                  "kind": 5,
                  "label": "title",
                  "range": undefined,
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "insertText": ""content"",
                  "kind": 5,
                  "label": "content",
                  "range": undefined,
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "insertText": ""user_id"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
              ]
            `)
        });

        it("should insert quoted column name", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
                singleSchemaContext, mockMonaco,
            );

            const idSuggestion = suggestions.find((s) => s.label === "id");
            expect(idSuggestion?.insertText).toBe('"id"');
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "insertText": ""id"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": ""email"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": ""created_at"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""updated_at"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""name"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
              ]
            `)
        });
    });

    describe("context with multiple selected tables", () => {
        it("should track multiple tables from JOIN clause", () => {
            const suggestions = sqlCompletionProvider(
                {
                    fullText: "SELECT * FROM users JOIN posts ON users.id = posts.user_id WHERE ",
                    cursorOffset: 68,
                },
                singleSchemaContext, mockMonaco,
            );

            const columnLabels = suggestions.map((s) => s.label);
            // Should have columns from both users and posts
            expect(columnLabels).toContain("email"); // from users
            expect(columnLabels).toContain("title"); // from posts
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "insertText": ""id"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": ""email"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": ""created_at"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""updated_at"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""name"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "insertText": ""title"",
                  "kind": 5,
                  "label": "title",
                  "range": undefined,
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "insertText": ""content"",
                  "kind": 5,
                  "label": "content",
                  "range": undefined,
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "insertText": ""user_id"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
              ]
            `)
        });

        it("should suggest columns from all tables when no table is tracked yet", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
                singleSchemaContext, mockMonaco,
            );

            const columnLabels = suggestions.map((s) => s.label);
            expect(columnLabels.length).toBe(5);
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "insertText": ""id"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": ""email"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": ""created_at"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""updated_at"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""name"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
              ]
            `)
        });
    });

    describe("no suggestions for other contexts", () => {
        it("should return empty suggestions for unknown contexts", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT id FROM users ", cursorOffset: 21 },
                singleSchemaContext, mockMonaco
            );

            // Cursor after table name and trailing space, should suggest keywords
            // This is actually a valid context (keyword_after_table)
            expect(suggestions.length).toBe(7);
            expect(suggestions.some(s => s.label === "WHERE")).toBe(true);
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "insertText": "WHERE ",
                  "kind": 14,
                  "label": "WHERE",
                  "range": undefined,
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "ORDER BY ",
                  "kind": 14,
                  "label": "ORDER BY",
                  "range": undefined,
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "GROUP BY ",
                  "kind": 14,
                  "label": "GROUP BY",
                  "range": undefined,
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LIMIT ",
                  "kind": 14,
                  "label": "LIMIT",
                  "range": undefined,
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "JOIN ",
                  "kind": 14,
                  "label": "JOIN",
                  "range": undefined,
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LEFT JOIN ",
                  "kind": 14,
                  "label": "LEFT JOIN",
                  "range": undefined,
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "INNER JOIN ",
                  "kind": 14,
                  "label": "INNER JOIN",
                  "range": undefined,
                  "sortText": "2_INNER JOIN",
                },
              ]
            `)
        });
    });

    describe("suggestion sorting and metadata", () => {
        it("should set proper sort order for tables before keywords", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM ", cursorOffset: 14 },
                singleSchemaContext, mockMonaco,
            );

            const tableSuggestion = suggestions.find((s) => s.label === "users");
            expect(tableSuggestion?.sortText).toBe("1_users");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": ""users" ",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": ""posts" ",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": ""comments" ",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });

        it("should set proper detail for table suggestions", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM ", cursorOffset: 14 },
                singleSchemaContext, mockMonaco,
            );

            const tableSuggestion = suggestions.find((s) => s.label === "users");
            expect(tableSuggestion?.detail).toBe("Table");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": ""users" ",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": ""posts" ",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": ""comments" ",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });

        it("should set proper detail for column suggestions", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users WHERE ", cursorOffset: 26 },
                singleSchemaContext, mockMonaco,
            );

            const columnSuggestion = suggestions.find((s) => s.label === "id");
            expect(columnSuggestion?.detail).toBe("Column");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Column",
                  "insertText": ""id"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": ""email"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": ""created_at"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""updated_at"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": ""name"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
              ]
            `)
        });

        it("should set proper detail for keyword suggestions", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM users ", cursorOffset: 20 },
                singleSchemaContext, mockMonaco,
            );

            const keywordSuggestion = suggestions.find((s) => s.label === "WHERE");
            expect(keywordSuggestion?.detail).toBe("SQL Keyword");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "insertText": "WHERE ",
                  "kind": 14,
                  "label": "WHERE",
                  "range": undefined,
                  "sortText": "2_WHERE",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "ORDER BY ",
                  "kind": 14,
                  "label": "ORDER BY",
                  "range": undefined,
                  "sortText": "2_ORDER BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "GROUP BY ",
                  "kind": 14,
                  "label": "GROUP BY",
                  "range": undefined,
                  "sortText": "2_GROUP BY",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LIMIT ",
                  "kind": 14,
                  "label": "LIMIT",
                  "range": undefined,
                  "sortText": "2_LIMIT",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "JOIN ",
                  "kind": 14,
                  "label": "JOIN",
                  "range": undefined,
                  "sortText": "2_JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "LEFT JOIN ",
                  "kind": 14,
                  "label": "LEFT JOIN",
                  "range": undefined,
                  "sortText": "2_LEFT JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "insertText": "INNER JOIN ",
                  "kind": 14,
                  "label": "INNER JOIN",
                  "range": undefined,
                  "sortText": "2_INNER JOIN",
                },
              ]
            `)
        });
    });

    describe("edge cases", () => {
        it("should handle empty tables list", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "SELECT * FROM ", cursorOffset: 14 },
                { ...singleSchemaContext, tables: [] },
                mockMonaco
            );

            expect(suggestions).toEqual([]);
            expect(suggestions).toMatchInlineSnapshot(`[]`)
        });

        it("should handle empty columns list", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "", cursorOffset: 0 },
                { ...singleSchemaContext, columns: {} },
                mockMonaco
            );

            const tableLabels = suggestions.map((s) => s.label);
            expect(tableLabels).toContain("users");
            // Should have no column suggestions
            expect(suggestions.filter((s) => s.detail === "Column").length).toBe(0);
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "users"",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "posts"",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "comments"",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });

        it("should handle table with no columns in metadata", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "", cursorOffset: 0 },
                {
                    ...singleSchemaContext,
                    columns: { users: [], posts: [], comments: [] },
                },
                mockMonaco
            );

            const tableLabels = suggestions.map((s) => s.label);
            expect(tableLabels).toContain("users");
            // Should still suggest tables but no columns
            expect(suggestions.filter((s) => s.detail === "Column").length).toBe(0);
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "users"",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "posts"",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "comments"",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
              ]
            `)
        });

        it("should handle whitespace-only input as empty line", () => {
            const suggestions = sqlCompletionProvider(
                { fullText: "   \n   ", cursorOffset: 7 },
                singleSchemaContext,
                mockMonaco
            );

            const tableLabels = suggestions.map((s) => s.label);
            expect(tableLabels).toContain("users");
            expect(suggestions).toMatchInlineSnapshot(`
              [
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "users"",
                  "kind": 6,
                  "label": "users",
                  "range": undefined,
                  "sortText": "1_users",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "posts"",
                  "kind": 6,
                  "label": "posts",
                  "range": undefined,
                  "sortText": "1_posts",
                },
                {
                  "detail": "Table",
                  "insertText": "SELECT * FROM "comments"",
                  "kind": 6,
                  "label": "comments",
                  "range": undefined,
                  "sortText": "1_comments",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "users"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "email" FROM "users"",
                  "kind": 5,
                  "label": "email",
                  "range": undefined,
                  "sortText": "1_email",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "users"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "updated_at" FROM "users"",
                  "kind": 5,
                  "label": "updated_at",
                  "range": undefined,
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "name" FROM "users"",
                  "kind": 5,
                  "label": "name",
                  "range": undefined,
                  "sortText": "1_name",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "posts"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "title" FROM "posts"",
                  "kind": 5,
                  "label": "title",
                  "range": undefined,
                  "sortText": "1_title",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "content" FROM "posts"",
                  "kind": 5,
                  "label": "content",
                  "range": undefined,
                  "sortText": "1_content",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "posts"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "created_at" FROM "posts"",
                  "kind": 5,
                  "label": "created_at",
                  "range": undefined,
                  "sortText": "1_created_at",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "id" FROM "comments"",
                  "kind": 5,
                  "label": "id",
                  "range": undefined,
                  "sortText": "1_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "text" FROM "comments"",
                  "kind": 5,
                  "label": "text",
                  "range": undefined,
                  "sortText": "1_text",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "post_id" FROM "comments"",
                  "kind": 5,
                  "label": "post_id",
                  "range": undefined,
                  "sortText": "1_post_id",
                },
                {
                  "detail": "Column",
                  "insertText": "SELECT "user_id" FROM "comments"",
                  "kind": 5,
                  "label": "user_id",
                  "range": undefined,
                  "sortText": "1_user_id",
                },
              ]
            `)
        });

    });

});
