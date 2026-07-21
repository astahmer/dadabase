import { describe, expect, it } from "vitest";

import {
  getDestructiveQuerySummary,
  isDestructiveQuery,
} from "#src/server/introspection/detect-destructive-sql.ts";

describe("detect-destructive-sql", () => {
  describe("isDestructiveQuery", () => {
    it("should detect DELETE queries", () => {
      expect(isDestructiveQuery("DELETE FROM users WHERE id = 1")).toBe(true);
      expect(isDestructiveQuery("  DELETE FROM users WHERE id = 1")).toBe(true);
    });

    it("should detect DROP TABLE queries", () => {
      expect(isDestructiveQuery("DROP TABLE users")).toBe(true);
      expect(isDestructiveQuery("DROP DATABASE mydb")).toBe(true);
      expect(isDestructiveQuery("DROP SCHEMA public")).toBe(true);
    });

    it("should detect ALTER queries", () => {
      expect(isDestructiveQuery("ALTER TABLE users ADD COLUMN email VARCHAR")).toBe(true);
      expect(isDestructiveQuery("ALTER DATABASE mydb OWNER TO postgres")).toBe(true);
    });

    it("should handle comments", () => {
      expect(isDestructiveQuery("-- This is a comment\nDELETE FROM users")).toBe(true);
      expect(isDestructiveQuery("/* block comment */ DELETE FROM users")).toBe(true);
    });

    it("should handle multiple statements", () => {
      expect(isDestructiveQuery("SELECT * FROM users; DELETE FROM users WHERE id = 1;")).toBe(true);
    });

    it("should not detect safe queries", () => {
      expect(isDestructiveQuery("SELECT * FROM users")).toBe(false);
      expect(isDestructiveQuery("INSERT INTO users VALUES (1, 'test')")).toBe(false);
      expect(isDestructiveQuery("UPDATE users SET name = 'test'")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(isDestructiveQuery("")).toBe(false);
      expect(isDestructiveQuery(null as any)).toBe(false);
      expect(isDestructiveQuery(undefined as any)).toBe(false);
    });
  });

  describe("getDestructiveQuerySummary", () => {
    it("should return appropriate summaries", () => {
      expect(getDestructiveQuerySummary("DELETE FROM users")).toContain("DELETE");
      expect(getDestructiveQuerySummary("DROP TABLE users")).toContain("table");
      expect(getDestructiveQuerySummary("DROP DATABASE mydb")).toContain("database");
      expect(getDestructiveQuerySummary("ALTER TABLE users ADD COLUMN x INT")).toContain("ALTER");
    });
  });
});
