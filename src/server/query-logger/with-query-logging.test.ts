import { describe, expect, it } from "vitest";

import { redactQueryParams } from "./with-query-logging.ts";

describe("redactQueryParams", () => {
  it("preserves parameter shape without retaining values", () => {
    expect(
      redactQueryParams({
        name: "Alice",
        nested: { token: "secret" },
        values: [42, false, null],
      }),
    ).toEqual({
      name: "[REDACTED]",
      nested: { token: "[REDACTED]" },
      values: ["[REDACTED]", "[REDACTED]", "[REDACTED]"],
    });
  });
});
