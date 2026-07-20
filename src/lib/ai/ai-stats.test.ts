import { describe, expect, it } from "vitest";

import { aiStatsFromRows, parseAiStatsPanelData } from "./ai-stats.ts";

describe("parseAiStatsPanelData", () => {
  it("accepts valid bar panel", () => {
    const parsed = parseAiStatsPanelData({
      type: "bar",
      title: "By status",
      data: [
        { label: "pending", value: 3 },
        { label: "shipped", value: 10 },
      ],
    });
    expect(parsed?.type).toBe("bar");
    expect(parsed?.data).toHaveLength(2);
  });

  it("accepts stat panel", () => {
    const parsed = parseAiStatsPanelData({
      type: "stat",
      title: "Total",
      data: [{ label: "rows", value: 42 }],
    });
    expect(parsed?.type).toBe("stat");
  });

  it("rejects invalid shapes", () => {
    expect(parseAiStatsPanelData(null)).toBeNull();
    expect(parseAiStatsPanelData({ type: "pie", title: "x", data: [] })).toBeNull();
    expect(parseAiStatsPanelData({ type: "bar", title: "x", data: [{ label: "a" }] })).toBeNull();
  });
});

describe("aiStatsFromRows", () => {
  it("maps rows into panel data", () => {
    const panel = aiStatsFromRows("Counts", [{ label: "a", value: 1 }]);
    expect(panel).toEqual({
      type: "bar",
      title: "Counts",
      data: [{ label: "a", value: 1 }],
    });
  });
});
