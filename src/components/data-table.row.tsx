import {
	horizontalListSortingStrategy,
	SortableContext,
} from "@dnd-kit/sortable";
import type { Row } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Fragment, memo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { DataTableCell } from "./data-table.cell.tsx";
import {
	tableCellStyles,
	tableRowStyles,
	type DataTableSize,
} from "./data-table.styles.ts";
import { RowContextMenu } from "./row-context-menu";

const fallbackRender = () => "An error happened";

export const DataTableRow = memo(function TableRow({
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
	enableColumnOrdering,
	columnOrder = [],
}: {
	index: number;
	getRow: () => Row<any>;
	onRowClick?: (row: Row<any>) => void;
	size: DataTableSize;
	striped: boolean;
	interactive: boolean;
	showColumnBorder: boolean;
	withContextMenu: boolean;
	enableColumnOrdering: boolean;
	columnOrder?: string[];
	ExpandedRow?: (props: { row: Row<any> }) => ReactNode;
	onExpandRowJson?: (row: Record<string, unknown>) => void;
}) {
	const row = getRow();
	const visibleCells = row.getVisibleCells();
	const isSelected = row.getIsSelected();

	const ContextMenu = withContextMenu ? RowContextMenu : Fragment;

	const CellsList = visibleCells.map((cell, cellIndex) => (
		<DataTableCell
			key={cell.id}
			cell={cell}
			index={cellIndex}
			isExpanded={row.getIsExpanded()}
			size={size}
			showColumnBorder={showColumnBorder}
			enableColumnOrdering={enableColumnOrdering}
		/>
	));

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
