import { describe, expect, it, vi } from "vitest";

import { downloadTextFile } from "./download-text-file.ts";

/** Minimal fake DOM sufficient for `downloadTextFile` / `exportRows`, since tests run without jsdom. */
function createMockDocument() {
  const click = vi.fn();
  const setAttribute = vi.fn();
  const anchor = { click, setAttribute, style: {} as Record<string, string> };
  const appendChild = vi.fn();
  const removeChild = vi.fn();
  const doc = {
    createElement: vi.fn(() => anchor),
    body: { appendChild, removeChild },
  } as unknown as Document;
  return { doc, click, setAttribute, appendChild, removeChild, createElement: doc.createElement };
}
import { copyToClipboard, exportRows, rowsToInsertStatements, stringifyRows } from "./index.ts";
import { rowsToCsv } from "./rows-to-csv.ts";
import { rowsToInsertSql } from "./rows-to-insert-sql.ts";
import { rowsToJson } from "./rows-to-json.ts";
import { rowsToTsv } from "./rows-to-tsv.ts";

describe("rowsToCsv", () => {
  it("returns empty string for no rows", () => {
    expect(rowsToCsv([], ["a"])).toBe("");
  });

  it("quotes fields with commas, quotes, and newlines", () => {
    const csv = rowsToCsv([{ name: 'He said "hi", ok', note: "line1\nline2" }], ["name", "note"]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("name,note");
    expect(lines.slice(1).join("\n")).toBe('"He said ""hi"", ok","line1\nline2"');
  });

  it("renders null/undefined as empty and objects as JSON", () => {
    const csv = rowsToCsv([{ a: null, b: undefined, c: { x: 1 } }], ["a", "b", "c"]);
    expect(csv.split("\n")[1]).toBe(',,"{""x"":1}"');
  });

  it("renders booleans as-is", () => {
    const csv = rowsToCsv([{ ok: true }, { ok: false }], ["ok"]);
    expect(csv.split("\n")).toEqual(["ok", "true", "false"]);
  });

  it("does not quote plain fields", () => {
    expect(rowsToCsv([{ a: 1 }], ["a"])).toBe("a\n1");
  });
});

describe("rowsToTsv", () => {
  it("returns empty string for no rows", () => {
    expect(rowsToTsv([], ["a"])).toBe("");
  });

  it("collapses tabs and newlines within cells", () => {
    const tsv = rowsToTsv([{ a: "x\ty\nz" }], ["a"]);
    expect(tsv).toBe("a\nx y z");
  });

  it("renders null as empty and objects as JSON", () => {
    const tsv = rowsToTsv([{ a: null, b: { y: 2 } }], ["a", "b"]);
    expect(tsv.split("\n")[1]).toBe('\t{"y":2}');
  });
});

describe("rowsToJson", () => {
  it("pretty prints rows", () => {
    expect(rowsToJson([{ a: 1 }])).toBe(JSON.stringify([{ a: 1 }], null, 2));
  });

  it("handles empty rows", () => {
    expect(rowsToJson([])).toBe("[]");
  });
});

describe("rowsToInsertSql", () => {
  it("returns empty string for no rows", () => {
    expect(rowsToInsertSql([], ["a"], "widgets")).toBe("");
  });

  it("quotes identifiers with double quotes and qualifies with schema", () => {
    const sql = rowsToInsertSql([{ id: 1, name: "O'Brien" }], ["id", "name"], "widgets", "public");
    expect(sql).toBe(`INSERT INTO "public"."widgets" ("id", "name") VALUES (1, 'O''Brien');`);
  });

  it("emits NULL, TRUE/FALSE, and JSON-encoded objects", () => {
    const sql = rowsToInsertSql(
      [{ a: null, b: true, c: false, d: { x: 1 } }],
      ["a", "b", "c", "d"],
      "t",
    );
    expect(sql).toBe(`INSERT INTO "t" ("a", "b", "c", "d") VALUES (NULL, TRUE, FALSE, '{"x":1}');`);
  });

  it("builds one statement per row", () => {
    const sql = rowsToInsertSql([{ id: 1 }, { id: 2 }], ["id"], "t");
    expect(sql.split("\n")).toHaveLength(2);
  });
});

describe("stringifyRows / exportRows", () => {
  it("dispatches sql format through rowsToInsertSql", () => {
    const content = stringifyRows([{ id: 1 }], ["id"], {
      format: "sql",
      tableName: "widgets",
      schemaName: "public",
    });
    expect(content).toBe(`INSERT INTO "public"."widgets" ("id") VALUES (1);`);
  });

  it("defaults to json when format is json", () => {
    expect(stringifyRows([{ a: 1 }], ["a"], { format: "json" })).toBe(
      JSON.stringify([{ a: 1 }], null, 2),
    );
  });

  it("does nothing when there are no rows", () => {
    const { doc, createElement } = createMockDocument();
    exportRows([], ["a"], { format: "csv" }, doc);
    expect(createElement).not.toHaveBeenCalled();
  });

  it("triggers a download for non-empty rows", () => {
    const { doc, click, setAttribute } = createMockDocument();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    });

    exportRows([{ a: 1 }], ["a"], { format: "csv", filename: "out.csv" }, doc);

    expect(click).toHaveBeenCalled();
    expect(setAttribute).toHaveBeenCalledWith("download", "out.csv");
    vi.unstubAllGlobals();
  });
});

describe("rowsToInsertStatements (legacy alias)", () => {
  it("delegates to rowsToInsertSql", () => {
    expect(rowsToInsertStatements([{ id: 1 }], ["id"], "t")).toBe(
      rowsToInsertSql([{ id: 1 }], ["id"], "t"),
    );
  });
});

describe("copyToClipboard", () => {
  it("returns true when clipboard write succeeds", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    expect(await copyToClipboard("hello")).toBe(true);
    vi.unstubAllGlobals();
  });

  it("returns false when clipboard write throws", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("nope")) },
    });
    expect(await copyToClipboard("hello")).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("downloadTextFile", () => {
  it("creates a link, clicks it, and revokes the object URL", () => {
    const { doc, click, setAttribute, appendChild, removeChild } = createMockDocument();
    const revokeSpy = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: revokeSpy,
    });

    downloadTextFile("hello", "file.txt", "text/plain", doc);

    expect(setAttribute).toHaveBeenCalledWith("download", "file.txt");
    expect(click).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock");

    vi.unstubAllGlobals();
  });
});
