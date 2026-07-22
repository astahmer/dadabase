import { describe, expect, it } from "vitest";

import { ensureSafeSelectLimit } from "./ensure-safe-select-limit.ts";

describe("ensureSafeSelectLimit", () => {
  it("appends LIMIT 100 when missing", () => {
    expect(ensureSafeSelectLimit("SELECT * FROM orders")).toBe("SELECT * FROM orders\nLIMIT 100");
  });

  it("keeps an existing LIMIT", () => {
    expect(ensureSafeSelectLimit("SELECT * FROM orders LIMIT 5")).toBe(
      "SELECT * FROM orders LIMIT 5",
    );
  });

  it("keeps LIMIT ALL / no-limit marker", () => {
    expect(ensureSafeSelectLimit("SELECT * FROM orders LIMIT ALL")).toContain("LIMIT ALL");
    expect(ensureSafeSelectLimit("SELECT * FROM orders /* no-limit */")).toContain("no-limit");
  });

  it("ignores non-SELECT statements", () => {
    expect(ensureSafeSelectLimit("DELETE FROM orders")).toBe("DELETE FROM orders");
  });

  it("handles WITH … SELECT", () => {
    expect(ensureSafeSelectLimit("WITH x AS (SELECT 1) SELECT * FROM x")).toContain("LIMIT 100");
  });
});
