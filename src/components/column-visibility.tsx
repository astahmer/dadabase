import { useListCollection } from "@ark-ui/react";
import { Listbox } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import type { Table as TanstackTable } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";

export interface ColumnVisibilityControlsProps<TData> {
	table: TanstackTable<TData>;
	columnList: string[];
	minimal?: boolean;
}

export function ColumnVisibilityControls<TData>(
	props: ColumnVisibilityControlsProps<TData>,
) {
	const { table, minimal = false } = props;
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);

	const allColumns = useMemo(
		() =>
			props.columnList.map((col) => {
				const tableCol = table.getColumn(col);
				return {
					label: (tableCol?.columnDef.header as string | undefined) || col,
					value: col,
				};
			}),
		[props.columnList],
	);

	const visibleCount = useMemo(
		() =>
			allColumns.reduce((acc, col) => {
				const tableCol = table.getColumn(col.value);
				return acc + ((tableCol?.getIsVisible?.() ?? true) ? 1 : 0);
			}, 0),
		[allColumns, table],
	);
	const allVisible = visibleCount === allColumns.length;

	const handleSelectAll = () => {
		allColumns.forEach((col) => {
			const column = table.getColumn(col.value);
			const isVisible = column?.getIsVisible?.() ?? true;
			if (allVisible && isVisible) {
				// Unselect all
				column?.toggleVisibility?.(false);
			} else if (!allVisible && !isVisible) {
				// Select all
				column?.toggleVisibility?.(true);
			}
		});
	};

	const filters = useFilter({ sensitivity: "base" });
	const list = useListCollection({
		initialItems: allColumns,
		filter: filters.contains,
	});

	const buttonClassName = minimal
		? "h-8 px-2 gap-1 justify-between"
		: "w-48 h-9 justify-between";

	const containerClassName = minimal
		? "flex items-center gap-2"
		: "px-4 py-2 border-b bg-muted/30 flex items-center gap-2";

	return (
		<div className={containerClassName}>
			<Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
				<Popover.Trigger asChild>
					<Button
						ref={triggerRef}
						variant="outline"
						size="sm"
						className={buttonClassName}
					>
						<span className="text-xs font-medium text-foreground uppercase tracking-wide">
							📋 Columns{" "}
							{allVisible ? "" : `(${visibleCount}/${allColumns.length})`}
						</span>
						<ChevronsUpDown className="h-4 w-4 opacity-50" />
					</Button>
				</Popover.Trigger>
				<Portal>
					<Popover.Positioner>
						<Popover.Content className="bg-card border border-border rounded-md shadow-lg z-50">
							<Listbox.Root collection={list.collection}>
								<div className="p-2 border-b border-border space-y-2">
									<Button
										size="sm"
										variant="outline"
										className="w-full text-xs h-7"
										onClick={handleSelectAll}
									>
										{allVisible ? "Unselect All" : "Select All"}
									</Button>
									<input
										placeholder="Filter columns..."
										className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
										autoFocus
										onChange={(e) => {
											list.filter(e.target.value);
										}}
									/>
								</div>
								<Listbox.Content className="max-h-64 overflow-y-auto">
									{list.collection.items.length > 0 ? (
										<Listbox.ItemGroup>
											{list.collection.items.map((item) => {
												const column = table.getColumn(item.value);
												const isVisible = column?.getIsVisible?.() ?? true;

												return (
													<Listbox.Item
														key={item.value}
														item={item}
														className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted data-highlighted:bg-accent transition-colors"
														onClick={(e: React.MouseEvent<HTMLDivElement>) => {
															e.preventDefault();
															e.stopPropagation();
															column?.toggleVisibility?.();
														}}
													>
														<input
															type="checkbox"
															checked={isVisible}
															readOnly
															className="rounded"
														/>
														<Listbox.ItemText className="flex-1">
															{item.label}
														</Listbox.ItemText>
													</Listbox.Item>
												);
											})}
										</Listbox.ItemGroup>
									) : (
										<div className="px-2 py-2 text-xs text-muted-foreground text-center">
											No columns found
										</div>
									)}
								</Listbox.Content>
							</Listbox.Root>
						</Popover.Content>
					</Popover.Positioner>
				</Portal>
			</Popover.Root>
		</div>
	);
}
