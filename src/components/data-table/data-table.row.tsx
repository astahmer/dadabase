import type { ComponentProps, ReactNode } from "react";

import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { flexRender, type Row } from "@tanstack/react-table";
import { Fragment, memo, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { getColumnPinningStyles } from "#src/lib/get-pinning-styles.ts";

import type { ColumnVirtualizationState } from "./data-table.column-virtualization.ts";
import type { CellSelectionCellState } from "./use-data-table-cell-selection.ts";

import { RowContextMenu } from "../app/row-context-menu.tsx";
import { DataTableCell } from "./data-table.cell.tsx";
import { type DataTableSize, tableCellStyles, tableRowStyles } from "./data-table.styles.ts";
import { useIsFindMatch } from "./table-find-context.tsx";

const fallbackRender = () => "An error happened";

export interface DataTableRowSubrow {
  id: string;
  content: ReactNode;
}

export const DataTableRow = memo(function TableRow({
  index,
  getRow,
  onRowClick,
  onRowDoubleClick,
  size,
  striped,
  interactive,
  showColumnBorder,
  withRowContextMenu,
  ExpandedRow,
  onExpandRowJson,
  enableColumnOrdering,
  columnOrder = [],
  columnVirtualization,
  renderSubrows,
  cellSelection,
}: {
  index: number;
  getRow: () => Row<any>;
  onRowClick?: (row: Row<any>) => void;
  onRowDoubleClick?: (row: Row<any>) => void;
  size: DataTableSize;
  striped: boolean;
  interactive: boolean;
  showColumnBorder: boolean;
  withRowContextMenu?: boolean;
  enableColumnOrdering: boolean;
  columnOrder?: string[];
  columnVirtualization: ColumnVirtualizationState;
  ExpandedRow?: (props: { row: Row<any> }) => ReactNode;
  onExpandRowJson?: (row: Record<string, unknown>) => void;
  renderSubrows?: (row: Row<any>) => DataTableRowSubrow[];
  cellSelection?: (rowId: string, columnId: string) => CellSelectionCellState | undefined;
}) {
  const row = getRow();
  const visibleCells = row.getVisibleCells();
  const isSelected = row.getIsSelected();
  const isExpanded = row.getIsExpanded();

  const CellsList = useMemo(() => {
    const renderCell = (cell: (typeof visibleCells)[number], cellIndex: number) => {
      const isPinned = Boolean(cell.column.getIsPinned());
      const isDragDisabled =
        (cell.column.columnDef.meta as any)?.enableColumnOrdering === false || isPinned;
      const textAlign = (cell.column.columnDef.meta as any)?.textAlign || "left";
      const className = (cell.column.columnDef.meta as any)?.className;
      const selection = cellSelection?.(row.id, cell.column.id);

      return (
        <DataTableCellWithFind
          key={cell.id}
          rowId={row.id}
          columnId={cell.column.id}
          columnSize={cell.column.getSize()}
          isDragDisabled={isDragDisabled}
          textAlign={textAlign}
          index={cellIndex}
          isExpanded={isExpanded}
          size={size}
          showColumnBorder={showColumnBorder}
          enableColumnOrdering={enableColumnOrdering}
          className={className}
          isCellSelected={selection?.isSelected}
          isCellFocused={selection?.isFocused}
          cellSelectionEdges={selection?.edges}
          onCellMouseDown={selection?.onMouseDown}
          onCellMouseEnter={selection?.onMouseEnter}
          onCellClick={selection?.onClick}
          style={isPinned ? getColumnPinningStyles(cell.column) : undefined}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </DataTableCellWithFind>
      );
    };

    const leftPinnedCells = visibleCells.filter((c) => c.column.getIsPinned() === "left");
    const rightPinnedCells = visibleCells.filter((c) => c.column.getIsPinned() === "right");
    const centerCells = visibleCells.filter((c) => !c.column.getIsPinned());

    const centerCellByColumnId = new Map(centerCells.map((c) => [c.column.id, c]));

    const renderedCenterColumnIds =
      columnVirtualization.enabled === true
        ? columnVirtualization.virtualCenterColumnIds
        : centerCells.map((c) => c.column.id);

    let cellIndex = 0;
    const out: ReactNode[] = [];

    for (const cell of leftPinnedCells) {
      out.push(renderCell(cell, cellIndex++));
    }

    if (
      columnVirtualization.enabled === true &&
      columnVirtualization.centerPaddingLeftColSpan > 0
    ) {
      out.push(
        <td
          key={`center-padding-left-${row.id}`}
          aria-hidden
          colSpan={columnVirtualization.centerPaddingLeftColSpan}
          className="p-0"
          style={{ width: columnVirtualization.centerPaddingLeftPx }}
        />,
      );
    }

    for (const columnId of renderedCenterColumnIds) {
      const cell = centerCellByColumnId.get(columnId);
      if (!cell) continue;
      out.push(renderCell(cell, cellIndex++));
    }

    if (
      columnVirtualization.enabled === true &&
      columnVirtualization.centerPaddingRightColSpan > 0
    ) {
      out.push(
        <td
          key={`center-padding-right-${row.id}`}
          aria-hidden
          colSpan={columnVirtualization.centerPaddingRightColSpan}
          className="p-0"
          style={{ width: columnVirtualization.centerPaddingRightPx }}
        />,
      );
    }

    for (const cell of rightPinnedCells) {
      out.push(renderCell(cell, cellIndex++));
    }

    return out;
  }, [
    visibleCells,
    isExpanded,
    size,
    showColumnBorder,
    enableColumnOrdering,
    columnVirtualization,
    row.id,
    cellSelection,
  ]);

  const MainRow = (
    <tr
      className={tableRowStyles({
        striped,
        selected: isSelected,
        interactive: interactive && !!onRowClick,
      })}
      data-testid={`row-${index}`}
      data-state={isSelected && "selected"}
      onClick={
        onRowClick
          ? (e) => {
              if (isDescendantOfButton(e, ["BUTTON", "A"])) return;
              e.stopPropagation();
              return onRowClick(row);
            }
          : undefined
      }
      onDoubleClick={
        onRowDoubleClick
          ? (e) => {
              if (isDescendantOfButton(e, ["BUTTON", "A"])) return;
              e.stopPropagation();
              return onRowDoubleClick(row);
            }
          : undefined
      }
    >
      {enableColumnOrdering ? (
        // the sortable context needs to be ABOVE the useSortable usage (inside the DataTableCell)
        <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
          {CellsList}
        </SortableContext>
      ) : (
        CellsList
      )}
    </tr>
  );

  return (
    <Fragment>
      {withRowContextMenu ? (
        <RowContextMenu
          row={row.original as Record<string, unknown>}
          onExpandRowJson={onExpandRowJson}
        >
          {MainRow}
        </RowContextMenu>
      ) : (
        MainRow
      )}
      {isExpanded && ExpandedRow && (
        <tr
          className={`border-b ${isSelected ? "bg-blue-50" : ""}`}
          data-testid={`row-${index}-subrow`}
          data-state={isSelected && "selected"}
        >
          <td className={tableCellStyles({ size, showColumnBorder })} colSpan={visibleCells.length}>
            <ErrorBoundary fallbackRender={fallbackRender}>
              <ExpandedRow row={row} />
            </ErrorBoundary>
          </td>
        </tr>
      )}
      {/* Custom subrows */}
      {renderSubrows &&
        renderSubrows(row).map((subrow) => (
          <tr
            key={subrow.id}
            className="bg-muted/20 border-border border-b"
            data-testid={`row-${index}-subrow-${subrow.id}`}
          >
            <td colSpan={visibleCells.length} className="p-0">
              <ErrorBoundary fallbackRender={fallbackRender}>{subrow.content}</ErrorBoundary>
            </td>
          </tr>
        ))}
    </Fragment>
  );
});

type TagName = "BUTTON" | "A";

function DataTableCellWithFind(props: ComponentProps<typeof DataTableCell> & { rowId: string }) {
  const { rowId, ...cellProps } = props;
  const isFindMatch = useIsFindMatch(rowId, cellProps.columnId);
  return <DataTableCell {...cellProps} isFindMatch={isFindMatch} />;
}

function isDescendantOfButton(e: React.MouseEvent<HTMLElement>, tags: TagName[]) {
  let element = e.target as HTMLElement | null;

  while (element && element !== e.currentTarget) {
    if (tags.includes(element.tagName as TagName)) {
      return true;
    }

    element = element.parentElement;
  }

  return false;
}
