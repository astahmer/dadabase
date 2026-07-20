import { createContext, useContext } from "react";

export interface TableFindContextValue {
  query: string;
  /** Set of `${rowId}::${columnId}` for highlighted cells. */
  matchKeys: Set<string>;
  filterMode: boolean;
}

const TableFindContext = createContext<TableFindContextValue | null>(null);

export const TableFindProvider = TableFindContext.Provider;

export function useTableFindContext(): TableFindContextValue | null {
  return useContext(TableFindContext);
}

export function useIsFindMatch(rowId: string, columnId: string): boolean {
  const ctx = useTableFindContext();
  if (!ctx?.query.trim()) return false;
  return ctx.matchKeys.has(`${rowId}::${columnId}`);
}
