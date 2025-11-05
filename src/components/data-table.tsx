import type { Cell, Row, Table as TanstackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Fragment, memo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Combobox, useListCollection } from "@ark-ui/react/combobox";
import { useFilter } from "@ark-ui/react/locale";
import { Portal } from "@ark-ui/react/portal";
import { Button } from "./ui/button";
import { PageLimitSelect } from "./page-limit.select.tsx";
import { runIfFn } from "./run-if-fn.ts";
import {
	tableCellStyles,
	tableEmptyStateStyles,
	tableHeaderCellStyles,
	tableHeaderStyles,
	tableRowStyles,
	tableStyles,
} from "./data-table.styles.ts";

const i18n = {
	emptyText: "No results found.",
	errorText: "An error occurred.",
};

export type DataTableSize = "sm" | "md" | "lg";
export type DataTableVariant = "line" | "outline";

export interface DataTableProps<TData> {
	className?: string;
	table: TanstackTable<TData>;
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
	variant?: DataTableVariant;
	size?: DataTableSize;
	ExpandedRow?: (props: { row: Row<TData> }) => ReactNode;
}

const fallbackRender = () => "An error happened";

export function DataTable<TData>(props: DataTableProps<TData>) {
	const {
		className,
		table,
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
		variant = "line",
		size = "md",
		ExpandedRow,
	} = props;

	const state = table.getState();
	const { pagination } = state;
	const columns = table.getAllColumns();
	const selectedRowsCount = table.getSelectedRowModel().rows.length;
	const hasSelectedRows = selectedRowsCount > 0;

	// Calculate total width from column sizing
	const getTotalWidth = () => {
		let total = 0;
		table.getHeaderGroups()[0]?.headers.forEach((header) => {
			total += header.getSize();
		});
		return total;
	};

	return (
		<>
			{runIfFn(top, table)}
			{runIfFn(header, table)}
			<ColumnVisibilityControls table={table} />
			<div className={`overflow-x-auto ${className || ""}`}>
				<table
					className={tableStyles({ variant })}
					style={{
						width: state.columnSizingInfo.isResizingColumn
							? `calc(${getTotalWidth()}px + ${state.columnSizingInfo.deltaOffset}px)`
							: `${getTotalWidth()}px`,
					}}
				>
					<thead className={tableHeaderStyles({ stickyHeader, variant })}>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									const size_val = header.getSize();
									const style = {
										width: `${size_val}px`,
										position: "relative",
									} as React.CSSProperties;
									const hasBulkActions =
										hasSelectedRows && headerGroup.headers.at(-1) === header;
									const column = header.column;
									const isSorted = column.getIsSorted();

									return (
										<th
											className={
												tableHeaderCellStyles({
													size,
													showColumnBorder,
												}) + (hasBulkActions ? " text-right" : "")
											}
											key={header.id}
											style={style}
										>
											<div className="flex items-center justify-between">
												<div className="flex-1">
													{header.isPlaceholder ? null : column.getCanSort() &&
														column.columnDef.enableSorting ? (
														<Button
															onClick={column.getToggleSortingHandler()}
															variant="ghost"
															size="sm"
															data-test-id={`table-sort-${column.id}`}
															className="h-6 px-1 gap-1"
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
												{header.column.columnDef.enableResizing !== false && (
													<div
														onMouseDown={header.getResizeHandler?.()}
														onTouchStart={header.getResizeHandler?.()}
														className="select-none touch-none cursor-col-resize w-1 h-6 bg-border hover:bg-primary/50 transition-colors"
														style={{
															transform: header.column.getIsResizing?.()
																? `translateX(${table.getState().columnSizingInfo.deltaOffset}px)`
																: "",
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
											ExpandedRow={ExpandedRow}
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
	return (
		<td
			className={tableCellStyles({ size, showColumnBorder })}
			data-testid={`cell-${index}-${cell.column.id}`}
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
	ExpandedRow,
}: {
	index: number;
	getRow: () => Row<any>;
	onRowClick?: (row: Row<any>) => void;
	size: DataTableSize;
	striped: boolean;
	interactive: boolean;
	showColumnBorder: boolean;
	ExpandedRow?: (props: { row: Row<any> }) => ReactNode;
}) {
	const row = getRow();
	const visibleCells = row.getVisibleCells();
	const isSelected = row.getIsSelected();

	return (
		<Fragment>
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

function ColumnVisibilityControls<TData>(props: {
	table: TanstackTable<TData>;
}) {
	const { table } = props;
	const [isOpen, setIsOpen] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const { contains } = useFilter({ sensitivity: "base" });

	const columns = table
		.getAllLeafColumns()
		.filter((col) => col.getCanHide?.())
		.map((col) => ({
			label: (col.columnDef.header as string) || col.id,
			value: col.id,
		}));

	const { collection, filter } = useListCollection({
		initialItems: columns,
		filter: contains,
	});

	const handleInputChange = (details: Combobox.InputValueChangeDetails) => {
		setInputValue(details.inputValue);
		filter(details.inputValue);
	};

	return (
		<div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
			<Combobox.Root
				collection={collection}
				onInputValueChange={handleInputChange}
				inputValue={inputValue}
				open={isOpen}
				onOpenChange={(details) => setIsOpen(details.open)}
				closeOnSelect={false}
			>
				<Combobox.Control>
					<Button
						variant="outline"
						size="sm"
						className="w-48 h-9 justify-between"
						onClick={() => setIsOpen(!isOpen)}
					>
						<span className="text-xs font-medium text-foreground uppercase tracking-wide">
							📋 Columns
						</span>
						<ChevronsUpDown className="h-4 w-4 opacity-50" />
					</Button>
				</Combobox.Control>
				<Portal>
					<Combobox.Positioner>
						<Combobox.Content className="bg-card border border-border rounded-md shadow-lg z-50 min-w-48">
							<div className="p-2 border-b">
								<Combobox.Input
									placeholder="Filter columns..."
									className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
									autoFocus
								/>
							</div>
							<div className="p-2 max-h-64 overflow-y-auto">
								<Combobox.ItemGroup>
									{collection.items.length > 0 ? (
										collection.items.map((item) => {
											const column = table.getColumn(item.value);
											const isVisible = column?.getIsVisible?.() ?? true;

											return (
												<Combobox.Item
													key={item.value}
													item={item}
													className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted data-highlighted:bg-accent transition-colors"
													onClick={(e) => {
														column?.toggleVisibility?.();
													}}
												>
													<input
														type="checkbox"
														checked={isVisible}
														readOnly
														className="rounded"
													/>
													<Combobox.ItemText className="flex-1">
														{item.label}
													</Combobox.ItemText>
												</Combobox.Item>
											);
										})
									) : (
										<div className="px-2 py-2 text-xs text-muted-foreground text-center">
											No columns found
										</div>
									)}
								</Combobox.ItemGroup>
							</div>
						</Combobox.Content>
					</Combobox.Positioner>
				</Portal>
			</Combobox.Root>
		</div>
	);
}
