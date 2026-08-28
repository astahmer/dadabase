import { describe, expect, it } from "vitest";

import { toJsonSafeValue } from "./json-safe-value.ts";

describe("toJsonSafeValue", () => {
  it("normalizes driver values nested in rows", () => {
    const value = toJsonSafeValue({
      rows: [{ recorded_at: new Date("2026-08-28T20:04:00.000Z"), count: 3n }],
    });

    expect(value).toEqual({
      rows: [{ recorded_at: "2026-08-28T20:04:00.000Z", count: "3" }],
    });
  });

  it("keeps malformed numeric values JSON-compatible", () => {
    expect(toJsonSafeValue({ nan: Number.NaN, infinity: Number.POSITIVE_INFINITY })).toEqual({
      nan: null,
      infinity: null,
    });
  });
});
