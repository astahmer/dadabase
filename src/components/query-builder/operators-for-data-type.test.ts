import { describe, expect, it } from "vitest";

import { getOperatorsForDataType } from "./operators-for-data-type.ts";

describe("getOperatorsForDataType", () => {
  it("excludes contains/starts_with for timestamps", () => {
    const ops = getOperatorsForDataType("timestamp with time zone");
    expect(ops).toContain("greater_than");
    expect(ops).toContain("between");
    expect(ops).not.toContain("contains");
    expect(ops).not.toContain("starts_with");
    expect(ops).not.toContain("in");
  });

  it("excludes contains for numeric types but keeps between/comparisons", () => {
    const ops = getOperatorsForDataType("integer");
    expect(ops).toContain("between");
    expect(ops).toContain("greater_than");
    expect(ops).toContain("in");
    expect(ops).not.toContain("contains");
  });

  it("limits boolean to equals/null checks", () => {
    const ops = getOperatorsForDataType("boolean");
    expect(ops).toEqual(["equals", "not_equals", "is_null", "is_not_null"]);
  });

  it("keeps text search ops for varchar", () => {
    const ops = getOperatorsForDataType("character varying");
    expect(ops).toContain("contains");
    expect(ops).toContain("starts_with");
    expect(ops).not.toContain("greater_than");
  });

  it("returns all operators when type is missing", () => {
    expect(getOperatorsForDataType(undefined).length).toBeGreaterThan(10);
    expect(getOperatorsForDataType(null).length).toBeGreaterThan(10);
  });
});
