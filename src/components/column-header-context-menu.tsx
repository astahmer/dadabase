import { Portal } from "@ark-ui/react";
import type { Column, Table } from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	Copy,
	Eye,
	EyeOff,
	Filter,
	Maximize2,
	Minimize2,
	RotateCcw,
	Type,
	Columns,
	Pin,
	PinOff,
} from "lucide-react";
import { ReactNode } from "react";
import {
	Menu,
	MenuContent,
	MenuContextTrigger,
	MenuItem,
	MenuItemText,
	MenuSeparator,
	MenuTriggerItem,
} from "./ui/menu";

export interface ColumnHeaderContextMenuProps<TData = unknown> {
	column: Column<TData>;
	table: Table<TData>;
	children: ReactNode;
	onFilterClick?: (columnId: string, columnName: string) => void;
}

export function ColumnHeaderContextMenu<TData>({
	column,
	table,
	children,
	onFilterClick,
}: ColumnHeaderContextMenuProps<TData>) {
	const canSort = column.getCanSort();
	const isSorted = column.getIsSorted();
	const isVisible = column.getIsVisible();

	const handleSortAsc = () => {
		// toggleSorting with desc=false gives ascending, isMulti=false clears other sorts
		column.toggleSorting(false, false);
	};

	const handleSortDesc = () => {
		// toggleSorting with desc=true gives descending, isMulti=false clears other sorts
		column.toggleSorting(true, false);
	};

	const handleResizeToContent = () => {
		// Get the header element and all visible cells in this column
		const headerElement = document.querySelector(
			`[data-column-id="${column.id}"]`,
		);
		if (!headerElement) return;

		const cells = Array.from(
			document.querySelectorAll(
				`td[style*="width"][data-testid*="-${column.id}"]`,
			),
		);

		if (cells.length === 0) {
			column.resetSize();
			return;
		}

		// Calculate max width from header and all cells
		const measurements = [
			headerElement.scrollWidth,
			...cells.map((cell) => (cell as HTMLElement).scrollWidth),
		];

		const maxWidth = Math.max(...measurements);
		const newSize = maxWidth + 8; // Add padding

		// Update column size via table state
		table.setColumnSizing((prev) => ({
			...prev,
			[column.id]: newSize,
		}));
	};

	const handleResizeToMinimum = () => {
		// Reset to minimum via table state
		const minSize = column.columnDef.minSize ?? 50;
		table.setColumnSizing((prev) => ({
			...prev,
			[column.id]: minSize,
		}));
	};

	const handleResizeAllToContent = () => {
		// Resize all columns to fit their content
		const newSizing: Record<string, number> = {};

		for (const col of table.getAllColumns()) {
			const headerElement = document.querySelector(
				`[data-column-id="${col.id}"]`,
			);
			const cells = Array.from(
				document.querySelectorAll(
					`td[style*="width"][data-testid*="-${col.id}"]`,
				),
			);

			if (!headerElement || cells.length === 0) {
				continue;
			}

			const measurements = [
				headerElement.scrollWidth,
				...cells.map((cell) => (cell as HTMLElement).scrollWidth),
			];

			const maxWidth = Math.max(...measurements);
			newSizing[col.id] = maxWidth + 8; // Add padding
		}

		if (Object.keys(newSizing).length > 0) {
			table.setColumnSizing(newSizing);
		}
	};

	const handleResizeAllToMinimumDouble = () => {
		// Resize all columns to minSize * 2
		const baseMinSize = 50;
		const targetSize = baseMinSize * 2;

		const newSizing = table.getAllColumns().reduce(
			(acc, col) => {
				acc[col.id] = targetSize;
				return acc;
			},
			{} as Record<string, number>,
		);

		table.setColumnSizing(newSizing);
	};

	const handleResetColumnSize = () => {
		// Reset this column to its default size
		column.resetSize();
	};

	const handleCopyColumnName = () => {
		navigator.clipboard.writeText(column.id);
	};

	const handleCopyColumnValues = async () => {
		// Get visible rows from the table and extract the column value
		const rows = table.getRowModel().rows;
		const columnId = column.id;

		const values: string[] = [];
		for (const row of rows) {
			const value = row.getValue(columnId);
			if (value !== null && value !== undefined) {
				const stringValue = String(value).trim();
				if (stringValue) {
					values.push(stringValue);
				}
			}
		}

		if (values.length === 0) return;

		const text = values.join("\n");
		await navigator.clipboard.writeText(text);
	};

	const handleResetAllColumnsSize = () => {
		// Reset all columns to their default size
		table.resetColumnSizing();
	};

	const canPin = column.getCanPin?.();
	const isPinned = column.getIsPinned?.();

	const handlePinLeft = () => {
		column.pin?.("left");
	};

	const handlePinRight = () => {
		column.pin?.("right");
	};

	const handleUnpin = () => {
		column.pin?.(false);
	};

	return (
		<Menu lazyMount>
			<MenuContextTrigger asChild>{children}</MenuContextTrigger>
			<Portal>
				<MenuContent className="z-50">
					{canSort && column.columnDef.enableSorting ? (
						<>
							<MenuItem
								value="sort-asc"
								onClick={handleSortAsc}
								disabled={isSorted === "asc"}
							>
								<ArrowUp className="size-4" />
								<MenuItemText>Sort ascending</MenuItemText>
							</MenuItem>
							<MenuItem
								value="sort-desc"
								onClick={handleSortDesc}
								disabled={isSorted === "desc"}
							>
								<ArrowDown className="size-4" />
								<MenuItemText>Sort descending</MenuItemText>
							</MenuItem>
							{isSorted && (
								<MenuItem
									value="clear-sort"
									onClick={() => column.clearSorting()}
								>
									<MenuItemText>Clear sorting</MenuItemText>
								</MenuItem>
							)}
							<MenuSeparator />
						</>
					) : null}

					<MenuItem
						value="filter"
						onClick={() =>
							onFilterClick?.(
								column.id,
								column.columnDef.header?.toString() ?? column.id,
							)
						}
					>
						<Filter className="size-4" />
						<MenuItemText>Filter column</MenuItemText>
					</MenuItem>

					<MenuSeparator />

					<MenuItem
						value="toggle-visibility"
						onClick={() => column.toggleVisibility()}
					>
						{isVisible ? (
							<Eye className="size-4" />
						) : (
							<EyeOff className="size-4" />
						)}
						<MenuItemText>{isVisible ? "Hide" : "Show"} column</MenuItemText>
					</MenuItem>

					<MenuSeparator />

					{canPin && (
						<>
							<MenuItem
								value="pin-left"
								onClick={handlePinLeft}
								disabled={isPinned === "left"}
							>
								<Pin className="size-4" />
								<MenuItemText>Pin to left</MenuItemText>
							</MenuItem>
							<MenuItem
								value="pin-right"
								onClick={handlePinRight}
								disabled={isPinned === "right"}
							>
								<Pin className="size-4" />
								<MenuItemText>Pin to right</MenuItemText>
							</MenuItem>
							{isPinned && (
								<MenuItem
									value="unpin"
									onClick={handleUnpin}
								>
									<PinOff className="size-4" />
									<MenuItemText>Unpin</MenuItemText>
								</MenuItem>
							)}
							<MenuSeparator />
						</>
					)}

					<MenuItem value="copy-column-name" onClick={handleCopyColumnName}>
						<Type className="size-4" />
						<MenuItemText>Copy column name</MenuItemText>
					</MenuItem>

					<MenuItem value="copy-column-values" onClick={handleCopyColumnValues}>
						<Copy className="size-4" />
						<MenuItemText>Copy column values</MenuItemText>
					</MenuItem>

					{column.columnDef.enableResizing !== false && (
						<>
							<MenuSeparator />
							<Menu
								positioning={{ placement: "right-start", gutter: -2 }}
								lazyMount
							>
								<MenuTriggerItem>
									<Maximize2 className="size-4" />
									Resize...
								</MenuTriggerItem>
								<Portal>
									<MenuContent className="z-50">
										<MenuItem
											value="fit-content"
											onClick={handleResizeToContent}
										>
											<Maximize2 className="size-4" />
											<MenuItemText>Fit to content</MenuItemText>
										</MenuItem>
										<MenuItem
											value="resize-minimum"
											onClick={handleResizeToMinimum}
										>
											<Minimize2 className="size-4" />
											<MenuItemText>Resize to minimum</MenuItemText>
										</MenuItem>
										<MenuSeparator />
										<MenuItem
											value="fit-all-content"
											onClick={handleResizeAllToContent}
										>
											<Maximize2 className="size-4" />
											<MenuItemText>Fit all to content</MenuItemText>
										</MenuItem>
										<MenuItem
											value="resize-all-double"
											onClick={handleResizeAllToMinimumDouble}
										>
											<Columns className="size-4" />
											<MenuItemText>Compact all columns</MenuItemText>
										</MenuItem>
										<MenuSeparator />
										<MenuItem
											value="reset-size"
											onClick={handleResetColumnSize}
										>
											<RotateCcw className="size-4" />
											<MenuItemText>Reset column size</MenuItemText>
										</MenuItem>
										<MenuItem
											value="reset-all-sizes"
											onClick={handleResetAllColumnsSize}
										>
											<Columns className="size-4" />
											<MenuItemText>Reset all to default</MenuItemText>
										</MenuItem>
									</MenuContent>
								</Portal>
							</Menu>
						</>
					)}
				</MenuContent>
			</Portal>
		</Menu>
	);
}
