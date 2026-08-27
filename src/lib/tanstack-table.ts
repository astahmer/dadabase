/**
 * Local v9 compatibility surface.
 *
 * Table v9 keeps the v8-shaped API in the explicit legacy entrypoint so large
 * consumers can migrate incrementally. Keeping this alias in one place lets
 * the application use v9's maintained implementation without spreading the
 * legacy feature type through every component.
 */
import type {
  AccessorKeyColumnDef as CoreAccessorKeyColumnDef,
  CellContext as CoreCellContext,
  ColumnPinningState as CoreColumnPinningState,
} from "@tanstack/react-table";
import type {
  LegacyColumn,
  LegacyColumnDef,
  LegacyFeatures,
  LegacyHeader,
  LegacyHeaderGroup,
  LegacyReactTable,
  LegacyRow,
  LegacyTableOptions,
} from "@tanstack/react-table/legacy";

import { flexRender } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  legacyCreateColumnHelper as createColumnHelper,
  useLegacyTable as useReactTable,
} from "@tanstack/react-table/legacy";

type RowData = Record<string, any>;

export {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
};

export type Column<TData extends RowData, TValue = unknown> = LegacyColumn<TData, TValue>;
export type ColumnDef<TData extends RowData, TValue = unknown> = LegacyColumnDef<TData, TValue>;
export type AccessorKeyColumnDef<
  TData extends RowData,
  TValue = unknown,
> = CoreAccessorKeyColumnDef<LegacyFeatures, TData, TValue>;
export type CellContext<TData extends RowData, TValue = unknown> = CoreCellContext<
  LegacyFeatures,
  TData,
  TValue
>;
export type ColumnPinningState = CoreColumnPinningState;
export type { RowData };
export type Header<TData extends RowData, TValue = unknown> = LegacyHeader<TData, TValue>;
export type HeaderGroup<TData extends RowData> = LegacyHeaderGroup<TData>;
export type Row<TData extends RowData> = LegacyRow<TData>;
export type Table<TData extends RowData> = LegacyReactTable<TData>;
export type TableOptions<TData extends RowData> = LegacyTableOptions<TData>;
export type ReactTable<TData extends RowData> = LegacyReactTable<TData>;
