import type { ReactNode, RefObject } from "react";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { arrayMove, horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  ChevronsUpDown,
  Check,
  Copy,
  GripVertical,
  Pin,
  PinOff,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import type {
  Header,
  HeaderGroup,
  Row,
  RowData,
  Table as TanstackTable,
} from "#src/lib/tanstack-table.ts";

import { flexRender } from "#src/lib/tanstack-table.ts";

import type { ColumnVirtualizationState } from "./data-table.column-virtualization.ts";
import type { ColumnHeaderFilterOperator } from "./upsert-column-header-filter.ts";

import { getColumnPinningStyles } from "../../lib/get-pinning-styles.ts";
import { runIfFn } from "../../lib/run-if-fn.ts";
import { cn } from "../../lib/utils.ts";
import { PageLimitSelect } from "../app/page-limit.select.tsx";
import { Button } from "../ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.tsx";
import { Input } from "../ui/input.tsx";
import { HStack } from "../ui/layout.tsx";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../ui/menu.tsx";
import { ColumnHeaderContextMenu } from "./column-header-context-menu.tsx";
import { ColumnHeaderFilter } from "./column-header-filter.tsx";
import { DataTableRow, type DataTableRowSubrow } from "./data-table.row.tsx";
import {
  type DataTableSize,
  tableCellStyles,
  tableEmptyStateStyles,
  tableHeaderCellStyles,
  tableHeaderStyles,
  tableStyles,
} from "./data-table.styles.ts";
import { VirtualizedTableBody } from "./data-table.virtualized-table-body.tsx";
import { DraggableColumnHeader } from "./draggable-column-header.tsx";
import { TableFindBar } from "./table-find-bar.tsx";
import { TableFindProvider } from "./table-find-context.tsx";
import {
  useDataTableCellSelection,
  type CellSelectionExportFormat,
  type DataTableCellSelectionOptions,
} from "./use-data-table-cell-selection.ts";
import { useTableFind } from "./use-table-find.ts";

const i18n = {
  emptyText: "No results found.",
  errorText: "An error occurred.",
};

export type DataTableVariant = "line" | "outline";

export interface DataTableProps<TData extends RowData> {
  className?: string;
  table: TanstackTable<TData>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  getTableContainer?: (el: HTMLDivElement) => void;
  footer?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
  top?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
  bottom?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
  emptyState?: ReactNode;
  isLoading?: boolean;
  hasError?: boolean;
  onRowClick?: (row: Row<TData>) => void;
  onRowDoubleClick?: (row: Row<TData>) => void;
  onColumnFilterClick?: (columnId: string, columnName: string) => void;
  /** Active equals/contains filter for a column header (from query filter state). */
  getColumnHeaderFilter?: (
    columnId: string,
  ) => { operator: ColumnHeaderFilterOperator; value: string } | undefined;
  /** Apply/clear inline header filter for a column. */
  onColumnHeaderFilterChange?: (
    columnId: string,
    filter: { operator: ColumnHeaderFilterOperator; value: string } | null,
  ) => void;
  stickyHeader?: boolean;
  interactive?: boolean;
  striped?: boolean;
  showColumnBorder?: boolean;
  withRowContextMenu?: boolean;
  variant?: DataTableVariant;
  size?: DataTableSize;
  ExpandedRow?: (props: { row: Row<TData> }) => ReactNode;
  resizable?: boolean;
  onExpandRowJson?: (row: Record<string, unknown>) => void;
  enableRowVirtualization?: boolean;
  rowEstimateItemSize?: number;
  rowOverscan?: number;
  enableColumnOrdering?: boolean;
  renderSubrows?: (row: Row<TData>) => DataTableRowSubrow[];
  hideColumnPinIconUnlessHovered?: boolean;
  enableColumnVirtualization?: boolean;
  /** Cmd/Ctrl+F local find over loaded rows (highlight / filter). */
  enableFind?: boolean;
  /** Spreadsheet-style cell selection and clipboard copy for this table. */
  enableCellSelection?: boolean;
  onPasteSelection?: DataTableCellSelectionOptions<TData>["onPasteSelection"];
  onBulkFillSelection?: DataTableCellSelectionOptions<TData>["onBulkFillSelection"];
  onSelectionExport?: DataTableCellSelectionOptions<TData>["onSelectionExport"];
}

export function DataTable<TData extends RowData>(props: DataTableProps<TData>) {
  const {
    table,
    top,
    bottom,
    emptyState = true,
    stickyHeader = true,
    interactive = false,
    striped = false,
    showColumnBorder = false,
    withRowContextMenu = false,
    resizable = true,
    variant = "line",
    size = "cozy",
    enableRowVirtualization = false,
    rowEstimateItemSize: estimateItemSize,
    rowOverscan = 10,
    enableColumnOrdering = false,
    hideColumnPinIconUnlessHovered = true,
    enableFind = false,
    enableCellSelection = false,
  } = props;

  const state = table.state;
  const { pagination } = state;
  const rows = table.getRowModel().rows;
  const enableColumnVirtualization = table.getVisibleLeafColumns().length >= 8;

  const findColumnIds = useMemo(
    () => table.getVisibleLeafColumns().map((c) => c.id),
    [table, state.columnVisibility, state.columnOrder],
  );

  const findRows = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        original: row.original as Record<string, unknown>,
      })),
    [rows],
  );

  const find = useTableFind(findRows, {
    enabled: enableFind,
    columnIds: findColumnIds,
  });
  const cellSelection = useDataTableCellSelection(table, enableCellSelection, {
    onPasteSelection: props.onPasteSelection,
    onBulkFillSelection: props.onBulkFillSelection,
    onSelectionExport: props.onSelectionExport,
  });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [bulkFillOpen, setBulkFillOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(MouseSensor),
    useSensor(KeyboardSensor),
  );

  const TableContent = (
    <TableFindProvider
      value={{
        query: find.open ? find.query : "",
        matchKeys: find.matchKeys,
        filterMode: find.filterMode,
      }}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        {enableFind ? (
          <TableFindBar
            open={find.open}
            query={find.query}
            filterMode={find.filterMode}
            matchCount={find.matchRowCount}
            onQueryChange={find.setQuery}
            onFilterModeChange={find.setFilterMode}
            onClose={find.closeFind}
          />
        ) : null}
        <TableContainer
          table={table}
          className={props.className}
          containerRef={props.containerRef}
          getTableContainer={props.getTableContainer}
          emptyState={emptyState}
          isLoading={props.isLoading}
          hasError={props.hasError}
          onRowClick={props.onRowClick}
          onRowDoubleClick={props.onRowDoubleClick}
          onColumnFilterClick={props.onColumnFilterClick}
          getColumnHeaderFilter={props.getColumnHeaderFilter}
          onColumnHeaderFilterChange={props.onColumnHeaderFilterChange}
          stickyHeader={stickyHeader}
          withRowContextMenu={withRowContextMenu}
          ExpandedRow={props.ExpandedRow}
          resizable={resizable}
          onExpandRowJson={props.onExpandRowJson}
          enableRowVirtualization={enableRowVirtualization}
          rowEstimateItemSize={estimateItemSize}
          rowOverscan={rowOverscan}
          renderSubrows={props.renderSubrows}
          hideColumnPinIconUnlessHovered={hideColumnPinIconUnlessHovered}
          enableColumnVirtualization={enableColumnVirtualization}
          size={size}
          variant={variant}
          interactive={interactive}
          striped={striped}
          showColumnBorder={showColumnBorder}
          enableColumnOrdering={enableColumnOrdering}
          enableCellSelection={enableCellSelection}
          cellSelection={cellSelection}
          findFilterRows={
            enableFind && find.open && find.filterMode
              ? (tableRows) => find.applyFindToTableRows(tableRows)
              : undefined
          }
        />
        {cellSelection.enabled ? (
          <table.Subscribe
            source={table.atoms.cellSelection}
            selector={() => table.getSelectedCellCount()}
          >
            {(selectedCellCount) =>
              selectedCellCount > 0 ? (
                <CellSelectionStatus
                  count={selectedCellCount}
                  rowCount={cellSelection.selectionSnapshot.rows.length}
                  columnCount={cellSelection.selectionSnapshot.columns.length}
                  onClear={cellSelection.clearSelection}
                  onCopy={cellSelection.copySelection}
                  onExport={cellSelection.exportSelection}
                  onPaste={Boolean(props.onPasteSelection)}
                  onFill={Boolean(props.onBulkFillSelection)}
                  onOpenFill={() => setBulkFillOpen(true)}
                  onDetails={() => setDetailsOpen(true)}
                />
              ) : null
            }
          </table.Subscribe>
        ) : null}
        {cellSelection.enabled && cellSelection.selectionSnapshot.focusedCell ? (
          <CellSelectionDetails
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            cell={cellSelection.selectionSnapshot.focusedCell}
          />
        ) : null}
        {cellSelection.enabled && props.onBulkFillSelection ? (
          <BulkCellFillDialog
            open={bulkFillOpen}
            onOpenChange={setBulkFillOpen}
            rowCount={cellSelection.selectionSnapshot.rows.length}
            columnCount={cellSelection.selectionSnapshot.columns.length}
            columns={cellSelection.selectionSnapshot.columns}
            onSubmit={async (value) => {
              await props.onBulkFillSelection?.({
                value,
                selection: cellSelection.selectionSnapshot,
              });
            }}
          />
        ) : null}
      </div>
    </TableFindProvider>
  );

  return (
    <>
      {runIfFn(top, table)}
      {enableColumnOrdering ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={function handleDragEnd(event) {
            const { active, over } = event;
            if (active && over && active.id !== over.id) {
              table.setColumnOrder((columnOrder) => {
                const oldIndex = columnOrder.indexOf(active.id as string);
                const newIndex = columnOrder.indexOf(over.id as string);
                return arrayMove(columnOrder, oldIndex, newIndex);
              });
            }
          }}
        >
          {TableContent}
        </DndContext>
      ) : (
        TableContent
      )}

      {table.options.manualPagination === false &&
      (rows.length >= pagination.pageSize || pagination.pageSize > 100) ? (
        <DataTablePagination table={table} />
      ) : null}
      {runIfFn(bottom, table)}
    </>
  );
}

const TableContainer = <TData extends RowData>(
  props: Pick<
    DataTableProps<TData>,
    | "table"
    | "className"
    | "containerRef"
    | "getTableContainer"
    | "emptyState"
    | "isLoading"
    | "hasError"
    | "onRowClick"
    | "onRowDoubleClick"
    | "onColumnFilterClick"
    | "getColumnHeaderFilter"
    | "onColumnHeaderFilterChange"
    | "stickyHeader"
    | "withRowContextMenu"
    | "ExpandedRow"
    | "resizable"
    | "onExpandRowJson"
    | "enableRowVirtualization"
    | "rowEstimateItemSize"
    | "rowOverscan"
    | "renderSubrows"
    | "hideColumnPinIconUnlessHovered"
    | "enableColumnVirtualization"
  > &
    Pick<
      Required<DataTableProps<TData>>,
      | "size"
      | "variant"
      | "interactive"
      | "striped"
      | "showColumnBorder"
      | "enableColumnOrdering"
      | "enableCellSelection"
    > & {
      cellSelection?: ReturnType<typeof useDataTableCellSelection<any>>;
      findFilterRows?: <T extends { id: string; original: Record<string, unknown> }>(
        rows: readonly T[],
      ) => T[];
    },
) => {
  const table = props.table;
  const state = props.table.state;

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const hasGroupedHeaders = useMemo(() => {
    return table.getHeaderGroups().some((hg) => hg.headers.some((h) => h.subHeaders.length > 0));
  }, [table]);

  const leafColumns = table.getVisibleLeafColumns();
  const centerLeafColumns =
    table.getCenterVisibleLeafColumns?.() ?? leafColumns.filter((c) => !c.getIsPinned());

  const columnVirtualizer = useVirtualizer({
    enabled: props.enableColumnVirtualization,
    horizontal: true,
    count: centerLeafColumns.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: (index) => centerLeafColumns[index]?.getSize() ?? 0,
    overscan: 1,
  });

  // Keep measurements fresh when column sizes change (resize, order, pinning)
  // biome-ignore lint/correctness/useExhaustiveDependencies: ok
  useEffect(() => {
    columnVirtualizer.measure();
  }, [
    columnVirtualizer,
    state.columnSizing,
    state.columnResizing,
    state.columnOrder,
    state.columnPinning,
  ]);

  const enabledColumnVirtualization =
    props.enableColumnVirtualization === true &&
    centerLeafColumns.length > 0 &&
    tableContainerRef.current != null;

  const centerVirtualItems = enabledColumnVirtualization ? columnVirtualizer.getVirtualItems() : [];

  const columnVirtualization: ColumnVirtualizationState = useMemo(() => {
    if (enabledColumnVirtualization && centerVirtualItems.length > 0) {
      const startIndex = centerVirtualItems[0]?.index ?? 0;
      const endIndex = centerVirtualItems.at(-1)?.index ?? 0;
      const totalSize = columnVirtualizer.getTotalSize();
      const leftPaddingPx = centerVirtualItems[0]?.start ?? 0;
      const rightPaddingPx = totalSize - (centerVirtualItems.at(-1)?.end ?? 0);

      return {
        enabled: true,
        virtualCenterColumnIds: centerVirtualItems
          .map((v) => centerLeafColumns[v.index]?.id)
          .filter(Boolean) as string[],
        centerPaddingLeftPx: leftPaddingPx,
        centerPaddingRightPx: rightPaddingPx,
        centerPaddingLeftColSpan: Math.max(0, startIndex),
        centerPaddingRightColSpan: Math.max(0, centerLeafColumns.length - (endIndex + 1)),
      };
    }

    return { enabled: false };
  }, [enabledColumnVirtualization, centerVirtualItems, centerLeafColumns, columnVirtualizer]);

  return (
    <div
      className={`h-full overflow-x-auto ${props.enableRowVirtualization ? "overflow-y-auto" : ""} ${props.className || ""}`}
      data-cell-selection-grid={props.enableCellSelection ? true : undefined}
      tabIndex={props.enableCellSelection ? 0 : undefined}
      onKeyDown={props.cellSelection?.onGridKeyDown}
      onPaste={props.cellSelection?.onGridPaste}
      ref={(el) => {
        if (props.containerRef) {
          props.containerRef.current = el;
        }

        if (el) {
          tableContainerRef.current = el;
          props.getTableContainer?.(el);
        }
      }}
    >
      <table
        className={tableStyles({ variant: props.variant })}
        style={{ width: table.getTotalSize() }}
      >
        <thead
          className={tableHeaderStyles({
            stickyHeader: props.stickyHeader,
            variant: props.variant,
          })}
        >
          {table.getHeaderGroups().map((headerGroup) => {
            const headerById = new Map(headerGroup.headers.map((h) => [h.column.id, h]));

            const getPinningSideForHeader = (
              headerCell: Header<TData, any>,
            ): "start" | "end" | false => {
              const leaves = headerCell.getLeafHeaders();
              const sides = new Set(
                leaves
                  .map((h: Header<TData, any>) => h.column.getIsPinned())
                  .filter((side): side is "start" | "end" => side === "start" || side === "end"),
              );
              if (sides.size === 1) {
                return (Array.from(sides)[0] as "start" | "end") ?? false;
              }
              return false;
            };

            const leftHeaders = headerGroup.headers.filter(
              (h) => getPinningSideForHeader(h) === "start",
            );
            const rightHeaders = headerGroup.headers.filter(
              (h) => getPinningSideForHeader(h) === "end",
            );
            const centerHeaders = headerGroup.headers.filter(
              (h) => getPinningSideForHeader(h) === false,
            );

            const centerIndexByColumnId = new Map(centerLeafColumns.map((c, i) => [c.id, i]));

            const getCenterLeafIndicesForHeader = (headerCell: Header<TData, any>): number[] => {
              return headerCell
                .getLeafHeaders()
                .map((h: Header<TData, any>) => centerIndexByColumnId.get(h.column.id))
                .filter((v): v is number => v != null);
            };

            const renderHeaderCell = (
              headerCell: Header<TData, any>,
              overrides?: { colSpan?: number; sizePx?: number },
            ) => (
              <HeaderCell
                key={headerCell.id}
                table={table}
                headerGroup={headerGroup}
                headerCell={headerCell}
                colSpanOverride={overrides?.colSpan}
                sizeOverridePx={overrides?.sizePx}
                enableColumnOrdering={props.enableColumnOrdering}
                size={props.size}
                showColumnBorder={props.showColumnBorder}
                hideColumnPinIconUnlessHovered={props.hideColumnPinIconUnlessHovered}
                onColumnFilterClick={props.onColumnFilterClick}
                getColumnHeaderFilter={props.getColumnHeaderFilter}
                onColumnHeaderFilterChange={props.onColumnHeaderFilterChange}
                resizable={props.resizable}
              />
            );

            const HeaderCellList =
              columnVirtualization.enabled === true
                ? (() => {
                    const startIndex = columnVirtualization.centerPaddingLeftColSpan;
                    const endIndex =
                      centerLeafColumns.length - columnVirtualization.centerPaddingRightColSpan - 1;

                    const slicedCenterHeaders = hasGroupedHeaders
                      ? centerHeaders
                          .map((h) => {
                            const indices = getCenterLeafIndicesForHeader(h);
                            const visibleIndices = indices.filter(
                              (i) => i >= startIndex && i <= endIndex,
                            );

                            if (visibleIndices.length === 0) return null;

                            const sizePx = visibleIndices.reduce(
                              (acc, i) => acc + (centerLeafColumns[i]?.getSize() ?? 0),
                              0,
                            );

                            return renderHeaderCell(h, {
                              colSpan: visibleIndices.length,
                              sizePx,
                            });
                          })
                          .filter(Boolean)
                      : columnVirtualization.virtualCenterColumnIds
                          .map((columnId) => headerById.get(columnId))
                          .filter(Boolean)
                          .map((h) => renderHeaderCell(h as Header<TData, any>));

                    return [
                      ...leftHeaders.map((h) => renderHeaderCell(h)),
                      columnVirtualization.centerPaddingLeftColSpan > 0 ? (
                        <th
                          key={`${headerGroup.id}-center-padding-left`}
                          aria-hidden
                          colSpan={columnVirtualization.centerPaddingLeftColSpan}
                          className="p-0"
                          style={{
                            width: columnVirtualization.centerPaddingLeftPx,
                          }}
                        />
                      ) : null,
                      ...slicedCenterHeaders,
                      columnVirtualization.centerPaddingRightColSpan > 0 ? (
                        <th
                          key={`${headerGroup.id}-center-padding-right`}
                          aria-hidden
                          colSpan={columnVirtualization.centerPaddingRightColSpan}
                          className="p-0"
                          style={{
                            width: columnVirtualization.centerPaddingRightPx,
                          }}
                        />
                      ) : null,
                      ...rightHeaders.map((h) => renderHeaderCell(h)),
                    ];
                  })()
                : // Fallback: render all headers
                  [
                    ...leftHeaders.map((h) => renderHeaderCell(h)),
                    ...centerHeaders.map((h) => renderHeaderCell(h)),
                    ...rightHeaders.map((h) => renderHeaderCell(h)),
                  ];

            if (props.enableColumnOrdering) {
              return (
                <tr key={headerGroup.id}>
                  <SortableContext
                    items={state.columnOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    {HeaderCellList}
                  </SortableContext>
                </tr>
              );
            }

            return <tr key={headerGroup.id}>{HeaderCellList}</tr>;
          })}
        </thead>
        {table.state.columnResizing.isResizingColumn ? (
          <MemoizedTableBody
            table={table}
            tableContainerRef={tableContainerRef}
            isLoading={props.isLoading}
            enableRowVirtualization={props.enableRowVirtualization}
            onRowClick={props.onRowClick}
            onRowDoubleClick={props.onRowDoubleClick}
            withRowContextMenu={props.withRowContextMenu}
            ExpandedRow={props.ExpandedRow}
            onExpandRowJson={props.onExpandRowJson}
            rowEstimateItemSize={props.rowEstimateItemSize}
            rowOverscan={props.rowOverscan}
            renderSubrows={props.renderSubrows}
            emptyState={props.emptyState}
            hasError={props.hasError}
            size={props.size}
            variant={props.variant}
            interactive={props.interactive}
            striped={props.striped}
            showColumnBorder={props.showColumnBorder}
            enableColumnOrdering={props.enableColumnOrdering}
            columnVirtualization={columnVirtualization}
            findFilterRows={props.findFilterRows}
            cellSelection={props.cellSelection}
          />
        ) : (
          <TableBody
            table={table}
            tableContainerRef={tableContainerRef}
            isLoading={props.isLoading}
            enableRowVirtualization={props.enableRowVirtualization}
            columnVirtualization={columnVirtualization}
            onRowClick={props.onRowClick}
            onRowDoubleClick={props.onRowDoubleClick}
            withRowContextMenu={props.withRowContextMenu}
            ExpandedRow={props.ExpandedRow}
            onExpandRowJson={props.onExpandRowJson}
            rowEstimateItemSize={props.rowEstimateItemSize}
            rowOverscan={props.rowOverscan}
            renderSubrows={props.renderSubrows}
            emptyState={props.emptyState}
            hasError={props.hasError}
            size={props.size}
            variant={props.variant}
            interactive={props.interactive}
            striped={props.striped}
            showColumnBorder={props.showColumnBorder}
            enableColumnOrdering={props.enableColumnOrdering}
            findFilterRows={props.findFilterRows}
            cellSelection={props.cellSelection}
          />
        )}
      </table>
    </div>
  );
};

const TableBody = <TData extends RowData>(
  props: {
    table: TanstackTable<TData>;
    tableContainerRef: RefObject<HTMLDivElement | null>;
    columnVirtualization: ColumnVirtualizationState;
    cellSelection?: ReturnType<typeof useDataTableCellSelection<TData>>;
    findFilterRows?: <T extends { id: string; original: Record<string, unknown> }>(
      rows: readonly T[],
    ) => T[];
  } & Pick<
    DataTableProps<TData>,
    | "isLoading"
    | "enableRowVirtualization"
    | "onRowClick"
    | "onRowDoubleClick"
    | "withRowContextMenu"
    | "ExpandedRow"
    | "onExpandRowJson"
    | "rowEstimateItemSize"
    | "rowOverscan"
    | "renderSubrows"
    | "emptyState"
    | "hasError"
  > &
    Pick<
      Required<DataTableProps<TData>>,
      "size" | "variant" | "interactive" | "striped" | "showColumnBorder" | "enableColumnOrdering"
    >,
) => {
  const { table, tableContainerRef } = props;
  const state = props.table.state;

  const allRows = table.getRowModel().rows;
  const rows = props.findFilterRows ? (props.findFilterRows(allRows) as typeof allRows) : allRows;
  const columnVirtualization = props.columnVirtualization;

  const leafColumns = table.getVisibleLeafColumns();
  const leftPinnedLeafColumns = leafColumns.filter((c) => c.getIsPinned() === "start");
  const rightPinnedLeafColumns = leafColumns.filter((c) => c.getIsPinned() === "end");
  const centerLeafColumns = leafColumns.filter((c) => !c.getIsPinned());

  return props.isLoading && !props.hasError ? (
    <tbody>
      {Array(state.pagination.pageSize)
        .fill(state.pagination.pageSize)
        .map((_, index) => (
          <tr className="border-border border-b" key={index} data-skeleton>
            {leftPinnedLeafColumns.map((col) => (
              <td
                key={col.id}
                className={tableCellStyles({ size: props.size })}
                style={getColumnPinningStyles(col)}
              >
                <div className="bg-muted h-3 animate-pulse rounded" />
              </td>
            ))}
            {columnVirtualization.enabled === true &&
            columnVirtualization.centerPaddingLeftColSpan > 0 ? (
              <td
                key={`skeleton-${index}-center-padding-left`}
                aria-hidden
                colSpan={columnVirtualization.centerPaddingLeftColSpan}
                className="p-0"
                style={{ width: columnVirtualization.centerPaddingLeftPx }}
              />
            ) : null}
            {(columnVirtualization.enabled === true
              ? columnVirtualization.virtualCenterColumnIds
              : centerLeafColumns.map((c) => c.id)
            ).map((columnId) => (
              <td
                key={`skeleton-${index}-${columnId}`}
                className={tableCellStyles({ size: props.size })}
              >
                <div className="bg-muted h-3 animate-pulse rounded" />
              </td>
            ))}
            {columnVirtualization.enabled === true &&
            columnVirtualization.centerPaddingRightColSpan > 0 ? (
              <td
                key={`skeleton-${index}-center-padding-right`}
                aria-hidden
                colSpan={columnVirtualization.centerPaddingRightColSpan}
                className="p-0"
                style={{ width: columnVirtualization.centerPaddingRightPx }}
              />
            ) : null}
            {rightPinnedLeafColumns.map((col) => (
              <td
                key={col.id}
                className={tableCellStyles({ size: props.size })}
                style={getColumnPinningStyles(col)}
              >
                <div className="bg-muted h-3 animate-pulse rounded" />
              </td>
            ))}
          </tr>
        ))}
    </tbody>
  ) : props.enableRowVirtualization && rows.length && tableContainerRef.current ? (
    <tbody>
      <VirtualizedTableBody
        rows={rows}
        onRowClick={props.onRowClick}
        onRowDoubleClick={props.onRowDoubleClick}
        size={props.size}
        striped={props.striped}
        interactive={props.interactive}
        showColumnBorder={props.showColumnBorder}
        enableColumnOrdering={props.enableColumnOrdering}
        columnOrder={state.columnOrder}
        columnVirtualization={columnVirtualization}
        withRowContextMenu={props.withRowContextMenu}
        ExpandedRow={props.ExpandedRow}
        onExpandRowJson={props.onExpandRowJson}
        estimateItemSize={props.rowEstimateItemSize ?? estimateSizeByTableSize(props.size)}
        overscan={props.rowOverscan}
        scrollElement={tableContainerRef.current}
        renderSubrows={props.renderSubrows}
        cellSelection={props.cellSelection?.getCellState}
      />
    </tbody>
  ) : (
    <tbody>
      {rows.length ? (
        rows.map((row, index) => (
          <DataTableRow
            key={row.id}
            index={index}
            getRow={() => row}
            onRowClick={props.onRowClick}
            onRowDoubleClick={props.onRowDoubleClick}
            size={props.size}
            striped={props.striped}
            interactive={props.interactive}
            showColumnBorder={props.showColumnBorder}
            enableColumnOrdering={props.enableColumnOrdering}
            columnOrder={state.columnOrder}
            columnVirtualization={columnVirtualization}
            withRowContextMenu={props.withRowContextMenu}
            ExpandedRow={props.ExpandedRow}
            onExpandRowJson={props.onExpandRowJson}
            renderSubrows={props.renderSubrows}
            cellSelection={props.cellSelection?.getCellState}
          />
        ))
      ) : (
        <tr>
          {props.emptyState ? (
            <td className="absolute inset-x-0 flex items-center justify-center px-4">
              <div className={tableEmptyStateStyles()}>
                {typeof props.emptyState === "boolean" ? (
                  <span>{props.hasError ? i18n.errorText : i18n.emptyText}</span>
                ) : (
                  props.emptyState
                )}
              </div>
            </td>
          ) : null}
        </tr>
      )}
    </tbody>
  );
};

// https://github.com/TanStack/table/issues/1766
// https://tanstack.com/table/latest/docs/framework/react/examples/column-resizing-performant?panel=sandbox
//special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data,
) as typeof TableBody;

const ResizeHandle = (props: {
  onDoubleClick: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  isResizing: boolean;
  columnResizeDirection?: string;
}) => {
  return (
    <div
      {...{
        onDoubleClick: props.onDoubleClick,
        onMouseDown: props.onMouseDown,
        onTouchStart: props.onTouchStart,
        className: cn(
          props.columnResizeDirection,
          props.isResizing && "isResizing",
          "bg-border hover:bg-primary absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize touch-none transition-colors duration-150 select-none hover:shadow-md",
        ),
        title: "Drag to resize column",
      }}
    />
  );
};

const estimateSizeByTableSize = (size: DataTableSize) => {
  switch (size) {
    case "excel":
      return 25;
    case "minimal":
      return 27.5;
    case "compact":
      return 29;
    case "cozy":
      return 33;
    case "comfortable":
      return 38;
  }
};

function CellSelectionStatus(props: {
  count: number;
  rowCount: number;
  columnCount: number;
  onCopy: (format?: CellSelectionExportFormat) => Promise<boolean>;
  onExport: (format: CellSelectionExportFormat) => Promise<boolean>;
  onClear: () => void;
  onPaste: boolean;
  onFill: boolean;
  onOpenFill: () => void;
  onDetails: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async (format: CellSelectionExportFormat = "tsv") => {
    const didCopy = await props.onCopy(format);
    if (!didCopy) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="border-border bg-muted/30 text-muted-foreground flex shrink-0 items-center justify-between gap-3 border-t px-2 py-1 text-xs">
      <span>
        {props.count} cell{props.count === 1 ? "" : "s"} selected
        <span className="text-muted-foreground/70 ml-1">
          · {props.rowCount} row{props.rowCount === 1 ? "" : "s"} · {props.columnCount} column
          {props.columnCount === 1 ? "" : "s"}
        </span>
      </span>
      <div className="flex items-center gap-1">
        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className="h-6 gap-1 px-1.5"
              aria-label="Copy selected cells"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem value="copy-tsv" onClick={() => void copy("tsv")}>
              Copy as TSV
            </MenuItem>
            <MenuItem value="copy-csv" onClick={() => void copy("csv")}>
              Copy as CSV
            </MenuItem>
            <MenuItem value="copy-json" onClick={() => void copy("json")}>
              Copy as JSON
            </MenuItem>
            <MenuItem value="copy-sql" onClick={() => void copy("sql")}>
              Copy as INSERT SQL
            </MenuItem>
          </MenuContent>
        </Menu>
        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className="h-6 px-1.5"
              aria-label="Export selected cells"
            >
              Export
            </Button>
          </MenuTrigger>
          <MenuContent>
            {(["tsv", "csv", "json", "sql"] as const).map((format) => (
              <MenuItem
                key={format}
                value={`export-${format}`}
                onClick={() => void props.onExport(format)}
              >
                Export as {format === "sql" ? "INSERT SQL" : format.toUpperCase()}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        {props.onFill ? (
          <>
            <Button
              variant="ghost"
              size="xs"
              className="h-6 px-1.5"
              onClick={props.onOpenFill}
              aria-label="Update selected cells"
            >
              Update
            </Button>
            <span className="text-muted-foreground/80 hidden text-[11px] sm:inline">
              Type to fill
            </span>
          </>
        ) : null}
        {props.onPaste ? (
          <span className="text-muted-foreground/80 hidden text-[11px] md:inline">
            Paste to replace
          </span>
        ) : null}
        <Button variant="ghost" size="xs" className="h-6 px-1.5" onClick={props.onDetails}>
          Details
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="h-6 px-1.5"
          onClick={props.onClear}
          aria-label="Clear cell selection"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

function BulkCellFillDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowCount: number;
  columnCount: number;
  columns: string[];
  onSubmit: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setIsSubmitting(true);
    try {
      await props.onSubmit(value);
      props.onOpenChange(false);
      setValue("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={({ open }) => props.onOpenChange(open)}>
      <DialogContent data-testid="bulk-cell-fill-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update selected cells</DialogTitle>
          <DialogDescription>
            Set one value across {props.rowCount} row{props.rowCount === 1 ? "" : "s"} in{" "}
            {props.columnCount} column{props.columnCount === 1 ? "" : "s"}.
            {props.columns.length === 1 ? ` Column: ${props.columns[0]}.` : null}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Value (leave empty for NULL where supported)"
            aria-label="Bulk update value"
            disabled={isSubmitting}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => props.onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Updating…" : "Update cells"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CellSelectionDetails<TData extends RowData>(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cell: { row: Row<TData>; columnId: string; value: unknown };
}) {
  if (!props.open) return null;

  const value = props.cell.value;
  let displayValue = "";
  if (value === null) displayValue = "NULL";
  else if (value === undefined) displayValue = "undefined";
  else if (typeof value === "string") displayValue = value;
  else {
    try {
      displayValue = JSON.stringify(value, null, 2) ?? Object.prototype.toString.call(value);
    } catch {
      displayValue = Object.prototype.toString.call(value);
    }
  }

  return (
    <div
      className={cn(
        "bg-background fixed inset-y-0 right-0 z-100 flex w-[min(32rem,100vw)] flex-col border-l shadow-xl transition-transform duration-200",
        "translate-x-0",
      )}
    >
      <div className="border-border flex items-start justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Cell details
          </p>
          <h2 className="text-foreground mt-1 truncate text-sm font-semibold">
            {props.cell.columnId}
          </h2>
          <p className="text-muted-foreground mt-1 truncate text-xs">Row {props.cell.row.id}</p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => props.onOpenChange(false)}
          aria-label="Close cell details"
        >
          Close
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="text-muted-foreground mb-2 text-xs">
          {value === null ? "null" : typeof value}
        </div>
        <pre className="bg-muted/40 text-foreground min-h-32 overflow-auto rounded-md border p-3 font-mono text-xs leading-5 break-words whitespace-pre-wrap">
          {displayValue}
        </pre>
      </div>
    </div>
  );
}

function DataTablePagination<TData extends RowData>(props: { table: TanstackTable<TData> }) {
  const { table } = props;
  const state = table.state;
  const rowCount = table.getRowCount();
  const { pageIndex, pageSize } = state.pagination;

  return (
    <div className="my-4 flex items-center justify-end gap-2">
      <PageLimitSelect
        value={[pageSize.toString()]}
        onValueChange={(details) => {
          table.setPageSize(Number(details.value));
        }}
      />
      <div className="flex items-center gap-1">
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="border-border hover:bg-muted text-foreground rounded border px-2 py-1 disabled:opacity-50"
        >
          Prev
        </button>
        <span className="text-foreground text-sm">
          Page {pageIndex + 1} of {Math.ceil(rowCount / pageSize)}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="border-border hover:bg-muted text-foreground rounded border px-2 py-1 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function CellHeaderContent<TData extends RowData>(props: {
  table: TanstackTable<TData>;
  headerCell: Header<TData, any>;
  onColumnFilterClick?: (columnId: string, columnName: string) => void;
  getColumnHeaderFilter?: DataTableProps<TData>["getColumnHeaderFilter"];
  onColumnHeaderFilterChange?: DataTableProps<TData>["onColumnHeaderFilterChange"];
  hideColumnPinIconUnlessHovered?: boolean;
}) {
  const {
    table,
    headerCell,
    onColumnFilterClick,
    getColumnHeaderFilter,
    onColumnHeaderFilterChange,
    hideColumnPinIconUnlessHovered,
  } = props;
  const column = headerCell.column;
  const isSorted = column.getIsSorted();
  const isUtilityColumn =
    column.id === "select" ||
    column.id === "actions" ||
    column.id === "__select" ||
    column.id === "__expand" ||
    column.id === "__actions";
  const showHeaderFilter = Boolean(onColumnHeaderFilterChange) && !isUtilityColumn;
  const activeHeaderFilter = getColumnHeaderFilter?.(column.id);

  return (
    <div className={"flex min-w-0 items-center justify-between gap-0.5"}>
      <ColumnHeaderContextMenu column={column} table={table} onFilterClick={onColumnFilterClick}>
        <HStack className="min-w-0 flex-1 truncate" align="center" w="full">
          {headerCell.isPlaceholder ? null : column.getCanSort() &&
            column.columnDef.enableSorting ? (
            <Button
              onClick={column.getToggleSortingHandler()}
              variant="ghost"
              size="sm"
              data-test-id={`table-sort-${column.id}`}
              className="h-5 gap-1 px-1"
            >
              {flexRender(headerCell.column.columnDef.header, headerCell.getContext())}
              {isSorted === "desc" ? (
                <ArrowDownNarrowWide className="h-3 w-3 shrink-0" />
              ) : isSorted === "asc" ? (
                <ArrowUpNarrowWide className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
              )}
            </Button>
          ) : (
            flexRender(headerCell.column.columnDef.header, headerCell.getContext())
          )}
        </HStack>
      </ColumnHeaderContextMenu>
      {showHeaderFilter ? (
        <ColumnHeaderFilter
          columnId={column.id}
          active={activeHeaderFilter}
          onApply={(filter) => onColumnHeaderFilterChange?.(column.id, filter)}
        />
      ) : null}
      {column.getCanPin() ? (
        column.getIsPinned() ? (
          <Button
            variant={hideColumnPinIconUnlessHovered ? "outline" : "ghost"}
            size="xs"
            withIcon={false}
            onClick={() => column.pin(false)}
            aria-label={`Unpin column ${String(column.id)}`}
            className={
              hideColumnPinIconUnlessHovered
                ? "absolute right-3 opacity-0 transition-opacity group-hover:opacity-100"
                : "mr-2"
            }
          >
            <PinOff className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            variant={hideColumnPinIconUnlessHovered ? "outline" : "ghost"}
            size="xs"
            withIcon={false}
            onClick={() => column.pin("start")}
            aria-label={`Pin column ${String(column.id)} to the left`}
            className={
              hideColumnPinIconUnlessHovered
                ? "absolute right-3 opacity-0 transition-opacity group-hover:opacity-100"
                : "mr-2"
            }
          >
            <Pin className="h-3 w-3" />
          </Button>
        )
      ) : null}
    </div>
  );
}

function HeaderCell<TData extends RowData>(props: {
  table: TanstackTable<TData>;
  headerGroup: HeaderGroup<TData>;
  headerCell: Header<TData, any>;
  colSpanOverride?: number;
  sizeOverridePx?: number;
  enableColumnOrdering?: boolean;
  size?: DataTableSize;
  showColumnBorder?: boolean;
  hideColumnPinIconUnlessHovered?: boolean;
  onColumnFilterClick?: (columnId: string, columnName: string) => void;
  getColumnHeaderFilter?: DataTableProps<TData>["getColumnHeaderFilter"];
  onColumnHeaderFilterChange?: DataTableProps<TData>["onColumnHeaderFilterChange"];
  resizable?: boolean;
}) {
  const { table, headerGroup, headerCell } = props;

  const selectedRowsCount = table.getSelectedRowModel().rows.length;
  const hasSelectedRows = selectedRowsCount > 0;
  const hasBulkActions = hasSelectedRows && headerGroup.headers.at(-1) === headerCell;
  const column = headerCell.column;

  const meta = headerCell.column.columnDef.meta as Record<string, unknown> | undefined;
  const textAlign = (meta?.textAlign as "left" | "right" | "center" | undefined) || "left";
  const className = (meta?.className as boolean) ?? false;
  const isDragDisabled =
    props.enableColumnOrdering === false ||
    meta?.enableColumnOrdering === false ||
    Boolean(column.getIsPinned()) ||
    headerCell.subHeaders.length;

  if (!isDragDisabled) {
    return (
      <DraggableColumnHeader key={headerCell.id} column={column}>
        {(dragCtx) => {
          return (
            <th
              key={headerCell.id}
              colSpan={props.colSpanOverride ?? headerCell.colSpan}
              data-column-id={headerCell.column.id}
              data-draggable
              ref={dragCtx.setNodeRef}
              style={{
                ...dragCtx.style,
                width:
                  headerCell.subHeaders.length === 0
                    ? `${props.sizeOverridePx ?? headerCell.getSize()}px`
                    : "auto",
                zIndex: headerCell.index + (dragCtx.isDragging ? 2 : 1),
                position: "sticky",
              }}
              className={cn(
                tableHeaderCellStyles({
                  size: props.size,
                  showColumnBorder: props.showColumnBorder,
                  textAlign: hasBulkActions ? "right" : textAlign,
                }),
                "bg-background sticky z-1",
                headerCell.subHeaders.length !== 0 && "left-[50px]",
                className,
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2 truncate",
                  props.hideColumnPinIconUnlessHovered && "group",
                )}
              >
                {!dragCtx.isDragDisabled && (
                  <button
                    {...dragCtx.attributes}
                    {...dragCtx.listeners}
                    type="button"
                    className="hover:bg-muted shrink-0 cursor-grab rounded p-1 active:cursor-grabbing"
                    title="Drag to reorder columns"
                  >
                    <GripVertical className="text-muted-foreground size-4" />
                  </button>
                )}
                <CellHeaderContent
                  table={table}
                  headerCell={headerCell}
                  onColumnFilterClick={props.onColumnFilterClick}
                  getColumnHeaderFilter={props.getColumnHeaderFilter}
                  onColumnHeaderFilterChange={props.onColumnHeaderFilterChange}
                  hideColumnPinIconUnlessHovered={props.hideColumnPinIconUnlessHovered}
                />
              </div>
              {props.resizable && headerCell.column.columnDef.enableResizing !== false && (
                <ResizeHandle
                  onDoubleClick={() => headerCell.column.resetSize()}
                  onMouseDown={headerCell.getResizeHandler()}
                  onTouchStart={headerCell.getResizeHandler()}
                  isResizing={headerCell.column.getIsResizing()}
                  columnResizeDirection={table.options.columnResizeDirection}
                />
              )}
            </th>
          );
        }}
      </DraggableColumnHeader>
    );
  }

  const headerSize = headerCell.column.getSize();
  return (
    <th
      key={headerCell.id}
      colSpan={props.colSpanOverride ?? headerCell.colSpan}
      data-column-id={headerCell.column.id}
      data-column-pinned={headerCell.column.getIsPinned()}
      style={{
        ...getColumnPinningStyles(column),
        width:
          props.sizeOverridePx != null
            ? `${props.sizeOverridePx}px`
            : headerCell.isPlaceholder
              ? `${(headerSize / table.getTotalSize()) * 100}%`
              : `${headerCell.getSize()}px`,
      }}
      className={cn(
        tableHeaderCellStyles({
          size: props.size,
          showColumnBorder: props.showColumnBorder,
          textAlign: hasBulkActions ? "right" : textAlign,
        }),
        className,
        "relative",
        headerCell.subHeaders.length && "py-1.5 pl-10",
        props.hideColumnPinIconUnlessHovered && "group",
      )}
    >
      <CellHeaderContent
        table={table}
        headerCell={headerCell}
        onColumnFilterClick={props.onColumnFilterClick}
        getColumnHeaderFilter={props.getColumnHeaderFilter}
        onColumnHeaderFilterChange={props.onColumnHeaderFilterChange}
        hideColumnPinIconUnlessHovered={props.hideColumnPinIconUnlessHovered}
      />
      {props.resizable && headerCell.column.columnDef.enableResizing !== false && (
        <ResizeHandle
          onDoubleClick={() => headerCell.column.resetSize()}
          onMouseDown={headerCell.getResizeHandler()}
          onTouchStart={headerCell.getResizeHandler()}
          isResizing={headerCell.column.getIsResizing()}
          columnResizeDirection={table.options.columnResizeDirection}
        />
      )}
    </th>
  );
}
