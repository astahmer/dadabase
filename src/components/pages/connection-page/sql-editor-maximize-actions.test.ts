import { describe, expect, it } from "vitest";

import { SQL_EDITOR_MAXIMIZE_ACTIONS } from "./sql-editor-maximize-actions.ts";

describe("SQL editor maximize menu", () => {
  it("exposes expand-panel and fullscreen actions", () => {
    expect(SQL_EDITOR_MAXIMIZE_ACTIONS.map((a) => a.id)).toEqual(["expand-panel", "fullscreen"]);
  });

  it("labels actions for the menu", () => {
    expect(SQL_EDITOR_MAXIMIZE_ACTIONS.find((a) => a.id === "expand-panel")?.label).toBe(
      "Expand panel",
    );
    expect(SQL_EDITOR_MAXIMIZE_ACTIONS.find((a) => a.id === "fullscreen")?.label).toBe(
      "Fullscreen",
    );
  });
});
