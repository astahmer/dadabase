import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type {
	FilterConditionExpression,
	QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import { QueryFilterBuilder } from "#src/components/query-builder/query-filter-builder.tsx";
import {
	Accordion,
	AccordionItem,
	AccordionItemContent,
	AccordionItemTrigger,
} from "#src/components/ui/accordion.tsx";
import { Button } from "#src/components/ui/button.tsx";
import {
	Checkbox,
	CheckboxControl,
	CheckboxLabel,
} from "#src/components/ui/checkbox.tsx";
import { Input } from "#src/components/ui/input.tsx";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";
import type { JoinConditionMode, JoinedTable } from "./join-tables.types";

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
	onUpdateJoinCondition: (updates: Partial<JoinedTable>) => void;
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
	onUpdateJoinCondition,
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

	const [joinFilterConditions, setJoinFilterConditions] = useState<
		FilterConditionExpression[]
	>(
		joined.joinCondition.mode === "filters" && joined.joinCondition.filters
			? joined.joinCondition.filters.conditions
			: [],
	);

	const [joinFilterLogicalOperator, setJoinFilterLogicalOperator] = useState<
		"and" | "or"
	>(
		joined.joinCondition.mode === "filters" && joined.joinCondition.filters
			? joined.joinCondition.filters.logicalOperator
			: "and",
	);

	// QueryFilterBuilder callbacks using index-based IDs
	const handleUpdateFilterCondition = (
		id: string,
		updates: Partial<FilterConditionExpression>,
	) => {
		const index = parseInt(id, 10);
		const updated = filterConditions.map((cond, i) =>
			i === index ? { ...cond, ...updates } : cond,
		);
		setFilterConditions(updated);
		onUpdateFilters({
			conditions: updated,
			logicalOperator,
		});
	};

	const handleRemoveFilterCondition = (id: string) => {
		const index = parseInt(id, 10);
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

	const handleAddFilterCondition = () => {
		const newCondition: FilterConditionExpression = {
			column: "",
			operator: "equals",
		};
		const updated = [...filterConditions, newCondition];
		setFilterConditions(updated);
		onUpdateFilters({
			conditions: updated,
			logicalOperator,
		});
	};

	const handleClearFilterConditions = () => {
		setFilterConditions([]);
		onUpdateFilters(undefined);
	};

	const handleFilterLogicalOperatorChange = (operator: "and" | "or") => {
		setLogicalOperator(operator);
		if (filterConditions.length > 0) {
			onUpdateFilters({
				conditions: filterConditions,
				logicalOperator: operator,
			});
		}
	};

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

	const filterLabel = `${filterConditions.length} filter${filterConditions.length === 1 ? "" : "s"}`;

	// Join condition handlers
	const handleSwitchJoinConditionMode = (mode: JoinConditionMode) => {
		setJoinConditionMode(mode);
		onUpdateJoinConditionMode(mode);
		if (mode === "custom") {
			// When switching to custom, add an empty condition if none exist
			if (customJoinConditions.length === 0) {
				setCustomJoinConditions([""]);
				onUpdateCustomJoinConditions([""]);
			}
		} else if (mode === "filters") {
			// When switching to filters, clear custom SQL conditions
			setCustomJoinConditions([]);
			onUpdateCustomJoinConditions([]);
		}
	};

	const handleAddCustomJoinCondition = () => {
		const updated = [...customJoinConditions, ""];
		setCustomJoinConditions(updated);
		onUpdateCustomJoinConditions(updated);
	};

	const handleUpdateCustomJoinCondition = (index: number, value: string) => {
		const updated = customJoinConditions.map((cond, i) =>
			i === index ? value : cond,
		);
		setCustomJoinConditions(updated);
		onUpdateCustomJoinConditions(updated);
	};

	const handleRemoveCustomJoinCondition = (index: number) => {
		const updated = customJoinConditions.filter((_, i) => i !== index);
		setCustomJoinConditions(updated);
		onUpdateCustomJoinConditions(updated);
	};

	const handleClearCustomJoinConditions = () => {
		setCustomJoinConditions([]);
		onUpdateCustomJoinConditions([]);
	};

	// Filter-based join condition handlers
	const handleUpdateJoinFilterCondition = (
		id: string,
		updates: Partial<FilterConditionExpression>,
	) => {
		const index = parseInt(id, 10);
		const updated = joinFilterConditions.map((cond, i) =>
			i === index ? { ...cond, ...updates } : cond,
		);
		setJoinFilterConditions(updated);
		const filterObj: QueryFilterType = {
			conditions: updated,
			logicalOperator: joinFilterLogicalOperator,
		};
		onUpdateJoinCondition({
			joinCondition: {
				mode: "filters",
				referencingColumn: joined.joinCondition.referencingColumn,
				referencedColumn: joined.joinCondition.referencedColumn,
				filters: filterObj,
			},
		});
	};

	const handleRemoveJoinFilterCondition = (id: string) => {
		const index = parseInt(id, 10);
		const updated = joinFilterConditions.filter((_, i) => i !== index);
		setJoinFilterConditions(updated);
		const filterObj: QueryFilterType = {
			conditions: updated,
			logicalOperator: joinFilterLogicalOperator,
		};
		onUpdateJoinCondition({
			joinCondition: {
				mode: "filters",
				referencingColumn: joined.joinCondition.referencingColumn,
				referencedColumn: joined.joinCondition.referencedColumn,
				filters: filterObj,
			},
		});
	};

	const handleAddJoinFilterCondition = () => {
		const updated = [
			...joinFilterConditions,
			{
				column: "",
				operator: "equals" as const,
				value: "",
			},
		];
		setJoinFilterConditions(updated);
		const filterObj: QueryFilterType = {
			conditions: updated,
			logicalOperator: joinFilterLogicalOperator,
		};
		onUpdateJoinCondition({
			joinCondition: {
				mode: "filters",
				referencingColumn: joined.joinCondition.referencingColumn,
				referencedColumn: joined.joinCondition.referencedColumn,
				filters: filterObj,
			},
		});
	};

	const handleClearJoinFilterConditions = () => {
		setJoinFilterConditions([]);
		onUpdateJoinCondition({
			joinCondition: {
				mode: "filters",
				referencingColumn: joined.joinCondition.referencingColumn,
				referencedColumn: joined.joinCondition.referencedColumn,
				filters: {
					conditions: [],
					logicalOperator: joinFilterLogicalOperator,
				},
			},
		});
	};

	const handleJoinFilterLogicalOperatorChange = (operator: "and" | "or") => {
		setJoinFilterLogicalOperator(operator);
		if (joinFilterConditions.length > 0) {
			const filterObj: QueryFilterType = {
				conditions: joinFilterConditions,
				logicalOperator: operator,
			};
			onUpdateJoinCondition({
				joinCondition: {
					mode: "filters",
					referencingColumn: joined.joinCondition.referencingColumn,
					referencedColumn: joined.joinCondition.referencedColumn,
					filters: filterObj,
				},
			});
		}
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
							) : joined.joinCondition.mode === "custom" ? (
								<>
									{joined.joinCondition.conditions.length > 0
										? `ON ${joined.joinCondition.conditions.length} condition(s)`
										: "ON (no conditions)"}
								</>
							) : (
								<>
									{joinFilterConditions.length > 0
										? `ON ${joinFilterConditions.length} filter(s)`
										: "ON (no filters)"}
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
							variant={joinConditionMode === "filters" ? "default" : "outline"}
							size="sm"
							onClick={() => handleSwitchJoinConditionMode("filters")}
							className="h-7 px-2 text-xs"
						>
							Filters
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
													handleUpdateCustomJoinCondition(index, e.target.value)
												}
												className="flex-1 h-8 text-xs"
											/>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => handleRemoveCustomJoinCondition(index)}
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
										onClick={handleAddCustomJoinCondition}
										className="h-7 flex-1 text-xs"
									>
										<Plus className="h-3 w-3 mr-1" />
										Add Condition
									</Button>
									{customJoinConditions.length > 0 && (
										<Button
											size="sm"
											variant="ghost"
											onClick={handleClearCustomJoinConditions}
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

				{joinConditionMode === "filters" && (
					<AccordionItem value="filter-join">
						<AccordionItemTrigger className="px-3 py-2">
							Join Conditions builder ({joinFilterConditions.length})
						</AccordionItemTrigger>
						<AccordionItemContent className="px-3 py-2">
							{joinFilterConditions.length === 0 ? (
								<div className="py-4">
									<Button
										size="sm"
										variant="outline"
										onClick={handleAddJoinFilterCondition}
										className="w-full text-xs"
									>
										<Plus className="h-3 w-3 mr-1" />
										Add Filter
									</Button>
								</div>
							) : (
								<QueryFilterBuilder
									conditions={joinFilterConditions}
									onUpdateCondition={handleUpdateJoinFilterCondition}
									onRemoveCondition={handleRemoveJoinFilterCondition}
									onAddCondition={handleAddJoinFilterCondition}
									onClearAll={handleClearJoinFilterConditions}
									onLogicalOperatorChange={
										handleJoinFilterLogicalOperatorChange
									}
									logicalOperator={joinFilterLogicalOperator}
									availableColumns={availableColumns.map((c) => c.name)}
								/>
							)}
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
						{filterConditions.length === 0 ? (
							<div className="py-4">
								<Button
									size="sm"
									variant="outline"
									onClick={handleAddFilterCondition}
									className="w-full text-xs"
								>
									<Plus className="h-3 w-3 mr-1" />
									Add Filter
								</Button>
							</div>
						) : (
							<QueryFilterBuilder
								conditions={filterConditions}
								onUpdateCondition={handleUpdateFilterCondition}
								onRemoveCondition={handleRemoveFilterCondition}
								onAddCondition={handleAddFilterCondition}
								onClearAll={handleClearFilterConditions}
								onLogicalOperatorChange={handleFilterLogicalOperatorChange}
								logicalOperator={logicalOperator}
								availableColumns={availableColumns.map((c) => c.name)}
							/>
						)}
					</AccordionItemContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
};
