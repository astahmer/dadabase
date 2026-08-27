import type { Table as TanstackTable } from "@tanstack/react-table";
import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { copyToClipboard } from "../../lib/data-export/index.ts";

type CellPosition = {
  rowId: string;
  columnId: string;
};

type CellSelectionRange = CellPosition & {
  focusRowId: string;
  focusColumnId: string;
  mode: "include" | "exclude";
};

type CellSelectionState = {
  ranges: CellSelectionRange[];
  focusedCellId: string | null;
};

export type CellSelectionEdges = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

export type CellSelectionCellState = {
  isSelected: boolean;
  isFocused: boolean;
  edges: CellSelectionEdges;
  onMouseDown: (event: ReactMouseEvent<HTMLTableCellElement>) => void;
  onMouseEnter: () => void;
  onClick: (event: ReactMouseEvent<HTMLTableCellElement>) => void;
};

const cellId = ({ rowId, columnId }: CellPosition) => `${rowId}::${columnId}`;

const isInteractiveTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.closest("button, a, input, textarea, select, [contenteditable='true']") != null;

const stringifyCell = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return "";
};

const escapeTsvValue = (value: unknown): string => {
  const text = stringifyCell(value);
  const safeText = /^[\t\r ]*[=+@-]/.test(text) ? `'${text}` : text;
  return /["\t\n\r]/.test(safeText) ? `"${safeText.replaceAll('"', '""')}"` : safeText;
};

const isWithinRange = (
  range: CellSelectionRange,
  rowIndex: number,
  columnIndex: number,
  rowIndexes: ReadonlyMap<string, number>,
  columnIndexes: ReadonlyMap<string, number>,
) => {
  const anchorRowIndex = rowIndexes.get(range.rowId);
  const focusRowIndex = rowIndexes.get(range.focusRowId);
  const anchorColumnIndex = columnIndexes.get(range.columnId);
  const focusColumnIndex = columnIndexes.get(range.focusColumnId);
  if (
    anchorRowIndex == null ||
    focusRowIndex == null ||
    anchorColumnIndex == null ||
    focusColumnIndex == null
  )
    return false;

  return (
    rowIndex >= Math.min(anchorRowIndex, focusRowIndex) &&
    rowIndex <= Math.max(anchorRowIndex, focusRowIndex) &&
    columnIndex >= Math.min(anchorColumnIndex, focusColumnIndex) &&
    columnIndex <= Math.max(anchorColumnIndex, focusColumnIndex)
  );
};

export function useDataTableCellSelection<TData>(table: TanstackTable<TData>, enabled: boolean) {
  const [selection, setSelection] = useState<CellSelectionState>({
    ranges: [],
    focusedCellId: null,
  });
  const selectingRangeIndex = useRef<number | null>(null);

  const rows = table.getRowModel().rows;
  const selectableColumns = useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .filter(
          (column) =>
            (column.columnDef.meta as { enableCellSelection?: boolean } | undefined)
              ?.enableCellSelection !== false,
        ),
    [table, table.getState().columnVisibility, table.getState().columnOrder],
  );
  const rowIndexes = useMemo(
    () => new Map(rows.map((row, index) => [row.id, index] as const)),
    [rows],
  );
  const columnIndexes = useMemo(
    () => new Map(selectableColumns.map((column, index) => [column.id, index] as const)),
    [selectableColumns],
  );

  const selectedCellIds = useMemo(() => {
    const selected = new Set<string>();
    for (const row of rows) {
      const rowIndex = rowIndexes.get(row.id);
      if (rowIndex == null) continue;
      for (const column of selectableColumns) {
        const columnIndex = columnIndexes.get(column.id);
        if (columnIndex == null) continue;
        const selectedByOperation = selection.ranges.reduce((isSelected, range) => {
          if (!isWithinRange(range, rowIndex, columnIndex, rowIndexes, columnIndexes))
            return isSelected;
          return range.mode === "exclude" ? false : true;
        }, false);
        if (selectedByOperation) selected.add(cellId({ rowId: row.id, columnId: column.id }));
      }
    }
    return selected;
  }, [columnIndexes, rowIndexes, rows, selectableColumns, selection.ranges]);

  const stopSelecting = useCallback(() => {
    selectingRangeIndex.current = null;
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", stopSelecting);
    return () => document.removeEventListener("mouseup", stopSelecting);
  }, [stopSelecting]);

  const getCellState = useCallback(
    (rowId: string, columnId: string): CellSelectionCellState | undefined => {
      if (!enabled || !columnIndexes.has(columnId)) return undefined;

      const rowIndex = rowIndexes.get(rowId);
      const columnIndex = columnIndexes.get(columnId);
      if (rowIndex == null || columnIndex == null) return undefined;

      const id = cellId({ rowId, columnId });
      const isSelected = selectedCellIds.has(id);
      const isFocused = selection.focusedCellId === id;
      const isSelectedAt = (row: number, column: number) => {
        const targetRow = rows[row];
        const targetColumn = selectableColumns[column];
        return targetRow != null && targetColumn != null
          ? selectedCellIds.has(cellId({ rowId: targetRow.id, columnId: targetColumn.id }))
          : false;
      };

      return {
        isSelected,
        isFocused,
        edges: {
          top: isSelected && !isSelectedAt(rowIndex - 1, columnIndex),
          right: isSelected && !isSelectedAt(rowIndex, columnIndex + 1),
          bottom: isSelected && !isSelectedAt(rowIndex + 1, columnIndex),
          left: isSelected && !isSelectedAt(rowIndex, columnIndex - 1),
        },
        onMouseDown: (event) => {
          if (isInteractiveTarget(event.target)) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.closest<HTMLElement>("[data-cell-selection-grid]")?.focus();

          const isModifierSelection = event.metaKey || event.ctrlKey;
          if (event.shiftKey && selection.ranges.length > 0) {
            stopSelecting();
            setSelection((current) => {
              const activeRange = current.ranges.at(-1);
              if (!activeRange) return current;
              return {
                ranges: [
                  ...current.ranges.slice(0, -1),
                  { ...activeRange, focusRowId: rowId, focusColumnId: columnId },
                ],
                focusedCellId: id,
              };
            });
            return;
          }

          const nextRange: CellSelectionRange = {
            rowId,
            columnId,
            focusRowId: rowId,
            focusColumnId: columnId,
            mode: isModifierSelection && isSelected ? "exclude" : "include",
          };
          setSelection((current) => ({
            ranges: isModifierSelection ? [...current.ranges, nextRange] : [nextRange],
            focusedCellId: id,
          }));
          selectingRangeIndex.current = isModifierSelection ? selection.ranges.length : 0;
        },
        onMouseEnter: () => {
          const activeIndex = selectingRangeIndex.current;
          if (activeIndex == null) return;
          setSelection((current) => {
            const activeRange = current.ranges[activeIndex];
            if (!activeRange) return current;
            if (activeRange.focusRowId === rowId && activeRange.focusColumnId === columnId) {
              return current;
            }
            const ranges = current.ranges.slice();
            ranges[activeIndex] = { ...activeRange, focusRowId: rowId, focusColumnId: columnId };
            return { ranges, focusedCellId: id };
          });
        },
        onClick: (event) => {
          if (!isInteractiveTarget(event.target)) event.stopPropagation();
        },
      };
    },
    [
      columnIndexes,
      enabled,
      rowIndexes,
      rows,
      selectableColumns,
      selectedCellIds,
      selection.focusedCellId,
      selection.ranges,
    ],
  );

  const selectionToTsv = useCallback(() => {
    const cellById = new Map(
      rows.flatMap((row) =>
        row
          .getVisibleCells()
          .map((cell) => [cellId({ rowId: row.id, columnId: cell.column.id }), cell] as const),
      ),
    );

    return selection.ranges
      .filter((range) => range.mode === "include")
      .map((range) => {
        const anchorRowIndex = rowIndexes.get(range.rowId);
        const focusRowIndex = rowIndexes.get(range.focusRowId);
        const anchorColumnIndex = columnIndexes.get(range.columnId);
        const focusColumnIndex = columnIndexes.get(range.focusColumnId);
        if (
          anchorRowIndex == null ||
          focusRowIndex == null ||
          anchorColumnIndex == null ||
          focusColumnIndex == null
        )
          return "";

        const rowsInRange = rows.slice(
          Math.min(anchorRowIndex, focusRowIndex),
          Math.max(anchorRowIndex, focusRowIndex) + 1,
        );
        const columnsInRange = selectableColumns.slice(
          Math.min(anchorColumnIndex, focusColumnIndex),
          Math.max(anchorColumnIndex, focusColumnIndex) + 1,
        );
        return rowsInRange
          .map((row) =>
            columnsInRange
              .map((column) => {
                const cell = cellById.get(cellId({ rowId: row.id, columnId: column.id }));
                return selectedCellIds.has(cellId({ rowId: row.id, columnId: column.id }))
                  ? escapeTsvValue(cell?.getValue())
                  : "";
              })
              .join("\t"),
          )
          .join("\n");
      })
      .filter(Boolean)
      .join("\n\n");
  }, [columnIndexes, rowIndexes, rows, selectableColumns, selectedCellIds, selection.ranges]);

  const copySelection = useCallback(async () => {
    const text = selectionToTsv();
    return text.length > 0 && (await copyToClipboard(text));
  }, [selectionToTsv]);

  const onGridKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const focused = selection.focusedCellId?.split("::") ?? [];
      const focusedRowId = focused.slice(0, -1).join("::");
      const focusedColumnId = focused.at(-1);
      const focusedRowIndex = rowIndexes.get(focusedRowId);
      const focusedColumnIndex = focusedColumnId ? columnIndexes.get(focusedColumnId) : undefined;
      const direction =
        event.key === "ArrowUp"
          ? { row: -1, column: 0 }
          : event.key === "ArrowDown"
            ? { row: 1, column: 0 }
            : event.key === "ArrowLeft"
              ? { row: 0, column: -1 }
              : event.key === "ArrowRight"
                ? { row: 0, column: 1 }
                : null;

      if (
        direction &&
        focusedRowIndex != null &&
        focusedColumnIndex != null &&
        rows.length > 0 &&
        selectableColumns.length > 0
      ) {
        const nextRow = rows[focusedRowIndex + direction.row];
        const nextColumn = selectableColumns[focusedColumnIndex + direction.column];
        if (!nextRow || !nextColumn) return;
        event.preventDefault();
        setSelection((current) => {
          const activeRange = current.ranges.at(-1);
          if (event.shiftKey && activeRange) {
            return {
              ranges: [
                ...current.ranges.slice(0, -1),
                {
                  ...activeRange,
                  focusRowId: nextRow.id,
                  focusColumnId: nextColumn.id,
                },
              ],
              focusedCellId: cellId({ rowId: nextRow.id, columnId: nextColumn.id }),
            };
          }
          return {
            ranges: [
              {
                rowId: nextRow.id,
                columnId: nextColumn.id,
                focusRowId: nextRow.id,
                focusColumnId: nextColumn.id,
                mode: "include",
              },
            ],
            focusedCellId: cellId({ rowId: nextRow.id, columnId: nextColumn.id }),
          };
        });
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        const firstRow = rows[0];
        const firstColumn = selectableColumns[0];
        const lastRow = rows.at(-1);
        const lastColumn = selectableColumns.at(-1);
        if (!firstRow || !firstColumn || !lastRow || !lastColumn) return;
        event.preventDefault();
        setSelection({
          ranges: [
            {
              rowId: firstRow.id,
              columnId: firstColumn.id,
              focusRowId: lastRow.id,
              focusColumnId: lastColumn.id,
              mode: "include",
            },
          ],
          focusedCellId: cellId({ rowId: firstRow.id, columnId: firstColumn.id }),
        });
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        if (selectedCellIds.size === 0) return;
        event.preventDefault();
        void copySelection();
      }
      if (event.key === "Escape" && selection.ranges.length > 0) {
        event.preventDefault();
        setSelection({ ranges: [], focusedCellId: null });
      }
    },
    [
      columnIndexes,
      copySelection,
      rowIndexes,
      rows,
      selectedCellIds.size,
      selectableColumns,
      selection.focusedCellId,
      selection.ranges.length,
    ],
  );

  return {
    enabled,
    selectedCellCount: selectedCellIds.size,
    getCellState,
    onGridKeyDown,
    copySelection,
    clearSelection: () => setSelection({ ranges: [], focusedCellId: null }),
  };
}
