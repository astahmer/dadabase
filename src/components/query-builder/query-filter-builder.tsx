import type {
	FilterConditionExpression,
	FilterOperatorType,
	LogicalOperatorType,
} from "#src/components/query-builder/query-filter.ts";
import {
	allOperators,
	arrayOperators,
	getOperatorLabel,
	getOperatorSymbols,
	nullOperators,
	specialValueSupportedOperators,
	SPECIAL_VALUES_LIST,
	isSpecialValue,
} from "#src/components/query-builder/query-filter.ts";
import { useListCollection } from "@ark-ui/react";
import { useFilter } from "@ark-ui/react/locale";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { DataTypeBadge } from "../app/data-type-badge.tsx";
import { Button } from "../ui/button.tsx";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
	createListCollection,
} from "../ui/combobox.tsx";
import { Input } from "../ui/input.tsx";
import { Kbd } from "../ui/kbd.tsx";
import { Stack } from "../ui/layout.tsx";
import * as ArkSelect from "../ui/select.tsx";
import { Tooltip } from "../ui/tooltip.tsx";

interface QueryFilterBuilderProps {
	conditions: readonly FilterConditionExpression[];
	onUpdateCondition: (
		id: string,
		updates: Partial<FilterConditionExpression>,
	) => void;
	onRemoveCondition: (id: string) => void;
	onAddCondition: () => void;
	onClearAll: () => void;
	onLogicalOperatorChange: (operator: LogicalOperatorType) => void;
	logicalOperator: LogicalOperatorType;
	availableColumns: string[];
	isLoading?: boolean;
	/** Optional table name/alias for display in column headers (useful for joined table filters) */
	tableReference?: string;
	/** Disable the filter builder (e.g., when in custom query mode) */
	disabled?: boolean;
	/** Optional column metadata to display data types in the column dropdown */
	columnMetadata?: Array<{
		name: string;
		dataType: string;
		nullable: boolean;
		primaryKey?: boolean;
		unique: boolean;
		defaultValue: string | null;
		isForeignKey?: boolean;
		foreignKey?: {
			referencedSchema: string;
			referencedTable: string;
			referencedColumn: string;
		};
	}>;
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
	tableReference,
	disabled = false,
	columnMetadata,
}: QueryFilterBuilderProps) => {
	const columnCollection = useMemo(
		() =>
			createListCollection({
				items: availableColumns.map((col) => ({
					label: tableReference ? `${tableReference}.${col}` : col,
					value: col,
				})),
			}),
		[availableColumns, tableReference],
	);

	if (conditions.length === 0) {
		return null;
	}

	return (
		<div
			className={`p-4 space-y-3 border-b ${
				disabled ? "opacity-50 pointer-events-none" : ""
			}`}
		>
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
						tableReference={tableReference}
						columnMetadata={columnMetadata}
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
	onLogicalOperatorChange: (operator: LogicalOperatorType) => void;
	isLoading?: boolean;
	isFirst: boolean;
	hasMultipleConditions: boolean;
	isLast: boolean;
	showLogicalLabel?: boolean;
	logicalOperator?: LogicalOperatorType;
	tableReference?: string;
	columnMetadata?: Array<{
		name: string;
		dataType: string;
		nullable: boolean;
		primaryKey?: boolean;
		unique: boolean;
		defaultValue: string | null;
		isForeignKey?: boolean;
		foreignKey?: {
			referencedSchema: string;
			referencedTable: string;
			referencedColumn: string;
		};
	}>;
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
		columnMetadata,
	} = props;
	const isNullOperator = nullOperators.includes(condition.operator);
	const isArrayOperator = arrayOperators.includes(condition.operator);
	const supportsSpecialValues = specialValueSupportedOperators.includes(
		condition.operator,
	);

	const filters = useFilter({ sensitivity: "base" });
	const columnList = useListCollection({
		initialItems: columnCollection.items,
		filter: filters.contains,
	});
	useEffect(() => {
		columnList.set(columnCollection.items);
	}, [columnCollection.items, columnList.set]);

	const operatorList = useListCollection({
		initialItems: operatorCollection.items,
		filter: filters.contains,
	});
	useEffect(() => {
		operatorList.set(operatorCollection.items);
	}, [operatorCollection.items, operatorList.set]);

	const specialValuesCollection = useMemo(
		() => createListCollection({ items: SPECIAL_VALUES_LIST }),
		[],
	);

	const getColumnDataType = (columnName: string): string | undefined => {
		return columnMetadata?.find((col) => col.name === columnName)?.dataType;
	};

	return (
		<Stack className="gap-0">
			{showLogicalLabel && index > 0 && (
				<div className="flex items-center px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/40 rounded-t-md border-b">
					{logicalOperator}
				</div>
			)}
			<div
				className={`flex gap-3 items-end p-3 border rounded-md ${showLogicalLabel && index > 0 ? "rounded-t-none border-t-0" : ""}`}
			>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						onRemove(String(index));
					}}
					className="h-8 w-8 p-0 shrink-0 mt-5"
					title="Remove this filter"
				>
					<X className="h-4 w-4" />
				</Button>

				<div className="flex-1 min-w-0">
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
						className="w-full"
					>
						<ComboboxControl size="sm">
							<ComboboxInput placeholder="Column" />
							<ComboboxTrigger />
						</ComboboxControl>
						<ComboboxContent>
							<ComboboxList>
								{columnList.collection.items.map((item) => (
									<ComboboxItem key={item.value} item={item}>
										<div className="flex items-center justify-between w-full gap-3">
											<span>{item.label}</span>
											{columnMetadata && (
												<div className="ml-auto">
													<DataTypeBadge
														dataType={getColumnDataType(item.value) || ""}
													/>
												</div>
											)}
										</div>
									</ComboboxItem>
								))}
							</ComboboxList>
						</ComboboxContent>
					</Combobox>
				</div>

				<div style={{ minWidth: "140px" }}>
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
						className="w-full"
					>
						<ComboboxControl size="sm">
							<ComboboxInput placeholder="Operator" />
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
				</div>

				{!isNullOperator && (
					<div className="flex-1 min-w-0">
						{supportsSpecialValues ? (
							<Combobox
								collection={specialValuesCollection}
								value={
									isArrayOperator && Array.isArray(condition.value)
										? condition.value.map(String)
										: condition.value
											? [String(condition.value)]
											: []
								}
								onValueChange={(details) => {
									onUpdate(String(index), {
										value:
											details.value.length === 1
												? details.value[0]
												: details.value || "",
									});
								}}
								onInputValueChange={(details) => {
									const val = details.inputValue;
									if (!val || val.trim() === "") return;
									onUpdate(String(index), {
										value: isArrayOperator
											? val.split(",").map((v) => v.trim())
											: val,
									});
								}}
								allowCustomValue
								openOnClick
							>
								<ComboboxControl size="sm">
									<ComboboxInput
										placeholder="Value or select special value..."
										className="w-full"
									/>
									<ComboboxTrigger />
								</ComboboxControl>
								<ComboboxContent>
									<ComboboxList>
										{specialValuesCollection.items.map((item) => (
											<ComboboxItem
												key={item.value}
												item={item}
												className="text-sm"
											>
												<span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
													{item.label}
												</span>
											</ComboboxItem>
										))}
									</ComboboxList>
								</ComboboxContent>
							</Combobox>
						) : (
							<Input
								className="w-full h-8 text-sm rounded-md border border-input bg-transparent shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
						)}{" "}
					</div>
				)}
				{props.isFirst && props.hasMultipleConditions && (
					<div style={{ minWidth: "100px" }}>
						<ArkSelect.Select
							className="w-full"
							value={[logicalOperator]}
							collection={logicalOperatorCollection}
							positioning={{ sameWidth: true }}
							onValueChange={(details: { value?: string[] }) => {
								props.onLogicalOperatorChange?.(
									(details.value?.[0] as LogicalOperatorType) || "and",
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
					</div>
				)}

				{isLast && (
					<Tooltip content="Add another filter">
						<Button
							variant="outline"
							size="sm"
							onClick={() => onAdd?.()}
							className="text-xs h-8 px-2 shrink-0"
						>
							<Plus className="h-4 w-4" />
						</Button>
					</Tooltip>
				)}

				{isLast && (
					<Tooltip content="Remove all filters">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onClearAll()}
							className="text-xs h-8 px-2 shrink-0"
						>
							<X className="h-4 w-4" />
						</Button>
					</Tooltip>
				)}
			</div>
		</Stack>
	);
};
