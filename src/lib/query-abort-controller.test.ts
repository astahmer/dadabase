import { describe, expect, it } from "vitest";

import {
  abortQueryController,
  createQueryAbortController,
  isQueryAbortError,
} from "./query-abort-controller.ts";

describe("createQueryAbortController", () => {
  it("returns a fresh non-aborted controller", () => {
    const controller = createQueryAbortController();
    expect(controller.signal.aborted).toBe(false);
  });

  it("aborts the previous controller when creating a new one", () => {
    const first = createQueryAbortController();
    const second = createQueryAbortController(first);

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
  });
});

describe("abortQueryController", () => {
  it("aborts and returns true when the controller is active", () => {
    const controller = createQueryAbortController();
    expect(abortQueryController(controller)).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });

  it("returns false for null/undefined or already-aborted controllers", () => {
    expect(abortQueryController(null)).toBe(false);
    expect(abortQueryController(undefined)).toBe(false);

    const controller = createQueryAbortController();
    controller.abort();
    expect(abortQueryController(controller)).toBe(false);
  });
});

describe("isQueryAbortError", () => {
  it("detects AbortError / CancelledError / aborted messages", () => {
    expect(isQueryAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(
      isQueryAbortError(Object.assign(new Error("cancelled"), { name: "CancelledError" })),
    ).toBe(true);
    expect(isQueryAbortError(new Error("The operation was aborted."))).toBe(true);
    expect(isQueryAbortError(new Error("connection failed"))).toBe(false);
    expect(isQueryAbortError(null)).toBe(false);
  });
});
