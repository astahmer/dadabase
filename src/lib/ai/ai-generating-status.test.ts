import { describe, expect, it } from "vitest";

import { getAiGeneratingStatus } from "./ai-generating-status.ts";

describe("getAiGeneratingStatus", () => {
  it("describes generate-only waits", () => {
    expect(getAiGeneratingStatus("generate").title).toMatch(/Generating SQL/i);
  });

  it("describes generate-and-run waits", () => {
    expect(getAiGeneratingStatus("generate-and-run").title).toMatch(/preparing to run/i);
  });
});
