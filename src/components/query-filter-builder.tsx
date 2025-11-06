import { useMemo } from "react";
import type {
	FilterConditionExpression,
	FilterOperatorType,
} from "#src/lib/query-filter";
import {
	allOperators,
	getOperatorLabel,
	nullOperators,
	arrayOperators,
} from "#src/lib/query-filter";
import { Button } from "./ui/button";
import { Stack } from "./ui/layout";
import { X } from "lucide-react";
import {
	Combobox,
	ComboboxControl,
	ComboboxInput,
	ComboboxTrigger,
	ComboboxContent,
	ComboboxList,
	ComboboxItem,
	createListCollection,
} from "./ui/combobox";
import * as ArkSelect from "./ui/select";
import { useFilter } from "@ark-ui/react/locale";
import { useListCollection } from "@ark-ui/react";

interface QueryFilterBuilderProps {
	conditions: readonly FilterConditionExpression[];
	onUpdateCondition: (
		id: string,
		updates: Partial<FilterConditionExpression>,
	) => void;
	onRemoveCondition: (id: string) => void;
	onLogicalOperatorChange?: (operator: "and" | "or") => void;
	logicalOperator: "and" | "or";
	availableColumns: string[];
	isLoading?: boolean;
}

const operatorCollection = createListCollection({
	items: allOperators.map((op) => ({
		label: getOperatorLabel(op),
		value: op,
	})),
});

const logicalOperatorCollection = createListCollection({
	items: [
		{ label: "AND", value: "and" },
		{ label: "OR", value: "or" },
	],
});

export const QueryFilterBuilder = ({
	conditions,
	onUpdateCondition,
	onRemoveCondition,
	onLogicalOperatorChange,
	logicalOperator,
	availableColumns,
	isLoading = false,
}: QueryFilterBuilderProps) => {
	const columnCollection = useMemo(
		() =>
			createListCollection({
				items: availableColumns.map((col) => ({
					label: col,
					value: col,
				})),
			}),
		[availableColumns],
	);

	if (conditions.length === 0) {
		return null;
	}

	return (
		<div className="p-4 space-y-3 border-b">
			<div className="flex items-center justify-between">
				<div className="text-xs font-medium text-foreground uppercase tracking-wide">
					Filters
				</div>
				{conditions.length > 1 && (
					<ArkSelect.Select
						className="w-24"
						value={[logicalOperator]}
						collection={logicalOperatorCollection}
						positioning={{ sameWidth: true }}
						onValueChange={(details: { value?: string[] }) => {
							onLogicalOperatorChange?.(
								(details.value?.[0] as "and" | "or") || "and",
							);
						}}
					>
						<ArkSelect.SelectControl>
							<ArkSelect.SelectTrigger>
								<ArkSelect.SelectValueText placeholder="AND" />
								<ArkSelect.SelectIndicator />
							</ArkSelect.SelectTrigger>
						</ArkSelect.SelectControl>
						<ArkSelect.SelectContent>
							{logicalOperatorCollection.items.map(
								(item: { label: string; value: string }) => (
									<ArkSelect.SelectItem key={item.value} item={item}>
										{item.label}
									</ArkSelect.SelectItem>
								),
							)}
						</ArkSelect.SelectContent>
					</ArkSelect.Select>
				)}
			</div>

			<Stack gap="2">
				{conditions.map((condition, index) => (
					<FilterConditionRow
						key={index}
						condition={condition}
						index={index}
						columnCollection={columnCollection}
						operatorCollection={operatorCollection}
						onUpdate={onUpdateCondition}
						onRemove={onRemoveCondition}
						isLoading={isLoading}
						showLogicalLabel={index === 0 && conditions.length > 1}
						logicalOperator={logicalOperator}
					/>
				))}
			</Stack>
		</div>
	);
};

interface FilterConditionRowProps {
	condition: FilterConditionExpression;
	index: number;
	columnCollection: ArkSelect.ListCollection<{
		label: string;
		value: string;
	}>;
	operatorCollection: ArkSelect.ListCollection<{
		label: string;
		value: FilterOperatorType;
	}>;
	onUpdate: (id: string, updates: Partial<FilterConditionExpression>) => void;
	onRemove: (id: string) => void;
	isLoading?: boolean;
	showLogicalLabel?: boolean;
	logicalOperator?: "and" | "or";
}

const FilterConditionRow = ({
	condition,
	index,
	columnCollection,
	operatorCollection,
	onUpdate,
	onRemove,
	isLoading = false,
	showLogicalLabel = false,
	logicalOperator = "and",
}: FilterConditionRowProps) => {
	const isNullOperator = nullOperators.includes(condition.operator);
	const isArrayOperator = arrayOperators.includes(condition.operator);

	const filters = useFilter({ sensitivity: "base" });
	const columnList = useListCollection({
		initialItems: columnCollection.items,
		filter: filters.contains,
	});
	const operatorList = useListCollection({
		initialItems: operatorCollection.items,
		filter: filters.contains,
	});

	return (
		<div className="space-y-2">
			{showLogicalLabel && index > 0 && (
				<div className="text-xs font-medium text-muted-foreground uppercase">
					{logicalOperator}
				</div>
			)}
			<div className="flex gap-2 items-start">
				<Combobox
					openOnClick
					collection={columnList.collection}
					value={condition.column ? [condition.column] : []}
					onValueChange={(details) => {
						onUpdate(String(index), { column: details.value?.[0] || "" });
					}}
					onInputValueChange={(details) =>
						columnList.filter(details.inputValue)
					}
					disabled={isLoading}
					className="flex-1 min-w-0"
				>
					<ComboboxControl>
						<ComboboxInput placeholder="Select column" />
						<ComboboxTrigger />
					</ComboboxControl>
					<ComboboxContent>
						<ComboboxList>
							{columnList.collection.items.map((item) => (
								<ComboboxItem key={item.value} item={item}>
									{item.label}
								</ComboboxItem>
							))}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>

				<Combobox
					openOnClick
					collection={operatorList.collection}
					value={[condition.operator]}
					onValueChange={(details) => {
						onUpdate(String(index), {
							operator: details.value?.[0] as FilterOperatorType,
						});
					}}
					onInputValueChange={(details) =>
						operatorList.filter(details.inputValue)
					}
					disabled={isLoading}
					className="flex-1 min-w-0"
				>
					<ComboboxControl>
						<ComboboxInput placeholder="Select operator" />
						<ComboboxTrigger />
					</ComboboxControl>
					<ComboboxContent>
						<ComboboxList>
							{operatorList.collection.items.map((item) => (
								<ComboboxItem key={item.value} item={item}>
									{item.label}
								</ComboboxItem>
							))}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>

				{!isNullOperator && (
					<input
						type="text"
						placeholder="Value"
						value={
							isArrayOperator && Array.isArray(condition.value)
								? condition.value.join(", ")
								: (condition.value as string) || ""
						}
						onChange={(e) => {
							const val = e.target.value;
							onUpdate(String(index), {
								value: isArrayOperator
									? val.split(",").map((v) => v.trim())
									: val,
							});
						}}
						disabled={isLoading}
						className="flex-1 min-w-0 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					/>
				)}

				<Button
					variant="ghost"
					size="sm"
					onClick={() => onRemove(String(index))}
					disabled={isLoading}
					className="h-9 w-9 p-0"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};
