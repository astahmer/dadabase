import type {
	FilterConditionExpression,
	FilterOperatorType,
} from "#src/lib/query-filter";
import {
	allOperators,
	arrayOperators,
	getOperatorLabel,
	getOperatorSymbols,
	nullOperators,
} from "#src/lib/query-filter";
import { useListCollection } from "@ark-ui/react";
import { useFilter } from "@ark-ui/react/locale";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "./ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
	createListCollection,
} from "./ui/combobox";
import { Input } from "./ui/input.tsx";
import { HStack, Stack } from "./ui/layout";
import * as ArkSelect from "./ui/select";
import { Kbd } from "./ui/kbd.tsx";

interface QueryFilterBuilderProps {
	conditions: readonly FilterConditionExpression[];
	onUpdateCondition: (
		id: string,
		updates: Partial<FilterConditionExpression>,
	) => void;
	onRemoveCondition: (id: string) => void;
	onAddCondition: () => void;
	onClearAll: () => void;
	onLogicalOperatorChange: (operator: "and" | "or") => void;
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
	onAddCondition,
	onClearAll,
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
						onAdd={onAddCondition}
						onClearAll={onClearAll}
						onLogicalOperatorChange={onLogicalOperatorChange}
						isLoading={isLoading}
						showLogicalLabel={index === 0 && conditions.length > 1}
						logicalOperator={logicalOperator}
						isFirst={index === 0}
						isLast={index === conditions.length - 1}
						hasMultipleConditions={conditions.length > 1}
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
	onAdd: () => void;
	onClearAll: () => void;
	onLogicalOperatorChange: (operator: "and" | "or") => void;
	isLoading?: boolean;
	isFirst: boolean;
	hasMultipleConditions: boolean;
	isLast: boolean;
	showLogicalLabel?: boolean;
	logicalOperator?: "and" | "or";
}

const FilterConditionRow = (props: FilterConditionRowProps) => {
	const {
		condition,
		index,
		columnCollection,
		operatorCollection,
		onUpdate,
		onRemove,
		onClearAll,
		onAdd,
		// isLoading = false,
		showLogicalLabel = false,
		isLast,
		logicalOperator = "and",
	} = props;
	const isNullOperator = nullOperators.includes(condition.operator);
	const isArrayOperator = arrayOperators.includes(condition.operator);

	const filters = useFilter({ sensitivity: "base" });
	const columnList = useListCollection({
		initialItems: columnCollection.items,
		filter: filters.contains,
	});
	useEffect(() => {
		columnList.set(columnCollection.items);
	}, [columnCollection.items]);

	const operatorList = useListCollection({
		initialItems: operatorCollection.items,
		filter: filters.contains,
	});
	useEffect(() => {
		operatorList.set(operatorCollection.items);
	}, [operatorCollection.items]);

	return (
		<Stack>
			{showLogicalLabel && index > 0 && (
				<div className="text-xs font-medium text-muted-foreground uppercase">
					{logicalOperator}
				</div>
			)}
			<div className="flex gap-2 items-start">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						onRemove(String(index));
					}}
				>
					<X />
				</Button>

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
					className="flex-1 min-w-0"
				>
					<ComboboxControl size="sm">
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
					className="flex-1 min-w-0"
				>
					<ComboboxControl size="sm">
						<ComboboxInput placeholder="Select operator" />
						<ComboboxTrigger />
					</ComboboxControl>
					<ComboboxContent>
						<ComboboxList>
							{operatorList.collection.items.map((item) => {
								const symbols = getOperatorSymbols(
									item.value as FilterOperatorType,
								);
								return (
									<ComboboxItem key={item.value} item={item}>
										<div className="flex items-center justify-between w-full gap-3">
											<span className="text-sm lowercase">{item.label}</span>
											{symbols.length > 0 && (
												<div className="flex gap-1 ml-auto">
													{symbols.map((symbol) => (
														<Kbd
															key={symbol}
															variant="outline"
															size="sm"
															className="text-xs lowercase"
														>
															{symbol}
														</Kbd>
													))}
												</div>
											)}
										</div>
									</ComboboxItem>
								);
							})}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>

				{!isNullOperator && (
					<Input
						className="flex-1 min-w-0 rounded-md border border-input bg-transparent shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						size="sm"
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
					/>
				)}

				<HStack className="min-w-[210px]">
					{props.isFirst && props.hasMultipleConditions && (
						<ArkSelect.Select
							className="w-24"
							value={[logicalOperator]}
							collection={logicalOperatorCollection}
							positioning={{ sameWidth: true }}
							onValueChange={(details: { value?: string[] }) => {
								props.onLogicalOperatorChange?.(
									(details.value?.[0] as "and" | "or") || "and",
								);
							}}
						>
							<ArkSelect.SelectControl size="sm">
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
					{isLast && (
						<>
							<Button variant="outline" size="sm" onClick={() => onAdd?.()}>
								<Plus />
								<span className="text-xs">Add filter</span>
							</Button>

							<Button variant="ghost" size="sm" onClick={() => onClearAll()}>
								<X />
								<span className="text-xs">Clear all</span>
							</Button>
						</>
					)}
				</HStack>
			</div>
		</Stack>
	);
};
