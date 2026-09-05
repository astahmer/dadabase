import { describe, expect, it } from "vitest";

import { shouldExpandToolByDefault } from "./tool-part.tsx";

describe("shouldExpandToolByDefault", () => {
  it("keeps a running or failed call visible", () => {
    expect(shouldExpandToolByDefault({ toolName: "table_details", state: "input-available" })).toBe(
      true,
    );
    expect(shouldExpandToolByDefault({ toolName: "table_details", state: "output-error" })).toBe(
      true,
    );
    expect(
      shouldExpandToolByDefault({
        toolName: "explain_sql",
        output: { type: "warning-text", value: "Plan unavailable" },
        state: "output-available",
      }),
    ).toBe(true);
  });

  it("opens primary SQL output only when it has something useful to show", () => {
    expect(
      shouldExpandToolByDefault({
        toolName: "propose_sql",
        input: { sql: "select 1" },
        state: "input-available",
      }),
    ).toBe(true);
    expect(
      shouldExpandToolByDefault({
        toolName: "run_sql",
        output: { ok: true, rowCount: 0, rows: [] },
        state: "output-available",
      }),
    ).toBe(false);
    expect(
      shouldExpandToolByDefault({
        toolName: "run_sql",
        output: { ok: true, rowCount: 1, rows: [{ id: 1 }] },
        state: "output-available",
      }),
    ).toBe(true);
  });

  it("collapses internal inspection calls after they finish", () => {
    expect(
      shouldExpandToolByDefault({
        toolName: "preview_rows",
        output: { rows: [{ id: 1 }] },
        state: "output-available",
      }),
    ).toBe(false);
    expect(
      shouldExpandToolByDefault({
        toolName: "table_details",
        output: { columns: [{ name: "id" }] },
        state: "output-available",
      }),
    ).toBe(false);
  });
});
