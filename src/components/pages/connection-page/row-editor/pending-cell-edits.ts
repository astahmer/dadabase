import { previewUpdateSql } from "./preview-sql.ts";

/**
 * In-memory buffer for datatable cell edits that commit in a review phase
 * instead of saving immediately on blur.
 */

export interface PendingCellEdit {
  /** Stable id: serialized primary key + column */
  id: string;
  schema: string;
  table: string;
  column: string;
  dataType: string;
  primaryKey: Record<string, unknown>;
  previousValue: unknown;
  nextValue: unknown;
}

export function pendingCellEditId(primaryKey: Record<string, unknown>, column: string): string {
  const pkPart = Object.keys(primaryKey)
    .sort()
    .map((k) => `${k}=${String(primaryKey[k])}`)
    .join("&");
  return `${pkPart}::${column}`;
}

export function upsertPendingCellEdit(
  edits: PendingCellEdit[],
  edit: Omit<PendingCellEdit, "id">,
): PendingCellEdit[] {
  const id = pendingCellEditId(edit.primaryKey, edit.column);
  const next: PendingCellEdit = { ...edit, id };

  // Reverting to previous value removes the pending edit
  if (valuesEqual(edit.previousValue, edit.nextValue)) {
    return edits.filter((e) => e.id !== id);
  }

  const idx = edits.findIndex((e) => e.id === id);
  if (idx === -1) return [...edits, next];

  const existing = edits[idx];
  // Keep original previousValue from first edit in the chain
  const merged: PendingCellEdit = {
    ...next,
    previousValue: existing.previousValue,
  };
  if (valuesEqual(merged.previousValue, merged.nextValue)) {
    return edits.filter((e) => e.id !== id);
  }
  const copy = edits.slice();
  copy[idx] = merged;
  return copy;
}

export function removePendingCellEdit(edits: PendingCellEdit[], id: string): PendingCellEdit[] {
  return edits.filter((e) => e.id !== id);
}

export function clearPendingCellEdits(_edits: PendingCellEdit[] = []): PendingCellEdit[] {
  return [];
}

export function getPendingCellEditCount(edits: PendingCellEdit[]): number {
  return edits.length;
}

export function getPendingValueForCell(
  edits: PendingCellEdit[],
  primaryKey: Record<string, unknown>,
  column: string,
): unknown | undefined {
  const id = pendingCellEditId(primaryKey, column);
  return edits.find((e) => e.id === id)?.nextValue;
}

/** Group pending edits by row and build reviewable UPDATE SQL statements. */
export function buildPendingUpdateSql(edits: PendingCellEdit[]): string {
  if (edits.length === 0) return "-- no pending changes";

  const byRow = new Map<string, PendingCellEdit[]>();
  for (const edit of edits) {
    const rowKey = pendingCellEditId(edit.primaryKey, "");
    const list = byRow.get(rowKey) ?? [];
    list.push(edit);
    byRow.set(rowKey, list);
  }

  const statements: string[] = [];
  for (const rowEdits of byRow.values()) {
    const first = rowEdits[0];
    const values: Record<string, unknown> = {};
    for (const e of rowEdits) {
      values[e.column] = e.nextValue;
    }
    statements.push(previewUpdateSql(first.schema, first.table, first.primaryKey, values));
  }
  return statements.join("\n\n");
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null && b == null) return a === b;
  return String(a ?? "") === String(b ?? "");
}
