import { SqlError } from "@effect/sql/SqlError";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { getErrorMessage } from "./get-error-message.ts";

describe("getErrorMessage", () => {
  it("unwraps FiberFailure SqlError cause from Effect.runPromise", async () => {
    const driverError = Object.assign(new Error("UNIQUE constraint failed: users.email"), {
      code: "SQLITE_CONSTRAINT_UNIQUE",
    });

    try {
      await Effect.runPromise(
        Effect.fail(
          new SqlError({
            cause: driverError,
            message: "Failed to execute statement",
          }),
        ),
      );
      expect.unreachable();
    } catch (error) {
      expect(getErrorMessage(error)).toBe("UNIQUE constraint failed: users.email");
    }
  });

  it("returns plain Error message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });
});
