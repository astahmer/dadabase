import type {
	Cell,
	ColumnDef,
	ColumnFiltersState,
	Row,
	SortingState,
	TableMeta,
	TableOptions,
	TableState,
	Table as TanstackTable,
	VisibilityState,
} from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type RowSelectionState,
	useReactTable,
} from "@tanstack/react-table";
import type { Dispatch, JSX, ReactNode, Ref, SetStateAction } from "react";
import {
	Fragment,
	memo,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { PageLimitSelect } from "./page-limit.select.tsx";
import { runIfFn } from "./run-if-fn.ts";
import { HStack } from "./ui/layout.tsx";
import { cx } from "class-variance-authority";
import {
	Pagination,
	PaginationContext,
	PaginationEllipsis,
	PaginationItem,
	PaginationNextTrigger,
	PaginationPrevTrigger,
} from "./ui/pagination.tsx";

// TODO pagination https://www.tarkui.com/components/react/pagination/
// pnpm dlx shadcn@latest add https://tarkui.com/r/r/18/3.json

export type { TanstackTable };

const i18nDefaults = {
	emptyText: "No results found.",
	errorText: "An error occured.",
	selectedRows: "{{count}} selected",
};
const NULL_PLACEHOLDER = "-";

export interface DataTableProps<TData>
	extends Omit<
		TableOptions<TData>,
		"getCoreRowModel" | "columns" | "data" | "meta"
	> {
	className?: string;
	data: readonly TData[];
	/**
	 * https://github.com/TanStack/table/issues/4382
	 * https://github.com/TanStack/table/issues/4241
	 * @description we need to specify `as ColumnDef<TData>[]` because of these
	 */
	columns?: ColumnDef<TData>[];
	header?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
	footer?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
	top?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
	bottom?: ReactNode | ((props: TanstackTable<TData>) => ReactNode);
	emptyState?: ReactNode;
	bulkActions?: ReactNode;
	isLoading?: boolean;
	hasError?: boolean;
	onRowClick?: (row: Row<TData>) => void;
	contained?: boolean;
	getTableRef?: (table: TanstackTable<TData>) => void;
	tableRef?: Ref<TanstackTable<TData>>;
	onTableStateChange?: (state: TableState, prevState: TableState) => void;
	i18n?: typeof i18nDefaults.__prop;
	meta?: Partial<TableMeta<TData>>;
	stickyPagination?: boolean;
	stickyHeader?: boolean;
	ExpandedRow?: (props: { row: Row<TData> }) => ReactNode;
}

const classes = tableRecipe({ stickyHeader: true });
export function DataTable<TData>(props: DataTableProps<TData>) {
	const {
		className,
		columns = [],
		data,
		i18n: i18nProp,
		rowCount,
		stickyHeader = true,
		ExpandedRow,
		...tableProps
	} = props;
	const {
		header,
		footer,
		stickyPagination,
		top,
		bottom,
		emptyState = true,
		hasError,
		isLoading,
		getTableRef,
		tableRef,
		onTableStateChange,
		...tableState
	} = tableProps;
	const {
		state: stateProp,
		initialState,
		onRowClick,
		enableRowSelection = false,
		meta: metaProp,
		...tableOptions
	} = tableState;

	const [sorting, setSorting] = useState<SortingState>(
		initialState?.sorting ?? [],
	);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
		initialState?.columnFilters ?? [],
	);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
		initialState?.columnVisibility ?? {},
	);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>(
		initialState?.rowSelection ?? {},
	);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: initialState?.pagination?.pageIndex ?? 0,
		pageSize: initialState?.pagination?.pageSize ?? 25,
	});
	// const meta = useContext(DataTableMetaContext);

	const table = useReactTable({
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: tableOptions.manualPagination
			? undefined
			: getPaginationRowModel(),
		getSortedRowModel: tableOptions.manualSorting
			? undefined
			: getSortedRowModel(),
		getFilteredRowModel: tableOptions.manualFiltering
			? undefined
			: getFilteredRowModel(),
		getExpandedRowModel: tableOptions.manualExpanding
			? undefined
			: getExpandedRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		onPaginationChange: setPagination,
		renderFallbackValue: NULL_PLACEHOLDER,
		rowCount,
		getRowId: (row) => (row as { id: string }).id,
		...tableOptions,
		data: data as TData[],
		columns,
		initialState: initialState,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			pagination,
			...stateProp,
		},
		meta: {
			// ...(meta as TableMeta<TData>),
			...metaProp,
		},
	});

	useEffect(() => {
		getTableRef?.(table);
	}, [getTableRef, table]);

	useImperativeHandle(tableRef, () => table, [table]);

	const state = table.getState();
	const prevStateRef = useRef<TableState>(state);
	useEffect(() => {
		onTableStateChange?.(state, prevStateRef.current);
		prevStateRef.current = state;
	}, [state, onTableStateChange]);

	const defaults = table._getDefaultColumnDef();
	const i18n = i18nDefaults.merge(i18nDefaults.defaults, i18nProp);

	const selectedRowsCount = table.getSelectedRowModel().rows.length;
	const hasSelectedRows = selectedRowsCount > 0;

	return (
		<>
			{runIfFn(top, table)}
			{runIfFn(header, table)}
			<div
				className={cx(
					className,
					css({
						display: "block",
						whiteSpace: "nowrap",
						WebkitOverflowScrolling: "touch",
						overflow: "auto",
						maxWidth: "100%",
					}),
				)}
			>
				<table className={classes.root}>
					<thead className={classes.header}>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr
								key={headerGroup.id}
								className={cx(classes.row, css({ borderBottom: "none" }))}
							>
								{headerGroup.headers.map((header, _index) => {
									const size = header.column.getSize();
									const style =
										size && size !== defaults.size
											? { minWidth: size }
											: undefined;
									const hasBulkActions =
										hasSelectedRows && headerGroup.headers.at(-1) === header;
									const column = header.column;
									const isSorted = column.getIsSorted();

									return (
										<th
											className={cx(
												classes.columnHeader,
												css({
													textAlign: hasBulkActions ? "right" : undefined,
												}),
											)}
											key={header.id}
											style={style}
										>
											{header.isPlaceholder ? null : column.getCanSort() &&
												column.columnDef.enableSorting ? (
												<Button
													variant="ghost"
													size="sm"
													onClick={column.getToggleSortingHandler()}
													data-test-id={`table-sort-${column.id}`}
													marginLeft="-2.5"
													opacity={isSorted ? 1 : 0.55}
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
													{isSorted === "desc" ? (
														<LuArrowDown />
													) : isSorted === "asc" ? (
														<LuArrowUp />
													) : (
														<LuChevronsUpDown />
													)}
												</Button>
											) : (
												flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)
											)}
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					{isLoading ? (
						<tbody className={classes.body}>
							{Array(pagination.pageSize)
								.fill(pagination.pageSize)
								.map((_, index) => (
									<tr className={classes.row} key={index} data-skeleton>
										{table.getAllColumns().map((cell) => (
											<td key={cell.id} className={classes.cell}>
												<Skeleton width="100%" height="12" />
											</td>
										))}
									</tr>
								))}
						</tbody>
					) : (
						<tbody className={classes.body}>
							{table.getRowModel().rows.length ? (
								table
									.getRowModel()
									.rows.map((row, index) => (
										<TableRow
											key={row.id}
											index={index}
											getRow={() => row}
											onRowClick={onRowClick}
											classes={classes}
											ExpandedRow={ExpandedRow}
										/>
									))
							) : (
								<tr>
									{emptyState ? (
										<td
											className={cx(classes.cell, css({ textAlign: "center" }))}
											colSpan={columns.length}
										>
											{typeof emptyState === "boolean" ? (
												<Flex
													gap="4"
													flexDirection="column"
													justifyContent="center"
													alignItems="center"
												>
													<span>
														{hasError ? i18n.errorText : i18n.emptyText}
													</span>
												</Flex>
											) : (
												emptyState
											)}
										</td>
									) : null}
								</tr>
							)}
						</tbody>
					)}
				</table>
			</div>
			{tableOptions.manualPagination
				? null
				: (data.length >= pagination.pageSize || pagination.pageSize > 100) && (
						<LimitAndPagination
							table={table}
							pageSize={pagination.pageSize}
							pageIndex={pagination.pageIndex}
							setPagination={setPagination}
							manualPagination={tableOptions.manualPagination}
							onPaginationChange={tableOptions.onPaginationChange}
						/>
					)}
			{runIfFn(bottom, table)}
		</>
	);
}

const fallbackRender = (props: FallbackProps) => {
	console.log(props);
	return "an error happened" as unknown as JSX.Element;
};

const TableCell = memo(function TableCell({
	cell,
	index,
}: {
	cell: Cell<any, any>;
	index: number;
	isExpanded: boolean;
}) {
	return (
		<td
			className={classes.cell}
			data-testid={`cell-${index}-${cell.column.id}`}
		>
			<ErrorBoundary fallbackRender={fallbackRender} key={cell.id}>
				{flexRender(cell.column.columnDef.cell, cell.getContext())}
			</ErrorBoundary>
		</td>
	);
});

const TableRow = memo(function TableRow({
	index,
	getRow,
	onRowClick,
	classes,
	ExpandedRow,
}: {
	index: number;
	getRow: () => Row<any>;
	onRowClick?: (row: Row<any>) => void;
	classes: any;
	ExpandedRow?: (props: { row: Row<any> }) => ReactNode;
}) {
	const row = getRow();
	const visibleCells = row.getVisibleCells();
	return (
		<Fragment>
			<tr
				className={
					(cx(classes.row, onRowClick ? "hoverable" : undefined),
					css({ bg: "bg.panel" }))
				}
				data-testid={`row-${index}`}
				data-state={row.getIsSelected() && "selected"}
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
				{row.getVisibleCells().map((cell, cellIndex) => (
					<TableCell
						key={cell.id}
						cell={cell}
						index={cellIndex}
						isExpanded={row.getIsExpanded()}
					/>
				))}
			</tr>
			{row.getIsExpanded() && ExpandedRow && (
				<tr
					className={cx(classes.row, onRowClick ? "hoverable" : undefined)}
					data-testid={`row-${index}-subrow`}
					data-state={row.getIsSelected() && "selected"}
				>
					<td className={classes.cell} colSpan={visibleCells.length}>
						<ErrorBoundary fallbackRender={fallbackRender}>
							<ExpandedRow row={row} />
						</ErrorBoundary>
					</td>
				</tr>
			)}
		</Fragment>
	);
});

const LimitAndPagination = memo(
	(
		props: {
			table: TanstackTable<any>;
			setPagination: Dispatch<SetStateAction<PaginationState>>;
		} & Pick<PaginationState, "pageIndex" | "pageSize"> &
			Pick<TableOptions<any>, "manualPagination" | "onPaginationChange">,
	) => {
		const {
			table,
			pageIndex,
			pageSize,
			setPagination,
			manualPagination,
			onPaginationChange,
		} = props;
		return (
			<Flex marginLeft="auto" my="4" justifyContent="flex-end">
				<PageLimitSelect
					portalled={false}
					value={[pageSize.toString()]}
					onValueChange={(details) => {
						setPagination({
							pageIndex: pageIndex,
							pageSize: Number(details.value) as never,
						});
					}}
				/>
				<DataTablePagination
					table={table}
					onPaginationChange={
						manualPagination && onPaginationChange
							? (pageIndex, pageSize) =>
									onPaginationChange?.({
										pageIndex,
										pageSize,
									})
							: (e) =>
									setPagination({
										pageIndex: e,
										pageSize: pageSize,
									})
					}
				/>
			</Flex>
		);
	},
);

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

interface DataTablePaginationProps<TData = unknown> {
	table: TanstackTable<TData>;
	onPaginationChange?: (pageIndex: number, pageSize: number) => void;
}

function DataTablePagination<TData>(props: DataTablePaginationProps<TData>) {
	const { table, onPaginationChange } = props;
	const state = table.getState();
	const rowCount = table.getRowCount();
	const { pageIndex, pageSize } = state.pagination;

	return (
		<Pagination
			page={pageIndex + 1}
			count={rowCount}
			pageSize={pageSize}
			onPageChange={(e) => {
				console.log(e);
				onPaginationChange?.(e.page - 1, pageSize);
			}}
		>
			<HStack>
				<PaginationPrevTrigger />
				<PaginationContext>
					{({ pages }) =>
						pages.map((page, index) =>
							page.type === "page" ? (
								<PaginationItem key={index} {...page} />
							) : (
								<PaginationEllipsis key={index} index={index} />
							),
						)
					}
				</PaginationContext>
				<PaginationNextTrigger />
			</HStack>
		</Pagination>
	);
}
