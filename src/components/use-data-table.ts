import type { ColumnDef, TableOptions } from "@tanstack/react-table";
import {
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";

export interface UseDataTableProps<TData>
	extends Omit<
		TableOptions<TData>,
		"getCoreRowModel" | "columns" | "data" | "meta"
	> {
	data: readonly TData[];
	columns: ColumnDef<TData>[];
}

export function useDataTable<TData>(props: UseDataTableProps<TData>) {
	const { columns, data, rowCount, ...tableOptions } = props;

	const table = useReactTable({
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: tableOptions.manualPagination
			? undefined
			: getPaginationRowModel(),
		getSortedRowModel: tableOptions.manualSorting
			? undefined
			: getSortedRowModel(),
		getFilteredRowModel: tableOptions.manualFiltering
			? undefined
			: getFilteredRowModel(),
		getExpandedRowModel: tableOptions.manualExpanding
			? undefined
			: getExpandedRowModel(),
		columnResizeMode: "onChange",
		renderFallbackValue: "-",
		rowCount,
		getRowId: (row) => (row as { id: string }).id,
		...tableOptions,
		data: data as TData[],
		columns,
	});

	return table;
}
