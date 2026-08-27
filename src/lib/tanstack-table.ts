import type {
  AccessorKeyColumnDef as CoreAccessorKeyColumnDef,
  CellContext as CoreCellContext,
  Column as CoreColumn,
  ColumnDef as CoreColumnDef,
  ColumnHelper,
  ColumnPinningState as CoreColumnPinningState,
  Header as CoreHeader,
  HeaderGroup as CoreHeaderGroup,
  Row as CoreRow,
  RowData as CoreRowData,
  TableOptions as CoreTableOptions,
} from "@tanstack/react-table";
import type { ReactTable as CoreReactTable } from "@tanstack/react-table";

import {
  cellSelectionFeature,
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper as createNativeColumnHelper,
  createCoreRowModel,
  createExpandedRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

/**
 * The native v9 feature set used by every Dadabase data table.
 *
 * Keep this outside React components: v9 uses the object identity to compose
 * the table's type and feature lifecycle once, rather than rebuilding it per
 * render. Features that are not useful to the current grid (grouping,
 * aggregation, spanning, and row pinning) stay out of the bundle until the UI
 * has a product-level use for them.
 */
export const dadabaseTableFeatures = tableFeatures({
  cellSelectionFeature,
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  expandedRowModel: createExpandedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});

export type DadabaseTableFeatures = typeof dadabaseTableFeatures;
export type RowData = CoreRowData & Record<string, any>;

export const createColumnHelper = <TData extends RowData = RowData>(): ColumnHelper<
  DadabaseTableFeatures,
  TData
> => createNativeColumnHelper<DadabaseTableFeatures, TData>();

export { flexRender, useTable as useReactTable };

export type AccessorKeyColumnDef<
  TData extends RowData,
  TValue = unknown,
> = CoreAccessorKeyColumnDef<DadabaseTableFeatures, TData, TValue>;
export type CellContext<TData extends RowData, TValue = unknown> = CoreCellContext<
  DadabaseTableFeatures,
  TData,
  TValue
>;
export type Column<TData extends RowData, TValue = unknown> = CoreColumn<
  DadabaseTableFeatures,
  TData,
  TValue
>;
export type ColumnDef<TData extends RowData, TValue = unknown> = CoreColumnDef<
  DadabaseTableFeatures,
  TData,
  TValue
>;
export type ColumnPinningState = CoreColumnPinningState;
export type Header<TData extends RowData, TValue = unknown> = CoreHeader<
  DadabaseTableFeatures,
  TData,
  TValue
>;
export type HeaderGroup<TData extends RowData> = CoreHeaderGroup<DadabaseTableFeatures, TData>;
export type Row<TData extends RowData> = CoreRow<DadabaseTableFeatures, TData>;
export type Table<TData extends RowData> = CoreReactTable<DadabaseTableFeatures, TData>;
export type TableOptions<TData extends RowData> = CoreTableOptions<DadabaseTableFeatures, TData>;
export type ReactTable<TData extends RowData> = CoreReactTable<DadabaseTableFeatures, TData>;
