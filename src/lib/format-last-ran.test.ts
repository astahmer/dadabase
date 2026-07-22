import { describe, expect, it } from "vitest";

import {
  formatLoadedRelativeLabel,
  formatRanAtIso,
  formatRefreshTooltip,
  hasValidRanAt,
} from "./format-last-ran.ts";

describe("hasValidRanAt", () => {
  it("rejects epoch / zero / missing", () => {
    expect(hasValidRanAt(0)).toBe(false);
    expect(hasValidRanAt(-1)).toBe(false);
    expect(hasValidRanAt(undefined)).toBe(false);
    expect(hasValidRanAt(null)).toBe(false);
    expect(hasValidRanAt(Number.NaN)).toBe(false);
  });

  it("accepts real timestamps", () => {
    expect(hasValidRanAt(Date.now())).toBe(true);
    expect(hasValidRanAt(1)).toBe(true);
  });
});

describe("formatRefreshTooltip", () => {
  it("says not run yet for epoch", () => {
    expect(formatRefreshTooltip(0)).toBe("Refresh rows (not run yet)");
  });

  it("includes ISO when valid", () => {
    const tip = formatRefreshTooltip(1_700_000_000_000);
    expect(tip.startsWith("Refresh rows (last ran at ")).toBe(true);
    expect(tip.includes("1970")).toBe(false);
  });
});

describe("formatRanAtIso / formatLoadedRelativeLabel", () => {
  it("returns null for invalid ranAt", () => {
    expect(formatRanAtIso(0)).toBeNull();
    expect(formatLoadedRelativeLabel(0)).toBeNull();
  });

  it("returns labels for valid ranAt", () => {
    expect(formatRanAtIso(1_700_000_000_000)).toMatch(/^\d{4}-/);
    expect(formatLoadedRelativeLabel(Date.now() - 5_000)).toMatch(/^Loaded /);
  });
});
