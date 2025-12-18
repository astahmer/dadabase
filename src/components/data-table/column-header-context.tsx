import { createContext, useContext, type ReactNode } from "react";
import type { Column } from "@tanstack/react-table";

interface ColumnHeaderContextValue {
	renderColumnHeaderMenuItems?: (column: Column<any>) => ReactNode;
}

const ColumnHeaderContext = createContext<ColumnHeaderContextValue | undefined>(
	undefined,
);

export function useColumnHeaderContext<TData = unknown>() {
	const context = useContext(ColumnHeaderContext);
	if (!context) {
		return {};
	}
	return context as ColumnHeaderContextValue;
}

export function ColumnHeaderContextProvider<TData = unknown>({
	children,
	renderColumnHeaderMenuItems,
}: {
	children: React.ReactNode;
	renderColumnHeaderMenuItems?: (column: Column<TData>) => ReactNode;
}) {
	return (
		<ColumnHeaderContext.Provider value={{ renderColumnHeaderMenuItems }}>
			{children}
		</ColumnHeaderContext.Provider>
	);
}
