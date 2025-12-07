import { Plus } from "lucide-react";
import { createListCollection } from "@ark-ui/react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValueText,
} from "#src/components/ui/select.tsx";
import { Button } from "#src/components/ui/button.tsx";
import { Stack } from "#src/components/ui/layout.tsx";
import type { JoinableTableOption, JoinedTable } from "./join-tables.types";

interface JoinableTableSelectorProps {
	availableTables: JoinableTableOption[];
	selectedTableIds: string[];
	onSelect: (option: JoinableTableOption) => void;
}

export const JoinableTableSelector = ({
	availableTables,
	selectedTableIds,
	onSelect,
}: JoinableTableSelectorProps) => {
	const unselectedTables = availableTables.filter(
		(t) => !selectedTableIds.includes(`${t.schema}.${t.table}`),
	);

	if (unselectedTables.length === 0) {
		return (
			<div className="text-xs text-muted-foreground p-2 text-center">
				No more tables available to join
			</div>
		);
	}

	const tableCollection = createListCollection({
		items: unselectedTables.map((t) => ({
			label: `${t.schema}.${t.table} (${t.direction === "outgoing" ? "FK references" : "referenced by"})`,
			value: `${t.schema}:${t.table}:${t.referencingColumn}:${t.referencedColumn}:${t.direction}`,
		})),
	});

	return (
		<div className="space-y-2">
			<div className="text-sm font-medium">Add Table to Join</div>
			<Select
				collection={tableCollection}
				onValueChange={(details) => {
					if (details.value && details.value.length > 0) {
						const [schema, table, refCol, refedCol, direction] =
							details.value[0].split(":");
						onSelect({
							schema,
							table,
							referencingColumn: refCol,
							referencedColumn: refedCol,
							direction: direction as "outgoing" | "incoming",
						});
					}
				}}
			>
				<SelectTrigger className="h-9">
					<SelectValueText placeholder="Select table..." />
				</SelectTrigger>
				<SelectContent>
					{unselectedTables.map((table) => (
						<SelectItem
							key={`${table.schema}.${table.table}`}
							item={`${table.schema}:${table.table}:${table.referencingColumn}:${table.referencedColumn}:${table.direction}`}
						>
							{table.schema}.{table.table}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
};
