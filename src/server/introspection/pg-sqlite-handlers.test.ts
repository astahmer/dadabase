import { describe, expect, it } from "vitest";

import { ALL_TABLES_INTROSPECTION_CONCURRENCY, pgSqliteHandlers } from "./pg-sqlite-handlers.ts";

describe("pgSqliteHandlers", () => {
  it("maps mysql onto the postgres handler for information_schema-compatible sites", () => {
    const handlers = pgSqliteHandlers({
      pg: () => "pg",
      sqlite: () => "sqlite",
      orElse: () => "else",
    });
    expect(handlers.pg()).toBe("pg");
    expect(handlers.mysql()).toBe("pg");
    expect(handlers.sqlite()).toBe("sqlite");
    expect(handlers.orElse()).toBe("else");
  });

  it("caps all-tables fan-out concurrency", () => {
    expect(ALL_TABLES_INTROSPECTION_CONCURRENCY).toBeGreaterThan(0);
    expect(ALL_TABLES_INTROSPECTION_CONCURRENCY).toBeLessThanOrEqual(16);
  });
});
