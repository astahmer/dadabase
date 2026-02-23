import { Button } from "#src/components/ui/button.tsx";
import { ListboxMenu } from "#src/components/ui/listbox-menu.export.ts";
import { createListCollection, useFilter } from "@ark-ui/react";
import { useState } from "react";

export function ListboxMenuExample() {
	const [isOpen, setIsOpen] = useState(false);
	const [filterValue, setFilterValue] = useState("");

	const { contains } = useFilter({ sensitivity: "base" });

	const columnCollection = createListCollection({
		items: [
			"users.id",
			"users.name",
			"users.email",
			"users.created_at",
			"users.updated_at",
		].map((colId) => ({
			label: colId,
			value: colId,
		})),
	});
	const filteredColumns = columnCollection.items.filter((item) =>
		contains(item.value, filterValue),
	);

	return (
		<div>
			<ListboxMenu.ListboxMenuRoot
				open={isOpen}
				onOpenChange={(e) => setIsOpen(e.open)}
			>
				<ListboxMenu.ListboxMenuTrigger asChild>
					<Button variant="outline" size="sm">
						Open
					</Button>
				</ListboxMenu.ListboxMenuTrigger>
				<ListboxMenu.ListboxMenuContent>
					<ListboxMenu.ListboxRoot
						collection={columnCollection}
						onValueChange={(details) => {
							if (details.value && details.value.length > 0) {
								setFilterValue("");
								setIsOpen(false);
							}
						}}
					>
						<ListboxMenu.ListboxMenuFilterContainer>
							<ListboxMenu.ListboxMenuFilterInput
								placeholder="Search columns to scroll to..."
								value={filterValue}
								onChange={(e) => setFilterValue(e.currentTarget.value)}
							/>
						</ListboxMenu.ListboxMenuFilterContainer>
						<ListboxMenu.ListboxMenuList>
							{filteredColumns.length === 0 ? (
								<ListboxMenu.ListboxMenuEmpty>
									{filterValue ? "No columns match filter" : "No columns"}
								</ListboxMenu.ListboxMenuEmpty>
							) : (
								filteredColumns.map((item) => (
									<ListboxMenu.ListboxMenuItem
										key={item.label}
										item={{ label: item.label, value: item.value }}
										showIndicator={false}
									>
										{item.label}
									</ListboxMenu.ListboxMenuItem>
								))
							)}
						</ListboxMenu.ListboxMenuList>
					</ListboxMenu.ListboxRoot>
				</ListboxMenu.ListboxMenuContent>
			</ListboxMenu.ListboxMenuRoot>
		</div>
	);
}
