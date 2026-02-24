import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { testLibsqlConnectionUrl } from "./test-libsql-connection.ts";

describe("testLibsqlConnectionUrl", () => {
  it("returns success and message properties in all cases", async () => {
    const result = await Effect.runPromise(testLibsqlConnectionUrl("file::memory:"));

    // Function must return object with both success and message
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("message");
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.message).toBe("string");
  });

  it("successfully connects to in-memory database", async () => {
    const result = await Effect.runPromise(testLibsqlConnectionUrl("file::memory:"));

    expect(result.success).toBe(true);
    expect(result.message).toBe("OK");
  });

  it("reports connection failures for invalid URLs with success false and error message", async () => {
    const result = await Effect.runPromise(testLibsqlConnectionUrl("invalid-url"));

    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("reports error for empty connection string", async () => {
    const result = await Effect.runPromise(testLibsqlConnectionUrl(""));

    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
    // Empty string should have a specific error message
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("returns Either-like structure with boolean success discriminator", async () => {
    const result = await Effect.runPromise(testLibsqlConnectionUrl("file::memory:"));

    // Discriminated union pattern: success boolean determines interpretation
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.message).toBe("string");
  });

  it("properly recognizes file:// protocol", async () => {
    const result = await Effect.runPromise(testLibsqlConnectionUrl("file::memory:"));

    // Should recognize protocol and connect
    expect(result.success).toBe(true);
    expect(result.message).toBe("OK");
  });

  it("handles libsql:// protocol URLs", async () => {
    // libsql:// URLs typically require authentication, so this will fail
    const result = await Effect.runPromise(testLibsqlConnectionUrl("libsql://localhost"));

    // Connection attempt itself may fail, but parsing should succeed
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("message");
    expect(typeof result.success).toBe("boolean");
  });

  it("distinguishes between file-based and remote URLs", async () => {
    // In-memory should succeed
    const memoryResult = await Effect.runPromise(testLibsqlConnectionUrl("file::memory:"));
    expect(memoryResult.success).toBe(true);

    // Invalid remote should fail
    const remoteResult = await Effect.runPromise(testLibsqlConnectionUrl("libsql://invalid-host"));
    expect(remoteResult.success).toBe(false);
    expect(remoteResult.message).toBeDefined();
  });

  it("provides meaningful error messages when connection fails", async () => {
    const result = await Effect.runPromise(
      testLibsqlConnectionUrl("file:/nonexistent/path/to/db.sqlite"),
    );

    expect(result.success).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
    // Should include some useful information about why it failed
    const messageIndicatesError =
      result.message.toLowerCase().includes("error") ||
      result.message.toLowerCase().includes("cannot") ||
      result.message.toLowerCase().includes("sqlite") ||
      result.message.toLowerCase().includes("file");
    expect(messageIndicatesError).toBe(true);
  });

  it("handles malformed URLs gracefully", async () => {
    const result = await Effect.runPromise(testLibsqlConnectionUrl("not-a-valid-url"));
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("can connect to temporary in-memory databases multiple times", async () => {
    const result1 = await Effect.runPromise(testLibsqlConnectionUrl("file::memory:"));
    const result2 = await Effect.runPromise(testLibsqlConnectionUrl("file::memory:"));

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});
