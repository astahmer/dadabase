import { describe, expect, it } from "vitest";

import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";

import {
  buildGroupByClause,
  buildHavingClause,
  formatGroupByExpression,
  havingConditionToSql,
} from "./build-group-by-clause.ts";

describe("formatGroupByExpression", () => {
  it("quotes plain identifiers", () => {
    expect(formatGroupByExpression("status")).toBe('"status"');
  });

  it("quotes dotted identifiers", () => {
    expect(formatGroupByExpression("users.status")).toBe('"users"."status"');
  });

  it("leaves aggregate expressions raw", () => {
    expect(formatGroupByExpression("COUNT(*)")).toBe("COUNT(*)");
    expect(formatGroupByExpression("SUM(amount)")).toBe("SUM(amount)");
  });
});

describe("buildGroupByClause", () => {
  it("returns empty for missing/empty columns", () => {
    expect(buildGroupByClause(undefined)).toBe("");
    expect(buildGroupByClause([])).toBe("");
  });

  it("builds a single-column GROUP BY", () => {
    expect(buildGroupByClause(["status"])).toBe('GROUP BY "status"');
  });

  it("builds a multi-column GROUP BY", () => {
    expect(buildGroupByClause(["status", "department"])).toBe('GROUP BY "status", "department"');
  });
});

describe("havingConditionToSql / buildHavingClause", () => {
  it("builds comparison HAVING conditions", () => {
    expect(
      havingConditionToSql({
        column: "COUNT(*)",
        operator: "greater_than",
        value: 5,
      }),
    ).toBe("COUNT(*) > 5");
  });

  it("builds HAVING clause with AND", () => {
    const having: QueryFilterType = {
      logicalOperator: "and",
      conditions: [
        { column: "COUNT(*)", operator: "greater_than", value: 5 },
        { column: "COUNT(*)", operator: "less_than", value: 100 },
      ],
    };
    expect(buildHavingClause(having)).toBe("HAVING COUNT(*) > 5 AND COUNT(*) < 100");
  });

  it("builds HAVING clause with OR and inverted", () => {
    const having: QueryFilterType = {
      logicalOperator: "or",
      conditions: [
        { column: "SUM(amount)", operator: "greater_than", value: 1000, inverted: true },
      ],
    };
    expect(buildHavingClause(having)).toBe("HAVING NOT (SUM(amount) > 1000)");
  });

  it("returns empty when no conditions", () => {
    expect(buildHavingClause(undefined)).toBe("");
    expect(buildHavingClause({ conditions: [], logicalOperator: "and" })).toBe("");
  });
});
