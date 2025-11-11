import { useVirtualizer } from "@tanstack/react-virtual";
import type { Row } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Fragment, memo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { flexRender } from "@tanstack/react-table";
import type { DataTableSize } from "./data-table";
import { tableCellStyles, tableRowStyles } from "./data-table.styles";
import { RowContextMenu } from "./row-context-menu.tsx";

const fallbackRender = () => "An error happened";

export interface VirtualizedTableBodyProps<TData> {
	rows: Row<TData>[];
	onRowClick?: (row: Row<TData>) => void;
	size: DataTableSize;
	striped: boolean;
	interactive: boolean;
	showColumnBorder: boolean;
	withContextMenu: boolean;
	ExpandedRow?: (props: { row: Row<TData> }) => ReactNode;
	onExpandRowJson?: (row: Record<string, unknown>) => void;
	estimateItemSize?: number;
	overscan?: number;
	scrollElement: HTMLDivElement;
}

export function VirtualizedTableBody<TData>({
	rows,
	onRowClick,
	size,
	striped,
	interactive,
	showColumnBorder,
	withContextMenu,
	ExpandedRow,
	onExpandRowJson,
	estimateItemSize = 35,
	overscan,
	scrollElement,
}: VirtualizedTableBodyProps<TData>) {
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollElement,
		estimateSize: () => estimateItemSize,
		overscan,
	});

	const virtualRows = virtualizer.getVirtualItems();
	const totalSize = virtualizer.getTotalSize();

	const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
	const paddingBottom =
		virtualRows.length > 0
			? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
			: 0;

	return (
		<>
			{paddingTop > 0 && (
				<tr>
					<td style={{ height: `${paddingTop}px` }} />
				</tr>
			)}
			{virtualRows.map((virtualRow) => {
				const row = rows[virtualRow.index];
				if (!row) return null;

				return (
					<TableRow
						key={row.id}
						index={virtualRow.index}
						getRow={() => row}
						onRowClick={onRowClick}
						size={size}
						striped={striped}
						interactive={interactive}
						showColumnBorder={showColumnBorder}
						withContextMenu={withContextMenu}
						ExpandedRow={ExpandedRow}
						onExpandRowJson={onExpandRowJson}
					/>
				);
			})}
			{paddingBottom > 0 && (
				<tr>
					<td style={{ height: `${paddingBottom}px` }} />
				</tr>
			)}
		</>
	);
}

const TableCell = memo(function TableCell({
	cell,
	index,
	size,
	showColumnBorder,
}: {
	cell: any;
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
