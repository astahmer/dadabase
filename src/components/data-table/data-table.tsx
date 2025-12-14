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
	Header,
	HeaderGroup,
	Row,
	Table as TanstackTable,
} from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	ArrowDownNarrowWide,
	ArrowUpNarrowWide,
	ChevronsUpDown,
	GripVertical,
	Pin,
	PinOff,
} from "lucide-react";
import type { ReactNode, Ref, RefObject } from "react";
import { memo, useEffect, useMemo, useRef } from "react";
import { getColumnPinningStyles } from "../../lib/get-pinning-styles.ts";
import { runIfFn } from "../../lib/run-if-fn.ts";
import { cn } from "../../lib/utils.ts";
import { PageLimitSelect } from "../app/page-limit.select.tsx";
import { Button } from "../ui/button.tsx";
import { HStack } from "../ui/layout.tsx";
import { ColumnHeaderContextMenu } from "./column-header-context-menu.tsx";
import { DataTableRow, type DataTableRowSubrow } from "./data-table.row.tsx";
import type { ColumnVirtualizationState } from "./data-table.column-virtualization.ts";
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
	virtualized?: boolean; // TODO rename enableRowVirtualization
	estimateItemSize?: number;
	overscan?: number;
	enableColumnOrdering?: boolean;
	renderSubrows?: (row: Row<TData>) => DataTableRowSubrow[];
	hideColumnPinIconUnlessHovered?: boolean;
	virtualizeColumns?: boolean; // TODO rename enableColumnVirtualization
}

export function DataTable<TData>(props: DataTableProps<TData>) {
	const {
		table,
		top,
		bottom,
		emptyState = true,
		stickyHeader = true,
		interactive = false,
		striped = false,
		showColumnBorder = false,
		withRowContextMenu = false,
		resizable = true,
		variant = "line",
		size = "cozy",
		virtualized = false,
		estimateItemSize,
		overscan = 15,
		enableColumnOrdering = false,
		hideColumnPinIconUnlessHovered = true,
		// TODO based on number of columns
		virtualizeColumns = true,
	} = props;

	const state = table.getState();
	const { pagination } = state;
	const rows = table.getRowModel().rows;

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(MouseSensor),
		useSensor(KeyboardSensor),
	);

	const TableContent = (
		<TableContainer
			table={table}
			className={props.className}
			containerRef={props.containerRef}
			getTableContainer={props.getTableContainer}
			emptyState={emptyState}
			isLoading={props.isLoading}
			hasError={props.hasError}
			onRowClick={props.onRowClick}
			onColumnFilterClick={props.onColumnFilterClick}
			stickyHeader={stickyHeader}
			withRowContextMenu={withRowContextMenu}
			ExpandedRow={props.ExpandedRow}
			resizable={resizable}
			onExpandRowJson={props.onExpandRowJson}
			virtualized={virtualized}
			estimateItemSize={estimateItemSize}
			overscan={overscan}
			renderSubrows={props.renderSubrows}
			hideColumnPinIconUnlessHovered={hideColumnPinIconUnlessHovered}
			virtualizeColumns={virtualizeColumns}
			size={size}
			variant={variant}
			interactive={interactive}
			striped={striped}
			showColumnBorder={showColumnBorder}
			enableColumnOrdering={enableColumnOrdering}
		/>
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
					{TableContent}
				</DndContext>
			) : (
				TableContent
			)}

			{table.options.manualPagination === false &&
			(rows.length >= pagination.pageSize || pagination.pageSize > 100) ? (
				<DataTablePagination table={table} />
			) : null}
			{runIfFn(bottom, table)}
		</>
	);
}

const TableContainer = (
	props: Pick<
		DataTableProps<any>,
		| "table"
		| "className"
		| "containerRef"
		| "getTableContainer"
		| "emptyState"
		| "isLoading"
		| "hasError"
		| "onRowClick"
		| "onColumnFilterClick"
		| "stickyHeader"
		| "withRowContextMenu"
		| "ExpandedRow"
		| "resizable"
		| "onExpandRowJson"
		| "virtualized"
		| "estimateItemSize"
		| "overscan"
		| "renderSubrows"
		| "hideColumnPinIconUnlessHovered"
		| "virtualizeColumns"
	> &
		Pick<
			Required<DataTableProps<any>>,
			| "size"
			| "variant"
			| "interactive"
			| "striped"
			| "showColumnBorder"
			| "enableColumnOrdering"
		>,
) => {
	const table = props.table;
	const state = props.table.getState();

	const tableContainerRef = useRef<HTMLDivElement>(null);

	const hasGroupedHeaders = useMemo(() => {
		return table
			.getHeaderGroups()
			.some((hg) => hg.headers.some((h) => h.subHeaders.length > 0));
	}, [table]);

	const leafColumns = table.getVisibleLeafColumns();
	const centerLeafColumns =
		table.getCenterVisibleLeafColumns?.() ??
		leafColumns.filter((c) => !c.getIsPinned());

	const columnVirtualizer = useVirtualizer({
		enabled: props.virtualizeColumns,
		horizontal: true,
		count: centerLeafColumns.length,
		getScrollElement: () => tableContainerRef.current,
		estimateSize: (index) => centerLeafColumns[index]?.getSize() ?? 0,
		overscan: 1,
	});

	// Keep measurements fresh when column sizes change (resize, order, pinning)
	useEffect(() => {
		columnVirtualizer.measure();
	}, [
		columnVirtualizer,
		state.columnSizing,
		state.columnSizingInfo,
		state.columnOrder,
		state.columnPinning,
	]);

	const enabledColumnVirtualization =
		props.virtualizeColumns === true &&
		!hasGroupedHeaders &&
		centerLeafColumns.length > 0 &&
		tableContainerRef.current != null;

	const centerVirtualItems = enabledColumnVirtualization
		? columnVirtualizer.getVirtualItems()
		: [];

	const columnVirtualization: ColumnVirtualizationState = useMemo(() => {
		if (enabledColumnVirtualization && centerVirtualItems.length > 0) {
			const startIndex = centerVirtualItems[0]?.index ?? 0;
			const endIndex = centerVirtualItems.at(-1)?.index ?? 0;
			const totalSize = columnVirtualizer.getTotalSize();
			const leftPaddingPx = centerVirtualItems[0]?.start ?? 0;
			const rightPaddingPx = totalSize - (centerVirtualItems.at(-1)?.end ?? 0);

			return {
				enabled: true,
				virtualCenterColumnIds: centerVirtualItems
					.map((v) => centerLeafColumns[v.index]?.id)
					.filter(Boolean) as string[],
				centerPaddingLeftPx: leftPaddingPx,
				centerPaddingRightPx: rightPaddingPx,
				centerPaddingLeftColSpan: Math.max(0, startIndex),
				centerPaddingRightColSpan: Math.max(
					0,
					centerLeafColumns.length - (endIndex + 1),
				),
			};
		}

		return { enabled: false };
	}, [enabledColumnVirtualization, centerVirtualItems, centerLeafColumns]);

	return (
		<div
			className={`overflow-x-auto h-full ${props.virtualized ? "overflow-y-auto" : ""} ${props.className || ""}`}
			ref={(el) => {
				if (props.containerRef) {
					props.containerRef.current = el;
				}

				if (el) {
					tableContainerRef.current = el;
					props.getTableContainer?.(el);
				}
			}}
		>
			<table
				className={tableStyles({ variant: props.variant })}
				style={{ width: table.getTotalSize() }}
			>
				<thead
					className={tableHeaderStyles({
						stickyHeader: props.stickyHeader,
						variant: props.variant,
					})}
				>
					{table.getHeaderGroups().map((headerGroup) => {
						const headerById = new Map(
							headerGroup.headers.map((h) => [h.column.id, h]),
						);

						const leftHeaders = headerGroup.headers.filter(
							(h) => h.column.getIsPinned() === "left",
						);
						const rightHeaders = headerGroup.headers.filter(
							(h) => h.column.getIsPinned() === "right",
						);
						const centerHeaders = headerGroup.headers.filter(
							(h) => !h.column.getIsPinned(),
						);

						const renderHeaderCell = (headerCell: Header<any, any>) => (
							<HeaderCell
								key={headerCell.id}
								table={table}
								headerGroup={headerGroup}
								headerCell={headerCell}
								enableColumnOrdering={props.enableColumnOrdering}
								size={props.size}
								showColumnBorder={props.showColumnBorder}
								hideColumnPinIconUnlessHovered={
									props.hideColumnPinIconUnlessHovered
								}
								onColumnFilterClick={props.onColumnFilterClick}
								resizable={props.resizable}
							/>
						);

						const HeaderCellList =
							columnVirtualization.enabled === true
								? [
										...leftHeaders.map(renderHeaderCell),
										columnVirtualization.centerPaddingLeftColSpan > 0 ? (
											<th
												key={`${headerGroup.id}-center-padding-left`}
												aria-hidden
												colSpan={columnVirtualization.centerPaddingLeftColSpan}
												className="p-0"
												style={{
													width: columnVirtualization.centerPaddingLeftPx,
												}}
											/>
										) : null,
										...columnVirtualization.virtualCenterColumnIds
											.map((columnId) => headerById.get(columnId))
											.filter(Boolean)
											.map((h) => renderHeaderCell(h as Header<any, any>)),
										columnVirtualization.centerPaddingRightColSpan > 0 ? (
											<th
												key={`${headerGroup.id}-center-padding-right`}
												aria-hidden
												colSpan={columnVirtualization.centerPaddingRightColSpan}
												className="p-0"
												style={{
													width: columnVirtualization.centerPaddingRightPx,
												}}
											/>
										) : null,
										...rightHeaders.map(renderHeaderCell),
									]
								: // Fallback: render all headers
									[
										...leftHeaders.map(renderHeaderCell),
										...centerHeaders.map(renderHeaderCell),
										...rightHeaders.map(renderHeaderCell),
									];

						if (props.enableColumnOrdering) {
							return (
								<tr key={headerGroup.id}>
									<SortableContext
										items={state.columnOrder}
										strategy={horizontalListSortingStrategy}
									>
										{HeaderCellList}
									</SortableContext>
								</tr>
							);
						}

						return <tr key={headerGroup.id}>{HeaderCellList}</tr>;
					})}
				</thead>
				{table.getState().columnSizingInfo.isResizingColumn ? (
					<MemoizedTableBody
						table={table}
						tableContainerRef={tableContainerRef}
						isLoading={props.isLoading}
						virtualized={props.virtualized}
						onRowClick={props.onRowClick}
						withRowContextMenu={props.withRowContextMenu}
						ExpandedRow={props.ExpandedRow}
						onExpandRowJson={props.onExpandRowJson}
						estimateItemSize={props.estimateItemSize}
						overscan={props.overscan}
						renderSubrows={props.renderSubrows}
						emptyState={props.emptyState}
						hasError={props.hasError}
						size={props.size}
						variant={props.variant}
						interactive={props.interactive}
						striped={props.striped}
						showColumnBorder={props.showColumnBorder}
						enableColumnOrdering={props.enableColumnOrdering}
						columnVirtualization={columnVirtualization}
					/>
				) : (
					<TableBody
						table={table}
						tableContainerRef={tableContainerRef}
						isLoading={props.isLoading}
						virtualized={props.virtualized}
						columnVirtualization={columnVirtualization}
						onRowClick={props.onRowClick}
						withRowContextMenu={props.withRowContextMenu}
						ExpandedRow={props.ExpandedRow}
						onExpandRowJson={props.onExpandRowJson}
						estimateItemSize={props.estimateItemSize}
						overscan={props.overscan}
						renderSubrows={props.renderSubrows}
						emptyState={props.emptyState}
						hasError={props.hasError}
						size={props.size}
						variant={props.variant}
						interactive={props.interactive}
						striped={props.striped}
						showColumnBorder={props.showColumnBorder}
						enableColumnOrdering={props.enableColumnOrdering}
					/>
				)}
			</table>
		</div>
	);
};

const TableBody = (
	props: {
		table: TanstackTable<any>;
		tableContainerRef: RefObject<HTMLDivElement | null>;
		columnVirtualization: ColumnVirtualizationState;
	} & Pick<
		DataTableProps<any>,
		| "isLoading"
		| "virtualized"
		| "onRowClick"
		| "withRowContextMenu"
		| "ExpandedRow"
		| "onExpandRowJson"
		| "estimateItemSize"
		| "overscan"
		| "renderSubrows"
		| "emptyState"
		| "hasError"
	> &
		Pick<
			Required<DataTableProps<any>>,
			| "size"
			| "variant"
			| "interactive"
			| "striped"
			| "showColumnBorder"
			| "enableColumnOrdering"
		>,
) => {
	const { table, tableContainerRef } = props;
	const state = props.table.getState();

	const rows = table.getRowModel().rows;
	const columnVirtualization = props.columnVirtualization;

	const leafColumns = table.getVisibleLeafColumns();
	const leftPinnedLeafColumns = leafColumns.filter(
		(c) => c.getIsPinned() === "left",
	);
	const rightPinnedLeafColumns = leafColumns.filter(
		(c) => c.getIsPinned() === "right",
	);
	const centerLeafColumns = leafColumns.filter((c) => !c.getIsPinned());

	return props.isLoading ? (
		<tbody>
			{Array(state.pagination.pageSize)
				.fill(state.pagination.pageSize)
				.map((_, index) => (
					<tr className="border-b border-border" key={index} data-skeleton>
						{leftPinnedLeafColumns.map((col) => (
							<td
								key={col.id}
								className={tableCellStyles({ size: props.size })}
								style={getColumnPinningStyles(col)}
							>
								<div className="h-3 bg-muted rounded animate-pulse" />
							</td>
						))}
						{columnVirtualization.enabled === true &&
						columnVirtualization.centerPaddingLeftColSpan > 0 ? (
							<td
								key={`skeleton-${index}-center-padding-left`}
								aria-hidden
								colSpan={columnVirtualization.centerPaddingLeftColSpan}
								className="p-0"
								style={{ width: columnVirtualization.centerPaddingLeftPx }}
							/>
						) : null}
						{(columnVirtualization.enabled === true
							? columnVirtualization.virtualCenterColumnIds
							: centerLeafColumns.map((c) => c.id)
						).map((columnId) => (
							<td
								key={`skeleton-${index}-${columnId}`}
								className={tableCellStyles({ size: props.size })}
							>
								<div className="h-3 bg-muted rounded animate-pulse" />
							</td>
						))}
						{columnVirtualization.enabled === true &&
						columnVirtualization.centerPaddingRightColSpan > 0 ? (
							<td
								key={`skeleton-${index}-center-padding-right`}
								aria-hidden
								colSpan={columnVirtualization.centerPaddingRightColSpan}
								className="p-0"
								style={{ width: columnVirtualization.centerPaddingRightPx }}
							/>
						) : null}
						{rightPinnedLeafColumns.map((col) => (
							<td
								key={col.id}
								className={tableCellStyles({ size: props.size })}
								style={getColumnPinningStyles(col)}
							>
								<div className="h-3 bg-muted rounded animate-pulse" />
							</td>
						))}
					</tr>
				))}
		</tbody>
	) : props.virtualized && rows.length && tableContainerRef.current ? (
		<tbody>
			<VirtualizedTableBody
				rows={rows}
				onRowClick={props.onRowClick}
				size={props.size}
				striped={props.striped}
				interactive={props.interactive}
				showColumnBorder={props.showColumnBorder}
				enableColumnOrdering={props.enableColumnOrdering}
				columnOrder={state.columnOrder}
				columnVirtualization={columnVirtualization}
				withRowContextMenu={props.withRowContextMenu}
				ExpandedRow={props.ExpandedRow}
				onExpandRowJson={props.onExpandRowJson}
				estimateItemSize={
					props.estimateItemSize ?? estimateSizeByTableSize(props.size)
				}
				overscan={props.overscan}
				scrollElement={tableContainerRef.current}
				renderSubrows={props.renderSubrows}
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
						onRowClick={props.onRowClick}
						size={props.size}
						striped={props.striped}
						interactive={props.interactive}
						showColumnBorder={props.showColumnBorder}
						enableColumnOrdering={props.enableColumnOrdering}
						columnOrder={state.columnOrder}
						columnVirtualization={columnVirtualization}
						withRowContextMenu={props.withRowContextMenu}
						ExpandedRow={props.ExpandedRow}
						onExpandRowJson={props.onExpandRowJson}
						renderSubrows={props.renderSubrows}
					/>
				))
			) : (
				<tr>
					{props.emptyState ? (
						<td className="text-center" colSpan={leafColumns.length}>
							<div className={tableEmptyStateStyles()}>
								<span>{props.hasError ? i18n.errorText : i18n.emptyText}</span>
							</div>
						</td>
					) : null}
				</tr>
			)}
		</tbody>
	);
};

// https://github.com/TanStack/table/issues/1766
// https://tanstack.com/table/latest/docs/framework/react/examples/column-resizing-performant?panel=sandbox
//special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = memo(
	TableBody,
	(prev, next) => prev.table.options.data === next.table.options.data,
) as typeof TableBody;

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

const CellHeaderContent = memo(
	(props: {
		table: TanstackTable<any>;
		headerCell: Header<any, any>;
		onColumnFilterClick?: (columnId: string, columnName: string) => void;
		hideColumnPinIconUnlessHovered?: boolean;
	}) => {
		const {
			table,
			headerCell,
			onColumnFilterClick,
			hideColumnPinIconUnlessHovered,
		} = props;
		const column = headerCell.column;
		const isSorted = column.getIsSorted();

		return (
			<div className={"flex items-center justify-between min-w-0"}>
				<ColumnHeaderContextMenu
					column={column}
					table={table}
					onFilterClick={onColumnFilterClick}
				>
					<HStack className="flex-1 min-w-0 truncate" align="center" w="full">
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
							variant={hideColumnPinIconUnlessHovered ? "outline" : "ghost"}
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
							variant={hideColumnPinIconUnlessHovered ? "outline" : "ghost"}
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
	},
);

const HeaderCell = memo(
	(props: {
		table: TanstackTable<any>;
		headerGroup: HeaderGroup<any>;
		headerCell: Header<any, any>;
		enableColumnOrdering?: boolean;
		size?: DataTableSize;
		showColumnBorder?: boolean;
		hideColumnPinIconUnlessHovered?: boolean;
		onColumnFilterClick?: (columnId: string, columnName: string) => void;
		resizable?: boolean;
	}) => {
		const { table, headerGroup, headerCell } = props;

		const selectedRowsCount = table.getSelectedRowModel().rows.length;
		const hasSelectedRows = selectedRowsCount > 0;
		const hasBulkActions =
			hasSelectedRows && headerGroup.headers.at(-1) === headerCell;
		const column = headerCell.column;

		const meta = headerCell.column.columnDef.meta as
			| Record<string, unknown>
			| undefined;
		const textAlign =
			(meta?.textAlign as "left" | "right" | "center" | undefined) || "left";
		const className = (meta?.className as boolean) ?? false;
		const isDragDisabled =
			props.enableColumnOrdering === false ||
			meta?.enableColumnOrdering === false ||
			Boolean(column.getIsPinned()) ||
			headerCell.subHeaders.length;

		if (!isDragDisabled) {
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
									...dragCtx.style,
									width:
										headerCell.subHeaders.length === 0
											? `${headerCell.getSize()}px`
											: "auto",
									zIndex: headerCell.index + (dragCtx.isDragging ? 2 : 1),
									position: "sticky",
								}}
								className={cn(
									tableHeaderCellStyles({
										size: props.size,
										showColumnBorder: props.showColumnBorder,
										textAlign: hasBulkActions ? "right" : textAlign,
									}),
									"sticky left-[50px] z-1 bg-background",
									className,
								)}
							>
								<div
									className={cn(
										"flex items-center gap-2 truncate",
										props.hideColumnPinIconUnlessHovered && "group",
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
									<CellHeaderContent
										table={table}
										headerCell={headerCell}
										onColumnFilterClick={props.onColumnFilterClick}
										hideColumnPinIconUnlessHovered={
											props.hideColumnPinIconUnlessHovered
										}
									/>
								</div>
								{props.resizable &&
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
						size: props.size,
						showColumnBorder: props.showColumnBorder,
						textAlign: hasBulkActions ? "right" : textAlign,
					}),
					className,
					"relative",
					headerCell.subHeaders.length && "py-1.5 pl-10",
					props.hideColumnPinIconUnlessHovered && "group",
				)}
			>
				<CellHeaderContent
					table={table}
					headerCell={headerCell}
					onColumnFilterClick={props.onColumnFilterClick}
					hideColumnPinIconUnlessHovered={props.hideColumnPinIconUnlessHovered}
				/>
				{props.resizable &&
					headerCell.column.columnDef.enableResizing !== false && (
						<ResizeHandle
							onDoubleClick={() => headerCell.column.resetSize()}
							onMouseDown={headerCell.getResizeHandler()}
							onTouchStart={headerCell.getResizeHandler()}
							isResizing={headerCell.column.getIsResizing()}
							columnResizeDirection={table.options.columnResizeDirection}
						/>
					)}
			</th>
		);
	},
);
