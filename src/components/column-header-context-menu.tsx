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
		table.setColumnSizing((prev) => ({
			...prev,
			[column.id]: maxWidth + 8,
		}));
	};

	const handleResizeAllToContent = () => {
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
			// Add padding + 8
			newSizing[col.id] = maxWidth + 8;
		}

		if (Object.keys(newSizing).length > 0) {
			table.setColumnSizing(newSizing);
		}
	};

	const handleCopyColumnValues = async () => {
		const rows = table.getRowModel().rows;
		const values: string[] = [];

		for (const row of rows) {
			const value = row.getValue(column.id);
			if (value !== null && value !== undefined) {
				const stringValue = String(value).trim();
				if (stringValue) {
					values.push(stringValue);
				}
			}
		}

		if (values.length > 0) {
			await navigator.clipboard.writeText(values.join("\n"));
		}
	};

	const canPin = column.getCanPin?.();
	const isPinned = column.getIsPinned?.();

	return (
		<Menu lazyMount>
			<MenuContextTrigger asChild>{children}</MenuContextTrigger>
			<Portal>
				<MenuContent className="z-50">
					{canSort && column.columnDef.enableSorting ? (
						<>
							<MenuItem
								value="sort-asc"
								// toggleSorting with desc=false gives ascending, isMulti=false clears other sorts
								onClick={() => column.toggleSorting(false, false)}
								disabled={isSorted === "asc"}
							>
								<ArrowUp className="size-4" />
								<MenuItemText>Sort ascending</MenuItemText>
							</MenuItem>
							<MenuItem
								value="sort-desc"
								// // toggleSorting with desc=true gives descending, isMulti=false clears other sorts
								onClick={() => column.toggleSorting(true, false)}
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
								onClick={() => column.pin?.("left")}
								disabled={isPinned === "left"}
							>
								<Pin className="size-4" />
								<MenuItemText>Pin to left</MenuItemText>
							</MenuItem>
							<MenuItem
								value="pin-right"
								onClick={() => column.pin?.("right")}
								disabled={isPinned === "right"}
							>
								<Pin className="size-4" />
								<MenuItemText>Pin to right</MenuItemText>
							</MenuItem>
							{isPinned && (
								<MenuItem value="unpin" onClick={() => column.pin?.(false)}>
									<PinOff className="size-4" />
									<MenuItemText>Unpin</MenuItemText>
								</MenuItem>
							)}
							<MenuSeparator />
						</>
					)}

					<MenuItem
						value="copy-column-name"
						onClick={() => navigator.clipboard.writeText(column.id)}
					>
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
											onClick={() => {
												const minSize = column.columnDef.minSize ?? 30;
												table.setColumnSizing((prev) => ({
													...prev,
													[column.id]: minSize,
												}));
											}}
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
											onClick={() => {
												const newSizing: Record<string, number> = {};
												for (const col of table.getAllColumns()) {
													const minSize = col.columnDef.minSize ?? 30;
													newSizing[col.id] = minSize * 2;
												}
												table.setColumnSizing(newSizing);
											}}
										>
											<Columns className="size-4" />
											<MenuItemText>Compact all columns</MenuItemText>
										</MenuItem>
										<MenuSeparator />
										<MenuItem
											value="reset-size"
											onClick={() => column.resetSize()}
										>
											<RotateCcw className="size-4" />
											<MenuItemText>Reset column size</MenuItemText>
										</MenuItem>
										<MenuItem
											value="reset-all-sizes"
											onClick={() => table.resetColumnSizing()}
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
