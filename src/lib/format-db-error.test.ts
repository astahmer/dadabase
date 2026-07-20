import { describe, expect, it } from "vitest";

import { formatDbError } from "./format-db-error.ts";

describe("formatDbError", () => {
  it("formats sqlite unique constraint failures", () => {
    expect(formatDbError(new Error("UNIQUE constraint failed: users.email"))).toBe(
      "Unique constraint violated (users.email)",
    );
  });

  it("formats libsql prefixed unique constraint failures", () => {
    expect(
      formatDbError(new Error("SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: users.email")),
    ).toBe("Unique constraint violated (users.email)");
  });

  it("formats postgres unique constraint failures", () => {
    expect(formatDbError(new Error('SqlError: unique constraint "users_email_key"'))).toBe(
      "Unique constraint violated (users_email_key)",
    );
  });

  it("formats foreign key failures", () => {
    expect(formatDbError(new Error("FOREIGN KEY constraint failed"))).toBe(
      "Foreign key constraint violated",
    );
  });

  it("formats not-null failures", () => {
    expect(formatDbError(new Error("NOT NULL constraint failed: users.name"))).toBe(
      'Column "users.name" cannot be null',
    );
  });

  it("falls back to truncated raw message", () => {
    const long = `SqlError: ${"x".repeat(300)}`;
    const formatted = formatDbError(new Error(long));
    expect(formatted.endsWith("…")).toBe(true);
    expect(formatted.length).toBeLessThanOrEqual(241);
  });
});
