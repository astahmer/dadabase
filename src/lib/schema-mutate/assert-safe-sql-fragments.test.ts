import { describe, expect, it } from "vitest";

import { assertSafeSqlDataType, assertSafeSqlDefault } from "./assert-safe-sql-fragments.ts";

describe("assertSafeSqlDataType", () => {
  it("accepts common types", () => {
    expect(assertSafeSqlDataType("TEXT")).toBe("TEXT");
    expect(assertSafeSqlDataType("INTEGER")).toBe("INTEGER");
    expect(assertSafeSqlDataType("varchar(255)")).toBe("varchar(255)");
    expect(assertSafeSqlDataType("NUMERIC(10, 2)")).toBe("NUMERIC(10, 2)");
    expect(assertSafeSqlDataType("double precision")).toBe("double precision");
  });

  it("rejects injection payloads", () => {
    expect(() => assertSafeSqlDataType('TEXT); DROP TABLE "users";--')).toThrow(
      /Unsafe|Unsupported/,
    );
    expect(() => assertSafeSqlDataType("TEXT -- comment")).toThrow();
    expect(() => assertSafeSqlDataType("TEXT /* x */")).toThrow();
    expect(() => assertSafeSqlDataType("")).toThrow(/required/);
  });
});

describe("assertSafeSqlDefault", () => {
  it("accepts safe literals", () => {
    expect(assertSafeSqlDefault("NULL")).toBe("NULL");
    expect(assertSafeSqlDefault("42")).toBe("42");
    expect(assertSafeSqlDefault("'hello''world'")).toBe("'hello''world'");
    expect(assertSafeSqlDefault("CURRENT_TIMESTAMP")).toBe("CURRENT_TIMESTAMP");
  });

  it("rejects injection payloads", () => {
    expect(() => assertSafeSqlDefault("1; DROP TABLE users")).toThrow();
    expect(() => assertSafeSqlDefault("(SELECT 1)")).toThrow();
    expect(() => assertSafeSqlDefault("now();--")).toThrow();
  });
});
