import { Button } from "#src/components/ui/button.tsx";
import {
	Accordion,
	AccordionItem,
	AccordionItemContent,
	AccordionItemTrigger,
} from "#src/components/ui/accordion.tsx";
import {
	Checkbox,
	CheckboxControl,
	CheckboxLabel,
} from "#src/components/ui/checkbox.tsx";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { JoinedTable } from "./join-tables.types";

interface JoinedTableRowProps {
	joined: JoinedTable;
	availableColumns: TableColumnMetadata[];
	onUpdateType: (type: "left" | "inner") => void;
	onUpdateColumns: (columns: "all" | string[]) => void;
	onRemove: () => void;
}

export const JoinedTableRow = ({
	joined,
	availableColumns,
	onUpdateType,
	onUpdateColumns,
	onRemove,
}: JoinedTableRowProps) => {
	const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
		new Set(
			joined.columns === "all"
				? availableColumns.map((c) => c.name)
				: joined.columns,
		),
	);

	const handleToggleColumn = (column: string) => {
		const updated = new Set(selectedColumns);
		if (updated.has(column)) {
			updated.delete(column);
		} else {
			updated.add(column);
		}
		setSelectedColumns(updated);
		// Apply immediately
		if (updated.size === availableColumns.length) {
			onUpdateColumns("all");
		} else {
			onUpdateColumns(Array.from(updated));
		}
	};

	const handleSelectAll = (selectAll: boolean) => {
		let updated: Set<string>;
		if (selectAll) {
			updated = new Set(availableColumns.map((c) => c.name));
		} else {
			updated = new Set();
		}
		setSelectedColumns(updated);
		// Apply immediately
		if (updated.size === availableColumns.length) {
			onUpdateColumns("all");
		} else {
			onUpdateColumns(Array.from(updated));
		}
	};

	const columnLabel =
		joined.columns === "all"
			? `All ${availableColumns.length} columns`
			: `${joined.columns.length} column${joined.columns.length === 1 ? "" : "s"}`;

	return (
		<div className="border rounded-md bg-background">
			<div className="p-3 space-y-2">
				<div className="flex items-center justify-between">
					<div className="flex-1">
						<div className="font-medium text-sm">
							{joined.schema}.{joined.table}
						</div>
						<div className="text-xs text-muted-foreground mt-0.5">
							ON {joined.schema}.{joined.table}.{joined.referencedColumn}
						</div>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={onRemove}
						className="h-8 w-8 p-0"
						aria-label="Remove join"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>

				<div className="flex gap-2 items-center">
					<div className="text-xs font-medium text-muted-foreground">
						Join type:
					</div>
					<div className="flex gap-1">
						<Button
							variant={joined.type === "left" ? "default" : "outline"}
							size="sm"
							onClick={() => onUpdateType("left")}
							className="h-7 px-2 text-xs"
						>
							LEFT
						</Button>
						<Button
							variant={joined.type === "inner" ? "default" : "outline"}
							size="sm"
							onClick={() => onUpdateType("inner")}
							className="h-7 px-2 text-xs"
						>
							INNER
						</Button>
					</div>
				</div>
			</div>

			<Accordion collapsible multiple={false}>
				<AccordionItem value="columns">
					<AccordionItemTrigger className="px-3 py-2">
						Columns ({columnLabel})
					</AccordionItemTrigger>
					<AccordionItemContent className="px-3 py-2">
						<div className="space-y-2">
							<Checkbox
								checked={
									selectedColumns.size === availableColumns.length
										? true
										: selectedColumns.size > 0
											? "indeterminate"
											: false
								}
								onCheckedChange={(details) =>
									handleSelectAll(details.checked === true)
								}
								className="flex gap-2 w-full"
							>
								<CheckboxControl />
								<CheckboxLabel className="text-xs cursor-pointer flex-1">
									<span className="font-medium">Select All</span>
								</CheckboxLabel>
							</Checkbox>
							{availableColumns.map((col) => (
								<div key={col.name} className="flex items-center gap-2">
									<Checkbox
										checked={selectedColumns.has(col.name)}
										onCheckedChange={() => handleToggleColumn(col.name)}
										className="flex gap-2 w-full"
									>
										<CheckboxControl />
										<CheckboxLabel className="text-xs cursor-pointer flex-1">
											<span className="font-medium">{col.name}</span>
											<span className="text-muted-foreground ml-1">
												({col.dataType})
											</span>
										</CheckboxLabel>
									</Checkbox>
								</div>
							))}

							{availableColumns.length === 0 && (
								<div className="text-xs text-muted-foreground py-2">
									No columns available
								</div>
							)}
						</div>
					</AccordionItemContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
};
