import { describe, expect, it } from "vitest";

import { redactSqlLiterals } from "./redact-sql.ts";

describe("redactSqlLiterals", () => {
  it("redacts string literals", () => {
    expect(redactSqlLiterals("SELECT * FROM t WHERE name = 'minecraft'")).toBe(
      "SELECT * FROM t WHERE name = ?",
    );
  });

  it("handles escaped quotes inside strings", () => {
    expect(redactSqlLiterals("INSERT INTO t VALUES ('it''s', 42)")).toBe(
      "INSERT INTO t VALUES (?, ?)",
    );
  });

  it("redacts predicate numbers but keeps LIMIT/OFFSET values", () => {
    expect(redactSqlLiterals("SELECT * FROM t WHERE age > 25 LIMIT 100 OFFSET 5")).toBe(
      "SELECT * FROM t WHERE age > ? LIMIT 100 OFFSET 5",
    );
  });

  it("does not mangle identifiers containing digits", () => {
    expect(redactSqlLiterals("SELECT col1, video2.title FROM video2 WHERE col1 = 7")).toBe(
      "SELECT col1, video2.title FROM video2 WHERE col1 = ?",
    );
  });

  it("leaves empty and non-sql strings alone", () => {
    expect(redactSqlLiterals("")).toBe("");
    expect(redactSqlLiterals("SELECT 1")).toBe("SELECT ?");
  });
});
