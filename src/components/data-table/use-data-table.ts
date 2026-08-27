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

  const table = useReactTable({
    features: dadabaseTableFeatures,
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
