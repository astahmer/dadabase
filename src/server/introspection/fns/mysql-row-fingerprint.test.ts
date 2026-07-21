import { describe, expect, it } from "vitest";

import {
  buildMysqlRowFingerprintExpr,
  buildMysqlSystemRowIdSelect,
  quoteMysqlIdent,
} from "./mysql-row-fingerprint.ts";
import { DADABASE_ROW_ID } from "./row-identity.ts";

describe("mysql-row-fingerprint", () => {
  it("quotes identifiers with backticks", () => {
    expect(quoteMysqlIdent("foo`bar")).toBe("`foo``bar`");
  });

  it("builds a SHA2 fingerprint over all columns", () => {
    expect(buildMysqlRowFingerprintExpr(["id", "name"])).toContain("SHA2(CONCAT_WS");
    expect(buildMysqlRowFingerprintExpr(["id", "name"])).toContain("`id`");
    expect(buildMysqlRowFingerprintExpr(["id", "name"])).toContain("`name`");
  });

  it("aliases the fingerprint as the system row id", () => {
    expect(buildMysqlSystemRowIdSelect(["a"])).toContain(`AS \`${DADABASE_ROW_ID}\``);
  });

  it("rejects an empty column list", () => {
    expect(() => buildMysqlRowFingerprintExpr([])).toThrow(/without columns/);
  });
});
