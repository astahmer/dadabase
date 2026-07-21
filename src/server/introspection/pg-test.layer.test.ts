import { describe, expect, it } from "vitest";

import { isContainerRuntimeAvailable } from "./pg-test.layer.ts";

describe("isContainerRuntimeAvailable", () => {
  it("returns a boolean without throwing", () => {
    expect(typeof isContainerRuntimeAvailable()).toBe("boolean");
  });
});
