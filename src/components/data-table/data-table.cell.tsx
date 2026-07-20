import type { CSSProperties, PropsWithChildren } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { cn } from "#src/lib/utils.ts";

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
  } = props;

  const cellClassName = cn(
    tableCellStyles({ size, showColumnBorder, textAlign }),
    isFindMatch && "bg-yellow-200/70 dark:bg-yellow-500/30",
    className,
  );

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
        style={{
          width: `${props.columnSize}px`,
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
      style={{
        width: `${props.columnSize}px`,
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
