import { ConfigProvider, Effect, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { DatabaseUrl } from "./app.db.config.ts";

describe("DatabaseUrl default", () => {
  it("defaults to a file: URL so libsql accepts it", async () => {
    const value = await Effect.runPromise(
      DatabaseUrl.pipe(
        Effect.map(Redacted.value),
        Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({}))),
      ),
    );
    expect(value.startsWith("file:")).toBe(true);
    expect(value).toMatch(/app\.db$/);
  });
});
