import type { Column } from "@tanstack/react-table";
import type { CSSProperties } from "react";

export function getPinningStyles(input: {
	isPinned: "left" | "right" | false;
	isLastLeftPinnedColumn: boolean;
	isFirstRightPinnedColumn: boolean;
	columnStartLeft: number;
	columnAfterRight: number;
	columnSize: number;
}): CSSProperties {
	const { isPinned, isLastLeftPinnedColumn, isFirstRightPinnedColumn } = input;

	return {
		backgroundColor: isPinned ? "var(--color-background)" : undefined,
		boxShadow: isLastLeftPinnedColumn
			? "-4px 0 4px -4px gray inset"
			: isFirstRightPinnedColumn
				? "4px 0 4px -4px gray inset"
				: undefined,
		left: isPinned === "left" ? `${input.columnStartLeft}px` : undefined,
		right: isPinned === "right" ? `${input.columnAfterRight}px` : undefined,
		opacity: isPinned ? 0.95 : 1,
		position: isPinned ? "sticky" : ("relative" as const),
		width: input.columnSize,
		zIndex: isPinned ? 10 : 0,
	};
}

export function getColumnPinningStyles<TData>(
	column: Column<TData>,
): CSSProperties {
	const isPinned = column.getIsPinned();
	const isLastLeftPinnedColumn =
		isPinned === "left" && column.getIsLastColumn("left");
	const isFirstRightPinnedColumn =
		isPinned === "right" && column.getIsFirstColumn("right");

	return getPinningStyles({
		isPinned,
		isLastLeftPinnedColumn,
		isFirstRightPinnedColumn,
		columnSize: column.getSize(),
		columnStartLeft: column.getStart("left"),
		columnAfterRight: column.getAfter("right"),
	});
}
