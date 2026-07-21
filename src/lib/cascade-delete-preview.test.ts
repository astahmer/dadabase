import { describe, expect, it } from "vitest";

import {
  buildCascadeDeletePreview,
  withDependentRowCounts,
  type ForeignKeyEdge,
} from "./cascade-delete-preview.ts";

describe("buildCascadeDeletePreview", () => {
  it("returns just the root table when there are no referencing edges", () => {
    const preview = buildCascadeDeletePreview({ edges: [], rootTable: "users" });
    expect(preview).toMatchObject({
      rootTable: "users",
      selectedCount: 0,
      affected: [],
      order: ["users"],
      blocked: false,
      blockedBy: [],
    });
  });

  it("cascades through a single CASCADE edge", () => {
    const edges: ForeignKeyEdge[] = [
      {
        fromTable: "orders",
        fromCols: ["user_id"],
        toTable: "users",
        toCols: ["id"],
        onDelete: "CASCADE",
      },
    ];
    const preview = buildCascadeDeletePreview({ edges, rootTable: "users" });
    expect(preview.affected).toEqual([
      { table: "orders", depth: 1, action: "cascade-delete", viaTable: "users", edge: edges[0] },
    ]);
    expect(preview.order).toEqual(["orders", "users"]);
    expect(preview.blocked).toBe(false);
  });

  it("marks SET NULL edges without recursing further", () => {
    const edges: ForeignKeyEdge[] = [
      {
        fromTable: "posts",
        fromCols: ["author_id"],
        toTable: "users",
        toCols: ["id"],
        onDelete: "SET NULL",
      },
      {
        fromTable: "comments",
        fromCols: ["post_id"],
        toTable: "posts",
        toCols: ["id"],
        onDelete: "CASCADE",
      },
    ];
    const preview = buildCascadeDeletePreview({ edges, rootTable: "users" });
    expect(preview.affected).toHaveLength(1);
    expect(preview.affected[0]).toMatchObject({ table: "posts", action: "set-null" });
    expect(preview.order).toEqual(["users"]);
  });

  it("blocks the delete on a RESTRICT edge without recursing", () => {
    const edges: ForeignKeyEdge[] = [
      {
        fromTable: "invoices",
        fromCols: ["user_id"],
        toTable: "users",
        toCols: ["id"],
        onDelete: "RESTRICT",
      },
      {
        fromTable: "line_items",
        fromCols: ["invoice_id"],
        toTable: "invoices",
        toCols: ["id"],
        onDelete: "CASCADE",
      },
    ];
    const preview = buildCascadeDeletePreview({ edges, rootTable: "users" });
    expect(preview.blocked).toBe(true);
    expect(preview.blockedBy).toHaveLength(1);
    expect(preview.blockedBy[0]?.table).toBe("invoices");
    // line_items is never reached since invoices wasn't queued for further traversal
    expect(preview.affected.some((a) => a.table === "line_items")).toBe(false);
  });

  it("treats NO ACTION like RESTRICT", () => {
    const edges: ForeignKeyEdge[] = [
      {
        fromTable: "orders",
        fromCols: ["user_id"],
        toTable: "users",
        toCols: ["id"],
        onDelete: "NO ACTION",
      },
    ];
    const preview = buildCascadeDeletePreview({ edges, rootTable: "users" });
    expect(preview.blocked).toBe(true);
    expect(preview.affected[0]?.action).toBe("restrict");
  });

  it("cascades multiple levels deep, deepest tables ordered first", () => {
    const edges: ForeignKeyEdge[] = [
      {
        fromTable: "orders",
        fromCols: ["user_id"],
        toTable: "users",
        toCols: ["id"],
        onDelete: "CASCADE",
      },
      {
        fromTable: "line_items",
        fromCols: ["order_id"],
        toTable: "orders",
        toCols: ["id"],
        onDelete: "CASCADE",
      },
    ];
    const preview = buildCascadeDeletePreview({ edges, rootTable: "users" });
    expect(preview.order).toEqual(["line_items", "orders", "users"]);
    expect(preview.affected.map((a) => a.depth)).toEqual([1, 2]);
  });

  it("does not infinite-loop on a self-referencing cascade", () => {
    const edges: ForeignKeyEdge[] = [
      {
        fromTable: "categories",
        fromCols: ["parent_id"],
        toTable: "categories",
        toCols: ["id"],
        onDelete: "CASCADE",
      },
    ];
    const preview = buildCascadeDeletePreview({ edges, rootTable: "categories" });
    expect(preview.order).toEqual(["categories"]);
  });

  it("passes through the selected row count", () => {
    const preview = buildCascadeDeletePreview({
      edges: [],
      rootTable: "users",
      selectedRows: [{ id: 1 }, { id: 2 }],
    });
    expect(preview.selectedCount).toBe(2);
  });

  it("marks RESTRICT/NO ACTION children as blocked for advisory UI only", () => {
    // Structural RESTRICT must surface as `blocked`, but callers should treat that as a
    // warning (dependent rows may or may not exist) — not a hard UI disable.
    const edges: ForeignKeyEdge[] = [
      {
        fromTable: "posts",
        fromCols: ["user_id"],
        toTable: "users",
        toCols: ["id"],
        onDelete: "NO ACTION",
      },
    ];
    const preview = buildCascadeDeletePreview({
      edges,
      rootTable: "users",
      selectedRows: [{ id: 3 }],
    });
    expect(preview.blocked).toBe(true);
    expect(preview.blockedBy.map((b) => b.table)).toEqual(["posts"]);
    expect(preview.selectedCount).toBe(1);
  });

  it("handles a diamond graph without duplicating cascaded tables in order", () => {
    const edges: ForeignKeyEdge[] = [
      { fromTable: "a", fromCols: ["id"], toTable: "root", toCols: ["id"], onDelete: "CASCADE" },
      { fromTable: "b", fromCols: ["id"], toTable: "root", toCols: ["id"], onDelete: "CASCADE" },
      { fromTable: "leaf", fromCols: ["id"], toTable: "a", toCols: ["id"], onDelete: "CASCADE" },
      { fromTable: "leaf", fromCols: ["id"], toTable: "b", toCols: ["id"], onDelete: "CASCADE" },
    ];
    const preview = buildCascadeDeletePreview({ edges, rootTable: "root" });
    const leafCount = preview.order.filter((t) => t === "leaf").length;
    expect(leafCount).toBe(1);
    expect(preview.order.at(-1)).toBe("root");
  });

  it("attaches dependent row counts when provided", () => {
    const edges: ForeignKeyEdge[] = [
      {
        fromTable: "orders",
        fromCols: ["user_id"],
        toTable: "users",
        toCols: ["id"],
        onDelete: "RESTRICT",
      },
    ];
    const preview = buildCascadeDeletePreview({ edges, rootTable: "users" });
    const withCounts = withDependentRowCounts(preview, { orders: 3 });
    expect(withCounts.affected[0]?.dependentRowCount).toBe(3);
    expect(withCounts.blockedBy[0]?.dependentRowCount).toBe(3);
  });
});
