import { describe, expect, it } from "vitest";

import { shouldSyncEditorFromGeneratedSql, toggleEditorDetached } from "./editor-detach.ts";

describe("editor-detach helpers", () => {
  it("syncs by default (attached)", () => {
    expect(shouldSyncEditorFromGeneratedSql({})).toBe(true);
    expect(shouldSyncEditorFromGeneratedSql({ editorDetached: false })).toBe(true);
  });

  it("does not sync when detached", () => {
    expect(shouldSyncEditorFromGeneratedSql({ editorDetached: true })).toBe(false);
  });

  it("toggles detach flag", () => {
    expect(toggleEditorDetached(undefined)).toBe(true);
    expect(toggleEditorDetached(false)).toBe(true);
    expect(toggleEditorDetached(true)).toBe(false);
  });
});
