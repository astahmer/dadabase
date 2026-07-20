import { describe, expect, it } from "vitest";

import { DATE_FILTER_PRESETS, getDateFilterPreset, toIsoDate } from "./date-filter-presets.ts";

describe("date-filter-presets", () => {
  // Fixed local noon so DST / timezone edge cases do not shift the calendar day
  const now = new Date(2024, 2, 15, 12, 0, 0); // 2024-03-15

  it("exposes all expected preset ids", () => {
    expect(DATE_FILTER_PRESETS.map((p) => p.id)).toEqual([
      "today",
      "last_7_days",
      "last_30_days",
      "this_month",
      "last_month",
      "this_year",
      "last_year",
    ]);
  });

  it("today → between same ISO date", () => {
    expect(getDateFilterPreset("today", now)).toEqual({
      operator: "between",
      value: ["2024-03-15", "2024-03-15"],
    });
  });

  it("last 7 days → inclusive rolling window ending today", () => {
    expect(getDateFilterPreset("last_7_days", now)).toEqual({
      operator: "between",
      value: ["2024-03-09", "2024-03-15"],
    });
  });

  it("last 30 days → inclusive rolling window ending today", () => {
    expect(getDateFilterPreset("last_30_days", now)).toEqual({
      operator: "between",
      value: ["2024-02-15", "2024-03-15"],
    });
  });

  it("this month → first through last day of current month", () => {
    expect(getDateFilterPreset("this_month", now)).toEqual({
      operator: "between",
      value: ["2024-03-01", "2024-03-31"],
    });
  });

  it("last month → full previous calendar month", () => {
    expect(getDateFilterPreset("last_month", now)).toEqual({
      operator: "between",
      value: ["2024-02-01", "2024-02-29"],
    });
  });

  it("this year → Jan 1 through Dec 31 of current year", () => {
    expect(getDateFilterPreset("this_year", now)).toEqual({
      operator: "between",
      value: ["2024-01-01", "2024-12-31"],
    });
  });

  it("last year → Jan 1 through Dec 31 of previous year", () => {
    expect(getDateFilterPreset("last_year", now)).toEqual({
      operator: "between",
      value: ["2023-01-01", "2023-12-31"],
    });
  });

  it("handles month/year boundaries from January", () => {
    const jan = new Date(2025, 0, 5, 12, 0, 0);
    expect(getDateFilterPreset("last_month", jan)).toEqual({
      operator: "between",
      value: ["2024-12-01", "2024-12-31"],
    });
    expect(getDateFilterPreset("last_year", jan)).toEqual({
      operator: "between",
      value: ["2024-01-01", "2024-12-31"],
    });
  });

  it("toIsoDate formats local calendar date", () => {
    expect(toIsoDate(now)).toBe("2024-03-15");
  });
});
