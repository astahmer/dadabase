import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Row, RowData, Table as TanstackTable } from "#src/lib/tanstack-table.ts";

import { copyToClipboard, exportRows } from "../../lib/data-export/index.ts";
import { matrixToDelimitedText, parseCellClipboard, stringifyCellValue } from "./cell-selection.ts";

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

export type CellSelectionExportFormat = "tsv" | "csv" | "json" | "sql";

export interface SelectedDataTableCell<TData extends RowData> {
  row: Row<TData>;
  columnId: string;
  value: unknown;
}

export interface DataTableSelectionSnapshot<TData extends RowData> {
  columns: string[];
  matrix: unknown[][];
  rows: Array<{ row: Row<TData>; values: Record<string, unknown> }>;
  cells: SelectedDataTableCell<TData>[];
  focusedCell: SelectedDataTableCell<TData> | null;
}

export interface DataTableSelectionExportInput<TData extends RowData> {
  format: CellSelectionExportFormat;
  download: boolean;
  selection: DataTableSelectionSnapshot<TData>;
}

export interface DataTableCellSelectionOptions<TData extends RowData> {
  onPasteSelection?: (input: {
    rowId: string;
    columnId: string;
    matrix: string[][];
    selection: DataTableSelectionSnapshot<TData>;
  }) => void | Promise<void>;
  onBulkFillSelection?: (input: {
    value: string;
    selection: DataTableSelectionSnapshot<TData>;
  }) => void | Promise<void>;
  onSelectionExport?: (input: DataTableSelectionExportInput<TData>) => boolean | Promise<boolean>;
}

const cellId = ({ rowId, columnId }: CellPosition) => `${rowId}::${columnId}`;

const parseCellId = (id: string | null): CellPosition | null => {
  if (!id) return null;
  const separatorIndex = id.lastIndexOf("::");
  if (separatorIndex < 0) return null;
  return { rowId: id.slice(0, separatorIndex), columnId: id.slice(separatorIndex + 2) };
};

const isInteractiveTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.closest("button, a, input, textarea, select, [contenteditable='true']") != null;

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

export function useDataTableCellSelection<TData extends RowData>(
  table: TanstackTable<TData>,
  enabled: boolean,
  options: DataTableCellSelectionOptions<TData> = {},
) {
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

  const selectionSnapshot = useMemo<DataTableSelectionSnapshot<TData>>(() => {
    const selectedColumns = selectableColumns.filter((column) =>
      rows.some((row) => selectedCellIds.has(cellId({ rowId: row.id, columnId: column.id }))),
    );
    const selectedRows = rows.filter((row) =>
      selectedColumns.some((column) =>
        selectedCellIds.has(cellId({ rowId: row.id, columnId: column.id })),
      ),
    );
    const matrix = selectedRows.map((row) =>
      selectedColumns.map((column) =>
        selectedCellIds.has(cellId({ rowId: row.id, columnId: column.id }))
          ? row.getValue(column.id)
          : "",
      ),
    );
    const selectedCells = selectedRows.flatMap((row) =>
      selectedColumns.flatMap((column) => {
        if (!selectedCellIds.has(cellId({ rowId: row.id, columnId: column.id }))) return [];
        return [{ row, columnId: column.id, value: row.getValue(column.id) }];
      }),
    );
    const rowValues = selectedRows.map((row, rowIndex) => ({
      row,
      values: Object.fromEntries(
        selectedColumns.map((column, columnIndex) => [column.id, matrix[rowIndex]?.[columnIndex]]),
      ),
    }));
    const focusedPosition = parseCellId(selection.focusedCellId);
    const focusedRow = focusedPosition
      ? rows.find((row) => row.id === focusedPosition.rowId)
      : undefined;
    const focusedColumn = focusedPosition
      ? selectableColumns.find((column) => column.id === focusedPosition.columnId)
      : undefined;
    const focusedCell =
      focusedRow && focusedColumn
        ? {
            row: focusedRow,
            columnId: focusedColumn.id,
            value: focusedRow.getValue(focusedColumn.id),
          }
        : null;
    return {
      columns: selectedColumns.map((column) => column.id),
      matrix,
      rows: rowValues,
      cells: selectedCells,
      focusedCell,
    };
  }, [rows, selectableColumns, selectedCellIds, selection.focusedCellId]);

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

  const serializeSelection = useCallback(
    (format: CellSelectionExportFormat) => {
      if (format === "tsv") return matrixToDelimitedText(selectionSnapshot.matrix, "\t");
      if (format === "csv") return matrixToDelimitedText(selectionSnapshot.matrix, ",");
      if (format === "json") {
        return JSON.stringify(
          selectionSnapshot.rows.map(({ values }) => values),
          null,
          2,
        );
      }
      return selectionSnapshot.rows
        .map(({ values }) =>
          selectionSnapshot.columns
            .map((column) => `${column}=${stringifyCellValue(values[column])}`)
            .join("\t"),
        )
        .join("\n");
    },
    [selectionSnapshot],
  );

  const copySelection = useCallback(
    async (format: CellSelectionExportFormat = "tsv") => {
      if (selectionSnapshot.cells.length === 0) return false;
      if (options.onSelectionExport) {
        return (
          (await options.onSelectionExport({
            format,
            download: false,
            selection: selectionSnapshot,
          })) ?? true
        );
      }
      return copyToClipboard(serializeSelection(format));
    },
    [options, selectionSnapshot, serializeSelection],
  );

  const exportSelection = useCallback(
    async (format: CellSelectionExportFormat) => {
      if (selectionSnapshot.cells.length === 0) return false;
      if (options.onSelectionExport) {
        return (
          (await options.onSelectionExport({
            format,
            download: true,
            selection: selectionSnapshot,
          })) ?? true
        );
      }
      exportRows(
        selectionSnapshot.rows.map(({ values }) => values),
        selectionSnapshot.columns,
        { format, filename: `selection.${format}` },
      );
      return true;
    },
    [options, selectionSnapshot, serializeSelection],
  );

  const onGridPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!options.onPasteSelection || isInteractiveTarget(event.target)) return;
      const focusedPosition = parseCellId(selection.focusedCellId);
      if (!focusedPosition) return;
      const matrix = parseCellClipboard(event.clipboardData.getData("text/plain"));
      if (matrix.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      void options.onPasteSelection({
        rowId: focusedPosition.rowId,
        columnId: focusedPosition.columnId,
        matrix,
        selection: selectionSnapshot,
      });
    },
    [options, selection.focusedCellId, selectionSnapshot],
  );

  const onGridKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isInteractiveTarget(event.target)) return;
      const focusedPosition = parseCellId(selection.focusedCellId);
      const focusedRowId = focusedPosition?.rowId;
      const focusedColumnId = focusedPosition?.columnId;
      const focusedRowIndex = focusedRowId ? rowIndexes.get(focusedRowId) : undefined;
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

      const isPrintableFill =
        event.key === "Enter" ||
        (Array.from(event.key).length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.nativeEvent.isComposing);
      if (isPrintableFill && selectedCellIds.size > 1 && options.onBulkFillSelection) {
        event.preventDefault();
        void options.onBulkFillSelection({
          value: event.key === "Enter" ? "" : event.key,
          selection: selectionSnapshot,
        });
        return;
      }
      if (event.key === "Escape" && selection.ranges.length > 0) {
        event.preventDefault();
        setSelection({ ranges: [], focusedCellId: null });
      }
    },
    [
      columnIndexes,
      copySelection,
      options,
      rowIndexes,
      rows,
      selectedCellIds.size,
      selectableColumns,
      selection.focusedCellId,
      selection.ranges.length,
      selectionSnapshot,
    ],
  );

  return {
    enabled,
    selectedCellCount: selectedCellIds.size,
    selectionSnapshot,
    getCellState,
    onGridKeyDown,
    onGridPaste,
    copySelection,
    exportSelection,
    clearSelection: () => setSelection({ ranges: [], focusedCellId: null }),
  };
}
