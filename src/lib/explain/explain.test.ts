import { describe, expect, it } from "vitest";

import { parsePostgresExplain } from "./parse-postgres-explain.ts";
import {
  buildSqliteExplainTree,
  flattenSqliteExplainTree,
  parseSqliteExplain,
  parseSqliteExplainRows,
} from "./parse-sqlite-explain.ts";

describe("parsePostgresExplain", () => {
  const sample = `Limit  (cost=0.29..8.31 rows=10 width=40) (actual time=0.020..0.045 rows=10 loops=1)
  ->  Seq Scan on users  (cost=0.00..20.00 rows=25 width=40) (actual time=0.010..0.030 rows=25 loops=1)
Planning Time: 0.123 ms
Execution Time: 0.456 ms`;

  it("extracts node names, cost, and actual rows", () => {
    const { nodes } = parsePostgresExplain(sample);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      name: "Limit",
      cost: "0.29 - 8.31",
      rows: "10",
      actualRows: "10",
    });
    expect(nodes[1]?.name).toBe("Seq Scan on users");
  });

  it("extracts planning/execution totals", () => {
    const { totals } = parsePostgresExplain(sample);
    expect(totals.planningTime).toBe("0.123 ms");
    expect(totals.executionTime).toBe("0.456 ms");
  });

  it("computes actualTime in ms from the second actual time value", () => {
    const { nodes } = parsePostgresExplain(sample);
    expect(nodes[0]?.actualTime).toBeCloseTo(0.045);
  });

  it("marks actualTime as NaN when actual time is absent (plan-only explain)", () => {
    const { nodes } = parsePostgresExplain(
      "Seq Scan on users  (cost=0.00..20.00 rows=25 width=40)",
    );
    expect(nodes[0]?.actualTime).toBeNaN();
    expect(nodes[0]?.time).toBe("N/A");
  });

  it("returns no nodes and empty totals for blank input", () => {
    expect(parsePostgresExplain("")).toEqual({
      nodes: [],
      totals: { planningTime: "", executionTime: "" },
    });
  });
});

describe("parseSqliteExplainRows", () => {
  it("parses pipe-delimited CLI text", () => {
    const rows = parseSqliteExplainRows(
      "QUERY PLAN\n2|0|0|SCAN t\n3|0|0|USE TEMP B-TREE FOR ORDER BY",
    );
    expect(rows).toEqual([
      { id: 2, parent: 0, notused: 0, detail: "SCAN t" },
      { id: 3, parent: 0, notused: 0, detail: "USE TEMP B-TREE FOR ORDER BY" },
    ]);
  });

  it("parses driver row objects", () => {
    const rows = parseSqliteExplainRows([{ id: 2, parent: 0, notused: 0, detail: "SCAN t" }]);
    expect(rows).toEqual([{ id: 2, parent: 0, notused: 0, detail: "SCAN t" }]);
  });

  it("preserves pipes within the detail column", () => {
    const rows = parseSqliteExplainRows("4|0|0|SEARCH t USING INDEX ix (a=?|b=?)");
    expect(rows[0]?.detail).toBe("SEARCH t USING INDEX ix (a=?|b=?)");
  });

  it("skips blank lines and the QUERY PLAN header", () => {
    const rows = parseSqliteExplainRows("QUERY PLAN\n\n2|0|0|SCAN t\n");
    expect(rows).toHaveLength(1);
  });
});

describe("buildSqliteExplainTree / flattenSqliteExplainTree", () => {
  it("nests child rows under their parent id", () => {
    const rows = [
      { id: 1, parent: 0, notused: 0, detail: "SEARCH a" },
      { id: 2, parent: 1, notused: 0, detail: "USE INDEX" },
      { id: 3, parent: 0, notused: 0, detail: "SCAN b" },
    ];
    const tree = buildSqliteExplainTree(rows);
    expect(tree).toHaveLength(2);
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.detail).toBe("USE INDEX");
    expect(tree[0]?.children[0]?.level).toBe(1);
  });

  it("flattens the tree back to depth-first order", () => {
    const rows = [
      { id: 1, parent: 0, notused: 0, detail: "A" },
      { id: 2, parent: 1, notused: 0, detail: "B" },
      { id: 3, parent: 0, notused: 0, detail: "C" },
    ];
    const flat = flattenSqliteExplainTree(buildSqliteExplainTree(rows));
    expect(flat.map((n) => n.detail)).toEqual(["A", "B", "C"]);
  });
});

describe("parseSqliteExplain", () => {
  it("parses text straight into a tree", () => {
    const tree = parseSqliteExplain("2|0|0|SCAN t\n3|2|0|USE INDEX ix");
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.detail).toBe("USE INDEX ix");
  });

  it("returns an empty tree for empty input", () => {
    expect(parseSqliteExplain("")).toEqual([]);
    expect(parseSqliteExplain([])).toEqual([]);
  });
});
