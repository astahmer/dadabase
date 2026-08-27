import { describe, expect, it } from "vitest";

import {
  escapeCsvCell,
  escapeTsvCell,
  matrixToDelimitedText,
  parseCellClipboard,
  stringifyCellValue,
} from "./cell-selection.ts";

describe("cell-selection clipboard helpers", () => {
  it("parses tabular clipboard data without losing quoted commas or newlines", () => {
    expect(parseCellClipboard('name\tnote\n"Doe, Jane"\t"line 1\nline 2"')).toEqual([
      ["name", "note"],
      ["Doe, Jane", "line 1\nline 2"],
    ]);
  });

  it("uses comma-separated values when tabs are absent", () => {
    expect(parseCellClipboard('"Doe, Jane",42')).toEqual([["Doe, Jane", "42"]]);
  });

  it("serializes selected matrices for spreadsheet-friendly copy", () => {
    expect(matrixToDelimitedText([["a", "b\nc"]], "\t")).toBe('a\t"b\nc"');
    expect(matrixToDelimitedText([["a", "b,c"]], ",")).toBe('a,"b,c"');
  });

  it("formats values consistently across export formats", () => {
    expect(stringifyCellValue({ id: 1 })).toBe('{"id":1}');
    expect(escapeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeTsvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
  });
});
