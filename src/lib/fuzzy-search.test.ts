import { describe, expect, it } from "vitest";

import { fuzzyFilter } from "./fuzzy-search.ts";

describe("fuzzyFilter", () => {
  it("matches small typos and keeps the strongest result first", () => {
    const tables = ["youtube_channel", "youtube_channel_history", "account"];
    expect(fuzzyFilter(tables, "ytube chanel", (table) => table)).toEqual([
      "youtube_channel",
      "youtube_channel_history",
    ]);
  });

  it("preserves all items for an empty query", () => {
    expect(fuzzyFilter(["b", "a"], "  ", (value) => value)).toEqual(["b", "a"]);
  });
});
