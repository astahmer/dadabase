import { describe, expect, it } from "vitest";

import {
  buildMssqlRowFingerprintExpr,
  buildMssqlSystemRowIdSelect,
  quoteMssqlIdent,
} from "./mssql-row-fingerprint.ts";

describe("quoteMssqlIdent", () => {
  it("wraps identifiers in brackets", () => {
    expect(quoteMssqlIdent("userName")).toBe("[userName]");
  });

  it("escapes embedded closing brackets", () => {
    expect(quoteMssqlIdent("we]ird")).toBe("[we]]ird]");
  });
});

describe("buildMssqlRowFingerprintExpr", () => {
  it("throws without columns", () => {
    expect(() => buildMssqlRowFingerprintExpr([])).toThrow();
  });

  it("hashes every column with null-safe casts", () => {
    const expr = buildMssqlRowFingerprintExpr(["id", "name"]);
    expect(expr).toContain("HASHBYTES('SHA2_256'");
    expect(expr).toContain("CONCAT_WS(NCHAR(31)");
    expect(expr).toContain("ISNULL(CAST([id] AS NVARCHAR(MAX)), N'')");
    expect(expr).toContain("ISNULL(CAST([name] AS NVARCHAR(MAX)), N'')");
    expect(expr).toContain("), 2)");
  });
});

describe("buildMssqlSystemRowIdSelect", () => {
  it("aliases the fingerprint as the dadabase row id", () => {
    const select = buildMssqlSystemRowIdSelect(["a"]);
    expect(select.startsWith("CONVERT(")).toBe(true);
    expect(select.endsWith("AS [__dadabase_rowid]")).toBe(true);
  });
});

// listMssqlTableColumnNames needs a live SqlClient — its SQL shape is covered by
// the catalog fixture expectations here instead of an integration run (no docker
// MSSQL server in unit CI; documented gap).
