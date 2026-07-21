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

  it("surfaces ECONNREFUSED instead of generic FiberFailure text", async () => {
    const driverError = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      code: "ECONNREFUSED",
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
      const message = getErrorMessage(error);
      expect(message).not.toBe("An error has occurred");
      expect(message).toMatch(/ECONNREFUSED|127\.0\.0\.1:5432/);
    }
  });

  it("unwraps PgClient Failed to connect wrappers to the driver cause", async () => {
    const driverError = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      code: "ECONNREFUSED",
    });

    try {
      await Effect.runPromise(
        Effect.fail(
          new SqlError({
            cause: driverError,
            message: "PgClient: Failed to connect",
          }),
        ),
      );
      expect.unreachable();
    } catch (error) {
      const message = getErrorMessage(error);
      expect(message).not.toBe("PgClient: Failed to connect");
      expect(message).toMatch(/ECONNREFUSED|127\.0\.0\.1:5432/);
    }
  });

  it("unwraps AggregateError nested connection failures", async () => {
    const nested = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      code: "ECONNREFUSED",
    });
    const aggregate = new AggregateError([nested], "Failed to connect");

    try {
      await Effect.runPromise(
        Effect.fail(
          new SqlError({
            cause: aggregate,
            message: "Failed to execute statement",
          }),
        ),
      );
      expect.unreachable();
    } catch (error) {
      const message = getErrorMessage(error);
      expect(message).not.toBe("An error has occurred");
      expect(message).toMatch(/ECONNREFUSED|127\.0\.0\.1:5432/);
    }
  });

  it("returns plain Error message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });
});
