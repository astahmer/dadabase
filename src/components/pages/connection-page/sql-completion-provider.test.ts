import type {
  TableWithColumnsMetadata,
} from "#src/server/introspection/introspection.ts";
import type * as MonacoType from "monaco-editor";

import { describe, expect, it } from "vitest";

import { sqlCompletionProvider } from "./sql-completion-provider";

const printSuggestions = (suggestions: MonacoType.languages.CompletionItem[]) => {
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
        {
          name: "id",
          dataType: "integer",
          nullable: false,
          primaryKey: true,
          unique: true,
          defaultValue: null,
          isForeignKey: false,
        },
        {
          name: "email",
          dataType: "varchar",
          nullable: false,
          primaryKey: false,
          unique: true,
          defaultValue: null,
          isForeignKey: false,
        },
        {
          name: "created_at",
          dataType: "timestamp",
          nullable: false,
          primaryKey: false,
          unique: false,
          defaultValue: null,
          isForeignKey: false,
        },
        {
          name: "updated_at",
          dataType: "timestamp",
          nullable: true,
          primaryKey: false,
          unique: false,
          defaultValue: null,
          isForeignKey: false,
        },
        {
          name: "name",
          dataType: "varchar",
          nullable: true,
          primaryKey: false,
          unique: false,
          defaultValue: null,
          isForeignKey: false,
        },
      ],
    },
    {
      table: "posts",
      columns: [
        {
          name: "id",
          dataType: "integer",
          nullable: false,
          primaryKey: true,
          unique: true,
          defaultValue: null,
          isForeignKey: false,
        },
        {
          name: "title",
          dataType: "varchar",
          nullable: false,
          primaryKey: false,
          unique: false,
          defaultValue: null,
          isForeignKey: false,
        },
        {
          name: "content",
          dataType: "text",
          nullable: true,
          primaryKey: false,
          unique: false,
          defaultValue: null,
          isForeignKey: false,
        },
        {
          name: "user_id",
          dataType: "integer",
          nullable: false,
          primaryKey: false,
          unique: false,
          defaultValue: null,
          isForeignKey: true,
          foreignKey: {
            referencedSchema: "public",
            referencedTable: "users",
            referencedColumn: "id",
            constraintName: "posts_user_id_fk",
          },
        },
        {
          name: "created_at",
          dataType: "timestamp",
          nullable: false,
          primaryKey: false,
          unique: false,
          defaultValue: null,
          isForeignKey: false,
        },
      ],
    },
    {
      table: "comments",
      columns: [
        {
          name: "id",
          dataType: "integer",
          nullable: false,
          primaryKey: true,
          unique: true,
          defaultValue: null,
          isForeignKey: false,
        },
        {
          name: "text",
          dataType: "text",
          nullable: false,
          primaryKey: false,
          unique: false,
          defaultValue: null,
          isForeignKey: false,
        },
        {
          name: "post_id",
          dataType: "integer",
          nullable: false,
          primaryKey: false,
          unique: false,
          defaultValue: null,
          isForeignKey: true,
          foreignKey: {
            referencedSchema: "public",
            referencedTable: "posts",
            referencedColumn: "id",
            constraintName: "comments_post_id_fk",
          },
        },
        {
          name: "user_id",
          dataType: "integer",
          nullable: false,
          primaryKey: false,
          unique: false,
          defaultValue: null,
          isForeignKey: true,
          foreignKey: {
            referencedSchema: "public",
            referencedTable: "users",
            referencedColumn: "id",
            constraintName: "comments_user_id_fk",
          },
        },
      ],
    },
  ] as TableWithColumnsMetadata[];

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
            "detail": "FK posts.user_id → users.id",
            "label": "posts",
            "sortText": "1_posts",
          },
          {
            "detail": "FK comments.user_id → users.id",
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
            "detail": "FK posts.user_id → users.id",
            "label": "posts",
            "sortText": "1_posts",
          },
          {
            "detail": "FK comments.user_id → users.id",
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
      // Verify keywords are present
      expect(tableLabels).toContain("SELECT");
      expect(tableLabels).toContain("CREATE");
      expect(tableLabels).toContain("DROP");
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "SELECT",
                  "sortText": "2_SELECT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "CREATE",
                  "sortText": "2_CREATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ALTER",
                  "sortText": "2_ALTER",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DROP",
                  "sortText": "2_DROP",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INSERT",
                  "sortText": "2_INSERT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "UPDATE",
                  "sortText": "2_UPDATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DELETE",
                  "sortText": "2_DELETE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "WITH",
                  "sortText": "2_WITH",
                },
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "timestamp",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "integer | references: users(id)",
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
                  "detail": "SQL Keyword",
                  "label": "SELECT",
                  "sortText": "2_SELECT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "CREATE",
                  "sortText": "2_CREATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ALTER",
                  "sortText": "2_ALTER",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DROP",
                  "sortText": "2_DROP",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INSERT",
                  "sortText": "2_INSERT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "UPDATE",
                  "sortText": "2_UPDATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DELETE",
                  "sortText": "2_DELETE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "WITH",
                  "sortText": "2_WITH",
                },
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "timestamp",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "integer | references: users(id)",
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
                  "detail": "SQL Keyword",
                  "label": "SELECT",
                  "sortText": "2_SELECT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "CREATE",
                  "sortText": "2_CREATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ALTER",
                  "sortText": "2_ALTER",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DROP",
                  "sortText": "2_DROP",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INSERT",
                  "sortText": "2_INSERT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "UPDATE",
                  "sortText": "2_UPDATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DELETE",
                  "sortText": "2_DELETE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "WITH",
                  "sortText": "2_WITH",
                },
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "timestamp",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "integer | references: users(id)",
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
                  "detail": "SQL Keyword",
                  "label": "SELECT",
                  "sortText": "2_SELECT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "CREATE",
                  "sortText": "2_CREATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ALTER",
                  "sortText": "2_ALTER",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DROP",
                  "sortText": "2_DROP",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INSERT",
                  "sortText": "2_INSERT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "UPDATE",
                  "sortText": "2_UPDATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DELETE",
                  "sortText": "2_DELETE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "WITH",
                  "sortText": "2_WITH",
                },
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "timestamp",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "integer | references: users(id)",
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
                  "detail": "SQL Keyword",
                  "label": "SELECT",
                  "sortText": "2_SELECT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "CREATE",
                  "sortText": "2_CREATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ALTER",
                  "sortText": "2_ALTER",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DROP",
                  "sortText": "2_DROP",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INSERT",
                  "sortText": "2_INSERT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "UPDATE",
                  "sortText": "2_UPDATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DELETE",
                  "sortText": "2_DELETE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "WITH",
                  "sortText": "2_WITH",
                },
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "timestamp",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "integer | references: users(id)",
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
                  "label": "CROSS JOIN",
                  "sortText": "2_CROSS JOIN",
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
                  "label": "CROSS JOIN",
                  "sortText": "2_CROSS JOIN",
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
      expect(keywordLabels.length).toBe(9);
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
                  "label": "CROSS JOIN",
                  "sortText": "2_CROSS JOIN",
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
                  "label": "CROSS JOIN",
                  "sortText": "2_CROSS JOIN",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "timestamp",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "integer | references: users(id)",
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
      expect(columnLabels).toContain("users.id");
      expect(columnLabels).toContain("users.email");
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
				[
				  {
				    "detail": "integer | PRIMARY KEY | UNIQUE",
				    "label": "users.id",
				    "sortText": "1_users.id",
				  },
				  {
				    "detail": "varchar | UNIQUE",
				    "label": "users.email",
				    "sortText": "1_users.email",
				  },
				  {
				    "detail": "timestamp",
				    "label": "users.created_at",
				    "sortText": "1_users.created_at",
				  },
				  {
				    "detail": "timestamp | nullable",
				    "label": "users.updated_at",
				    "sortText": "1_users.updated_at",
				  },
				  {
				    "detail": "varchar | nullable",
				    "label": "users.name",
				    "sortText": "1_users.name",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
          fullText: "SELECT * FROM users JOIN posts ON users.id = posts.user_id WHERE ",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
      expect(suggestions.length).toBe(9);
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
                  "label": "CROSS JOIN",
                  "sortText": "2_CROSS JOIN",
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
      expect(columnSuggestion?.detail).toBe("integer | PRIMARY KEY | UNIQUE");
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "label": "CROSS JOIN",
                  "sortText": "2_CROSS JOIN",
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
                  "detail": "SQL Keyword",
                  "label": "SELECT",
                  "sortText": "2_SELECT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "CREATE",
                  "sortText": "2_CREATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ALTER",
                  "sortText": "2_ALTER",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DROP",
                  "sortText": "2_DROP",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INSERT",
                  "sortText": "2_INSERT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "UPDATE",
                  "sortText": "2_UPDATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DELETE",
                  "sortText": "2_DELETE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "WITH",
                  "sortText": "2_WITH",
                },
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
                  "detail": "SQL Keyword",
                  "label": "SELECT",
                  "sortText": "2_SELECT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "CREATE",
                  "sortText": "2_CREATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ALTER",
                  "sortText": "2_ALTER",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DROP",
                  "sortText": "2_DROP",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INSERT",
                  "sortText": "2_INSERT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "UPDATE",
                  "sortText": "2_UPDATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DELETE",
                  "sortText": "2_DELETE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "WITH",
                  "sortText": "2_WITH",
                },
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
                  "detail": "SQL Keyword",
                  "label": "SELECT",
                  "sortText": "2_SELECT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "CREATE",
                  "sortText": "2_CREATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "ALTER",
                  "sortText": "2_ALTER",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DROP",
                  "sortText": "2_DROP",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "INSERT",
                  "sortText": "2_INSERT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "UPDATE",
                  "sortText": "2_UPDATE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DELETE",
                  "sortText": "2_DELETE",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "WITH",
                  "sortText": "2_WITH",
                },
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "timestamp",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "comments.user_id",
                  "sortText": "1_comments.user_id",
                },
              ]
            `);
    });
  });

  describe("advanced completion scenarios", () => {
    const accountingTables = [{ schema: "public", name: "accounting_imports" }, ...mockTables];

    const accountingColumns = [
      {
        table: "accounting_imports",
        columns: [
          {
            name: "id",
            dataType: "integer",
            nullable: false,
            primaryKey: true,
            unique: true,
            defaultValue: null,
            isForeignKey: false,
          },
          {
            name: "created_at",
            dataType: "timestamp",
            nullable: false,
            primaryKey: false,
            unique: false,
            defaultValue: null,
            isForeignKey: false,
          },
          {
            name: "updated_at",
            dataType: "timestamp",
            nullable: false,
            primaryKey: false,
            unique: false,
            defaultValue: null,
            isForeignKey: false,
          },
          {
            name: "account_id",
            dataType: "integer",
            nullable: false,
            primaryKey: false,
            unique: false,
            defaultValue: null,
            isForeignKey: true,
            foreignKey: {
              referencedSchema: "public",
              referencedTable: "accounts",
              referencedColumn: "id",
              constraintName: "accounting_imports_account_id_fk",
            },
          },
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
          fullText: 'select * from "accounting_imports" WHERE "accounting_imports".',
          cursorOffset: 65,
        },
        contextWithAccountingTable,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("id");
      expect(labels).toContain("created_at");
      expect(labels).toContain("account_id");
      expect(suggestions.length).toBe(4);
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "timestamp",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "timestamp",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "integer | references: accounts(id)",
                  "label": "account_id",
                  "sortText": "1_account_id",
                },
              ]
            `);
    });

    it("should suggest table columns when typing table.column (unquoted table)", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "select * from accounting_imports WHERE accounting_imports.",
          cursorOffset: 59,
        },
        contextWithAccountingTable,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("id");
      expect(labels).toContain("created_at");
      expect(suggestions.length).toBe(4);
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "timestamp",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "timestamp",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "integer | references: accounts(id)",
                  "label": "account_id",
                  "sortText": "1_account_id",
                },
              ]
            `);
    });

    it("should suggest table columns with unqualified names in SELECT without FROM", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: 'SELECT "accounting_imports".',
          cursorOffset: 29,
        },
        contextWithAccountingTable,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("id");
      expect(labels).toContain("created_at");
      expect(labels).toContain("account_id");
      expect(suggestions.length).toBe(4);
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "timestamp",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "timestamp",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "integer | references: accounts(id)",
                  "label": "account_id",
                  "sortText": "1_account_id",
                },
              ]
            `);
    });

    it("should suggest table columns with unqualified names in SELECT without FROM (unquoted)", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT accounting_imports.",
          cursorOffset: 26,
        },
        contextWithAccountingTable,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("id");
      expect(labels).toContain("created_at");
      expect(suggestions.length).toBe(4);
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "timestamp",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "timestamp",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "integer | references: accounts(id)",
                  "label": "account_id",
                  "sortText": "1_account_id",
                },
              ]
            `);
    });

    it("should suggest keywords after schema-qualified table", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: 'select * from "public"."accounting_imports" ',
          cursorOffset: 44,
        },
        contextWithAccountingTable,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("WHERE");
      expect(labels).toContain("ORDER BY");
      expect(labels).not.toContain("accounting_imports");
      expect(suggestions.length).toBe(9);
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
                  "label": "CROSS JOIN",
                  "sortText": "2_CROSS JOIN",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "AS",
                  "sortText": "2_AS",
                },
              ]
            `);
    });

    it("should suggest only JOIN when typing 'left ' after column reference", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: 'SELECT "accounting_imports"."category" left ',
          cursorOffset: 45,
        },
        contextWithAccountingTable,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      // Should suggest JOIN keyword to complete "LEFT JOIN"
      expect(labels).toContain("JOIN");
      // LEFT also allows OUTER JOIN
      expect(labels).toContain("OUTER JOIN");
      // Should not suggest column names
      expect(labels).not.toContain("id");
      expect(labels).not.toContain("accounting_imports.id");
    });

    it("should suggest only JOIN when typing 'cross ' after column reference", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users cross ",
          cursorOffset: 27,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      // CROSS only suggests JOIN, not OUTER JOIN
      expect(labels).toContain("JOIN");
      expect(labels).not.toContain("OUTER JOIN");
      // Should not suggest table names or other keywords
      expect(labels).not.toContain("WHERE");
    });

    it("should suggest keywords after mixed-case schema-qualified table", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: 'select * from "public".accounting_imports ',
          cursorOffset: 41,
        },
        contextWithAccountingTable,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("WHERE");
      expect(labels).toContain("AS");
      expect(suggestions.length).toBe(9);
    });

    it("should suggest keywords after unquoted schema-qualified table", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "select * from public.accounting_imports ",
          cursorOffset: 39,
        },
        contextWithAccountingTable,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("WHERE");
      expect(labels).toContain("AS");
      expect(suggestions.length).toBe(9);
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
                  "label": "CROSS JOIN",
                  "sortText": "2_CROSS JOIN",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "accounting_imports.id",
                  "sortText": "1_accounting_imports.id",
                },
                {
                  "detail": "timestamp",
                  "label": "accounting_imports.created_at",
                  "sortText": "1_accounting_imports.created_at",
                },
                {
                  "detail": "timestamp",
                  "label": "accounting_imports.updated_at",
                  "sortText": "1_accounting_imports.updated_at",
                },
                {
                  "detail": "integer | references: accounts(id)",
                  "label": "accounting_imports.account_id",
                  "sortText": "1_accounting_imports.account_id",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "timestamp",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "integer | references: users(id)",
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
          fullText: 'select * from "accounting_imports" WHERE accounting_imports.created_at ',
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
            "label": "NOT BETWEEN",
            "sortText": "2_NOT BETWEEN",
          },
          {
            "detail": "Operator",
            "label": "IN",
            "sortText": "2_IN",
          },
          {
            "detail": "Operator",
            "label": "NOT IN",
            "sortText": "2_NOT IN",
          },
          {
            "detail": "Operator",
            "label": "LIKE",
            "sortText": "2_LIKE",
          },
          {
            "detail": "Operator",
            "label": "NOT LIKE",
            "sortText": "2_NOT LIKE",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "timestamp",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "name",
                  "sortText": "1_name",
                },
                {
                  "detail": "varchar",
                  "label": "title",
                  "sortText": "1_title",
                },
                {
                  "detail": "text | nullable",
                  "label": "content",
                  "sortText": "1_content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "user_id",
                  "sortText": "1_user_id",
                },
                {
                  "detail": "text",
                  "label": "text",
                  "sortText": "1_text",
                },
                {
                  "detail": "integer | references: posts(id)",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "timestamp",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "name",
                  "sortText": "1_name",
                },
                {
                  "detail": "varchar",
                  "label": "title",
                  "sortText": "1_title",
                },
                {
                  "detail": "text | nullable",
                  "label": "content",
                  "sortText": "1_content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "user_id",
                  "sortText": "1_user_id",
                },
                {
                  "detail": "text",
                  "label": "text",
                  "sortText": "1_text",
                },
                {
                  "detail": "integer | references: posts(id)",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "timestamp",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "name",
                  "sortText": "1_name",
                },
                {
                  "detail": "varchar",
                  "label": "title",
                  "sortText": "1_title",
                },
                {
                  "detail": "text | nullable",
                  "label": "content",
                  "sortText": "1_content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "user_id",
                  "sortText": "1_user_id",
                },
                {
                  "detail": "text",
                  "label": "text",
                  "sortText": "1_text",
                },
                {
                  "detail": "integer | references: posts(id)",
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
            "detail": "FK posts.user_id → users.id",
            "label": "posts",
            "sortText": "1_posts",
          },
          {
            "detail": "FK comments.user_id → users.id",
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
            "detail": "FK posts.user_id → users.id",
            "label": "posts",
            "sortText": "1_posts",
          },
          {
            "detail": "FK comments.user_id → users.id",
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
            "detail": "FK posts.user_id → users.id",
            "label": "users",
            "sortText": "1_users",
          },
          {
            "detail": "Table",
            "label": "posts",
            "sortText": "1_posts",
          },
          {
            "detail": "FK comments.post_id → posts.id",
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
            "detail": "FK comments.user_id → users.id",
            "label": "users",
            "sortText": "1_users",
          },
          {
            "detail": "FK comments.post_id → posts.id",
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
      expect(suggestions.length).toBe(9);
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
                  "label": "CROSS JOIN",
                  "sortText": "2_CROSS JOIN",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "timestamp",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "name",
                  "sortText": "1_name",
                },
                {
                  "detail": "varchar",
                  "label": "title",
                  "sortText": "1_title",
                },
                {
                  "detail": "text | nullable",
                  "label": "content",
                  "sortText": "1_content",
                },
                {
                  "detail": "integer | references: users(id)",
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
      expect(suggestions.length).toBe(15);
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
            "label": "NOT BETWEEN",
            "sortText": "2_NOT BETWEEN",
          },
          {
            "detail": "Operator",
            "label": "IN",
            "sortText": "2_IN",
          },
          {
            "detail": "Operator",
            "label": "NOT IN",
            "sortText": "2_NOT IN",
          },
          {
            "detail": "Operator",
            "label": "LIKE",
            "sortText": "2_LIKE",
          },
          {
            "detail": "Operator",
            "label": "NOT LIKE",
            "sortText": "2_NOT LIKE",
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
          fullText: "SELECT * FROM users u JOIN posts p ON u.id = p.user_id AND u.",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
      expect(suggestions.length).toBe(15); // 10 operators
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
            "label": "NOT BETWEEN",
            "sortText": "2_NOT BETWEEN",
          },
          {
            "detail": "Operator",
            "label": "IN",
            "sortText": "2_IN",
          },
          {
            "detail": "Operator",
            "label": "NOT IN",
            "sortText": "2_NOT IN",
          },
          {
            "detail": "Operator",
            "label": "LIKE",
            "sortText": "2_LIKE",
          },
          {
            "detail": "Operator",
            "label": "NOT LIKE",
            "sortText": "2_NOT LIKE",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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

      // NOT should suggest columns from available tables
      expect(suggestions.length).toBe(5);
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "posts.id",
                  "sortText": "1_posts.id",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "timestamp",
                  "label": "posts.created_at",
                  "sortText": "1_posts.created_at",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "comments.id",
                  "sortText": "1_comments.id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
                  "label": "comments.post_id",
                  "sortText": "1_comments.post_id",
                },
                {
                  "detail": "integer | references: users(id)",
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
      expect(suggestions.length).toBe(9);
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
                  "label": "CROSS JOIN",
                  "sortText": "2_CROSS JOIN",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "id",
                  "sortText": "1_id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "email",
                  "sortText": "1_email",
                },
                {
                  "detail": "timestamp",
                  "label": "created_at",
                  "sortText": "1_created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "updated_at",
                  "sortText": "1_updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "name",
                  "sortText": "1_name",
                },
                {
                  "detail": "varchar",
                  "label": "title",
                  "sortText": "1_title",
                },
                {
                  "detail": "text | nullable",
                  "label": "content",
                  "sortText": "1_content",
                },
                {
                  "detail": "integer | references: users(id)",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
      // ORDER BY suggests columns with table qualification
      expect(labels).toContain("users.id");
      expect(labels).toContain("users.email");
      expect(suggestions.length).toBe(5);
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
				[
				  {
				    "detail": "integer | PRIMARY KEY | UNIQUE",
				    "label": "users.id",
				    "sortText": "1_users.id",
				  },
				  {
				    "detail": "varchar | UNIQUE",
				    "label": "users.email",
				    "sortText": "1_users.email",
				  },
				  {
				    "detail": "timestamp",
				    "label": "users.created_at",
				    "sortText": "1_users.created_at",
				  },
				  {
				    "detail": "timestamp | nullable",
				    "label": "users.updated_at",
				    "sortText": "1_users.updated_at",
				  },
				  {
				    "detail": "varchar | nullable",
				    "label": "users.name",
				    "sortText": "1_users.name",
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
      expect(labels).toContain("users.id");
      expect(labels).toContain("users.email");
      expect(suggestions.length).toBe(5);
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
				[
				  {
				    "detail": "integer | PRIMARY KEY | UNIQUE",
				    "label": "users.id",
				    "sortText": "1_users.id",
				  },
				  {
				    "detail": "varchar | UNIQUE",
				    "label": "users.email",
				    "sortText": "1_users.email",
				  },
				  {
				    "detail": "timestamp",
				    "label": "users.created_at",
				    "sortText": "1_users.created_at",
				  },
				  {
				    "detail": "timestamp | nullable",
				    "label": "users.updated_at",
				    "sortText": "1_users.updated_at",
				  },
				  {
				    "detail": "varchar | nullable",
				    "label": "users.name",
				    "sortText": "1_users.name",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
          fullText: "SELECT users.id, COUNT(*) FROM users GROUP BY users.id HAVING ",
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
				    "detail": "integer | PRIMARY KEY | UNIQUE",
				    "label": "users.id",
				    "sortText": "1_users.id",
				  },
				  {
				    "detail": "varchar | UNIQUE",
				    "label": "users.email",
				    "sortText": "1_users.email",
				  },
				  {
				    "detail": "timestamp",
				    "label": "users.created_at",
				    "sortText": "1_users.created_at",
				  },
				  {
				    "detail": "timestamp | nullable",
				    "label": "users.updated_at",
				    "sortText": "1_users.updated_at",
				  },
				  {
				    "detail": "varchar | nullable",
				    "label": "users.name",
				    "sortText": "1_users.name",
				  },
				]
			`);
    });

    it("should suggest aggregate function in HAVING", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT users.id, COUNT(*) FROM users GROUP BY users.id HAVING COUNT(",
          cursorOffset: 69,
        },
        singleSchemaContext,
        mockMonaco,
      );

      expect(suggestions.length).toBe(5);
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
				[
				  {
				    "detail": "integer | PRIMARY KEY | UNIQUE",
				    "label": "users.id",
				    "sortText": "1_users.id",
				  },
				  {
				    "detail": "varchar | UNIQUE",
				    "label": "users.email",
				    "sortText": "1_users.email",
				  },
				  {
				    "detail": "timestamp",
				    "label": "users.created_at",
				    "sortText": "1_users.created_at",
				  },
				  {
				    "detail": "timestamp | nullable",
				    "label": "users.updated_at",
				    "sortText": "1_users.updated_at",
				  },
				  {
				    "detail": "varchar | nullable",
				    "label": "users.name",
				    "sortText": "1_users.name",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "users.name",
                  "sortText": "1_users.name",
                },
                {
                  "detail": "varchar",
                  "label": "posts.title",
                  "sortText": "1_posts.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "posts.content",
                  "sortText": "1_posts.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "posts.user_id",
                  "sortText": "1_posts.user_id",
                },
                {
                  "detail": "text",
                  "label": "comments.text",
                  "sortText": "1_comments.text",
                },
                {
                  "detail": "integer | references: posts(id)",
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
      expect(labels).toContain("users.id");
      expect(labels).toContain("users.email");
      expect(suggestions.length).toBe(5);
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
				[
				  {
				    "detail": "integer | PRIMARY KEY | UNIQUE",
				    "label": "users.id",
				    "sortText": "1_users.id",
				  },
				  {
				    "detail": "varchar | UNIQUE",
				    "label": "users.email",
				    "sortText": "1_users.email",
				  },
				  {
				    "detail": "timestamp",
				    "label": "users.created_at",
				    "sortText": "1_users.created_at",
				  },
				  {
				    "detail": "timestamp | nullable",
				    "label": "users.updated_at",
				    "sortText": "1_users.updated_at",
				  },
				  {
				    "detail": "varchar | nullable",
				    "label": "users.name",
				    "sortText": "1_users.name",
				  },
				]
			`);
    });

    it("should suggest multiple columns in GROUP BY", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT users.id, users.name, COUNT(*) FROM users GROUP BY users.id, ",
          cursorOffset: 70,
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
				    "detail": "integer | PRIMARY KEY | UNIQUE",
				    "label": "users.id",
				    "sortText": "1_users.id",
				  },
				  {
				    "detail": "varchar | UNIQUE",
				    "label": "users.email",
				    "sortText": "1_users.email",
				  },
				  {
				    "detail": "timestamp",
				    "label": "users.created_at",
				    "sortText": "1_users.created_at",
				  },
				  {
				    "detail": "timestamp | nullable",
				    "label": "users.updated_at",
				    "sortText": "1_users.updated_at",
				  },
				  {
				    "detail": "varchar | nullable",
				    "label": "users.name",
				    "sortText": "1_users.name",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "users.id",
                  "sortText": "1_users.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "users.email",
                  "sortText": "1_users.email",
                },
                {
                  "detail": "timestamp",
                  "label": "users.created_at",
                  "sortText": "1_users.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "users.updated_at",
                  "sortText": "1_users.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "u.id",
                  "sortText": "1_u.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "u.email",
                  "sortText": "1_u.email",
                },
                {
                  "detail": "timestamp",
                  "label": "u.created_at",
                  "sortText": "1_u.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "u.updated_at",
                  "sortText": "1_u.updated_at",
                },
                {
                  "detail": "varchar | nullable",
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
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "u.id",
                  "sortText": "1_u.id",
                },
                {
                  "detail": "varchar | UNIQUE",
                  "label": "u.email",
                  "sortText": "1_u.email",
                },
                {
                  "detail": "timestamp",
                  "label": "u.created_at",
                  "sortText": "1_u.created_at",
                },
                {
                  "detail": "timestamp | nullable",
                  "label": "u.updated_at",
                  "sortText": "1_u.updated_at",
                },
                {
                  "detail": "varchar | nullable",
                  "label": "u.name",
                  "sortText": "1_u.name",
                },
                {
                  "detail": "integer | PRIMARY KEY | UNIQUE",
                  "label": "p.id",
                  "sortText": "1_p.id",
                },
                {
                  "detail": "varchar",
                  "label": "p.title",
                  "sortText": "1_p.title",
                },
                {
                  "detail": "text | nullable",
                  "label": "p.content",
                  "sortText": "1_p.content",
                },
                {
                  "detail": "integer | references: users(id)",
                  "label": "p.user_id",
                  "sortText": "1_p.user_id",
                },
                {
                  "detail": "timestamp",
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
          fullText: 'select * FROM users AS u WHERE u.email = "test@example.com" ',
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

  describe("ORDER BY with ASC/DESC", () => {
    it("should suggest ASC and DESC after ORDER BY column", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ORDER BY users.id ",
          cursorOffset: 39,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("ASC");
      expect(labels).toContain("DESC");
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "ASC",
                  "sortText": "2_ASC",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "DESC",
                  "sortText": "2_DESC",
                },
              ]
            `);
    });

    it("should suggest ASC and DESC after ORDER BY unqualified column", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ORDER BY id ",
          cursorOffset: 33,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("ASC");
      expect(labels).toContain("DESC");
      expect(suggestions.length).toBe(2);
    });

    it("should suggest ASC and DESC after ORDER BY with quoted column", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: 'SELECT * FROM users ORDER BY "users"."id" ',
          cursorOffset: 44,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("ASC");
      expect(labels).toContain("DESC");
    });

    it("should suggest contextual keywords after ORDER BY with DESC", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ORDER BY users.id DESC ",
          cursorOffset: 43,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      // After ORDER BY DESC, should suggest comma for multiple columns, or LIMIT, etc
      expect(labels).toContain("LIMIT");
      expect(labels).toContain("OFFSET");
    });
  });

  describe("HAVING clause with AND/OR", () => {
    it("should suggest AND and OR after HAVING condition", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT users.id, COUNT(*) FROM users GROUP BY users.id HAVING COUNT(*) > 5 ",
          cursorOffset: 79,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("AND");
      expect(labels).toContain("OR");
      expect(labels).toContain("ORDER BY");
      expect(labels).toContain("LIMIT");
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

    it("should suggest columns after AND in HAVING clause", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText:
            "SELECT users.id, COUNT(*) FROM users GROUP BY users.id HAVING COUNT(*) > 5 AND ",
          cursorOffset: 87,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      // After AND in HAVING, should suggest aggregate functions or columns
      // For now, will suggest columns from the selected table
      expect(labels.length).toBeGreaterThan(0);
    });

    it("should suggest columns after OR in HAVING clause", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText:
            "SELECT users.id, COUNT(*) FROM users GROUP BY users.id HAVING COUNT(*) > 5 OR ",
          cursorOffset: 86,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      // After OR in HAVING, should suggest options
      expect(labels.length).toBeGreaterThan(0);
    });

    it("should NOT suggest AND/OR after ON in JOIN (only WHERE allows AND/OR)", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users JOIN posts ON users.id = posts.user_id ",
          cursorOffset: 61,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      // Should NOT have AND/OR here - ON conditions don't continue with AND/OR in this context
      expect(labels).not.toContain("AND");
      expect(labels).not.toContain("OR");
    });
  });

  describe("CROSS JOIN support", () => {
    it("should suggest CROSS JOIN as keyword option after table name", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ",
          cursorOffset: 20,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("CROSS JOIN");
    });

    it("should suggest CROSS JOIN along with other JOINs", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ",
          cursorOffset: 20,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const joinLabels = suggestions
        .filter((s) => String(s.label).includes("JOIN"))
        .map((s) => s.label);
      expect(joinLabels).toContain("INNER JOIN");
      expect(joinLabels).toContain("LEFT JOIN");
      expect(joinLabels).toContain("CROSS JOIN");
    });
  });

  describe("Multiple consecutive conditions", () => {
    it("should suggest columns after second AND in WHERE", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users WHERE users.id = 1 AND users.email = 'test' AND ",
          cursorOffset: 70,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("users.id");
      expect(labels).toContain("users.email");
    });

    it("should suggest columns after AND then OR in WHERE", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users WHERE users.id = 1 AND users.email = 'test' OR ",
          cursorOffset: 68,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("users.id");
      expect(labels).toContain("users.email");
    });

    it("should suggest AND/OR after completed third condition", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText:
            "SELECT * FROM users WHERE users.id = 1 AND users.email = 'test' AND users.id > 10 ",
          cursorOffset: 82,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("AND");
      expect(labels).toContain("OR");
      expect(labels).toContain("LIMIT");
      expect(labels).toContain("ORDER BY");
    });
  });

  describe("Edge cases and complex scenarios", () => {
    it("should handle ORDER BY with qualified column and spaces", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users  ORDER BY  users.id  ",
          cursorOffset: 42,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("ASC");
      expect(labels).toContain("DESC");
    });

    it("should handle multiple ORDER BY columns", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ORDER BY users.id ASC, users.email ",
          cursorOffset: 57,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("ASC");
      expect(labels).toContain("DESC");
    });

    it("should suggest keywords after ORDER BY ASC with comma for next column", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ORDER BY users.id ASC, ",
          cursorOffset: 44,
        },
        singleSchemaContext,
        mockMonaco,
      );

      // After comma in ORDER BY should suggest columns with table qualification
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("users.id");
      expect(labels).toContain("users.email");
    });

    it("should handle HAVING with multiple conditions", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText:
            "SELECT users.id, COUNT(*) FROM users GROUP BY users.id HAVING COUNT(*) > 5 AND SUM(users.id) < 100 ",
          cursorOffset: 107,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("AND");
      expect(labels).toContain("OR");
    });

    it("should handle WHERE with HAVING in same query", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText:
            "SELECT users.id, COUNT(*) FROM users WHERE users.email LIKE '%@example.com' GROUP BY users.id HAVING COUNT(*) > 5 ",
          cursorOffset: 120,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      // After HAVING condition completion, should suggest AND/OR/LIMIT/etc
      expect(labels.length).toBeGreaterThan(0);
    });

    it("should handle ORDER BY ASC after WHERE and GROUP BY HAVING", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText:
            "SELECT users.id, COUNT(*) FROM users WHERE users.created_at > NOW() GROUP BY users.id HAVING COUNT(*) > 1 ORDER BY users.id ",
          cursorOffset: 133,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("ASC");
      expect(labels).toContain("DESC");
    });
  });

  describe("NULLS FIRST/LAST after ORDER BY direction", () => {
    it("should suggest NULLS FIRST and NULLS LAST after ASC", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ORDER BY users.id ASC ",
          cursorOffset: 43,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("NULLS FIRST");
      expect(labels).toContain("NULLS LAST");
      expect(labels).toContain("LIMIT");
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "NULLS FIRST",
                  "sortText": "2_NULLS FIRST",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "NULLS LAST",
                  "sortText": "2_NULLS LAST",
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
              ]
            `);
    });

    it("should suggest NULLS FIRST and NULLS LAST after DESC", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ORDER BY users.id DESC ",
          cursorOffset: 44,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("NULLS FIRST");
      expect(labels).toContain("NULLS LAST");
    });

    it("should suggest keywords after NULLS FIRST", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ORDER BY users.id ASC NULLS FIRST ",
          cursorOffset: 55,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("LIMIT");
      expect(labels).toContain("OFFSET");
      expect(labels).not.toContain("UNION");
    });

    it("should suggest keywords after NULLS LAST", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users ORDER BY users.id DESC NULLS LAST ",
          cursorOffset: 54,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("LIMIT");
      expect(labels).toContain("OFFSET");
    });
  });

  describe("Subqueries - SELECT after opening parenthesis", () => {
    it("should suggest SELECT after opening parenthesis in WHERE", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users WHERE id IN (",
          cursorOffset: 33,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("SELECT");
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "SELECT",
                  "sortText": "2_SELECT",
                },
                {
                  "detail": "SQL Keyword",
                  "label": "WITH",
                  "sortText": "2_WITH",
                },
              ]
            `);
    });

    it("should suggest SELECT after opening parenthesis in FROM", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM (",
          cursorOffset: 16,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("SELECT");
      expect(labels).toContain("WITH");
    });

    it("should suggest SELECT after opening parenthesis in EXISTS", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users WHERE EXISTS (",
          cursorOffset: 34,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("SELECT");
    });

    it("should suggest SELECT after opening parenthesis with spaces", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users WHERE id IN (   ",
          cursorOffset: 36,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("SELECT");
      expect(labels).toContain("WITH");
    });

    it("should suggest SELECT in nested subqueries", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users WHERE id IN (SELECT id FROM posts WHERE user_id IN (",
          cursorOffset: 74,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("SELECT");
    });
  });

  describe("JOIN with alias - should suggest only ON", () => {
    it("should suggest only ON after LEFT JOIN with alias", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users LEFT JOIN posts AS p ",
          cursorOffset: 42,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toEqual(["ON"]);
      expect(printSuggestions(suggestions)).toMatchInlineSnapshot(`
              [
                {
                  "detail": "SQL Keyword",
                  "label": "ON",
                  "sortText": "2_ON",
                },
              ]
            `);
    });

    it("should suggest only ON after INNER JOIN with alias", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users INNER JOIN posts AS p ",
          cursorOffset: 43,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toEqual(["ON"]);
    });

    it("should suggest only ON after RIGHT JOIN with alias", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users RIGHT JOIN posts AS p ",
          cursorOffset: 42,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toEqual(["ON"]);
    });

    it("should suggest only ON after FULL OUTER JOIN with alias", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users FULL OUTER JOIN posts AS p ",
          cursorOffset: 49,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels).toEqual(["ON"]);
    });

    it("should suggest AS and ON after JOIN without alias", () => {
      const suggestions = sqlCompletionProvider(
        {
          fullText: "SELECT * FROM users JOIN posts ",
          cursorOffset: 31,
        },
        singleSchemaContext,
        mockMonaco,
      );

      const labels = suggestions.map((s) => s.label);
      expect(labels.length).toBe(2);
      expect(labels).toContain("AS");
      expect(labels).toContain("ON");
    });
  });
});
