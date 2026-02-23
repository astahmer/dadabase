import { Portal, useListCollection } from "@ark-ui/react";
import { useFilter } from "@ark-ui/react/locale";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "#src/components/ui/button";
import { Stack } from "#src/components/ui/layout.tsx";
import { ListboxMenu } from "#src/components/ui/listbox-menu.export.ts";

interface RowsPerPageSelectorProps {
	value: number;
	onValueChange: (newLimit: number) => void;
}

const items = [
	{ label: "50", value: 50 },
	{ label: "100", value: 100 },
	{ label: "250", value: 250 },
	{ label: "500", value: 500 },
];

export function RowsPerPageSelector({
	value,
	onValueChange,
}: RowsPerPageSelectorProps) {
	const [open, setOpen] = useState(false);

	const filters = useFilter({ sensitivity: "base" });
	const list = useListCollection({
		initialItems: items,
		filter: filters.contains,
	});

	const filteredItems = list.collection.items;

	const handleSelect = (newValue: number) => {
		onValueChange(newValue);
		setOpen(false);
	};

	return (
		<ListboxMenu.ListboxMenuRoot
			open={open}
			onOpenChange={(e) => setOpen(e.open)}
		>
			<ListboxMenu.ListboxMenuTrigger size="sm" asChild>
				<Button
					variant="outline"
					className="flex flex-1 items-center justify-between gap-5 bg-transparent px-3 py-2 outline-none outline-hidden placeholder:text-muted-foreground/70 has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 data-placeholder-shown:text-muted-foreground"
				>
					<span className="text-sm font-medium text-foreground">{value}</span>
					<ChevronDownIcon className="size-4 shrink-0 in-aria-invalid:text-destructive/80 text-muted-foreground/80" />
				</Button>
			</ListboxMenu.ListboxMenuTrigger>
			<Portal>
				<ListboxMenu.ListboxMenuContent>
					<ListboxMenu.ListboxRoot collection={list.collection}>
						<ListboxMenu.ListboxMenuFilterContainer>
							<Stack>
								<ListboxMenu.ListboxMenuFilterInput
									placeholder="Use a custom value"
									autoFocus
									type="number"
									// onChange={(e) => {
									// 	list.filter(e.target.value);
									// }}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											const target = e.target as HTMLInputElement;
											const exits = list.collection.items.some(
												(item) => item.value === target.valueAsNumber,
											);
											if (
												exits ||
												target.valueAsNumber < 1 ||
												target.valueAsNumber > 1000
											) {
												setOpen(false);
												return;
											}

											const insertAfterIndex = list.collection.items.findIndex(
												(item) => item.value > target.valueAsNumber,
											);
											list.insert(
												insertAfterIndex === -1
													? list.collection.items.length
													: insertAfterIndex,
												{
													label: target.value,
													value: target.valueAsNumber,
												},
											);
											handleSelect(target.valueAsNumber);
										}
									}}
								/>
								<span className="text-xs text-muted-foreground">Max: 1000</span>
							</Stack>
						</ListboxMenu.ListboxMenuFilterContainer>
						<ListboxMenu.ListboxMenuList>
							{filteredItems.length > 0 ? (
								<ListboxMenu.ListboxMenuItemGroup>
									{filteredItems.map(
										(item: { label: string; value: number }) => (
											<ListboxMenu.ListboxMenuItem
												key={item.value}
												item={item}
												onClick={() => handleSelect(item.value)}
												showIndicator={item.value === value}
											>
												{item.label}
											</ListboxMenu.ListboxMenuItem>
										),
									)}
								</ListboxMenu.ListboxMenuItemGroup>
							) : (
								<ListboxMenu.ListboxMenuEmpty>
									No items found
								</ListboxMenu.ListboxMenuEmpty>
							)}
						</ListboxMenu.ListboxMenuList>
					</ListboxMenu.ListboxRoot>
				</ListboxMenu.ListboxMenuContent>
			</Portal>
		</ListboxMenu.ListboxMenuRoot>
	);
}
