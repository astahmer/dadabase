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
import { Input } from "#src/components/ui/input.tsx";
import type {
	FilterConditionExpression,
	FilterOperatorType,
	QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";
import { HStack } from "#src/components/ui/layout.tsx";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
	createListCollection,
} from "#src/components/ui/combobox.tsx";
import type { JoinedTable, JoinConditionMode } from "./join-tables.types";

interface JoinedTableRowProps {
	joined: JoinedTable;
	availableColumns: TableColumnMetadata[];
	parentSchema: string;
	parentTable: string;
	onUpdateType: (type: "left" | "inner") => void;
	onUpdateColumns: (columns: "all" | string[]) => void;
	onUpdateFilters: (filters: QueryFilterType | undefined) => void;
	onUpdateJoinConditionMode: (mode: JoinConditionMode) => void;
	onUpdateCustomJoinConditions: (conditions: string[]) => void;
	onRemove: () => void;
}

export const JoinedTableRow = ({
	joined,
	availableColumns,
	parentSchema,
	parentTable,
	onUpdateType,
	onUpdateColumns,
	onUpdateFilters,
	onUpdateJoinConditionMode,
	onUpdateCustomJoinConditions,
	onRemove,
}: JoinedTableRowProps) => {
	const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
		new Set(
			joined.columns === "all"
				? availableColumns.map((c) => c.name)
				: joined.columns,
		),
	);

	const [filterConditions, setFilterConditions] = useState<
		FilterConditionExpression[]
	>(joined.filters?.conditions || []);

	const [logicalOperator, setLogicalOperator] = useState<"and" | "or">(
		joined.filters?.logicalOperator || "and",
	);

	const [joinConditionMode, setJoinConditionMode] = useState<JoinConditionMode>(
		joined.joinCondition.mode,
	);

	const [customJoinConditions, setCustomJoinConditions] = useState<string[]>(
		joined.joinCondition.mode === "custom"
			? joined.joinCondition.conditions
			: [],
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

	const filterLabel =
		filterConditions.length === 0
			? "No filters"
			: `${filterConditions.length} filter${filterConditions.length === 1 ? "" : "s"}`;

	const handleAddCondition = () => {
		const newCondition: FilterConditionExpression = {
			column: "",
			operator: "equals",
		};
		const updated = [...filterConditions, newCondition];
		setFilterConditions(updated);
		// Update parent with new filters
		onUpdateFilters({
			conditions: updated,
			logicalOperator,
		});
	};

	const handleUpdateCondition = (
		index: number,
		updates: Partial<FilterConditionExpression>,
	) => {
		const updated = filterConditions.map((cond, i) =>
			i === index ? { ...cond, ...updates } : cond,
		);
		setFilterConditions(updated);
		onUpdateFilters({
			conditions: updated,
			logicalOperator,
		});
	};

	const handleRemoveCondition = (index: number) => {
		const updated = filterConditions.filter((_, i) => i !== index);
		setFilterConditions(updated);
		if (updated.length === 0) {
			onUpdateFilters(undefined);
		} else {
			onUpdateFilters({
				conditions: updated,
				logicalOperator,
			});
		}
	};

	const handleClearAllFilters = () => {
		setFilterConditions([]);
		onUpdateFilters(undefined);
	};

	const handleLogicalOperatorChange = (operator: "and" | "or") => {
		setLogicalOperator(operator);
		if (filterConditions.length > 0) {
			onUpdateFilters({
				conditions: filterConditions,
				logicalOperator: operator,
			});
		}
	};

	const handleSwitchJoinConditionMode = (mode: JoinConditionMode) => {
		setJoinConditionMode(mode);
		onUpdateJoinConditionMode(mode);
		if (mode === "custom") {
			// When switching to custom, clear any previously set custom conditions
			if (customJoinConditions.length === 0) {
				setCustomJoinConditions([""]);
			}
		}
	};

	const handleAddCustomCondition = () => {
		const updated = [...customJoinConditions, ""];
		setCustomJoinConditions(updated);
		onUpdateCustomJoinConditions(updated);
	};

	const handleUpdateCustomCondition = (index: number, value: string) => {
		const updated = customJoinConditions.map((cond, i) =>
			i === index ? value : cond,
		);
		setCustomJoinConditions(updated);
		onUpdateCustomJoinConditions(updated);
	};

	const handleRemoveCustomCondition = (index: number) => {
		const updated = customJoinConditions.filter((_, i) => i !== index);
		setCustomJoinConditions(updated);
		onUpdateCustomJoinConditions(updated);
	};

	const handleClearCustomConditions = () => {
		setCustomJoinConditions([]);
		onUpdateCustomJoinConditions([]);
	};

	return (
		<div className="border rounded-md bg-background">
			<div className="p-3 space-y-2">
				<div className="flex items-center justify-between">
					<div className="flex-1">
						<div className="font-medium text-sm">
							{joined.schema}.{joined.table}
						</div>
						<div className="text-xs text-muted-foreground mt-0.5">
							{joined.joinCondition.mode === "standard" ? (
								<>
									ON {joined.schema}.{joined.table}.
									{joined.joinCondition.referencingColumn} = {parentSchema}.
									{parentTable}.{joined.joinCondition.referencedColumn}
								</>
							) : (
								<>
									{joined.joinCondition.conditions.length > 0
										? `ON ${joined.joinCondition.conditions.length} condition(s)`
										: "ON (no conditions)"}
								</>
							)}
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

				<div className="flex gap-2 items-center pt-2">
					<div className="text-xs font-medium text-muted-foreground">
						Join condition:
					</div>
					<div className="flex gap-1">
						<Button
							variant={joinConditionMode === "standard" ? "default" : "outline"}
							size="sm"
							onClick={() => handleSwitchJoinConditionMode("standard")}
							className="h-7 px-2 text-xs"
						>
							Standard
						</Button>
						<Button
							variant={joinConditionMode === "custom" ? "default" : "outline"}
							size="sm"
							onClick={() => handleSwitchJoinConditionMode("custom")}
							className="h-7 px-2 text-xs"
						>
							Custom SQL
						</Button>
					</div>
				</div>
			</div>

			<Accordion collapsible multiple={false}>
				{joinConditionMode === "custom" && (
					<AccordionItem value="custom-join">
						<AccordionItemTrigger className="px-3 py-2">
							Custom Join Conditions ({customJoinConditions.length})
						</AccordionItemTrigger>
						<AccordionItemContent className="px-3 py-2">
							<div className="space-y-3">
								<p className="text-xs text-muted-foreground">
									Enter SQL expressions for the ON clause. Multiple conditions
									will be combined with AND.
								</p>
								<div className="space-y-2">
									{customJoinConditions.map((condition, index) => (
										<div key={index} className="flex gap-2 items-start">
											<Input
												placeholder={`e.g., ${joined.table}.deleted_at IS NULL`}
												value={condition}
												onChange={(e) =>
													handleUpdateCustomCondition(index, e.target.value)
												}
												className="flex-1 h-8 text-xs"
											/>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => handleRemoveCustomCondition(index)}
												className="h-8 w-8 p-0"
												aria-label="Remove condition"
											>
												<X className="h-3 w-3" />
											</Button>
										</div>
									))}
								</div>
								<div className="flex gap-2 pt-2">
									<Button
										size="sm"
										variant="outline"
										onClick={handleAddCustomCondition}
										className="h-7 flex-1 text-xs"
									>
										<Plus className="h-3 w-3 mr-1" />
										Add Condition
									</Button>
									{customJoinConditions.length > 0 && (
										<Button
											size="sm"
											variant="ghost"
											onClick={handleClearCustomConditions}
											className="h-7 px-2 text-xs"
										>
											<X className="h-3 w-3" />
										</Button>
									)}
								</div>
							</div>
						</AccordionItemContent>
					</AccordionItem>
				)}

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

				<AccordionItem value="filters">
					<AccordionItemTrigger className="px-3 py-2">
						Filters ({filterLabel})
					</AccordionItemTrigger>
					<AccordionItemContent className="px-3 py-2">
						<div className="space-y-3">
							{filterConditions.length > 0 && (
								<div className="flex items-center gap-2">
									<span className="text-xs font-medium text-muted-foreground">
										Match
									</span>
									<button
										className={`text-xs px-2 py-1 rounded border ${
											logicalOperator === "and"
												? "bg-primary text-primary-foreground border-primary"
												: "border-input hover:bg-muted"
										}`}
										onClick={() => handleLogicalOperatorChange("and")}
									>
										ALL
									</button>
									<button
										className={`text-xs px-2 py-1 rounded border ${
											logicalOperator === "or"
												? "bg-primary text-primary-foreground border-primary"
												: "border-input hover:bg-muted"
										}`}
										onClick={() => handleLogicalOperatorChange("or")}
									>
										ANY
									</button>
								</div>
							)}

							<div className="space-y-2">
								{filterConditions.map((condition, index) => (
									<FilterConditionRowCompact
										key={index}
										condition={condition}
										index={index}
										availableColumns={availableColumns.map((c) => c.name)}
										onUpdate={(updates) =>
											handleUpdateCondition(index, updates)
										}
										onRemove={() => handleRemoveCondition(index)}
									/>
								))}
							</div>

							<div className="flex gap-2 pt-2">
								<Button
									size="sm"
									variant="outline"
									onClick={handleAddCondition}
									className="h-7 flex-1 text-xs"
								>
									<Plus className="h-3 w-3 mr-1" />
									Add Filter
								</Button>
								{filterConditions.length > 0 && (
									<Button
										size="sm"
										variant="ghost"
										onClick={handleClearAllFilters}
										className="h-7 px-2 text-xs"
									>
										<X className="h-3 w-3" />
									</Button>
								)}
							</div>
						</div>
					</AccordionItemContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
};

/**
 * Compact filter condition row for use in join tables
 */
const FilterConditionRowCompact = ({
	condition,
	index,
	availableColumns,
	onUpdate,
	onRemove,
}: {
	condition: FilterConditionExpression;
	index: number;
	availableColumns: string[];
	onUpdate: (updates: Partial<FilterConditionExpression>) => void;
	onRemove: () => void;
}) => {
	const columnCollection = createListCollection({
		items: availableColumns.map((col) => ({
			label: col,
			value: col,
		})),
	});

	const conditionValue =
		typeof condition.value === "boolean"
			? String(condition.value)
			: condition.value || "";

	return (
		<HStack gap="2" className="items-end">
			<Combobox
				collection={columnCollection}
				value={condition.column ? [condition.column] : []}
				onValueChange={(details) => onUpdate({ column: details.value[0] })}
				className="flex-1"
			>
				<ComboboxControl>
					<ComboboxInput placeholder="Column" className="h-7 text-xs" />
					<ComboboxTrigger />
				</ComboboxControl>
				<ComboboxContent>
					<ComboboxList>
						{availableColumns.map((col) => (
							<ComboboxItem key={col} item={col}>
								{col}
							</ComboboxItem>
						))}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>

			<select
				value={condition.operator}
				onChange={(e) =>
					onUpdate({ operator: e.target.value as FilterOperatorType })
				}
				className="h-7 text-xs rounded border border-input bg-background px-2 py-1 shrink-0"
				aria-label="operator"
			>
				<option value="equals">=</option>
				<option value="not_equals">≠</option>
				<option value="greater_than">&gt;</option>
				<option value="greater_than_or_equal">≥</option>
				<option value="less_than">&lt;</option>
				<option value="less_than_or_equal">≤</option>
				<option value="contains">contains</option>
				<option value="not_contains">not contains</option>
				<option value="starts_with">starts with</option>
				<option value="in">in</option>
				<option value="not_in">not in</option>
				<option value="is_null">is null</option>
				<option value="is_not_null">is not null</option>
				<option value="between">between</option>
			</select>

			{condition.operator !== "is_null" &&
				condition.operator !== "is_not_null" && (
					<Input
						type="text"
						placeholder="Value"
						value={conditionValue}
						onChange={(e) => onUpdate({ value: e.target.value })}
						className="h-7 text-xs flex-1"
					/>
				)}

			<Button
				size="sm"
				variant="ghost"
				onClick={onRemove}
				className="h-7 w-7 p-0 shrink-0"
				aria-label="Remove filter"
			>
				<X className="h-3 w-3" />
			</Button>
		</HStack>
	);
};
