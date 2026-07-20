import { describe, expect, it } from "vitest";

import {
  buildPendingUpdateSql,
  clearPendingCellEdits,
  getPendingCellEditCount,
  getPendingValueForCell,
  pendingCellEditId,
  removePendingCellEdit,
  upsertPendingCellEdit,
  type PendingCellEdit,
} from "./pending-cell-edits.ts";

const base = {
  schema: "public",
  table: "users",
  dataType: "text",
  primaryKey: { id: 1 },
} as const;

function edit(
  partial: Partial<PendingCellEdit> &
    Pick<PendingCellEdit, "column" | "previousValue" | "nextValue">,
): Omit<PendingCellEdit, "id"> {
  return {
    schema: base.schema,
    table: base.table,
    dataType: base.dataType,
    primaryKey: { ...base.primaryKey },
    ...partial,
  };
}

describe("pending-cell-edits", () => {
  it("builds stable ids from primary key + column", () => {
    expect(pendingCellEditId({ id: 1, tenant: "a" }, "name")).toBe("id=1&tenant=a::name");
    expect(pendingCellEditId({ tenant: "a", id: 1 }, "name")).toBe("id=1&tenant=a::name");
  });

  it("upserts edits and counts them", () => {
    let edits = upsertPendingCellEdit(
      [],
      edit({ column: "name", previousValue: "a", nextValue: "b" }),
    );
    expect(getPendingCellEditCount(edits)).toBe(1);
    expect(getPendingValueForCell(edits, { id: 1 }, "name")).toBe("b");

    edits = upsertPendingCellEdit(
      edits,
      edit({ column: "email", previousValue: "x", nextValue: "y" }),
    );
    expect(getPendingCellEditCount(edits)).toBe(2);

    // Second edit to same cell keeps original previousValue
    edits = upsertPendingCellEdit(
      edits,
      edit({ column: "name", previousValue: "b", nextValue: "c" }),
    );
    expect(edits.find((e) => e.column === "name")?.previousValue).toBe("a");
    expect(edits.find((e) => e.column === "name")?.nextValue).toBe("c");
  });

  it("removes edit when value reverts to original", () => {
    let edits = upsertPendingCellEdit(
      [],
      edit({ column: "name", previousValue: "a", nextValue: "b" }),
    );
    edits = upsertPendingCellEdit(
      edits,
      edit({ column: "name", previousValue: "b", nextValue: "a" }),
    );
    expect(edits).toEqual([]);
  });

  it("remove and clear work", () => {
    let edits = upsertPendingCellEdit(
      [],
      edit({ column: "name", previousValue: "a", nextValue: "b" }),
    );
    const id = edits[0].id;
    edits = removePendingCellEdit(edits, id);
    expect(edits).toEqual([]);
    edits = upsertPendingCellEdit([], edit({ column: "name", previousValue: "a", nextValue: "b" }));
    expect(clearPendingCellEdits(edits)).toEqual([]);
  });

  it("builds UPDATE SQL for review", () => {
    const edits = [
      {
        ...edit({ column: "name", previousValue: "a", nextValue: "Ada" }),
        id: pendingCellEditId({ id: 1 }, "name"),
      },
      {
        ...edit({ column: "email", previousValue: "x", nextValue: "ada@ex.com" }),
        id: pendingCellEditId({ id: 1 }, "email"),
      },
      {
        ...edit({
          column: "name",
          previousValue: "b",
          nextValue: "Bob",
          primaryKey: { id: 2 },
        }),
        id: pendingCellEditId({ id: 2 }, "name"),
      },
    ];

    const sql = buildPendingUpdateSql(edits);
    expect(sql).toContain('UPDATE "public"."users"');
    expect(sql).toContain("\"name\" = 'Ada'");
    expect(sql).toContain("\"email\" = 'ada@ex.com'");
    expect(sql).toContain('"id" = 1');
    expect(sql).toContain("\"name\" = 'Bob'");
    expect(sql).toContain('"id" = 2');
    expect(buildPendingUpdateSql([])).toBe("-- no pending changes");
  });
});
