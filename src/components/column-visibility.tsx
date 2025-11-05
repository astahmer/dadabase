import { useState } from "react";
import type { Table as TanstackTable } from "@tanstack/react-table";
import { Combobox, useListCollection } from "@ark-ui/react/combobox";
import { useFilter } from "@ark-ui/react/locale";
import { Portal } from "@ark-ui/react/portal";
import { Button } from "./ui/button";
import { ChevronsUpDown } from "lucide-react";

export interface ColumnVisibilityControlsProps<TData> {
	table: TanstackTable<TData>;
	minimal?: boolean;
}

export function ColumnVisibilityControls<TData>(
	props: ColumnVisibilityControlsProps<TData>,
) {
	const { table, minimal = false } = props;
	const [isOpen, setIsOpen] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const { contains } = useFilter({ sensitivity: "base" });

	const columns = table
		.getAllLeafColumns()
		.filter((col) => col.getCanHide?.())
		.map((col) => ({
			label: (col.columnDef.header as string) || col.id,
			value: col.id,
		}));

	const { collection, filter } = useListCollection({
		initialItems: columns,
		filter: contains,
	});

	const handleInputChange = (details: Combobox.InputValueChangeDetails) => {
		setInputValue(details.inputValue);
		filter(details.inputValue);
	};

	const buttonClassName = minimal
		? "h-8 px-2 gap-1 justify-between"
		: "w-48 h-9 justify-between";

	const containerClassName = minimal
		? "flex items-center gap-2"
		: "px-4 py-2 border-b bg-muted/30 flex items-center gap-2";

	return (
		<div className={containerClassName}>
			<Combobox.Root
				collection={collection}
				onInputValueChange={handleInputChange}
				inputValue={inputValue}
				open={isOpen}
				onOpenChange={(details) => setIsOpen(details.open)}
				closeOnSelect={false}
			>
				<Combobox.Control>
					<Button
						variant="outline"
						size="sm"
						className={buttonClassName}
						onClick={() => setIsOpen(!isOpen)}
					>
						<span className="text-xs font-medium text-foreground uppercase tracking-wide">
							📋 Columns
						</span>
						<ChevronsUpDown className="h-4 w-4 opacity-50" />
					</Button>
				</Combobox.Control>
				<Portal>
					<Combobox.Positioner>
						<Combobox.Content className="bg-card border border-border rounded-md shadow-lg z-50 min-w-48">
							<div className="p-2 border-b">
								<Combobox.Input
									placeholder="Filter columns..."
									className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
									autoFocus
								/>
							</div>
							<div className="p-2 max-h-64 overflow-y-auto">
								<Combobox.ItemGroup>
									{collection.items.length > 0 ? (
										collection.items.map((item) => {
											const column = table.getColumn(item.value);
											const isVisible = column?.getIsVisible?.() ?? true;

											return (
												<Combobox.Item
													key={item.value}
													item={item}
													className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted data-highlighted:bg-accent transition-colors"
													onClick={(e) => {
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
													<Combobox.ItemText className="flex-1">
														{item.label}
													</Combobox.ItemText>
												</Combobox.Item>
											);
										})
									) : (
										<div className="px-2 py-2 text-xs text-muted-foreground text-center">
											No columns found
										</div>
									)}
								</Combobox.ItemGroup>
							</div>
						</Combobox.Content>
					</Combobox.Positioner>
				</Portal>
			</Combobox.Root>
		</div>
	);
}
