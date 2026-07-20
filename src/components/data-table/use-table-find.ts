import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  buildFindMatchCellKeys,
  filterRowsByFindQuery,
  normalizeFindQuery,
  rowMatchesFindQuery,
} from "./table-find.ts";

export interface UseTableFindOptions {
  /** When false, Cmd/Ctrl+F is ignored. Default true. */
  enabled?: boolean;
  /** Restrict matching to these column ids. */
  columnIds?: readonly string[];
}

export interface UseTableFindResult {
  open: boolean;
  query: string;
  filterMode: boolean;
  setQuery: (query: string) => void;
  setFilterMode: (filterMode: boolean) => void;
  openFind: () => void;
  closeFind: () => void;
  matchKeys: Set<string>;
  /** Filter loaded rows when filterMode + query active; otherwise return input. */
  applyFindToRows: <T extends Record<string, unknown>>(rows: readonly T[]) => T[];
  /** Filter tanstack rows; when not filtering, return input. */
  applyFindToTableRows: <T extends { id: string; original: Record<string, unknown> }>(
    rows: readonly T[],
  ) => T[];
  matchRowCount: number;
}

export function useTableFind(
  rows: ReadonlyArray<{ id: string; original: Record<string, unknown> }>,
  options: UseTableFindOptions = {},
): UseTableFindResult {
  const { enabled = true, columnIds } = options;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState(false);

  const openFind = useEffectEvent(() => setOpen(true));
  const closeFind = useEffectEvent(() => {
    setOpen(false);
    setQuery("");
    setFilterMode(false);
  });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "f") return;

      const target = event.target as HTMLElement | null;
      if (!open) {
        // Don't steal from editors / other inputs
        if (
          target?.closest?.(
            ".monaco-editor, textarea, input, [contenteditable='true'], [role='textbox']",
          )
        ) {
          return;
        }
      }

      event.preventDefault();
      openFind();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, open]);

  const matchKeys = useMemo(() => {
    if (!open || !normalizeFindQuery(query)) return new Set<string>();
    return buildFindMatchCellKeys(rows, query, columnIds);
  }, [open, query, rows, columnIds]);

  const matchRowCount = useMemo(() => {
    if (!normalizeFindQuery(query)) return 0;
    return rows.filter((row) => rowMatchesFindQuery(row.original, query, columnIds)).length;
  }, [rows, query, columnIds]);

  const applyFindToRows = useCallback(
    <T extends Record<string, unknown>>(input: readonly T[]): T[] => {
      if (!open || !filterMode || !normalizeFindQuery(query)) return [...input];
      return filterRowsByFindQuery(input, query, columnIds);
    },
    [open, filterMode, query, columnIds],
  );

  const applyFindToTableRows = useCallback(
    <T extends { id: string; original: Record<string, unknown> }>(input: readonly T[]): T[] => {
      if (!open || !filterMode || !normalizeFindQuery(query)) return [...input];
      return input.filter((row) => rowMatchesFindQuery(row.original, query, columnIds));
    },
    [open, filterMode, query, columnIds],
  );

  return {
    open,
    query,
    filterMode,
    setQuery,
    setFilterMode,
    openFind,
    closeFind,
    matchKeys,
    applyFindToRows,
    applyFindToTableRows,
    matchRowCount,
  };
}
