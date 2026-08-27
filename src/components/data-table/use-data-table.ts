import {
  dadabaseTableFeatures,
  useReactTable,
  type ColumnDef,
  type RowData,
  type TableOptions,
} from "#src/lib/tanstack-table.ts";

export interface UseDataTableProps<TData extends RowData> extends Omit<
  TableOptions<TData>,
  "columns" | "data" | "features"
> {
  data: readonly TData[];
  columns: ColumnDef<TData>[];
}

export function useDataTable<TData extends RowData>(props: UseDataTableProps<TData>) {
  const { columns, data, rowCount, ...tableOptions } = props;

  // Native v9 keeps feature registration static, while manual tables opt out
  // of client row-model stages by leaving the corresponding factory unset.
  const features = {
    ...dadabaseTableFeatures,
    expandedRowModel: tableOptions.manualExpanding
      ? undefined
      : dadabaseTableFeatures.expandedRowModel,
    filteredRowModel: tableOptions.manualFiltering
      ? undefined
      : dadabaseTableFeatures.filteredRowModel,
    paginatedRowModel: tableOptions.manualPagination
      ? undefined
      : dadabaseTableFeatures.paginatedRowModel,
    sortedRowModel: tableOptions.manualSorting ? undefined : dadabaseTableFeatures.sortedRowModel,
  } as typeof dadabaseTableFeatures;

  const table = useReactTable({
    features,
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
