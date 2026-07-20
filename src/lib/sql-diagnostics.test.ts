import { describe, expect, it } from "vitest";

import {
  analyzeSqlDiagnostics,
  offsetToPosition,
  SqlDiagnosticSeverity,
  type SqlDiagnosticsSchema,
} from "./sql-diagnostics.ts";

const schema: SqlDiagnosticsSchema = {
  tables: [
    { schema: "public", name: "users" },
    { schema: "public", name: "orders" },
  ],
  columns: [
    {
      table: "users",
      columns: [{ name: "id" }, { name: "email" }, { name: "name" }],
    },
    {
      table: "orders",
      columns: [{ name: "id" }, { name: "user_id" }, { name: "total" }],
    },
  ],
};

describe("offsetToPosition", () => {
  it("maps offsets to 1-based line/column", () => {
    expect(offsetToPosition("ab\nc", 0)).toEqual({ lineNumber: 1, column: 1 });
    expect(offsetToPosition("ab\nc", 2)).toEqual({ lineNumber: 1, column: 3 });
    expect(offsetToPosition("ab\nc", 3)).toEqual({ lineNumber: 2, column: 1 });
  });
});

describe("analyzeSqlDiagnostics", () => {
  it("flags empty statement", () => {
    const markers = analyzeSqlDiagnostics("   ", schema);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      severity: SqlDiagnosticSeverity.Warning,
      message: "Empty statement",
      startLineNumber: 1,
      startColumn: 1,
    });
  });

  it("treats comments-only as empty", () => {
    const markers = analyzeSqlDiagnostics("-- just a comment\n", schema);
    expect(markers[0]?.message).toBe("Empty statement");
  });

  it("flags unclosed single quote", () => {
    const sql = "SELECT * FROM users WHERE name = 'oops";
    const markers = analyzeSqlDiagnostics(sql, schema);
    expect(markers.some((m) => m.message === "Unclosed string literal")).toBe(true);
  });

  it("allows escaped single quotes", () => {
    const sql = "SELECT * FROM users WHERE name = 'o''brian'";
    const markers = analyzeSqlDiagnostics(sql, schema);
    expect(markers.filter((m) => m.message === "Unclosed string literal")).toHaveLength(0);
  });

  it("flags unknown table after FROM", () => {
    const sql = "SELECT * FROM nope";
    const markers = analyzeSqlDiagnostics(sql, schema);
    const unknown = markers.find((m) => m.message.includes("Unknown table"));
    expect(unknown).toMatchObject({
      severity: SqlDiagnosticSeverity.Error,
      message: 'Unknown table "nope"',
      startLineNumber: 1,
    });
    expect(unknown!.startColumn).toBeGreaterThan(0);
    expect(unknown!.endColumn).toBeGreaterThan(unknown!.startColumn);
  });

  it("flags unknown table after JOIN", () => {
    const sql = "SELECT * FROM users JOIN missing_table ON true";
    const markers = analyzeSqlDiagnostics(sql, schema);
    expect(markers.some((m) => m.message === 'Unknown table "missing_table"')).toBe(true);
  });

  it("accepts known tables", () => {
    const sql = "SELECT id FROM users JOIN orders ON users.id = orders.user_id";
    const markers = analyzeSqlDiagnostics(sql, schema);
    expect(markers.filter((m) => m.message.includes("Unknown table"))).toHaveLength(0);
  });

  it("skips table checks when no known tables", () => {
    const markers = analyzeSqlDiagnostics("SELECT * FROM nope", {
      tables: [],
      columns: [],
    });
    expect(markers.filter((m) => m.message.includes("Unknown table"))).toHaveLength(0);
  });

  it("flags unknown unqualified column when single table is unambiguous", () => {
    const sql = "SELECT missing_col FROM users";
    const markers = analyzeSqlDiagnostics(sql, schema);
    expect(markers.some((m) => m.message === 'Unknown column "missing_col"')).toBe(true);
  });

  it("does not flag unqualified column when multiple tables (ambiguous)", () => {
    const sql = "SELECT missing_col FROM users JOIN orders ON users.id = orders.user_id";
    const markers = analyzeSqlDiagnostics(sql, schema);
    expect(markers.filter((m) => m.message.includes("Unknown column"))).toHaveLength(0);
  });

  it("flags unknown qualified column", () => {
    const sql = "SELECT users.missing FROM users";
    const markers = analyzeSqlDiagnostics(sql, schema);
    expect(markers.some((m) => m.message === 'Unknown column "missing" on table "users"')).toBe(
      true,
    );
  });

  it("resolves alias for qualified column check", () => {
    const sql = "SELECT u.missing FROM users AS u";
    const markers = analyzeSqlDiagnostics(sql, schema);
    expect(markers.some((m) => m.message === 'Unknown column "missing" on table "users"')).toBe(
      true,
    );
  });

  it("accepts known columns", () => {
    const sql = "SELECT id, email FROM users";
    const markers = analyzeSqlDiagnostics(sql, schema);
    expect(markers.filter((m) => m.message.includes("Unknown column"))).toHaveLength(0);
  });

  it("ignores star and expressions in select list", () => {
    const sql = "SELECT *, lower(email), id + 1 FROM users";
    const markers = analyzeSqlDiagnostics(sql, schema);
    expect(markers.filter((m) => m.message.includes("Unknown column"))).toHaveLength(0);
  });
});
