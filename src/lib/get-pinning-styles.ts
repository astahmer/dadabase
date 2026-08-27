import type { CSSProperties } from "react";

import type { Column, RowData } from "#src/lib/tanstack-table.ts";

export function getPinningStyles(input: {
  isPinned: "start" | "end" | false;
  isLastLeftPinnedColumn: boolean;
  isFirstRightPinnedColumn: boolean;
  columnStartLeft: number;
  columnAfterRight: number;
  columnSize: number;
}): CSSProperties {
  const { isPinned, isLastLeftPinnedColumn, isFirstRightPinnedColumn } = input;

  return {
    backgroundColor: isPinned ? "var(--color-background)" : undefined,
    boxShadow: isLastLeftPinnedColumn
      ? "-4px 0 4px -4px gray inset"
      : isFirstRightPinnedColumn
        ? "4px 0 4px -4px gray inset"
        : undefined,
    left: isPinned === "start" ? `${input.columnStartLeft}px` : undefined,
    right: isPinned === "end" ? `${input.columnAfterRight}px` : undefined,
    opacity: isPinned ? 0.95 : 1,
    position: isPinned ? "sticky" : ("relative" as const),
    width: input.columnSize,
    zIndex: isPinned ? 10 : 0,
  };
}

export function getColumnPinningStyles<TData extends RowData>(
  column: Column<TData>,
): CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn = isPinned === "start" && column.getIsLastColumn("start");
  const isFirstRightPinnedColumn = isPinned === "end" && column.getIsFirstColumn("end");

  return getPinningStyles({
    isPinned,
    isLastLeftPinnedColumn,
    isFirstRightPinnedColumn,
    columnSize: column.getSize(),
    columnStartLeft: column.getStart("start"),
    columnAfterRight: column.getAfter("end"),
  });
}
