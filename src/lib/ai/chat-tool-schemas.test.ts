import { describe, expect, it } from "vitest";

import {
  ExplainSqlInputSchema,
  OpenWorkspaceViewInputSchema,
  PreviewRowsInputSchema,
  TableDetailsInputSchema,
} from "./chat-tool-schemas.ts";

describe("OpenWorkspaceViewInputSchema", () => {
  it("accepts a table-only view", () => {
    const parsed = OpenWorkspaceViewInputSchema.safeParse({ table: "users" });
    expect(parsed.success).toBe(true);
  });

  it("accepts filters, orderBy and limit", () => {
    const parsed = OpenWorkspaceViewInputSchema.safeParse({
      table: "users",
      schema: "public",
      filters: [
        { column: "status", operator: "equals", value: "active" },
        { column: "deleted_at", operator: "is_null" },
      ],
      orderBy: { column: "created_at", direction: "desc" },
      limit: 50,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown operators", () => {
    const parsed = OpenWorkspaceViewInputSchema.safeParse({
      table: "users",
      filters: [{ column: "a", operator: "MATCH" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects limit above the 1000 cap", () => {
    expect(
      OpenWorkspaceViewInputSchema.safeParse({ table: "users", limit: 5000 }).success,
    ).toBe(false);
  });
});

describe("PreviewRowsInputSchema", () => {
  it("defaults limit to 8", () => {
    const parsed = PreviewRowsInputSchema.parse({ table: "users" });
    expect(parsed.limit).toBe(8);
  });

  it("caps limit at 25", () => {
    expect(PreviewRowsInputSchema.safeParse({ table: "users", limit: 100 }).success).toBe(false);
  });
});

describe("TableDetailsInputSchema / ExplainSqlInputSchema", () => {
  it("require a table name", () => {
    expect(TableDetailsInputSchema.safeParse({}).success).toBe(false);
  });

  it("require non-empty sql", () => {
    expect(ExplainSqlInputSchema.safeParse({ sql: "" }).success).toBe(false);
    expect(ExplainSqlInputSchema.safeParse({ sql: "SELECT 1" }).success).toBe(true);
  });
});
