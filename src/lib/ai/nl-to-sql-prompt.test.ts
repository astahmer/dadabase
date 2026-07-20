import { describe, expect, it } from "vitest";

import type { AiTableContext } from "./ai-types.ts";

import { buildNlToSqlPrompt, extractSqlFromModelText } from "./nl-to-sql-prompt.ts";

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

describe("buildNlToSqlPrompt", () => {
  it("includes table, columns, dialect, and question", () => {
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
  });

  it("trims the question", () => {
    const prompt = buildNlToSqlPrompt({
      question: "  count rows  ",
      table: sampleTable,
    });
    expect(prompt).toContain("User question: count rows");
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
