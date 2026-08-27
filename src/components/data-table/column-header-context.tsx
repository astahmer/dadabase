import { createContext, type ReactNode, useContext } from "react";

import type { Column, RowData } from "#src/lib/tanstack-table.ts";

interface ColumnHeaderContextValue {
  renderColumnHeaderMenuItems?: (options: { column: Column<RowData> }) => ReactNode;
}

const ColumnHeaderContext = createContext<ColumnHeaderContextValue | undefined>(undefined);

export function useColumnHeaderContext() {
  const context = useContext(ColumnHeaderContext);
  if (!context) {
    return {};
  }
  return context as ColumnHeaderContextValue;
}

export function ColumnHeaderContextProvider({
  children,
  renderColumnHeaderMenuItems,
}: {
  children: React.ReactNode;
  renderColumnHeaderMenuItems?: (options: { column: Column<RowData> }) => ReactNode;
}) {
  return (
    <ColumnHeaderContext.Provider value={{ renderColumnHeaderMenuItems }}>
      {children}
    </ColumnHeaderContext.Provider>
  );
}
