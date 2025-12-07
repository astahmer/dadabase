import { CheckCircle2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "#src/components/ui/button.tsx";
import { Checkbox, CheckboxControl } from "#src/components/ui/checkbox.tsx";
import { createListCollection } from "@ark-ui/react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValueText,
} from "#src/components/ui/select.tsx";
import { Stack } from "#src/components/ui/layout.tsx";
import type { JoinableTableOption, JoinedTable } from "./join-tables.types";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

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
	const [showColumnSelector, setShowColumnSelector] = useState(false);
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
	};

	const handleApplyColumns = () => {
		if (selectedColumns.size === availableColumns.length) {
			onUpdateColumns("all");
		} else {
			onUpdateColumns(Array.from(selectedColumns));
		}
		setShowColumnSelector(false);
	};

	const columnLabel =
		joined.columns === "all"
			? "All columns"
			: `${joined.columns.length} column${joined.columns.length === 1 ? "" : "s"}`;

	return (
		<div className="p-3 border rounded-md space-y-2 bg-background">
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

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<div className="text-xs font-medium text-muted-foreground">
						Columns:
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setShowColumnSelector(!showColumnSelector)}
						className="h-6 px-2 text-xs"
					>
						{showColumnSelector ? "Hide" : "Edit"} ({columnLabel})
					</Button>
				</div>

				{showColumnSelector && (
					<div className="p-2 border rounded bg-muted/30 space-y-2 max-h-48 overflow-y-auto">
						{availableColumns.map((col) => (
							<div key={col.name} className="flex items-center gap-2">
								<Checkbox
									checked={selectedColumns.has(col.name)}
									onCheckedChange={() => handleToggleColumn(col.name)}
									className="h-4 w-4"
								>
									<CheckboxControl />
								</Checkbox>
							<label className="text-xs cursor-pointer flex-1">
								<span className="font-medium">{col.name}</span>
								<span className="text-muted-foreground ml-1">
									({col.dataType})
								</span>
							</label>
							</div>
						))}

						{availableColumns.length === 0 && (
							<div className="text-xs text-muted-foreground py-2">
								No columns available
							</div>
						)}

						<div className="flex gap-2 pt-2 border-t">
							<Button
								size="sm"
								variant="default"
								onClick={handleApplyColumns}
								className="flex-1 h-7 text-xs"
							>
								Apply
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setShowColumnSelector(false)}
								className="flex-1 h-7 text-xs"
							>
								Cancel
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
