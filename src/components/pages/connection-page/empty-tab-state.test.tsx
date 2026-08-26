import { describe, expect, it } from "vitest";

import { filterTablesByQuery } from "./empty-tab-state.tsx";

const tables = [
  { schema: "public", name: "youtube_video" },
  { schema: "public", name: "users" },
  { schema: "analytics", name: "video_events" },
];

describe("filterTablesByQuery", () => {
  it("returns everything for an empty/whitespace query", () => {
    expect(filterTablesByQuery(tables, "")).toHaveLength(3);
    expect(filterTablesByQuery(tables, "   ")).toHaveLength(3);
  });

  it("matches by table name substring, case-insensitive", () => {
    const result = filterTablesByQuery(tables, "VIDEO");
    expect(result.map((t) => t.name)).toEqual(["youtube_video", "video_events"]);
  });

  it("matches by schema name substring", () => {
    expect(filterTablesByQuery(tables, "analytics").map((t) => t.name)).toEqual([
      "video_events",
    ]);
  });

  it("returns no results when nothing matches", () => {
    expect(filterTablesByQuery(tables, "nope")).toEqual([]);
  });
});
