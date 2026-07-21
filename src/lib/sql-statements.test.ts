import { describe, expect, it } from "vitest";

import { splitSqlStatements } from "./sql-statements.ts";

describe("splitSqlStatements", () => {
  it("splits multiple statements on semicolons", () => {
    const stmts = splitSqlStatements("SELECT 1;\nSELECT 2;");
    expect(stmts.map((s) => s.sql)).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("keeps a trailing statement without a semicolon", () => {
    const stmts = splitSqlStatements("SELECT 1;\nSELECT 2");
    expect(stmts.map((s) => s.sql)).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("ignores semicolons inside single-quoted strings", () => {
    const stmts = splitSqlStatements("SELECT 'a;b';\nSELECT 2;");
    expect(stmts.map((s) => s.sql)).toEqual(["SELECT 'a;b'", "SELECT 2"]);
  });

  it("handles escaped single quotes ('')", () => {
    const stmts = splitSqlStatements("SELECT 'it''s; fine';");
    expect(stmts.map((s) => s.sql)).toEqual(["SELECT 'it''s; fine'"]);
  });

  it("ignores semicolons inside double-quoted identifiers", () => {
    const stmts = splitSqlStatements('SELECT "weird;col" FROM t;');
    expect(stmts.map((s) => s.sql)).toEqual(['SELECT "weird;col" FROM t']);
  });

  it("ignores semicolons inside line comments", () => {
    const stmts = splitSqlStatements("SELECT 1; -- comment; with semicolon\nSELECT 2;");
    expect(stmts.map((s) => s.sql)).toEqual(["SELECT 1", "-- comment; with semicolon\nSELECT 2"]);
  });

  it("ignores semicolons inside block comments", () => {
    const stmts = splitSqlStatements("SELECT 1 /* a;b */;\nSELECT 2;");
    expect(stmts.map((s) => s.sql)).toEqual(["SELECT 1 /* a;b */", "SELECT 2"]);
  });

  it("ignores semicolons inside dollar-quoted function bodies", () => {
    const sql = `CREATE FUNCTION f() RETURNS void AS $$\nBEGIN\n  SELECT 1;\nEND;\n$$ LANGUAGE plpgsql;`;
    const stmts = splitSqlStatements(sql);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]?.sql).toContain("SELECT 1;");
  });

  it("ignores tagged dollar-quotes ($tag$...$tag$)", () => {
    const sql = `CREATE FUNCTION f() AS $body$ SELECT 'a;b'; $body$ LANGUAGE sql;`;
    const stmts = splitSqlStatements(sql);
    expect(stmts).toHaveLength(1);
  });

  it("skips statements that are empty or comment-only", () => {
    const stmts = splitSqlStatements("SELECT 1;\n\n;\n-- just a comment\n;\nSELECT 2;");
    expect(stmts.map((s) => s.sql)).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("returns an empty array for blank input", () => {
    expect(splitSqlStatements("")).toEqual([]);
    expect(splitSqlStatements("   \n\n  ")).toEqual([]);
  });

  it("reports correct 1-based start/end lines", () => {
    const stmts = splitSqlStatements("SELECT 1;\n\nSELECT\n  2;");
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toMatchObject({ startLine: 1, endLine: 1 });
    expect(stmts[1]).toMatchObject({ startLine: 3, endLine: 4 });
  });

  it("reports offsets that round-trip via slice", () => {
    const script = "SELECT 1;\nSELECT 2;";
    const stmts = splitSqlStatements(script);
    for (const stmt of stmts) {
      expect(script.slice(stmt.startOffset, stmt.endOffset)).toBe(stmt.sql);
    }
  });

  it("trims surrounding whitespace but keeps inner formatting", () => {
    const stmts = splitSqlStatements("  \n  SELECT\n    1  \n  ;");
    expect(stmts[0]?.sql).toBe("SELECT\n    1");
  });
});
