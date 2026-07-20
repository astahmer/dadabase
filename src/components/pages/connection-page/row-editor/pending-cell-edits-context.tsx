import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import {
  clearPendingCellEdits,
  getPendingValueForCell,
  upsertPendingCellEdit,
  type PendingCellEdit,
} from "./pending-cell-edits.ts";

interface BufferCellEditInput {
  schema: string;
  table: string;
  column: string;
  dataType: string;
  primaryKey: Record<string, unknown>;
  previousValue: unknown;
  nextValue: unknown;
}

interface PendingCellEditsContextValue {
  edits: PendingCellEdit[];
  setEdits: (edits: PendingCellEdit[]) => void;
  bufferEdit: (input: BufferCellEditInput) => void;
  getPendingValue: (primaryKey: Record<string, unknown>, column: string) => unknown | undefined;
  clearAll: () => void;
}

const PendingCellEditsContext = createContext<PendingCellEditsContextValue | null>(null);

export function PendingCellEditsProvider({ children }: { children: ReactNode }) {
  const [edits, setEdits] = useState<PendingCellEdit[]>([]);

  const bufferEdit = useCallback((input: BufferCellEditInput) => {
    setEdits((prev) => upsertPendingCellEdit(prev, input));
  }, []);

  const getPendingValue = useCallback(
    (primaryKey: Record<string, unknown>, column: string) =>
      getPendingValueForCell(edits, primaryKey, column),
    [edits],
  );

  const clearAll = useCallback(() => {
    setEdits(clearPendingCellEdits());
  }, []);

  const value = useMemo(
    () => ({ edits, setEdits, bufferEdit, getPendingValue, clearAll }),
    [edits, bufferEdit, getPendingValue, clearAll],
  );

  return (
    <PendingCellEditsContext.Provider value={value}>{children}</PendingCellEditsContext.Provider>
  );
}

export function usePendingCellEdits(): PendingCellEditsContextValue | null {
  return useContext(PendingCellEditsContext);
}
