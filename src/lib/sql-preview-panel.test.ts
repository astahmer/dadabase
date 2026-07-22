import { describe, expect, it } from "vitest";

import {
  getSqlPreviewSplitterDefaultSize,
  isSqlPreviewOpen,
  SQL_PREVIEW_REVEAL_SIZE,
} from "./sql-preview-panel.ts";

describe("sql-preview-panel", () => {
  it("starts fully collapsed when no size is stored", () => {
    expect(getSqlPreviewSplitterDefaultSize(undefined)).toEqual([0, 100]);
    expect(getSqlPreviewSplitterDefaultSize(0)).toEqual([0, 100]);
    expect(isSqlPreviewOpen(undefined)).toBe(false);
  });

  it("restores a saved open size", () => {
    expect(getSqlPreviewSplitterDefaultSize(35)).toEqual([35, 65]);
    expect(isSqlPreviewOpen(SQL_PREVIEW_REVEAL_SIZE)).toBe(true);
  });
});
