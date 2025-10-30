import type { Cell, Row, Table as TanstackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Fragment, memo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { PageLimitSelect } from "./page-limit.select.tsx";
import { runIfFn } from "./run-if-fn.ts";

const i18n = {
	emptyText: "No results found.",
	errorText: "An error occurred.",
};

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
	stickyPagination?: boolean;
	stickyHeader?: boolean;
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
				className={`overflow-x-auto overflow-y-hidden max-w-full ${className || ""}`}
			>
				<table className="w-full border-collapse">
					<thead className={stickyHeader ? "sticky top-0 bg-white" : ""}>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id} className="border-b">
								{headerGroup.headers.map((header) => {
									const size = header.column.getSize();
									const style =
										size && size !== 150 ? { minWidth: size } : undefined;
									const hasBulkActions =
										hasSelectedRows && headerGroup.headers.at(-1) === header;
									const column = header.column;
									const isSorted = column.getIsSorted();

									return (
										<th
											className={`px-4 py-2 text-left font-semibold ${
												hasBulkActions ? "text-right" : ""
											}`}
											key={header.id}
											style={style}
										>
											{header.isPlaceholder ? null : column.getCanSort() &&
												column.columnDef.enableSorting ? (
												<button
													onClick={column.getToggleSortingHandler()}
													data-test-id={`table-sort-${column.id}`}
													className="inline-flex items-center gap-2 hover:opacity-100 opacity-55 transition-opacity"
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
													{isSorted === "desc" ? (
														<span>↓</span>
													) : isSorted === "asc" ? (
														<span>↑</span>
													) : (
														<span>↕</span>
													)}
												</button>
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
						<tbody>
							{Array(pagination.pageSize)
								.fill(pagination.pageSize)
								.map((_, index) => (
									<tr className="border-b" key={index} data-skeleton>
										{columns.map((col) => (
											<td key={col.id} className="px-4 py-2">
												<div className="h-3 bg-gray-200 rounded animate-pulse" />
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
											ExpandedRow={ExpandedRow}
										/>
									))
							) : (
								<tr>
									{emptyState ? (
										<td
											className="px-4 py-8 text-center"
											colSpan={columns.length}
										>
											<div className="flex flex-col gap-4 justify-center items-center">
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
}: {
	cell: Cell<any, any>;
	index: number;
	isExpanded: boolean;
}) {
	return (
		<td className="px-4 py-2" data-testid={`cell-${index}-${cell.column.id}`}>
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
	ExpandedRow,
}: {
	index: number;
	getRow: () => Row<any>;
	onRowClick?: (row: Row<any>) => void;
	ExpandedRow?: (props: { row: Row<any> }) => ReactNode;
}) {
	const row = getRow();
	const visibleCells = row.getVisibleCells();

	return (
		<Fragment>
			<tr
				className={`border-b ${
					onRowClick ? "hover:bg-gray-50 cursor-pointer" : ""
				} ${row.getIsSelected() ? "bg-blue-50" : "bg-white"}`}
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
				{visibleCells.map((cell, cellIndex) => (
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
					className={`border-b ${row.getIsSelected() ? "bg-blue-50" : ""}`}
					data-testid={`row-${index}-subrow`}
					data-state={row.getIsSelected() && "selected"}
				>
					<td className="px-4 py-2" colSpan={visibleCells.length}>
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
					className="px-2 py-1 border rounded disabled:opacity-50"
				>
					Prev
				</button>
				<span className="text-sm">
					Page {pageIndex + 1} of {Math.ceil(rowCount / pageSize)}
				</span>
				<button
					onClick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
					className="px-2 py-1 border rounded disabled:opacity-50"
				>
					Next
				</button>
			</div>
		</div>
	);
}
