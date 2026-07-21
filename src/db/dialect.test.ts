import { describe, expect, it } from "vitest";

import { DatabaseDialect, getDialectDefaultSchema, onDialectOrElse } from "./dialect.ts";

describe("DatabaseDialect.MySQL", () => {
  it("defaults schema to empty string (database-scoped)", () => {
    expect(getDialectDefaultSchema(DatabaseDialect.MySQL)).toBe("");
  });

  it("routes onDialectOrElse to mysql handler when provided", () => {
    const value = onDialectOrElse(DatabaseDialect.MySQL, {
      mysql: () => "mysql-ok",
      orElse: () => "fallback",
    });
    expect(value).toBe("mysql-ok");
  });

  it("falls back to orElse when mysql handler is omitted", () => {
    const value = onDialectOrElse(DatabaseDialect.MySQL, {
      postgres: () => "pg",
      orElse: () => "fallback",
    });
    expect(value).toBe("fallback");
  });
});
