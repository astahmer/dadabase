import { describe, expect, it, vi } from "vitest";

import { registerCustomSqlRunner, runRegisteredCustomSql } from "./custom-sql-runner-bridge.ts";

describe("custom-sql-runner-bridge", () => {
  it("invokes the registered runner", () => {
    const runner = vi.fn();
    const unregister = registerCustomSqlRunner(runner);
    expect(runRegisteredCustomSql("SELECT 1")).toBe(true);
    expect(runner).toHaveBeenCalledWith("SELECT 1", undefined);
    unregister();
    expect(runRegisteredCustomSql("SELECT 2")).toBe(false);
  });

  it("forwards revealEditor options", () => {
    const runner = vi.fn();
    registerCustomSqlRunner(runner);
    expect(runRegisteredCustomSql("SELECT 1", { revealEditor: true })).toBe(true);
    expect(runner).toHaveBeenCalledWith("SELECT 1", { revealEditor: true });
  });
});
