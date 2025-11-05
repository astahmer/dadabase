import { useMemo } from "react";
import type { FilterCondition } from "#src/lib/query-filter";
import {
	FilterOperator,
	getOperatorLabel,
	nullOperators,
	arrayOperators,
} from "#src/lib/query-filter";
import { Button } from "./ui/button";
import { Stack } from "./ui/layout";
import { X, Plus } from "lucide-react";
import * as ArkSelect from "./ui/select";

interface QueryFilterBuilderProps {
	conditions: FilterCondition[];
	onAddCondition: () => void;
	onUpdateCondition: (id: string, updates: Partial<FilterCondition>) => void;
	onRemoveCondition: (id: string) => void;
	onLogicalOperatorChange?: (operator: "and" | "or") => void;
	logicalOperator: "and" | "or";
	availableColumns: string[];
	isLoading?: boolean;
}

export const QueryFilterBuilder = ({
	conditions,
	onAddCondition,
	onUpdateCondition,
	onRemoveCondition,
	onLogicalOperatorChange,
	logicalOperator,
	availableColumns,
	isLoading = false,
}: QueryFilterBuilderProps) => {
	const columnCollection = useMemo(
		() =>
			ArkSelect.createListCollection({
				items: availableColumns.map((col) => ({
					label: col,
					value: col,
				})),
			}),
		[availableColumns],
	);

	const operatorCollection = useMemo(
		() =>
			ArkSelect.createListCollection({
				items: Array.from(FilterOperator.options).map((op) => ({
					label: getOperatorLabel(op),
					value: op,
				})),
			}),
		[],
	);

	const logicalOperatorCollection = useMemo(
		() =>
			ArkSelect.createListCollection({
				items: [
					{ label: "AND", value: "and" },
					{ label: "OR", value: "or" },
				],
			}),
		[],
	);

	if (conditions.length === 0) {
		return (
			<div className="p-4 space-y-2">
				<div className="text-xs font-medium text-foreground uppercase tracking-wide">
					Filters
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={onAddCondition}
					disabled={isLoading}
					className="w-full"
				>
					<Plus className="h-3 w-3 mr-1" />
					Add Filter
				</Button>
			</div>
		);
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
						key={condition.id}
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

			<Button
				variant="outline"
				size="sm"
				onClick={onAddCondition}
				disabled={isLoading}
				className="w-full"
			>
				<Plus className="h-3 w-3 mr-1" />
				Add Filter
			</Button>
		</div>
	);
};

interface FilterConditionRowProps {
	condition: FilterCondition;
	index: number;
	columnCollection: any;
	operatorCollection: any;
	onUpdate: (id: string, updates: Partial<FilterCondition>) => void;
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
	const isNullOperator = nullOperators.includes(condition.operator as any);
	const isArrayOperator = arrayOperators.includes(condition.operator as any);

	return (
		<div className="space-y-2">
			{showLogicalLabel && index > 0 && (
				<div className="text-xs font-medium text-muted-foreground uppercase">
					{logicalOperator}
				</div>
			)}
			<div className="flex gap-2 items-start">
				<ArkSelect.Select
					className="flex-1 min-w-0"
					value={condition.column ? [condition.column] : []}
					collection={columnCollection}
					positioning={{ sameWidth: true }}
					disabled={isLoading}
					onValueChange={(details: { value?: string[] }) => {
						onUpdate(condition.id, { column: details.value?.[0] || "" });
					}}
				>
					<ArkSelect.SelectControl>
						<ArkSelect.SelectTrigger>
							<ArkSelect.SelectValueText placeholder="Select column" />
							<ArkSelect.SelectIndicator />
						</ArkSelect.SelectTrigger>
					</ArkSelect.SelectControl>
					<ArkSelect.SelectContent>
						{columnCollection.items.map((item: any) => (
							<ArkSelect.SelectItem key={item.value} item={item}>
								{item.label}
							</ArkSelect.SelectItem>
						))}
					</ArkSelect.SelectContent>
				</ArkSelect.Select>

				<ArkSelect.Select
					className="flex-1 min-w-0"
					value={[condition.operator]}
					collection={operatorCollection}
					positioning={{ sameWidth: true }}
					disabled={isLoading}
					onValueChange={(details: { value?: string[] }) => {
						onUpdate(condition.id, { operator: details.value?.[0] as any });
					}}
				>
					<ArkSelect.SelectControl>
						<ArkSelect.SelectTrigger>
							<ArkSelect.SelectValueText placeholder="Select operator" />
							<ArkSelect.SelectIndicator />
						</ArkSelect.SelectTrigger>
					</ArkSelect.SelectControl>
					<ArkSelect.SelectContent>
						{operatorCollection.items.map((item: any) => (
							<ArkSelect.SelectItem key={item.value} item={item}>
								{item.label}
							</ArkSelect.SelectItem>
						))}
					</ArkSelect.SelectContent>
				</ArkSelect.Select>

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
							onUpdate(condition.id, {
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
					onClick={() => onRemove(condition.id)}
					disabled={isLoading}
					className="h-9 w-9 p-0"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};
