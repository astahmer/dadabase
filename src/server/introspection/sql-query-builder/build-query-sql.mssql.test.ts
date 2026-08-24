import { describe, expect, it } from "vitest";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { buildQuerySql } from "./build-query-sql.ts";

describe("buildQuerySql (mssql)", () => {
  it("uses OFFSET/FETCH instead of LIMIT", () => {
    const { sql } = buildQuerySql(
      { schema: "dbo", table: "users", limit: 25, offset: 50 },
      DatabaseDialect.Mssql,
    );
    expect(sql).toContain("OFFSET 50 ROWS FETCH NEXT 25 ROWS ONLY");
    expect(sql).not.toContain("LIMIT");
    expect(sql).not.toContain("OFFSET 50\n");
  });

  it("adds a mandatory ORDER BY when none is given (T-SQL requirement)", () => {
    const { sql } = buildQuerySql(
      { schema: "dbo", table: "users", limit: 10 },
      DatabaseDialect.Mssql,
    );
    expect(sql).toContain("ORDER BY (SELECT NULL)");
  });

  it("keeps the user ORDER BY and drops NULLS FIRST/LAST (unsupported in T-SQL)", () => {
    const { sql } = buildQuerySql(
      {
        schema: "dbo",
        table: "users",
        limit: 10,
        orderBy: "created_at",
        orderDirection: "desc",
        nullsOrder: "first",
      },
      DatabaseDialect.Mssql,
    );
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(sql).not.toContain("NULLS");
  });

  it("qualifies the table with the schema using quoted identifiers", () => {
    const { sql } = buildQuerySql({ schema: "sales", table: "orders" }, DatabaseDialect.Mssql);
    expect(sql).toContain('FROM "sales"."orders"');
  });

  it("other dialects keep LIMIT/OFFSET pagination", () => {
    const { sql } = buildQuerySql(
      { schema: "public", table: "users", limit: 10, offset: 5 },
      DatabaseDialect.Postgres,
    );
    expect(sql).toContain("LIMIT 10");
    expect(sql).toContain("OFFSET 5");
    expect(sql).not.toContain("FETCH");
  });
});
