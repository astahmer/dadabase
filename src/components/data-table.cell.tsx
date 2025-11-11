import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Cell } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import type { CSSProperties } from "react";
import { memo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { getCommonPinningStyles } from "../lib/get-pinning-styles.ts";
import { tableCellStyles, type DataTableSize } from "./data-table.styles.ts";

const fallbackRender = () => "An error happened";

export const DataTableCell = memo(function TableCell({
	cell,
	index,
	size,
	showColumnBorder,
	enableColumnOrdering,
}: {
	cell: Cell<any, any>;
	index: number;
	isExpanded: boolean;
	size: DataTableSize;
	showColumnBorder: boolean;
	enableColumnOrdering: boolean;
}) {
	const columnSize = cell.column.getSize();
	const textAlign = (cell.column.columnDef.meta as any)?.textAlign || "left";

	const isDragDisabled =
		(cell.column.columnDef.meta as any)?.enableColumnOrdering === false ||
		Boolean(cell.column.getIsPinned());

	const sortable = useSortable({
		id: cell.column.id,
		disabled: isDragDisabled,
	});

	if (enableColumnOrdering && !isDragDisabled) {
		const dragStyle: CSSProperties = {
			opacity: sortable.isDragging ? 0.5 : 1,
			position: "relative",
			transform: CSS.Translate.toString(sortable.transform), // translate instead of transform to avoid squishing
			transition: "width transform 0.2s ease-in-out",
			width: cell.column.getSize(),
			zIndex: sortable.isDragging ? 1 : 0,
		};
		return (
			<td
				ref={sortable.setNodeRef}
				className={tableCellStyles({ size, showColumnBorder, textAlign })}
				data-testid={`cell-${index}-${cell.column.id}`}
				style={{
					width: `${columnSize}px`,
					...dragStyle,
				}}
			>
				<ErrorBoundary fallbackRender={fallbackRender}>
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</ErrorBoundary>
			</td>
		);
	}

	return (
		<td
			className={tableCellStyles({ size, showColumnBorder, textAlign })}
			data-testid={`cell-${index}-${cell.column.id}`}
			style={{
				width: `${columnSize}px`,
				...getCommonPinningStyles(cell.column),
			}}
		>
			<ErrorBoundary fallbackRender={fallbackRender}>
				{flexRender(cell.column.columnDef.cell, cell.getContext())}
			</ErrorBoundary>
		</td>
	);
});
