import { describe, expect, it } from "vitest";

import type { AiColumnMeta, AiIndexMeta } from "./ai-types.ts";

import { suggestMissingIndexes } from "./suggest-missing-indexes.ts";

const columns: AiColumnMeta[] = [
  { name: "id", dataType: "uuid", nullable: false, primaryKey: true },
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
    name: "status",
    dataType: "text",
    nullable: false,
    primaryKey: false,
  },
  {
    name: "created_at",
    dataType: "timestamptz",
    nullable: false,
    primaryKey: false,
  },
];

describe("suggestMissingIndexes", () => {
  it("suggests index for unindexed FK columns", () => {
    const indexes: AiIndexMeta[] = [
      { index_name: "orders_pkey", column_name: "id", is_primary: true, is_unique: true },
    ];
    const result = suggestMissingIndexes({
      schema: "public",
      table: "orders",
      columns,
      indexes,
    });
    expect(result.some((s) => s.reason === "foreign_key" && s.columns[0] === "user_id")).toBe(true);
    expect(result[0]?.createSql).toContain("CREATE INDEX");
    expect(result[0]?.createSql).toContain("user_id");
  });

  it("does not suggest FK when already indexed", () => {
    const indexes: AiIndexMeta[] = [
      { index_name: "orders_pkey", column_name: "id", is_primary: true },
      { index_name: "orders_user_id_idx", column_name: "user_id", is_unique: false },
    ];
    const result = suggestMissingIndexes({
      schema: "public",
      table: "orders",
      columns,
      indexes,
    });
    expect(result.filter((s) => s.reason === "foreign_key")).toHaveLength(0);
  });

  it("suggests from filter and order usage", () => {
    const indexes: AiIndexMeta[] = [
      { name: "orders_pkey", columns: ["id"], isPrimary: true },
      { name: "orders_user_id_idx", columns: ["user_id"] },
    ];
    const result = suggestMissingIndexes({
      schema: "public",
      table: "orders",
      columns,
      indexes,
      filterColumns: ["status"],
      orderColumns: ["created_at"],
    });
    expect(result.some((s) => s.reason === "filter_usage" && s.columns[0] === "status")).toBe(true);
    expect(result.some((s) => s.reason === "order_usage" && s.columns[0] === "created_at")).toBe(
      true,
    );
  });

  it("dedupes suggestions and skips PK filter usage", () => {
    const result = suggestMissingIndexes({
      schema: "public",
      table: "orders",
      columns,
      indexes: [],
      filterColumns: ["id", "status", "status"],
    });
    expect(result.filter((s) => s.columns[0] === "id")).toHaveLength(0);
    expect(
      result.filter((s) => s.reason === "filter_usage" && s.columns[0] === "status"),
    ).toHaveLength(1);
  });
});
