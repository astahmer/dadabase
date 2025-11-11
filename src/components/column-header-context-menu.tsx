import { Portal } from "@ark-ui/react";
import type { Column, Table } from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	Eye,
	EyeOff,
	Filter,
	Maximize2,
	Minimize2,
} from "lucide-react";
import { ReactNode } from "react";
import {
	Menu,
	MenuContent,
	MenuContextTrigger,
	MenuItem,
	MenuItemText,
	MenuSeparator,
} from "./ui/menu";

export interface ColumnHeaderContextMenuProps<TData = unknown> {
	column: Column<TData>;
	table: Table<TData>;
	children: ReactNode;
	onFilterClick?: (columnId: string) => void;
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

					<MenuItem value="filter" onClick={() => onFilterClick?.(column.id)}>
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

					{column.columnDef.enableResizing !== false && (
						<>
							<MenuSeparator />
							<MenuItem value="fit-content" onClick={handleResizeToContent}>
								<Maximize2 className="size-4" />
								<MenuItemText>Fit to content</MenuItemText>
							</MenuItem>
							<MenuItem value="resize-minimum" onClick={handleResizeToMinimum}>
								<Minimize2 className="size-4" />
								<MenuItemText>Resize to minimum</MenuItemText>
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Portal>
		</Menu>
	);
}
