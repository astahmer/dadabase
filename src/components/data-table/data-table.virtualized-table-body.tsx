import type { Row } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ReactNode } from "react";
import { DataTableRow, type DataTableRowSubrow } from "./data-table.row.tsx";
import type { DataTableSize } from "./data-table.styles.ts";

export interface VirtualizedTableBodyProps<TData> {
	rows: Row<TData>[];
	onRowClick?: (row: Row<TData>) => void;
	size: DataTableSize;
	striped: boolean;
	interactive: boolean;
	showColumnBorder: boolean;
	withRowContextMenu?: boolean;
	ExpandedRow?: (props: { row: Row<TData> }) => ReactNode;
	onExpandRowJson?: (row: Record<string, unknown>) => void;
	estimateItemSize?: number;
	overscan?: number;
	scrollElement: HTMLDivElement;
	enableColumnOrdering: boolean;
	columnOrder?: string[];
	renderSubrows?: (row: Row<TData>) => DataTableRowSubrow[];
}

export function VirtualizedTableBody<TData>({
	rows,
	onRowClick,
	size,
	striped,
	interactive,
	showColumnBorder,
	enableColumnOrdering,
	withRowContextMenu,
	ExpandedRow,
	onExpandRowJson,
	estimateItemSize = 35,
	overscan,
	scrollElement,
	columnOrder = [],
	renderSubrows,
}: VirtualizedTableBodyProps<TData>) {
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollElement,
		estimateSize: () => estimateItemSize,
		overscan: overscan ?? 30,
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
					<DataTableRow
						key={virtualRow.key}
						index={virtualRow.index}
						getRow={() => row}
						onRowClick={onRowClick}
						size={size}
						striped={striped}
						interactive={interactive}
						showColumnBorder={showColumnBorder}
						enableColumnOrdering={enableColumnOrdering}
						columnOrder={columnOrder}
						withRowContextMenu={withRowContextMenu}
						ExpandedRow={ExpandedRow}
						onExpandRowJson={onExpandRowJson}
						renderSubrows={renderSubrows}
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
