// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  consumeStagedCustomSqlRun,
  stageCustomSqlRun,
} from "./custom-sql-run-handoff.ts";

describe("custom-sql-run-handoff", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("returns null when nothing was staged for the tab", () => {
    expect(consumeStagedCustomSqlRun("tab-1")).toBeNull();
  });

  it("stages and consumes a run once, then stays consumed", () => {
    stageCustomSqlRun("tab-1", { sql: "SELECT 1" });
    expect(consumeStagedCustomSqlRun("tab-1")).toEqual({ sql: "SELECT 1" });
    expect(consumeStagedCustomSqlRun("tab-1")).toBeNull();
  });

  it("keys entries per tab id", () => {
    stageCustomSqlRun("tab-a", { sql: "SELECT 1" });
    expect(consumeStagedCustomSqlRun("tab-b")).toBeNull();
    expect(consumeStagedCustomSqlRun("tab-a")).toEqual({ sql: "SELECT 1" });
  });

  it("re-staging overwrites the previous payload for the same tab", () => {
    stageCustomSqlRun("tab-1", { sql: "SELECT 1" });
    stageCustomSqlRun("tab-1", { sql: "SELECT 2" });
    expect(consumeStagedCustomSqlRun("tab-1")).toEqual({ sql: "SELECT 2" });
  });

  it("treats corrupt JSON as no staged run (and clears it)", () => {
    sessionStorage.setItem("dadabase.custom-sql-run.tab-x", "{not json");
    expect(consumeStagedCustomSqlRun("tab-x")).toBeNull();
    expect(sessionStorage.getItem("dadabase.custom-sql-run.tab-x")).toBeNull();
  });

  it("rejects payloads without usable sql", () => {
    sessionStorage.setItem("dadabase.custom-sql-run.tab-y", JSON.stringify({ sql: "   " }));
    expect(consumeStagedCustomSqlRun("tab-y")).toBeNull();
    sessionStorage.setItem("dadabase.custom-sql-run.tab-z", JSON.stringify({ nope: true }));
    expect(consumeStagedCustomSqlRun("tab-z")).toBeNull();
  });

  it("tolerates a missing tab id", () => {
    stageCustomSqlRun("", { sql: "SELECT 1" });
    expect(consumeStagedCustomSqlRun("")).toBeNull();
  });
});
