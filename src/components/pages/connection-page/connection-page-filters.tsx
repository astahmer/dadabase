import { useNavigate } from "@tanstack/react-router";
import type { Table as TanstackTable } from "@tanstack/react-table";
import {
	LayoutGrid,
	LucideChevronDown,
	LucideChevronUp,
	LucideListFilter,
	Rows,
} from "lucide-react";
import { Button } from "../../ui/button";
import { HStack } from "../../ui/layout.tsx";
import { Tooltip } from "../../ui/tooltip.tsx";
import { NaturalLanguageSearch } from "../../query-builder/natural-language-search.tsx";
import { ColumnVisibilityControls } from "../../data-table/column-visibility.tsx";
import { OrderBySelect } from "../../app/order-by-select.tsx";
import type { QueryFilterBuilderReturn } from "#src/components/query-builder/use-query-builder.ts";
import { updateTabState, useActiveTabState } from "./create-tab-state.ts";

interface ConnectionPageFiltersProps {
	columnList: string[];
	isLoading: boolean;
	table: TanstackTable<any>;
	queryBuilder: QueryFilterBuilderReturn;
}

export const ConnectionPageFilters = (props: ConnectionPageFiltersProps) => {
	const { columnList, isLoading, table, queryBuilder } = props;
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const viewMode = useActiveTabState((s) => s.viewMode);
	const filtersOpened = useActiveTabState((s) => s.filtersOpened);
	const filterConditions = useActiveTabState(
		(s) => s.filters?.conditions ?? [],
	);
	const orderBy = useActiveTabState((s) => s.orderBy);
	const orderDirection = useActiveTabState((s) => s.orderDirection);

	return (
		<div className="relative border-b bg-muted/50">
			{isLoading && (
				<div
					className="absolute inset-x-0 top-0 h-0.5 bg-primary"
					style={{
						background:
							"linear-gradient(90deg, transparent, var(--color-primary), transparent)",
						animation: "shimmer 1.5s infinite",
					}}
				/>
			)}
			<HStack className="px-4 py-2 items-center justify-between">
				<div className="flex gap-2">
					<Tooltip content="View rows">
						<Button
							variant={viewMode === "rows" ? "default" : "outline"}
							size="sm"
							onClick={() =>
								navigate({
									search: (prev) =>
										updateTabState(prev, {
											viewMode: "rows",
										}),
								})
							}
						>
							<Rows className="h-4 w-4" />
						</Button>
					</Tooltip>
					<Tooltip content="View table structure">
						<Button
							variant={viewMode === "structure" ? "default" : "outline"}
							size="sm"
							onClick={() =>
								navigate({
									search: (prev) =>
										updateTabState(prev, {
											viewMode: "structure",
										}),
								})
							}
						>
							<LayoutGrid className="h-4 w-4" />
						</Button>
					</Tooltip>
					{viewMode === "rows" && (
						<Button
							variant={
								filterConditions.length > 0 && !filtersOpened
									? "default"
									: "outline"
							}
							size="sm"
							onClick={() => {
								if (queryBuilder.filter.conditions.length === 0) {
									queryBuilder.addCondition();
								} else {
									navigate({
										search: (prev) =>
											updateTabState(prev, (tab) => ({
												filtersOpened: !tab.filtersOpened,
											})),
									});
								}
							}}
							disabled={isLoading}
							className={filterConditions.length > 0 ? "gap-2" : ""}
						>
							<LucideListFilter className="h-3 w-3" />
							{filterConditions.length > 0
								? filtersOpened
									? "Filters"
									: "Open filters"
								: "Add filter"}
							{filterConditions.length > 0 && (
								<span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-semibold bg-background/20">
									{filterConditions.length || 0}
								</span>
							)}
							{filterConditions.length > 0 ? (
								filtersOpened ? (
									<LucideChevronUp className="h-3 w-3" />
								) : (
									<LucideChevronDown className="h-3 w-3" />
								)
							) : null}
						</Button>
					)}
				</div>
				{viewMode === "rows" && (
					<NaturalLanguageSearch
						className="w-full"
						availableColumns={columnList}
						onApplyFilters={(parsed) => {
							const { filters = [], orderBy, limit } = parsed;
							console.log("onApplyFilters", filters);
							const operatorMap: Record<string, any> = {
								eq: "equals",
								gt: "greater_than",
								lt: "less_than",
								gte: "greater_than_or_equal",
								lte: "less_than_or_equal",
								contains: "contains",
								in: "in",
								not_eq: "not_equals",
								not_contains: "not_contains",
							};

							if (filters.length) {
								if (parsed.clear) {
									queryBuilder.updateManyConditions(
										filterConditions.filter((current) => {
											return filters.some(
												(removed) =>
													current.column === removed.field &&
													current.operator === removed.operator &&
													current.value === removed.value,
											);
										}),
									);
								} else {
									queryBuilder.updateManyConditions(
										filterConditions
											.map((f) => ({
												column: f.column,
												operator: f.operator,
												value: f.value as string,
											}))
											.concat(
												filters.map((f) => ({
													column: f.field,
													operator: operatorMap[f.operator] || "equals",
													value: f.value as string,
												})),
											),
									);
								}
							}

							if (orderBy) {
								navigate({
									search: (prev) =>
										updateTabState(prev, {
											orderBy: orderBy.field,
											orderDirection: orderBy.direction,
										}),
								});
							}

							if (limit) {
								navigate({
									search: (prev) =>
										updateTabState(prev, {
											limit: limit,
										}),
								});
							}
						}}
					/>
				)}
				{viewMode === "rows" && (
					<ColumnVisibilityControls
						table={table}
						columnList={columnList}
						minimal={true}
					/>
				)}
				{viewMode === "rows" && (
					<OrderBySelect
						columnList={columnList}
						orderBy={orderBy}
						orderDirection={orderDirection}
						onOrderChange={(orderBy, direction) => {
							navigate({
								search: (prev) =>
									updateTabState(prev, {
										orderBy,
										orderDirection: direction || "asc",
										offset: 0,
									}),
							});
						}}
						getColumnLabel={(col) => col}
						minimal
					/>
				)}
			</HStack>
		</div>
	);
};
