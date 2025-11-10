import type { Cell, Row, Table as TanstackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, memo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { cn } from "../lib/utils.ts";
import {
	tableCellStyles,
	tableEmptyStateStyles,
	tableHeaderCellStyles,
	tableHeaderStyles,
	tableRowStyles,
	tableStyles,
} from "./data-table.styles.ts";
import { PageLimitSelect } from "./page-limit.select.tsx";
import { RowContextMenu } from "./row-context-menu";
import { runIfFn } from "./run-if-fn.ts";
import { Button } from "./ui/button";

const i18n = {
	emptyText: "No results found.",
	errorText: "An error occurred.",
};

export type DataTableSize =
	| "excel"
	| "minimal"
	| "compact"
	| "cozy"
	| "comfortable";
export type DataTableVariant = "line" | "outline";

export interface DataTableProps<TData> {
	className?: string;
	table: TanstackTable<TData>;
	containerRef?: React.RefObject<HTMLDivElement | null>;
	header?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
	footer?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
	top?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
	bottom?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
	emptyState?: ReactNode;
	isLoading?: boolean;
	hasError?: boolean;
	onRowClick?: (row: Row<TData>) => void;
	stickyHeader?: boolean;
	interactive?: boolean;
	striped?: boolean;
	showColumnBorder?: boolean;
	withContextMenu?: boolean;
	variant?: DataTableVariant;
	size?: DataTableSize;
	ExpandedRow?: (props: { row: Row<TData> }) => ReactNode;
	resizable?: boolean;
	onExpandRowJson?: (row: Record<string, unknown>) => void;
}

const fallbackRender = () => "An error happened";

export function DataTable<TData>(props: DataTableProps<TData>) {
	const {
		className,
		table,
		containerRef,
		header,
		top,
		bottom,
		emptyState = true,
		hasError,
		isLoading,
		onRowClick,
		stickyHeader = true,
		interactive = false,
		striped = false,
		showColumnBorder = false,
		withContextMenu = false,
		resizable = true,
		variant = "line",
		size = "cozy",
		ExpandedRow,
	} = props;

	const state = table.getState();
	const { pagination } = state;
	const columns = table.getAllColumns();
	const selectedRowsCount = table.getSelectedRowModel().rows.length;
	const hasSelectedRows = selectedRowsCount > 0;

	return (
		<>
			{runIfFn(top, table)}
			{runIfFn(header, table)}
			<div
				className={`overflow-x-auto h-full ${className || ""}`}
				ref={containerRef}
			>
				<table
					className={tableStyles({ variant })}
					// style={{ width: table.getCenterTotalSize() }}
				>
					<thead className={tableHeaderStyles({ stickyHeader, variant })}>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									const hasBulkActions =
										hasSelectedRows && headerGroup.headers.at(-1) === header;
									const column = header.column;
									const isSorted = column.getIsSorted();

									const textAlign =
										(header.column.columnDef.meta as any)?.textAlign || "left";

									return (
										<th
											key={header.id}
											colSpan={header.colSpan}
											data-column-id={header.column.id}
											style={{ width: `${header.getSize()}px` }}
											className={tableHeaderCellStyles({
												size,
												showColumnBorder,
												textAlign: hasBulkActions ? "right" : textAlign,
											})}
										>
											<div className="flex items-center justify-between overflow-hidden">
												<div className="flex-1 min-w-0">
													{header.isPlaceholder ? null : column.getCanSort() &&
														column.columnDef.enableSorting ? (
														<Button
															onClick={column.getToggleSortingHandler()}
															variant="ghost"
															size="sm"
															data-test-id={`table-sort-${column.id}`}
															className="h-5 px-1 gap-1"
														>
															{flexRender(
																header.column.columnDef.header,
																header.getContext(),
															)}
															{isSorted === "desc" ? (
																<ArrowDown className="h-3 w-3 shrink-0" />
															) : isSorted === "asc" ? (
																<ArrowUp className="h-3 w-3 shrink-0" />
															) : (
																<ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
															)}
														</Button>
													) : (
														flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)
													)}
												</div>
												{resizable &&
													header.column.columnDef.enableResizing !== false && (
														<div
															{...{
																onDoubleClick: () => header.column.resetSize(),
																onMouseDown: header.getResizeHandler(),
																onTouchStart: header.getResizeHandler(),
																className: cn(
																	table.options.columnResizeDirection,
																	header.column.getIsResizing() && "isResizing",
																	"select-none touch-none cursor-col-resize w-1.5 h-6 bg-border hover:bg-primary transition-colors duration-150 hover:shadow-md shrink-0 -mx-0.5",
																),
																title: "Drag to resize column",
																//   style: {
																//     transform:
																//       columnResizeMode === 'onEnd' &&
																//       header.column.getIsResizing()
																//         ? `translateX(${
																//             (table.options.columnResizeDirection ===
																//             'rtl'
																//               ? -1
																//               : 1) *
																//             (table.getState().columnSizingInfo
																//               .deltaOffset ?? 0)
																//           }px)`
																//         : '',
																//   },
															}}
														/>
													)}
											</div>
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					{isLoading ? (
						<tbody>
							{Array(pagination.pageSize)
								.fill(pagination.pageSize)
								.map((_, index) => (
									<tr
										className="border-b border-border"
										key={index}
										data-skeleton
									>
										{columns.map((col) => (
											<td key={col.id} className={tableCellStyles({ size })}>
												<div className="h-3 bg-muted rounded animate-pulse" />
											</td>
										))}
									</tr>
								))}
						</tbody>
					) : (
						<tbody>
							{table.getRowModel().rows.length ? (
								table
									.getRowModel()
									.rows.map((row, index) => (
										<TableRow
											key={row.id}
											index={index}
											getRow={() => row}
											onRowClick={onRowClick}
											size={size}
											striped={striped}
											interactive={interactive}
											showColumnBorder={showColumnBorder}
											withContextMenu={withContextMenu}
											ExpandedRow={ExpandedRow}
											onExpandRowJson={props.onExpandRowJson}
										/>
									))
							) : (
								<tr>
									{emptyState ? (
										<td className="text-center" colSpan={columns.length}>
											<div className={tableEmptyStateStyles()}>
												<span>
													{hasError ? i18n.errorText : i18n.emptyText}
												</span>
											</div>
										</td>
									) : null}
								</tr>
							)}
						</tbody>
					)}
				</table>
			</div>

			{table.options.manualPagination === false &&
			(table.getRowModel().rows.length >= pagination.pageSize ||
				pagination.pageSize > 100) ? (
				<DataTablePagination table={table} />
			) : null}
			{runIfFn(bottom, table)}
		</>
	);
}

const TableCell = memo(function TableCell({
	cell,
	index,
	size,
	showColumnBorder,
}: {
	cell: Cell<any, any>;
	index: number;
	isExpanded: boolean;
	size: DataTableSize;
	showColumnBorder: boolean;
}) {
	const columnSize = cell.column.getSize();
	const textAlign = (cell.column.columnDef.meta as any)?.textAlign || "left";

	return (
		<td
			className={tableCellStyles({ size, showColumnBorder, textAlign })}
			data-testid={`cell-${index}-${cell.column.id}`}
			style={{
				width: `${columnSize}px`,
			}}
		>
			<ErrorBoundary fallbackRender={fallbackRender}>
				{flexRender(cell.column.columnDef.cell, cell.getContext())}
			</ErrorBoundary>
		</td>
	);
});

const TableRow = memo(function TableRow({
	index,
	getRow,
	onRowClick,
	size,
	striped,
	interactive,
	showColumnBorder,
	withContextMenu,
	ExpandedRow,
	onExpandRowJson,
}: {
	index: number;
	getRow: () => Row<any>;
	onRowClick?: (row: Row<any>) => void;
	size: DataTableSize;
	striped: boolean;
	interactive: boolean;
	showColumnBorder: boolean;
	withContextMenu: boolean;
	ExpandedRow?: (props: { row: Row<any> }) => ReactNode;
	onExpandRowJson?: (row: Record<string, unknown>) => void;
}) {
	const row = getRow();
	const visibleCells = row.getVisibleCells();
	const isSelected = row.getIsSelected();

	const ContextMenu = withContextMenu ? RowContextMenu : Fragment;

	return (
		<Fragment>
			<ContextMenu
				row={row.original as Record<string, unknown>}
				onExpandRowJson={onExpandRowJson}
			>
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
				>
					{visibleCells.map((cell, cellIndex) => (
						<TableCell
							key={cell.id}
							cell={cell}
							index={cellIndex}
							isExpanded={row.getIsExpanded()}
							size={size}
							showColumnBorder={showColumnBorder}
						/>
					))}
				</tr>
			</ContextMenu>
			{row.getIsExpanded() && ExpandedRow && (
				<tr
					className={`border-b ${isSelected ? "bg-blue-50" : ""}`}
					data-testid={`row-${index}-subrow`}
					data-state={isSelected && "selected"}
				>
					<td
						className={tableCellStyles({ size, showColumnBorder })}
						colSpan={visibleCells.length}
					>
						<ErrorBoundary fallbackRender={fallbackRender}>
							<ExpandedRow row={row} />
						</ErrorBoundary>
					</td>
				</tr>
			)}
		</Fragment>
	);
});

type TagName = "BUTTON" | "A";

function isDescendantOfButton(
	e: React.MouseEvent<HTMLElement>,
	tags: TagName[],
) {
	let element = e.target as HTMLElement | null;

	while (element && element !== e.currentTarget) {
		if (tags.includes(element.tagName as TagName)) {
			return true;
		}

		element = element.parentElement;
	}

	return false;
}

function DataTablePagination<TData>(props: { table: TanstackTable<TData> }) {
	const { table } = props;
	const state = table.getState();
	const rowCount = table.getRowCount();
	const { pageIndex, pageSize } = state.pagination;

	return (
		<div className="flex items-center justify-end gap-2 my-4">
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
					className="px-2 py-1 border border-border rounded disabled:opacity-50 hover:bg-muted text-foreground"
				>
					Prev
				</button>
				<span className="text-sm text-foreground">
					Page {pageIndex + 1} of {Math.ceil(rowCount / pageSize)}
				</span>
				<button
					onClick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
					className="px-2 py-1 border border-border rounded disabled:opacity-50 hover:bg-muted text-foreground"
				>
					Next
				</button>
			</div>
		</div>
	);
}
