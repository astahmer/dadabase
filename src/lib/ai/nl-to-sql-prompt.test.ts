import { describe, expect, it } from "vitest";

import type { AiSchemaContext, AiTableContext } from "./ai-types.ts";

import {
  buildChatSystemPrompt,
  buildNlToSqlChatPrompt,
  buildNlToSqlPrompt,
  extractSqlFromModelText,
} from "./nl-to-sql-prompt.ts";

const sampleTable: AiTableContext = {
  schema: "public",
  table: "orders",
  dialect: "postgres",
  columns: [
    {
      name: "id",
      dataType: "uuid",
      nullable: false,
      primaryKey: true,
    },
    {
      name: "status",
      dataType: "text",
      nullable: false,
      primaryKey: false,
      isEnum: true,
      enumValues: ["pending", "shipped", "cancelled"],
    },
    {
      name: "user_id",
      dataType: "uuid",
      nullable: false,
      primaryKey: false,
      isForeignKey: true,
      foreignKey: {
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
      },
    },
    {
      name: "created_at",
      dataType: "timestamptz",
      nullable: false,
      primaryKey: false,
    },
  ],
};

const usersTable: AiTableContext = {
  schema: "public",
  table: "users",
  dialect: "postgres",
  columns: [
    { name: "id", dataType: "uuid", nullable: false, primaryKey: true },
    { name: "email", dataType: "text", nullable: false, primaryKey: false },
  ],
};

const sampleSchema: AiSchemaContext = {
  schema: "public",
  dialect: "postgres",
  tables: [sampleTable, usersTable],
  activeTable: "orders",
};

describe("buildNlToSqlPrompt", () => {
  it("includes table, columns, dialect, and question (legacy single table)", () => {
    const prompt = buildNlToSqlPrompt({
      question: "show pending orders",
      table: sampleTable,
    });

    expect(prompt).toContain("Dialect: postgres");
    expect(prompt).toContain('"public"."orders"');
    expect(prompt).toContain("- status text");
    expect(prompt).toContain("ENUM(pending|shipped|cancelled)");
    expect(prompt).toContain("FK→public.users.id");
    expect(prompt).toContain("User question: show pending orders");
    expect(prompt).toContain("Output ONLY the SQL statement");
    expect(prompt).toContain("Always include a safe LIMIT");
    expect(prompt).toContain("GROUP BY");
  });

  it("includes the whole database schema when provided", () => {
    const prompt = buildNlToSqlPrompt({
      question: "list order emails",
      schema: sampleSchema,
    });

    expect(prompt).toContain("FULL database schema");
    expect(prompt).toContain('"public"."orders"');
    expect(prompt).toContain('"public"."users"');
    expect(prompt).toContain("- email text");
    expect(prompt).toContain('currently has table "orders" open');
  });

  it("trims the question", () => {
    const prompt = buildNlToSqlPrompt({
      question: "  count rows  ",
      table: sampleTable,
    });
    expect(prompt).toContain("User question: count rows");
  });
});

describe("buildChatSystemPrompt tool filtering", () => {
  const schema = undefined;

  it("mentions both tools by default (no enabledTools given)", () => {
    const prompt = buildChatSystemPrompt({ schema });
    expect(prompt).toContain("propose_sql");
    expect(prompt).toContain("run_sql");
    expect(prompt).toContain("Do not ask a clarification question before trying");
    expect(prompt).toContain("matches what the user expected");
  });

  it("drops run_sql instructions when run_sql is disabled", () => {
    const prompt = buildChatSystemPrompt({ schema, enabledTools: ["propose_sql"] });
    expect(prompt).toContain("propose_sql");
    expect(prompt).not.toContain("run_sql");
  });

  it("drops all workflow tool lines when every tool is disabled", () => {
    const prompt = buildChatSystemPrompt({ schema, enabledTools: [] });
    expect(prompt).not.toContain("propose_sql");
    expect(prompt).not.toContain("run_sql");
    expect(prompt).toContain("plain language");
  });
});

describe("extractSqlFromModelText", () => {
  it("returns plain SQL as-is", () => {
    expect(extractSqlFromModelText("SELECT 1")).toBe("SELECT 1");
  });

  it("strips markdown fences", () => {
    expect(extractSqlFromModelText("```sql\nSELECT * FROM t;\n```")).toBe("SELECT * FROM t;");
  });

  it("strips SQL: prefix", () => {
    expect(extractSqlFromModelText("SQL: SELECT 1")).toBe("SELECT 1");
  });
});

describe("buildNlToSqlChatPrompt", () => {
  it("includes prior turns", () => {
    const prompt = buildNlToSqlChatPrompt({
      question: "now filter by status",
      table: sampleTable,
      history: [
        { role: "user", content: "list orders" },
        { role: "assistant", content: "SELECT * FROM orders LIMIT 100" },
      ],
    });
    expect(prompt).toContain("Conversation so far");
    expect(prompt).toContain("list orders");
    expect(prompt).toContain("SELECT * FROM orders");
    expect(prompt).toContain("now filter by status");
  });
});
