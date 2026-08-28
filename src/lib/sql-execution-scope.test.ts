import { describe, expect, it } from "vitest";

import {
  formatSqlExecutionScope,
  getSqlExecutionScope,
  summarizeSqlStatement,
} from "./sql-execution-scope.ts";

describe("sql execution scope", () => {
  const script = "SELECT 1;\n\nUPDATE users SET active = 1;";

  it("describes a whole script and its write safety", () => {
    const scope = getSqlExecutionScope(script);

    expect(scope).toMatchObject({
      kind: "script",
      statementCount: 2,
      totalStatementCount: 2,
      hasWrites: true,
      hasDestructiveStatements: false,
    });
    expect(formatSqlExecutionScope(scope)).toBe("Run all 2 statements");
  });

  it("describes a statement selected from the script", () => {
    const scope = getSqlExecutionScope(script, "UPDATE users SET active = 1;");

    expect(scope).toMatchObject({
      kind: "statement",
      statementIndex: 1,
      statementCount: 1,
      totalStatementCount: 2,
      hasWrites: true,
    });
    expect(formatSqlExecutionScope(scope)).toBe("Run statement 2 of 2");
  });

  it("describes arbitrary text selection", () => {
    const scope = getSqlExecutionScope(script, "SELECT");

    expect(scope.kind).toBe("selection");
    expect(formatSqlExecutionScope(scope)).toContain("Run selection");
  });

  it("summarizes SQL without breaking words unnecessarily", () => {
    expect(summarizeSqlStatement("SELECT   *\nFROM users", 16)).toBe("SELECT * FROM u…");
  });
});
