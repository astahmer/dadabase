import { describe, expect, it } from "vitest";

import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

import { buildJoinOnSnippet, isAfterJoinKeyword } from "./build-join-on-snippet.ts";

const col = (name: string, extra: Partial<TableColumnMetadata> = {}): TableColumnMetadata => ({
  name,
  dataType: "integer",
  nullable: false,
  primaryKey: name === "id",
  unique: name === "id",
  defaultValue: null,
  ...extra,
});

describe("buildJoinOnSnippet", () => {
  const usersCols = [col("id", { primaryKey: true, unique: true })];
  const postsCols = [
    col("id", { primaryKey: true, unique: true }),
    col("user_id", {
      isForeignKey: true,
      foreignKey: {
        referencedSchema: "public",
        referencedTable: "users",
        referencedColumn: "id",
        constraintName: "posts_user_id_fkey",
      },
    }),
  ];

  it("prefers FK on the join table referencing the from table", () => {
    const snippet = buildJoinOnSnippet({
      fromTable: "users",
      joinTable: "posts",
      fromColumns: usersCols,
      joinColumns: postsCols,
    });
    expect(snippet).not.toBeNull();
    expect(snippet!.insertText).toBe(`"posts" ON "users"."id" = "posts"."user_id"`);
    expect(snippet!.detail).toContain("posts.user_id");
  });

  it("falls back to FK on the from table referencing the join table", () => {
    const ordersCols = [
      col("id", { primaryKey: true, unique: true }),
      col("customer_id", {
        isForeignKey: true,
        foreignKey: {
          referencedSchema: "public",
          referencedTable: "customers",
          referencedColumn: "id",
          constraintName: "orders_customer_id_fkey",
        },
      }),
    ];
    const customersCols = [col("id", { primaryKey: true, unique: true })];

    const snippet = buildJoinOnSnippet({
      fromTable: "orders",
      joinTable: "customers",
      fromColumns: ordersCols,
      joinColumns: customersCols,
    });
    expect(snippet!.insertText).toBe(`"customers" ON "orders"."customer_id" = "customers"."id"`);
  });

  it("uses aliases when provided", () => {
    const snippet = buildJoinOnSnippet({
      fromTable: "users",
      fromAlias: "u",
      joinTable: "posts",
      joinAlias: "p",
      fromColumns: usersCols,
      joinColumns: postsCols,
    });
    expect(snippet!.onClause).toBe(`"u"."id" = "p"."user_id"`);
  });

  it("returns null when no FK relates the tables", () => {
    expect(
      buildJoinOnSnippet({
        fromTable: "users",
        joinTable: "tags",
        fromColumns: usersCols,
        joinColumns: [col("id")],
      }),
    ).toBeNull();
  });
});

describe("isAfterJoinKeyword", () => {
  it("detects JOIN table completion contexts", () => {
    expect(isAfterJoinKeyword("SELECT * FROM users JOIN ")).toBe(true);
    expect(isAfterJoinKeyword("SELECT * FROM users LEFT JOIN po")).toBe(true);
    expect(isAfterJoinKeyword("SELECT * FROM users LEFT OUTER JOIN ")).toBe(true);
    expect(isAfterJoinKeyword("SELECT * FROM ")).toBe(false);
    expect(isAfterJoinKeyword("SELECT * FROM users WHERE ")).toBe(false);
  });
});
