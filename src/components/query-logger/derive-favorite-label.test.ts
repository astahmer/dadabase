import { describe, expect, it } from "vitest";

import { deriveFavoriteLabel } from "./derive-favorite-label.ts";

describe("deriveFavoriteLabel", () => {
  it("returns Untitled for empty SQL", () => {
    expect(deriveFavoriteLabel("")).toBe("Untitled query");
    expect(deriveFavoriteLabel("   \n  ")).toBe("Untitled query");
  });

  it("collapses whitespace", () => {
    expect(deriveFavoriteLabel("SELECT   *\nFROM users")).toBe("SELECT * FROM users");
  });

  it("truncates long queries with an ellipsis", () => {
    const long = "SELECT " + "a,".repeat(40) + " id FROM t";
    const label = deriveFavoriteLabel(long, 20);
    expect(label.length).toBe(20);
    expect(label.endsWith("…")).toBe(true);
  });
});
