import { useEffect, useState } from "react";

/**
 * Client-side staged-edit tracking for CSV connections (§B.3 of
 * plans/csv-database-and-duckdb.md).
 *
 * Edits on a CSV connection are applied to an in-memory DuckDB table through the
 * standard row-edit server fns; nothing touches the source file until an
 * explicit per-table Save. The UI already knows when it issued update/insert/
 * delete calls, so this store just counts those operations per
 * connection+table since the last successful save.
 *
 * Counters are recorded for every connection but only surfaced for
 * dialect === "csv" (the save bar checks the dialect), so no call site needs to
 * resolve the connection record first.
 */

const counters = new Map<string, number>();
const listeners = new Set<() => void>();

export const csvUnsavedKey = (connectionUrl: string, table: string): string =>
  `${connectionUrl}::${table}`;

const emitChange = () => {
  for (const listener of listeners) listener();
};

/** Record n successful row mutations (update/insert/delete) against a table. */
export function noteRowMutations(connectionUrl: string, table: string, count = 1): void {
  if (!connectionUrl || !table || count <= 0) return;
  const key = csvUnsavedKey(connectionUrl, table);
  counters.set(key, (counters.get(key) ?? 0) + count);
  emitChange();
}

/** Clear the counter after a successful save (or table switch away). */
export function clearUnsavedCount(connectionUrl: string, table: string): void {
  const key = csvUnsavedKey(connectionUrl, table);
  if (!counters.delete(key)) return;
  emitChange();
}

export function getUnsavedCount(connectionUrl: string, table: string): number {
  return counters.get(csvUnsavedKey(connectionUrl, table)) ?? 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive unsaved-edit count for one connection+table (useSyncExternalStore). */
export function useUnsavedRowCount(connectionUrl: string, table: string): number {
  const [count, setCount] = useState(() => getUnsavedCount(connectionUrl, table));

  useEffect(() => {
    const update = () => setCount(getUnsavedCount(connectionUrl, table));
    update();
    return subscribe(update);
  }, [connectionUrl, table]);

  return count;
}

/**
 * Warn before closing/reloading the tab while a CSV table has staged edits.
 * Mirrors the destructive-query confirm intent (`§B.3`) — browser APIs offer no
 * richer dialog for unload.
 */
export function useUnloadWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome requires returnValue to be set to show the dialog.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
