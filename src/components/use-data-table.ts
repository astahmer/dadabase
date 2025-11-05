import type {
	ColumnDef,
	ColumnFiltersState,
	ColumnSizingState,
	PaginationState,
	RowSelectionState,
	SortingState,
	TableOptions,
	VisibilityState,
} from "@tanstack/react-table";
import {
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

export interface UseDataTableProps<TData>
	extends Omit<
		TableOptions<TData>,
		"getCoreRowModel" | "columns" | "data" | "meta"
	> {
	data: readonly TData[];
	columns: ColumnDef<TData>[];
}

export function useDataTable<TData>(props: UseDataTableProps<TData>) {
	const { columns, data, initialState, rowCount, ...tableOptions } = props;

	const [sorting, setSorting] = useState<SortingState>(
		initialState?.sorting ?? [],
	);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
		initialState?.columnFilters ?? [],
	);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
		initialState?.columnVisibility ?? {},
	);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>(
		initialState?.rowSelection ?? {},
	);
	const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: initialState?.pagination?.pageIndex ?? 0,
		pageSize: initialState?.pagination?.pageSize ?? 25,
	});

	const table = useReactTable({
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
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
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		onColumnSizingChange: setColumnSizing,
		onPaginationChange: setPagination,
		columnResizeMode: "onChange",
		renderFallbackValue: "-",
		rowCount,
		getRowId: (row) => (row as { id: string }).id,
		...tableOptions,
		data: data as TData[],
		columns,
		initialState,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			columnSizing,
			pagination,
		},
	});

	return table;
}
