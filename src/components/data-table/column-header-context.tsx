import type { Column } from "@tanstack/react-table";
import { createContext, type ReactNode, useContext } from "react";

interface ColumnHeaderContextValue {
	renderColumnHeaderMenuItems?: (options: { column: Column<any> }) => ReactNode;
}

const ColumnHeaderContext = createContext<ColumnHeaderContextValue | undefined>(
	undefined,
);

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
	renderColumnHeaderMenuItems?: (options: { column: Column<any> }) => ReactNode;
}) {
	return (
		<ColumnHeaderContext.Provider value={{ renderColumnHeaderMenuItems }}>
			{children}
		</ColumnHeaderContext.Provider>
	);
}
