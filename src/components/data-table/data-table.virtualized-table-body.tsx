import type { ReactNode } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";

import type { Row, RowData } from "#src/lib/tanstack-table.ts";

import type { ColumnVirtualizationState } from "./data-table.column-virtualization.ts";
import type { DataTableSize } from "./data-table.styles.ts";
import type { CellSelectionCellState } from "./use-data-table-cell-selection.ts";

import { DataTableRow, type DataTableRowSubrow } from "./data-table.row.tsx";

export interface VirtualizedTableBodyProps<TData extends RowData> {
  rows: Row<TData>[];
  onRowClick?: (row: Row<TData>) => void;
  onRowDoubleClick?: (row: Row<TData>) => void;
  size: DataTableSize;
  striped: boolean;
  interactive: boolean;
  showColumnBorder: boolean;
  withRowContextMenu?: boolean;
  ExpandedRow?: (props: { row: Row<TData> }) => ReactNode;
  onExpandRowJson?: (row: Record<string, unknown>) => void;
  estimateItemSize?: number;
  overscan?: number;
  scrollElement: HTMLDivElement;
  enableColumnOrdering: boolean;
  columnOrder?: string[];
  columnVirtualization: ColumnVirtualizationState;
  renderSubrows?: (row: Row<TData>) => DataTableRowSubrow[];
  cellSelection?: (rowId: string, columnId: string) => CellSelectionCellState | undefined;
}

export function VirtualizedTableBody<TData extends RowData>({
  rows,
  onRowClick,
  onRowDoubleClick,
  size,
  striped,
  interactive,
  showColumnBorder,
  enableColumnOrdering,
  withRowContextMenu,
  ExpandedRow,
  onExpandRowJson,
  estimateItemSize = 35,
  overscan,
  scrollElement,
  columnOrder = [],
  columnVirtualization,
  renderSubrows,
  cellSelection,
}: VirtualizedTableBodyProps<TData>) {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateItemSize,
    overscan: overscan ?? 30,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) : 0;

  return (
    <>
      {paddingTop > 0 && (
        <tr>
          <td style={{ height: `${paddingTop}px` }} />
        </tr>
      )}
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;

        return (
          <DataTableRow
            key={virtualRow.key}
            index={virtualRow.index}
            getRow={() => row}
            onRowClick={onRowClick}
            onRowDoubleClick={onRowDoubleClick}
            size={size}
            striped={striped}
            interactive={interactive}
            showColumnBorder={showColumnBorder}
            enableColumnOrdering={enableColumnOrdering}
            columnOrder={columnOrder}
            columnVirtualization={columnVirtualization}
            withRowContextMenu={withRowContextMenu}
            ExpandedRow={ExpandedRow}
            onExpandRowJson={onExpandRowJson}
            renderSubrows={renderSubrows}
            cellSelection={cellSelection}
          />
        );
      })}
      {paddingBottom > 0 && (
        <tr>
          <td style={{ height: `${paddingBottom}px` }} />
        </tr>
      )}
    </>
  );
}
