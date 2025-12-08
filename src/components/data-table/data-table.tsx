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
import {
	arrayMove,
	horizontalListSortingStrategy,
	SortableContext,
} from "@dnd-kit/sortable";
import type {
	Row,
	Table as TanstackTable,
	Header,
} from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import {
	ArrowDownNarrowWide,
	ArrowUpNarrowWide,
	ChevronsUpDown,
	GripVertical,
	Pin,
	PinOff,
} from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";
import { getColumnPinningStyles } from "../../lib/get-pinning-styles.ts";
import { runIfFn } from "../../lib/run-if-fn.ts";
import { cn } from "../../lib/utils.ts";
import { PageLimitSelect } from "../app/page-limit.select.tsx";
import { Button } from "../ui/button.tsx";
import { HStack } from "../ui/layout.tsx";
import { ColumnHeaderContextMenu } from "./column-header-context-menu.tsx";
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

const i18n = {
	emptyText: "No results found.",
	errorText: "An error occurred.",
};

export type DataTableVariant = "line" | "outline";

export interface DataTableProps<TData> {
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
	onColumnFilterClick?: (columnId: string, columnName: string) => void;
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
	virtualized?: boolean;
	estimateItemSize?: number;
	overscan?: number;
	enableColumnOrdering?: boolean;
	renderSubrows?: (row: Row<TData>) => DataTableRowSubrow[];
	hideColumnPinIconUnlessHovered?: boolean;
}

export function DataTable<TData>(props: DataTableProps<TData>) {
	const {
		className,
		table,
		containerRef,
		getTableContainer,
		top,
		bottom,
		emptyState = true,
		hasError,
		isLoading,
		onRowClick,
		onColumnFilterClick,
		stickyHeader = true,
		interactive = false,
		striped = false,
		showColumnBorder = false,
		withRowContextMenu = false,
		resizable = true,
		variant = "line",
		size = "cozy",
		ExpandedRow,
		virtualized = false,
		estimateItemSize,
		overscan = 30,
		enableColumnOrdering = false,
		renderSubrows,
		hideColumnPinIconUnlessHovered = true,
	} = props;

	const state = table.getState();
	const { pagination } = state;
	const columns = table.getAllColumns();
	const selectedRowsCount = table.getSelectedRowModel().rows.length;
	const hasSelectedRows = selectedRowsCount > 0;
	const rows = table.getRowModel().rows;

	const tableContainerRef = useRef<HTMLDivElement>(null);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(MouseSensor),
		useSensor(KeyboardSensor),
	);

	const TableContainer = (
		<div
			className={`overflow-x-auto h-full ${virtualized ? "overflow-y-auto" : ""} ${className || ""}`}
			ref={(el) => {
				if (containerRef) {
					containerRef.current = el;
				}

				if (el) {
					tableContainerRef.current = el;
					getTableContainer?.(el);
				}
			}}
		>
			<table
				className={tableStyles({ variant })}
				style={{ width: table.getTotalSize() }}
			>
				<thead className={tableHeaderStyles({ stickyHeader, variant })}>
					{table.getHeaderGroups().map((headerGroup) => {
						const TableContent = headerGroup.headers.map((headerCell) => {
							const hasBulkActions =
								hasSelectedRows && headerGroup.headers.at(-1) === headerCell;
							const column = headerCell.column;
							const isSorted = column.getIsSorted();

							const meta = headerCell.column.columnDef.meta as
								| Record<string, unknown>
								| undefined;
							const textAlign =
								(meta?.textAlign as "left" | "right" | "center" | undefined) ||
								"left";
							const isDragDisabled =
								meta?.enableColumnOrdering === false ||
								Boolean(column.getIsPinned());

							const CellHeaderContent = (
								<div className={"flex items-center justify-between min-w-0"}>
									<ColumnHeaderContextMenu
										column={column}
										table={table}
										onFilterClick={onColumnFilterClick}
									>
										<HStack
											className="flex-1 min-w-0 truncate"
											align="center"
											w="full"
										>
											{headerCell.isPlaceholder ? null : column.getCanSort() &&
												column.columnDef.enableSorting ? (
												<Button
													onClick={column.getToggleSortingHandler()}
													variant="ghost"
													size="sm"
													data-test-id={`table-sort-${column.id}`}
													className="h-5 px-1 gap-1"
												>
													{flexRender(
														headerCell.column.columnDef.header,
														headerCell.getContext(),
													)}
													{isSorted === "desc" ? (
														<ArrowDownNarrowWide className="h-3 w-3 shrink-0" />
													) : isSorted === "asc" ? (
														<ArrowUpNarrowWide className="h-3 w-3 shrink-0" />
													) : (
														<ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
													)}
												</Button>
											) : (
												flexRender(
													headerCell.column.columnDef.header,
													headerCell.getContext(),
												)
											)}
										</HStack>
									</ColumnHeaderContextMenu>
									{column.getCanPin() ? (
										column.getIsPinned() ? (
											<Button
												variant={
													hideColumnPinIconUnlessHovered ? "outline" : "ghost"
												}
												size="xs"
												withIcon={false}
												onClick={() => column.pin(false)}
												className={
													hideColumnPinIconUnlessHovered
														? "absolute right-3 group-hover:opacity-100 opacity-0 transition-opacity"
														: "mr-2"
												}
											>
												<PinOff className="h-3 w-3" />
											</Button>
										) : (
											<Button
												variant={
													hideColumnPinIconUnlessHovered ? "outline" : "ghost"
												}
												size="xs"
												withIcon={false}
												onClick={() => column.pin("left")}
												className={
													hideColumnPinIconUnlessHovered
														? "absolute right-3 group-hover:opacity-100 opacity-0 transition-opacity"
														: "mr-2"
												}
											>
												<Pin className="h-3 w-3" />
											</Button>
										)
									) : null}
								</div>
							);

							if (enableColumnOrdering && !isDragDisabled) {
								return (
									<DraggableColumnHeader key={headerCell.id} column={column}>
										{(dragCtx) => {
											return (
												<th
													key={headerCell.id}
													colSpan={headerCell.colSpan}
													data-column-id={headerCell.column.id}
													data-draggable
													ref={dragCtx.setNodeRef}
													style={{
														width: `${headerCell.getSize()}px`,
														...dragCtx.style,
														zIndex:
															headerCell.index + (dragCtx.isDragging ? 2 : 1),
														position: "sticky",
														// ...(headerCell.depth === 0 && {
														// 	left: "50px",
														// 	backgroundColor: "var(--color-background)",
														// 	zIndex:
														// 		headerCell.index + (dragCtx.isDragging ? 2 : 1),
														// 	position: "sticky",
														// }),
													}}
													className={cn(
														tableHeaderCellStyles({
															size,
															showColumnBorder,
															textAlign: hasBulkActions ? "right" : textAlign,
														}),
														"sticky left-[50px] z-1 bg-background",
													)}
												>
													<div
														className={cn(
															"flex items-center gap-2 truncate",
															hideColumnPinIconUnlessHovered && "group",
														)}
													>
														{!dragCtx.isDragDisabled && (
															<button
																{...dragCtx.attributes}
																{...dragCtx.listeners}
																type="button"
																className="p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing shrink-0"
																title="Drag to reorder columns"
															>
																<GripVertical className="size-4 text-muted-foreground" />
															</button>
														)}
														{CellHeaderContent}
													</div>
													{resizable &&
														headerCell.column.columnDef.enableResizing !==
															false && (
															<ResizeHandle
																onDoubleClick={() =>
																	headerCell.column.resetSize()
																}
																onMouseDown={headerCell.getResizeHandler()}
																onTouchStart={headerCell.getResizeHandler()}
																isResizing={headerCell.column.getIsResizing()}
																columnResizeDirection={
																	table.options.columnResizeDirection
																}
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
									colSpan={headerCell.colSpan}
									data-column-id={headerCell.column.id}
									data-column-pinned={headerCell.column.getIsPinned()}
									style={{
										...getColumnPinningStyles(column),
										width: headerCell.isPlaceholder
											? `${(headerSize / table.getTotalSize()) * 100}%`
											: `${headerCell.getSize()}px`,
									}}
									className={cn(
										tableHeaderCellStyles({
											size,
											showColumnBorder,
											textAlign: hasBulkActions ? "right" : textAlign,
										}),
										"relative",
										hideColumnPinIconUnlessHovered && "group",
									)}
								>
									{CellHeaderContent}
									{resizable &&
										headerCell.column.columnDef.enableResizing !== false && (
											<ResizeHandle
												onDoubleClick={() => headerCell.column.resetSize()}
												onMouseDown={headerCell.getResizeHandler()}
												onTouchStart={headerCell.getResizeHandler()}
												isResizing={headerCell.column.getIsResizing()}
												columnResizeDirection={
													table.options.columnResizeDirection
												}
											/>
										)}
								</th>
							);
						});

						if (enableColumnOrdering) {
							return (
								<tr key={headerGroup.id}>
									<SortableContext
										items={state.columnOrder}
										strategy={horizontalListSortingStrategy}
									>
										{TableContent}
									</SortableContext>
								</tr>
							);
						}

						return <tr key={headerGroup.id}>{TableContent}</tr>;
					})}
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
				) : virtualized && rows.length && tableContainerRef.current ? (
					<tbody>
						<VirtualizedTableBody
							rows={rows}
							onRowClick={onRowClick}
							size={size}
							striped={striped}
							interactive={interactive}
							showColumnBorder={showColumnBorder}
							enableColumnOrdering={enableColumnOrdering}
							columnOrder={state.columnOrder}
							withRowContextMenu={withRowContextMenu}
							ExpandedRow={ExpandedRow}
							onExpandRowJson={props.onExpandRowJson}
							estimateItemSize={
								estimateItemSize ?? estimateSizeByTableSize(size)
							}
							overscan={overscan}
							scrollElement={tableContainerRef.current}
							renderSubrows={renderSubrows}
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
									onRowClick={onRowClick}
									size={size}
									striped={striped}
									interactive={interactive}
									showColumnBorder={showColumnBorder}
									enableColumnOrdering={enableColumnOrdering}
									columnOrder={state.columnOrder}
									withRowContextMenu={withRowContextMenu}
									ExpandedRow={ExpandedRow}
									onExpandRowJson={props.onExpandRowJson}
									renderSubrows={renderSubrows}
								/>
							))
						) : (
							<tr>
								{emptyState ? (
									<td className="text-center" colSpan={columns.length}>
										<div className={tableEmptyStateStyles()}>
											<span>{hasError ? i18n.errorText : i18n.emptyText}</span>
										</div>
									</td>
								) : null}
							</tr>
						)}
					</tbody>
				)}
			</table>
		</div>
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
					{TableContainer}
				</DndContext>
			) : (
				TableContainer
			)}

			{table.options.manualPagination === false &&
			(rows.length >= pagination.pageSize || pagination.pageSize > 100) ? (
				<DataTablePagination table={table} />
			) : null}
			{runIfFn(bottom, table)}
		</>
	);
}

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
					"absolute top-0 right-0 bottom-0 select-none touch-none cursor-col-resize w-1.5 bg-border hover:bg-primary transition-colors duration-150 hover:shadow-md",
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
