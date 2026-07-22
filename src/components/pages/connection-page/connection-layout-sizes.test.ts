import { describe, expect, it } from "vitest";

import {
  getQueryLoggerSplitterDefaultSize,
  getSidebarSplitterDefaultSize,
  getZenLayoutRemountKey,
} from "./connection-layout-sizes.ts";

describe("getSidebarSplitterDefaultSize", () => {
  it("collapses sidebar in zen mode", () => {
    expect(
      getSidebarSplitterDefaultSize({
        zenMode: true,
        sidebarSize: 25,
        sidebarMinSize: 15,
      }),
    ).toEqual([0, 100]);
  });

  it("uses stored size outside zen", () => {
    expect(
      getSidebarSplitterDefaultSize({
        zenMode: false,
        sidebarSize: 20,
        sidebarMinSize: 15,
      }),
    ).toEqual([20, 80]);
  });

  it("falls back to min size when unset", () => {
    expect(
      getSidebarSplitterDefaultSize({
        zenMode: false,
        sidebarSize: undefined,
        sidebarMinSize: 15,
      }),
    ).toEqual([15, 85]);
  });
});

describe("getQueryLoggerSplitterDefaultSize", () => {
  it("collapses query logger in zen mode", () => {
    expect(
      getQueryLoggerSplitterDefaultSize({
        zenMode: true,
        queryLoggerSize: 30,
      }),
    ).toEqual([100, 0]);
  });

  it("keeps logger size outside zen", () => {
    expect(
      getQueryLoggerSplitterDefaultSize({
        zenMode: false,
        queryLoggerSize: 20,
      }),
    ).toEqual([80, 20]);
  });
});

describe("getZenLayoutRemountKey", () => {
  it("changes when zen toggles", () => {
    expect(getZenLayoutRemountKey(false, "sidebar")).not.toBe(
      getZenLayoutRemountKey(true, "sidebar"),
    );
  });
});
