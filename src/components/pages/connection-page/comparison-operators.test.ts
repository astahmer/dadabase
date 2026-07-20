import { describe, expect, it } from "vitest";

import {
  COMPARISON_OPERATORS,
  INVERTED_COMPARISON_OPERATORS,
  isInvertedComparisonOperator,
} from "./comparison-operators.ts";

describe("comparison operators", () => {
  it("includes inverted forms for LIKE, IN, and BETWEEN", () => {
    expect(COMPARISON_OPERATORS).toContain("NOT LIKE");
    expect(COMPARISON_OPERATORS).toContain("NOT IN");
    expect(COMPARISON_OPERATORS).toContain("NOT BETWEEN");
  });

  it("lists inverted operators separately", () => {
    expect(INVERTED_COMPARISON_OPERATORS).toEqual(["NOT BETWEEN", "NOT IN", "NOT LIKE"]);
  });

  it("detects inverted operators", () => {
    expect(isInvertedComparisonOperator("NOT LIKE")).toBe(true);
    expect(isInvertedComparisonOperator("LIKE")).toBe(false);
    expect(isInvertedComparisonOperator("=")).toBe(false);
  });
});
