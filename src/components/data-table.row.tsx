import {
	horizontalListSortingStrategy,
	SortableContext,
} from "@dnd-kit/sortable";
import { flexRender, type Row } from "@tanstack/react-table";
import type { PropsWithChildren, ReactNode } from "react";
import { Fragment, memo, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { RelationshipMetadata } from "../types/relationships";
import { DataTableCell } from "./data-table.cell.tsx";
import {
	tableCellStyles,
	tableRowStyles,
	type DataTableSize,
} from "./data-table.styles.ts";
import { RowContextMenu } from "./row-context-menu";
import { getColumnPinningStyles } from "#src/lib/get-pinning-styles.ts";

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
	expandedRelationships,
	relationships,
	RelationshipSubrowComponent,
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
	// TODO rm
	expandedRelationships?: Set<string>; // Set of constraintNames that are expanded
	relationships?: RelationshipMetadata[]; // Available relationships for this row
	RelationshipSubrowComponent?: (props: {
		relationship: RelationshipMetadata;
		parentRowValue: unknown;
	}) => ReactNode;
}) {
	const row = getRow();
	const visibleCells = row.getVisibleCells();
	const isSelected = row.getIsSelected();
	const isExpanded = row.getIsExpanded();

	const ContextMenu = withContextMenu
		? RowContextMenu
		: (props: PropsWithChildren) => (
				<div className="contents">{props.children}</div>
			);

	const CellsList = useMemo(() => {
		return visibleCells.map((cell, cellIndex) => {
			const isPinned = Boolean(cell.column.getIsPinned());
			const isDragDisabled =
				(cell.column.columnDef.meta as any)?.enableColumnOrdering === false ||
				isPinned;
			const textAlign =
				(cell.column.columnDef.meta as any)?.textAlign || "left";

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
					style={isPinned ? getColumnPinningStyles(cell.column) : undefined}
				>
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</DataTableCell>
			);
		});
	}, [visibleCells, isSelected, isExpanded]);

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
			{/* TODO rm */}
			{/* Relationship subrows */}
			{expandedRelationships &&
				relationships?.map((rel) => {
					if (!expandedRelationships.has(rel.constraintName)) {
						return null;
					}

					return (
						<tr
							key={`${row.id}_rel_${rel.constraintName}`}
							className="bg-muted/20 border-b border-border"
							data-relationship-id={rel.constraintName}
						>
							<td colSpan={visibleCells.length} className="p-0">
								<ErrorBoundary fallbackRender={fallbackRender}>
									{RelationshipSubrowComponent && (
										<RelationshipSubrowComponent
											relationship={rel}
											parentRowValue={row.original[rel.referencedColumn]}
										/>
									)}
								</ErrorBoundary>
							</td>
						</tr>
					);
				})}
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
