import { describe, expect, it } from "vitest";

import { buildErDiagramLayout } from "./layout.ts";

describe("buildErDiagramLayout", () => {
  it("places an isolated table at the origin margin", () => {
    const layout = buildErDiagramLayout({ tables: [{ id: "users", columnCount: 3 }], edges: [] });
    expect(layout.nodes).toEqual([{ id: "users", x: 40, y: 40, w: 220, h: 32 + 3 * 24 }]);
    expect(layout.edges).toEqual([]);
  });

  it("places the referenced parent to the left of the referencing child", () => {
    const layout = buildErDiagramLayout({
      tables: [
        { id: "orders", columnCount: 2 },
        { id: "users", columnCount: 2 },
      ],
      edges: [{ fromId: "orders", toId: "users" }],
    });
    const users = layout.nodes.find((n) => n.id === "users")!;
    const orders = layout.nodes.find((n) => n.id === "orders")!;
    expect(users.x).toBeLessThan(orders.x);
  });

  it("stacks tables in the same layer vertically, in input order", () => {
    const layout = buildErDiagramLayout({
      tables: [
        { id: "a", columnCount: 1 },
        { id: "b", columnCount: 1 },
      ],
      edges: [],
    });
    const a = layout.nodes.find((n) => n.id === "a")!;
    const b = layout.nodes.find((n) => n.id === "b")!;
    expect(a.x).toBe(b.x);
    expect(a.y).toBeLessThan(b.y);
  });

  it("layers multi-hop chains by longest FK depth", () => {
    const layout = buildErDiagramLayout({
      tables: [
        { id: "line_items", columnCount: 2 },
        { id: "orders", columnCount: 2 },
        { id: "users", columnCount: 2 },
      ],
      edges: [
        { fromId: "line_items", toId: "orders" },
        { fromId: "orders", toId: "users" },
      ],
    });
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    expect(byId.get("users")!.x).toBeLessThan(byId.get("orders")!.x);
    expect(byId.get("orders")!.x).toBeLessThan(byId.get("line_items")!.x);
  });

  it("sizes node height based on column count", () => {
    const layout = buildErDiagramLayout({
      tables: [
        { id: "small", columnCount: 1 },
        { id: "big", columnCount: 10 },
      ],
      edges: [],
    });
    const small = layout.nodes.find((n) => n.id === "small")!;
    const big = layout.nodes.find((n) => n.id === "big")!;
    expect(big.h).toBeGreaterThan(small.h);
  });

  it("does not infinite-loop on a self-referencing or cyclic FK graph", () => {
    const layout = buildErDiagramLayout({
      tables: [
        { id: "a", columnCount: 1 },
        { id: "b", columnCount: 1 },
      ],
      edges: [
        { fromId: "a", toId: "b" },
        { fromId: "b", toId: "a" },
      ],
    });
    expect(layout.nodes).toHaveLength(2);
  });

  it("drops edges that reference an unknown table", () => {
    const layout = buildErDiagramLayout({
      tables: [{ id: "a", columnCount: 1 }],
      edges: [{ fromId: "a", toId: "missing" }],
    });
    expect(layout.edges).toEqual([]);
  });

  it("preserves edges between known tables in the output", () => {
    const edges = [{ fromId: "orders", toId: "users" }];
    const layout = buildErDiagramLayout({
      tables: [
        { id: "orders", columnCount: 1 },
        { id: "users", columnCount: 1 },
      ],
      edges,
    });
    expect(layout.edges).toEqual(edges);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = {
      tables: [
        { id: "line_items", columnCount: 3 },
        { id: "orders", columnCount: 4 },
        { id: "users", columnCount: 5 },
        { id: "products", columnCount: 2 },
      ],
      edges: [
        { fromId: "line_items", toId: "orders" },
        { fromId: "line_items", toId: "products" },
        { fromId: "orders", toId: "users" },
      ],
    };
    const first = buildErDiagramLayout(input);
    const second = buildErDiagramLayout(input);
    expect(second).toEqual(first);
  });
});
