import { describe, expect, it } from "vitest";

import { buildInsertPreviewSql } from "./build-insert-preview-sql.ts";
import { inferColumnType, inferColumnTypes } from "./infer-column-types.ts";
import { parseCsv } from "./parse-csv.ts";
import { parseJsonRows, ParseJsonRowsError } from "./parse-json-rows.ts";

describe("parseCsv", () => {
  it("parses a simple header + rows", () => {
    const result = parseCsv("a,b\n1,2\n3,4");
    expect(result.header).toEqual(["a", "b"]);
    expect(result.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(result.records).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("handles quoted fields containing commas and quotes", () => {
    const result = parseCsv('name,note\n"Doe, Jane","He said ""hi"""');
    expect(result.rows).toEqual([["Doe, Jane", 'He said "hi"']]);
  });

  it("handles newlines inside quoted fields", () => {
    const result = parseCsv('a,b\n"line1\nline2",2');
    expect(result.rows).toEqual([["line1\nline2", "2"]]);
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv("a,b\r\n1,2\r\n3,4");
    expect(result.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("supports a custom delimiter", () => {
    const result = parseCsv("a;b\n1;2", { delimiter: ";" });
    expect(result.rows).toEqual([["1", "2"]]);
  });

  it("returns raw rows without header when hasHeader is false", () => {
    const result = parseCsv("1,2\n3,4", { hasHeader: false });
    expect(result.header).toBeNull();
    expect(result.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(result.records).toEqual([]);
  });

  it("returns empty result for empty input", () => {
    expect(parseCsv("")).toEqual({ header: null, rows: [], records: [] });
  });

  it("ignores a single trailing blank line", () => {
    const result = parseCsv("a,b\n1,2\n");
    expect(result.rows).toEqual([["1", "2"]]);
  });
});

describe("parseJsonRows", () => {
  it("parses a JSON array of objects", () => {
    expect(parseJsonRows('[{"a":1},{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("parses newline-delimited JSON", () => {
    expect(parseJsonRows('{"a":1}\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("skips blank lines in NDJSON", () => {
    expect(parseJsonRows('{"a":1}\n\n{"a":2}')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseJsonRows("")).toEqual([]);
  });

  it("throws on invalid JSON array", () => {
    expect(() => parseJsonRows("[{a:1}]")).toThrow(ParseJsonRowsError);
  });

  it("throws when an array element is not an object", () => {
    expect(() => parseJsonRows("[1,2]")).toThrow(ParseJsonRowsError);
  });

  it("throws on invalid NDJSON line", () => {
    expect(() => parseJsonRows("not json")).toThrow(ParseJsonRowsError);
  });
});

describe("inferColumnType", () => {
  it("infers null for all-empty columns", () => {
    expect(inferColumnType([null, undefined, ""])).toBe("null");
  });

  it("infers boolean from JS booleans and boolean-like strings", () => {
    expect(inferColumnType([true, false])).toBe("boolean");
    expect(inferColumnType(["true", "false", "TRUE"])).toBe("boolean");
  });

  it("infers integer from ints", () => {
    expect(inferColumnType(["1", "2", "-3"])).toBe("integer");
    expect(inferColumnType([1, 2, 3])).toBe("integer");
  });

  it("infers real from floats", () => {
    expect(inferColumnType(["1.5", "2"])).toBe("real");
    expect(inferColumnType([1.5, 2])).toBe("real");
  });

  it("infers text when values are mixed/non-numeric", () => {
    expect(inferColumnType(["abc", "123"])).toBe("text");
  });

  it("ignores null/empty values when inferring", () => {
    expect(inferColumnType(["1", null, "", "2"])).toBe("integer");
  });
});

describe("inferColumnTypes", () => {
  it("infers a type per column", () => {
    const rows = [
      { id: "1", active: "true", name: "a" },
      { id: "2", active: "false", name: "b" },
    ];
    expect(inferColumnTypes(rows, ["id", "active", "name"])).toEqual({
      id: "integer",
      active: "boolean",
      name: "text",
    });
  });
});

describe("buildInsertPreviewSql", () => {
  it("builds a multi-row INSERT with quoted identifiers", () => {
    const sql = buildInsertPreviewSql({
      dialect: "postgres",
      schema: "public",
      table: "widgets",
      columns: ["id", "name"],
      rows: [
        { id: "1", name: "a" },
        { id: "2", name: "b" },
      ],
      columnTypes: { id: "integer", name: "text" },
    });
    expect(sql).toBe(
      'INSERT INTO "public"."widgets" ("id", "name") VALUES\n  (1, \'a\'),\n  (2, \'b\');',
    );
  });

  it("renders booleans per dialect", () => {
    const pg = buildInsertPreviewSql({
      dialect: "postgres",
      table: "t",
      columns: ["ok"],
      rows: [{ ok: "true" }],
      columnTypes: { ok: "boolean" },
    });
    expect(pg).toContain("(TRUE)");

    const sqlite = buildInsertPreviewSql({
      dialect: "sqlite",
      table: "t",
      columns: ["ok"],
      rows: [{ ok: "true" }],
      columnTypes: { ok: "boolean" },
    });
    expect(sqlite).toContain("(1)");
  });

  it("emits NULL for empty values", () => {
    const sql = buildInsertPreviewSql({
      dialect: "postgres",
      table: "t",
      columns: ["a"],
      rows: [{ a: null }],
    });
    expect(sql).toContain("(NULL)");
  });

  it("truncates rows past maxRows and notes the omission", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: String(i) }));
    const sql = buildInsertPreviewSql({
      dialect: "postgres",
      table: "t",
      columns: ["id"],
      rows,
      columnTypes: { id: "integer" },
      maxRows: 2,
    });
    expect(sql).toContain("-- ... 3 more rows omitted from preview");
    expect(sql.match(/\(\d\)/g)).toHaveLength(2);
  });

  it("returns a comment when there are no rows", () => {
    const sql = buildInsertPreviewSql({
      dialect: "postgres",
      table: "t",
      columns: ["a"],
      rows: [],
    });
    expect(sql).toBe('-- No rows to insert into "t"');
  });

  it("throws when table name is missing", () => {
    expect(() =>
      buildInsertPreviewSql({ dialect: "postgres", table: "  ", columns: ["a"], rows: [] }),
    ).toThrow("Table name is required");
  });
});
