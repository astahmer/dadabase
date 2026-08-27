import type { ClipboardEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

import { useCallback, useMemo } from "react";

import type { Row, RowData, Table as TanstackTable } from "#src/lib/tanstack-table.ts";

import { copyToClipboard, exportRows } from "../../lib/data-export/index.ts";
import { matrixToDelimitedText, parseCellClipboard, stringifyCellValue } from "./cell-selection.ts";

const isInteractiveTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.closest("button, a, input, textarea, select, [contenteditable='true']") != null;

export type CellSelectionEdges = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

export type CellSelectionCellState = {
  isSelected: boolean;
  isFocused: boolean;
  tabIndex: number;
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

type TanstackCell<TData extends RowData> = ReturnType<Row<TData>["getAllCells"]>[number];

export function useDataTableCellSelection<TData extends RowData>(
  table: TanstackTable<TData>,
  enabled: boolean,
  options: DataTableCellSelectionOptions<TData> = {},
) {
  const rows = table.getRowModel().rows;
  const selectableColumns = useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .filter((column) => column.columnDef.enableCellSelection !== false),
    [table, table.state.columnVisibility, table.state.columnOrder],
  );

  const cellsByPosition = useMemo(() => {
    const cells = new Map<string, TanstackCell<TData>>();
    for (const row of rows) {
      for (const cell of row.getAllCells()) {
        cells.set(`${row.id}::${cell.column.id}`, cell);
      }
    }
    return cells;
  }, [rows]);

  const selectedCellIds = useMemo(() => {
    const selected = new Set<string>();
    for (const row of rows) {
      for (const column of selectableColumns) {
        const cell = cellsByPosition.get(`${row.id}::${column.id}`);
        if (cell?.getIsSelected()) selected.add(`${row.id}::${column.id}`);
      }
    }
    return selected;
  }, [cellsByPosition, rows, selectableColumns, table.state.cellSelection]);

  const selectionSnapshot = useMemo<DataTableSelectionSnapshot<TData>>(() => {
    const selectedColumns = selectableColumns.filter((column) =>
      rows.some((row) => selectedCellIds.has(`${row.id}::${column.id}`)),
    );
    const selectedRows = rows.filter((row) =>
      selectedColumns.some((column) => selectedCellIds.has(`${row.id}::${column.id}`)),
    );
    const matrix = selectedRows.map((row) =>
      selectedColumns.map((column) =>
        selectedCellIds.has(`${row.id}::${column.id}`) ? row.getValue(column.id) : "",
      ),
    );
    const selectedCells = selectedRows.flatMap((row) =>
      selectedColumns.flatMap((column) => {
        if (!selectedCellIds.has(`${row.id}::${column.id}`)) return [];
        return [{ row, columnId: column.id, value: row.getValue(column.id) }];
      }),
    );
    const rowValues = selectedRows.map((row, rowIndex) => ({
      row,
      values: Object.fromEntries(
        selectedColumns.map((column, columnIndex) => [column.id, matrix[rowIndex]?.[columnIndex]]),
      ),
    }));
    const focusedCell = table.getFocusedCell();

    return {
      columns: selectedColumns.map((column) => column.id),
      matrix,
      rows: rowValues,
      cells: selectedCells,
      focusedCell: focusedCell
        ? {
            row: focusedCell.row,
            columnId: focusedCell.column.id,
            value: focusedCell.getValue(),
          }
        : null,
    };
  }, [rows, selectableColumns, selectedCellIds, table, table.state.cellSelection]);

  const getCellState = useCallback(
    (rowId: string, columnId: string): CellSelectionCellState | undefined => {
      if (!enabled) return undefined;
      const cell = cellsByPosition.get(`${rowId}::${columnId}`);
      if (!cell || !cell.getCanSelect()) return undefined;

      return {
        isSelected: cell.getIsSelected(),
        isFocused: cell.getIsFocused(),
        tabIndex: cell.getTabIndex(),
        edges: cell.getSelectionEdges(),
        onMouseDown: (event) => {
          if (isInteractiveTarget(event.target)) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.closest<HTMLElement>("[data-cell-selection-grid]")?.focus();
          cell.getSelectionStartHandler()(event);
        },
        onMouseEnter: () => {
          cell.getSelectionExtendHandler()(undefined);
        },
        onClick: (event) => {
          if (!isInteractiveTarget(event.target)) event.stopPropagation();
        },
      };
    },
    [cellsByPosition, enabled],
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
    [options, selectionSnapshot],
  );

  const onGridPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (!options.onPasteSelection || isInteractiveTarget(event.target)) return;
      const focusedCell = table.getFocusedCell();
      if (!focusedCell) return;
      const matrix = parseCellClipboard(event.clipboardData.getData("text/plain"));
      if (matrix.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      void options.onPasteSelection({
        rowId: focusedCell.row.id,
        columnId: focusedCell.column.id,
        matrix,
        selection: selectionSnapshot,
      });
    },
    [options, selectionSnapshot, table],
  );

  const onGridKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isInteractiveTarget(event.target)) return;
      const direction =
        event.key === "ArrowUp"
          ? "up"
          : event.key === "ArrowDown"
            ? "down"
            : event.key === "ArrowLeft"
              ? "left"
              : event.key === "ArrowRight"
                ? "right"
                : null;

      if (direction) {
        event.preventDefault();
        if (event.shiftKey) table.extendCellSelection(direction);
        else table.moveCellSelection(direction);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        table.selectAllCells();
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
      if (event.key === "Escape" && selectedCellIds.size > 0) {
        event.preventDefault();
        table.resetCellSelection(true);
      }
    },
    [copySelection, options, selectedCellIds.size, selectionSnapshot, table],
  );

  return {
    enabled,
    selectedCellCount: table.getSelectedCellCount(),
    selectionSnapshot,
    getCellState,
    onGridKeyDown,
    onGridPaste,
    copySelection,
    exportSelection,
    clearSelection: () => table.resetCellSelection(true),
  };
}
