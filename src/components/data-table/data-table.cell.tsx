import type { CSSProperties, MouseEventHandler, PropsWithChildren } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { cn } from "#src/lib/utils.ts";

import type { CellSelectionEdges } from "./use-data-table-cell-selection.ts";

import { type DataTableSize, tableCellStyles } from "./data-table.styles.ts";

const fallbackRender = () => "An error happened";

export const DataTableCell = memo(function TableCell(props: {
  children: PropsWithChildren["children"];
  columnId: string;
  columnSize: number;
  index: number;
  isExpanded: boolean;
  size: DataTableSize;
  showColumnBorder: boolean;
  enableColumnOrdering: boolean;
  isDragDisabled: boolean;
  textAlign: "left" | "right" | "center";
  className?: string;
  style?: CSSProperties;
  isFindMatch?: boolean;
  isCellSelected?: boolean;
  isCellFocused?: boolean;
  cellSelectionEdges?: CellSelectionEdges;
  onCellMouseDown?: MouseEventHandler<HTMLTableCellElement>;
  onCellMouseEnter?: MouseEventHandler<HTMLTableCellElement>;
  onCellClick?: MouseEventHandler<HTMLTableCellElement>;
}) {
  const {
    columnId,
    children,
    index,
    size,
    showColumnBorder,
    enableColumnOrdering,
    textAlign,
    isDragDisabled,
    className,
    style,
    isFindMatch,
    isCellSelected,
    isCellFocused,
    cellSelectionEdges,
    onCellMouseDown,
    onCellMouseEnter,
    onCellClick,
  } = props;

  const cellClassName = cn(
    tableCellStyles({ size, showColumnBorder, textAlign }),
    isFindMatch && "bg-yellow-200/70 dark:bg-yellow-500/30",
    isCellSelected && "bg-primary/10 dark:bg-primary/15",
    isCellFocused && "outline-primary outline-2 outline-offset-[-2px]",
    className,
  );
  const selectionShadow = isCellSelected
    ? `inset ${cellSelectionEdges?.left ? "2px" : "1px"} 0 0 var(--primary), inset ${
        cellSelectionEdges?.right ? "-2px" : "-1px"
      } 0 0 var(--primary), inset 0 ${cellSelectionEdges?.top ? "2px" : "1px"} 0 var(--primary), inset 0 ${
        cellSelectionEdges?.bottom ? "-2px" : "-1px"
      } 0 0 var(--primary)`
    : undefined;

  const sortable = useSortable({
    id: columnId,
    disabled: isDragDisabled,
  });

  if (enableColumnOrdering && !isDragDisabled) {
    const dragStyle: CSSProperties = {
      opacity: sortable.isDragging ? 0.5 : 1,
      position: "relative",
      transform: CSS.Translate.toString(sortable.transform), // translate instead of transform to avoid squishing
      transition: "width transform 0.2s ease-in-out",
      width: props.columnSize,
      zIndex: sortable.isDragging ? 1 : 0,
    };
    return (
      <td
        ref={sortable.setNodeRef}
        className={cellClassName}
        data-testid={`cell-${index}-${columnId}`}
        data-find-match={isFindMatch || undefined}
        onMouseDown={onCellMouseDown}
        onMouseEnter={onCellMouseEnter}
        onClick={onCellClick}
        style={{
          width: `${props.columnSize}px`,
          boxShadow: selectionShadow,
          ...dragStyle,
        }}
      >
        <ErrorBoundary fallbackRender={fallbackRender}>
          {children}
          {/* {flexRender(cell.column.columnDef.cell, cell.getContext())} */}
        </ErrorBoundary>
      </td>
    );
  }

  return (
    <td
      className={cellClassName}
      data-testid={`cell-${index}-${columnId}`}
      data-find-match={isFindMatch || undefined}
      onMouseDown={onCellMouseDown}
      onMouseEnter={onCellMouseEnter}
      onClick={onCellClick}
      style={{
        width: `${props.columnSize}px`,
        boxShadow: selectionShadow,
        ...style,
      }}
    >
      <ErrorBoundary fallbackRender={fallbackRender}>
        {children}
        {/* {flexRender(cell.column.columnDef.cell, cell.getContext())} */}
      </ErrorBoundary>
    </td>
  );
});
