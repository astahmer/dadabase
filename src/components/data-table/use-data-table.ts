import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type TableOptions,
} from "#src/lib/tanstack-table.ts";

export interface UseDataTableProps<TData extends RowData> extends Omit<
  TableOptions<TData>,
  "getCoreRowModel" | "columns" | "data" | "meta"
> {
  data: readonly TData[];
  columns: ColumnDef<TData>[];
}

export function useDataTable<TData extends RowData>(props: UseDataTableProps<TData>) {
  const { columns, data, rowCount, ...tableOptions } = props;

  const table = useReactTable({
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: tableOptions.manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: tableOptions.manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: tableOptions.manualFiltering ? undefined : getFilteredRowModel(),
    getExpandedRowModel: tableOptions.manualExpanding ? undefined : getExpandedRowModel(),
    columnResizeMode: "onChange",
    renderFallbackValue: "-",
    rowCount,
    getRowId: (row, index) => (row as unknown as { id: string }).id ?? index,
    ...tableOptions,
    data: data as TData[],
    columns,
  });

  return table;
}
