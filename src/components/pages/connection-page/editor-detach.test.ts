import { describe, expect, it } from "vitest";

import { shouldSyncEditorFromGeneratedSql } from "./editor-detach.ts";

describe("shouldSyncEditorFromGeneratedSql", () => {
  it("syncs when there is no local draft", () => {
    expect(shouldSyncEditorFromGeneratedSql({ hasLocalDraft: false })).toBe(true);
  });

  it("keeps draft when user/AI has edited", () => {
    expect(shouldSyncEditorFromGeneratedSql({ hasLocalDraft: true })).toBe(false);
  });
});
