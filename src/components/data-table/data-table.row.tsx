import {
	horizontalListSortingStrategy,
	SortableContext,
} from "@dnd-kit/sortable";
import { flexRender, type Row } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Fragment, memo, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { getColumnPinningStyles } from "#src/lib/get-pinning-styles.ts";
import { RowContextMenu } from "../app/row-context-menu.tsx";
import { DataTableCell } from "./data-table.cell.tsx";
import type { ColumnVirtualizationState } from "./data-table.column-virtualization.ts";
import {
	type DataTableSize,
	tableCellStyles,
	tableRowStyles,
} from "./data-table.styles.ts";

const fallbackRender = () => "An error happened";

export interface DataTableRowSubrow {
	id: string;
	content: ReactNode;
}

export const DataTableRow = memo(function TableRow({
	index,
	getRow,
	onRowClick,
	size,
	striped,
	interactive,
	showColumnBorder,
	withRowContextMenu,
	ExpandedRow,
	onExpandRowJson,
	enableColumnOrdering,
	columnOrder = [],
	columnVirtualization,
	renderSubrows,
}: {
	index: number;
	getRow: () => Row<any>;
	onRowClick?: (row: Row<any>) => void;
	size: DataTableSize;
	striped: boolean;
	interactive: boolean;
	showColumnBorder: boolean;
	withRowContextMenu?: boolean;
	enableColumnOrdering: boolean;
	columnOrder?: string[];
	columnVirtualization: ColumnVirtualizationState;
	ExpandedRow?: (props: { row: Row<any> }) => ReactNode;
	onExpandRowJson?: (row: Record<string, unknown>) => void;
	renderSubrows?: (row: Row<any>) => DataTableRowSubrow[];
}) {
	const row = getRow();
	const visibleCells = row.getVisibleCells();
	const isSelected = row.getIsSelected();
	const isExpanded = row.getIsExpanded();

	const CellsList = useMemo(() => {
		const renderCell = (
			cell: (typeof visibleCells)[number],
			cellIndex: number,
		) => {
			const isPinned = Boolean(cell.column.getIsPinned());
			const isDragDisabled =
				(cell.column.columnDef.meta as any)?.enableColumnOrdering === false ||
				isPinned;
			const textAlign =
				(cell.column.columnDef.meta as any)?.textAlign || "left";
			const className = (cell.column.columnDef.meta as any)?.className;

			return (
				<DataTableCell
					key={cell.id}
					columnId={cell.column.id}
					columnSize={cell.column.getSize()}
					isDragDisabled={isDragDisabled}
					textAlign={textAlign}
					index={cellIndex}
					isExpanded={isExpanded}
					size={size}
					showColumnBorder={showColumnBorder}
					enableColumnOrdering={enableColumnOrdering}
					className={className}
					style={isPinned ? getColumnPinningStyles(cell.column) : undefined}
				>
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</DataTableCell>
			);
		};

		const leftPinnedCells = visibleCells.filter(
			(c) => c.column.getIsPinned() === "left",
		);
		const rightPinnedCells = visibleCells.filter(
			(c) => c.column.getIsPinned() === "right",
		);
		const centerCells = visibleCells.filter((c) => !c.column.getIsPinned());

		const centerCellByColumnId = new Map(
			centerCells.map((c) => [c.column.id, c]),
		);

		const renderedCenterColumnIds =
			columnVirtualization.enabled === true
				? columnVirtualization.virtualCenterColumnIds
				: centerCells.map((c) => c.column.id);

		let cellIndex = 0;
		const out: ReactNode[] = [];

		for (const cell of leftPinnedCells) {
			out.push(renderCell(cell, cellIndex++));
		}

		if (
			columnVirtualization.enabled === true &&
			columnVirtualization.centerPaddingLeftColSpan > 0
		) {
			out.push(
				<td
					key={`center-padding-left-${row.id}`}
					aria-hidden
					colSpan={columnVirtualization.centerPaddingLeftColSpan}
					className="p-0"
					style={{ width: columnVirtualization.centerPaddingLeftPx }}
				/>,
			);
		}

		for (const columnId of renderedCenterColumnIds) {
			const cell = centerCellByColumnId.get(columnId);
			if (!cell) continue;
			out.push(renderCell(cell, cellIndex++));
		}

		if (
			columnVirtualization.enabled === true &&
			columnVirtualization.centerPaddingRightColSpan > 0
		) {
			out.push(
				<td
					key={`center-padding-right-${row.id}`}
					aria-hidden
					colSpan={columnVirtualization.centerPaddingRightColSpan}
					className="p-0"
					style={{ width: columnVirtualization.centerPaddingRightPx }}
				/>,
			);
		}

		for (const cell of rightPinnedCells) {
			out.push(renderCell(cell, cellIndex++));
		}

		return out;
	}, [
		visibleCells,
		isSelected,
		isExpanded,
		size,
		showColumnBorder,
		enableColumnOrdering,
		columnVirtualization,
		row.id,
	]);

	const MainRow = (
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
			{enableColumnOrdering ? (
				// the sortable context needs to be ABOVE the useSortable usage (inside the DataTableCell)
				<SortableContext
					items={columnOrder}
					strategy={horizontalListSortingStrategy}
				>
					{CellsList}
				</SortableContext>
			) : (
				CellsList
			)}
		</tr>
	);

	return (
		<Fragment>
			{withRowContextMenu ? (
				<RowContextMenu
					row={row.original as Record<string, unknown>}
					onExpandRowJson={onExpandRowJson}
				>
					{MainRow}
				</RowContextMenu>
			) : (
				MainRow
			)}
			{isExpanded && ExpandedRow && (
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
			{/* Custom subrows */}
			{renderSubrows &&
				renderSubrows(row).map((subrow) => (
					<tr
						key={subrow.id}
						className="bg-muted/20 border-b border-border"
						data-testid={`row-${index}-subrow-${subrow.id}`}
					>
						<td colSpan={visibleCells.length} className="p-0">
							<ErrorBoundary fallbackRender={fallbackRender}>
								{subrow.content}
							</ErrorBoundary>
						</td>
					</tr>
				))}
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
