import { describe, expect, it } from "vitest";

import { formatDatabaseSearchValue } from "./global-data-search-sheet.tsx";

describe("formatDatabaseSearchValue", () => {
  it("renders structured values as JSON instead of object coercion", () => {
    expect(formatDatabaseSearchValue([{ tag: "minecraft" }, { tag: "survival" }])).toBe(
      '[{"tag":"minecraft"},{"tag":"survival"}]',
    );
  });

  it("renders null and primitive values predictably", () => {
    expect(formatDatabaseSearchValue(null)).toBe("NULL");
    expect(formatDatabaseSearchValue(true)).toBe("true");
    expect(formatDatabaseSearchValue("minecraft")).toBe("minecraft");
  });
});
