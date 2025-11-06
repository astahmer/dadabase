import { useConnectionStorage } from "#src/hooks/use-connection-storage";
import { useQueryBuilder } from "#src/hooks/use-query-builder";
import { redactConnectionUrl } from "#src/lib/redact-connection-url";
import { Route } from "#src/routes/connections/$connectionName";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/pg/start-fns/get-available-schemas.start";
import { listAvailableTablesQueryOptions } from "#src/server/pg/start-fns/get-available-tables.start";
import { getTableColumnsQueryOptions } from "#src/server/pg/start-fns/get-table-columns.start";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { Listbox, createListCollection } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { Pagination } from "@ark-ui/react/pagination";
import {
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	LayoutGrid,
	LucideChevronDown,
	LucideChevronUp,
	LucideListFilter,
	RefreshCw,
	Rows,
} from "lucide-react";
import { useMemo, useState } from "react";
import { getErrorMessage } from "../../lib/get-error-message.ts";
import { ColumnVisibilityControls } from "../column-visibility";
import { DataTable } from "../data-table";
import { NaturalLanguageSearch } from "../natural-language-search";
import { OrderBySelect } from "../order-by-select";
import { QueryFilterBuilder } from "../query-filter-builder";
import { Button } from "../ui/button";
import { HStack, Stack } from "../ui/layout.tsx";
import * as ArkSelect from "../ui/select";
import { Spinner } from "../ui/spinner.tsx";
import { Tooltip } from "../ui/tooltip.tsx";
import { useDataTable } from "../use-data-table";

const formatRelativeTime = (timestamp: number): string => {
	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
	const now = Date.now();
	const seconds = Math.floor((now - timestamp) / 1000);

	if (seconds < 60) return rtf.format(-seconds, "second");
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return rtf.format(-minutes, "minute");
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return rtf.format(-hours, "hour");
	const days = Math.floor(hours / 24);
	return rtf.format(-days, "day");
};

interface ConnectionPageProps {
	connectionName: string;
}

export const ConnectionPage = ({ connectionName }: ConnectionPageProps) => {
	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: Route.fullPath });

	const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
	const connection = connectionList.data.find((c) => c.name === connectionName);
	const connectionUrl = connection?.url || "";

	const search = Route.useSearch();

	const { setSchema, setTable } = useConnectionStorage(connectionName);

	const queryBuilder = useQueryBuilder(
		search.filters ?? { conditions: [], logicalOperator: "and" },
		(updatedFilter) => {
			let shouldOpenFilters = search.filtersOpened;
			if (
				!search.filters?.conditions?.length &&
				updatedFilter.conditions.length
			) {
				shouldOpenFilters = true;
			}

			navigate({
				search: (prev) => ({
					...prev,
					filters: updatedFilter || undefined,
					filtersOpened: shouldOpenFilters,
					offset: 0, // Reset to first page when filters change
					limit: 50,
					orderBy: undefined,
					orderDirection: undefined,
				}),
			});
		},
	);

	const schemaListQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: connectionUrl }),
		enabled: !!connection?.url,
	});

	const tablesListQuery = useQuery({
		...listAvailableTablesQueryOptions({ url: connection?.url || "" }),
		enabled: !!connection?.url && !!search.schema,
	});

	const rowsQuery = useQuery({
		...queryTableDataQueryOptions({
			url: connectionUrl,
			schema: search.schema || "",
			table: search.table || "",
			limit: search.limit,
			offset: search.offset,
			orderBy: search.orderBy,
			orderDirection: search.orderDirection,
			filters: queryBuilder.getWhereClause() ?? {
				conditions: [],
				logicalOperator: "and",
			},
		}),
		// placeholderData: keepPreviousData,
		enabled: !!connection?.url && !!search.schema && !!search.table,
	});
	// console.log("query", {
	// 	url: connectionUrl,
	// 	schema: search.schema || "",
	// 	table: search.table || "",
	// 	limit: search.limit,
	// 	offset: search.offset,
	// 	orderBy: search.orderBy,
	// 	orderDirection: search.orderDirection,
	// 	filters: queryBuilder.getWhereClause() ?? {
	// 		conditions: [],
	// 		logicalOperator: "and",
	// 	},
	// });
	// console.log(rowsQuery.data);

	const metadataQuery = useQuery({
		...getTableColumnsQueryOptions({
			url: connectionUrl,
			schema: search.schema || "",
			table: search.table || "",
		}),
		enabled: !!connection?.url && !!search.schema && !!search.table,
	});
	const columnMetadata = metadataQuery.data ?? [];

	const schemas = schemaListQuery.data || [];
	const tables = tablesListQuery.data || [];

	// Filter tables based on search term
	const [tableFilterValue, setTableFilterValue] = useState("");
	const { contains } = useFilter({ sensitivity: "base" });

	const filteredTables = tables.filter(
		(table) =>
			contains(table.name, tableFilterValue) && search.schema === table.schema,
	);

	const tableCollection = useMemo(
		() =>
			createListCollection({
				items: filteredTables.map((t) => ({
					label: t.name,
					value: t.name,
				})),
			}),
		[filteredTables],
	);

	const queryResponse = rowsQuery.data || {
		rows: [],
		rowCount: 0,
		timeTaken: 0,
		ranAt: 0,
	};
	const tableData = queryResponse.rows;
	const totalRowCount = queryResponse.rowCount;

	const tableDisplayName = search.table
		? `${search.schema}.${search.table}`
		: "No table selected";

	// Format data with ISO dates and create columns
	const formatTableValue = (value: unknown): unknown => {
		if (value instanceof Date) {
			return value.toISOString();
		}
		if (typeof value === "string") {
			// Check if it looks like a date
			const dateObj = new Date(value);
			if (!isNaN(dateObj.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
				return dateObj.toISOString();
			}
		}
		return value;
	};

	const formattedTableData = tableData.map((row) => {
		const formatted: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(row)) {
			formatted[key] = formatTableValue(value);
		}
		return formatted;
	});

	const rowsColumns: Array<ColumnDef<Record<string, unknown>>> =
		columnMetadata.length > 0
			? columnMetadata.map((col) => ({
					accessorKey: col.name,
					// header: `${col.name} (${col.dataType})`,
					header: () => (
						<div>
							<span>{col.name}</span>
							<Tooltip content={col.dataType}>
								<span className="ml-1 truncate max-w-16 inline-flex font-mono text-[0.625rem] text-muted-foreground/80 whitespace-nowrap pointer-events-none">
									({col.dataType})
								</span>
							</Tooltip>
						</div>
					),
					// size: 150,
					// minSize: 75,
					// maxSize: 500,
					enableResizing: true,
					enableSorting: true,
				}))
			: [];

	// Create sorting state from URL params
	const sortingState = search.orderBy
		? [
				{
					id: search.orderBy,
					desc: search.orderDirection === "desc",
				},
			]
		: [];

	const dataTable = useDataTable({
		data: formattedTableData,
		columns: rowsColumns,
		initialState: {
			pagination: {
				pageIndex: Math.floor(search.offset / search.limit),
				pageSize: search.limit,
			},
			sorting: sortingState,
		},
		manualPagination: true,
		manualSorting: true,
		rowCount: totalRowCount,
		defaultColumn: {
			size: 150,
			minSize: 20,
			maxSize: Number.MAX_SAFE_INTEGER,
		},
		onSortingChange: (updater) => {
			const newSorting =
				typeof updater === "function" ? updater(sortingState) : updater;
			const firstSort = newSorting[0];
			navigate({
				search: (prev) => ({
					...prev,
					orderBy: firstSort?.id || undefined,
					orderDirection: firstSort?.desc ? "desc" : "asc",
					offset: 0,
				}),
			});
		},
		onPaginationChange: (updater) => {
			const current = {
				pageIndex: Math.floor(search.offset / search.limit),
				pageSize: search.limit,
			};
			const newPagination =
				typeof updater === "function" ? updater(current) : updater;
			navigate({
				search: (prev) => ({
					...prev,
					offset: newPagination.pageIndex * newPagination.pageSize,
					limit: newPagination.pageSize,
				}),
			});
		},
	});

	const redactedUrl = connection ? redactConnectionUrl(connection.url) : "";

	if (!connection) {
		return (
			<div className="h-screen bg-background py-8 px-4">
				<div className="max-w-6xl mx-auto">
					<h1 className="text-2xl font-bold text-foreground">
						Connection not found
					</h1>
				</div>
			</div>
		);
	}

	const schemaCollection = ArkSelect.createListCollection({
		items: schemas.map((s: string) => ({ label: s, value: s })),
	});

	return (
		<div className="h-screen bg-background flex flex-col">
			{/* Header */}
			<div className="border-b bg-card px-4 py-2 sm:px-6 space-y-1">
				<div className="flex items-center justify-between gap-4">
					<div className="flex-1 min-w-0">
						<h1 className="text-lg font-bold tracking-tight text-foreground truncate">
							{connection.name}
						</h1>
						<span className="text-xs text-muted-foreground truncate">
							{redactedUrl}
						</span>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							queryClient.invalidateQueries({
								queryKey: ["db", "list"],
							});
							queryClient.invalidateQueries({
								queryKey: ["pg", "schemaList"],
							});
							queryClient.invalidateQueries({
								queryKey: ["pg", "tableList"],
							});
							queryClient.invalidateQueries({
								queryKey: ["pg", "tableData"],
							});
						}}
						className="shrink-0"
					>
						<RefreshCw className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Main Layout */}
			<div className="flex-1 flex h-full min-h-0">
				{/* Sidebar */}
				<div className="w-64 border-r bg-muted/30 flex flex-col overflow-hidden h-full min-h-0">
					{/* Schema Selector */}
					<Stack className="px-4 pt-4 shrink-0" gap="2">
						<label className="text-xs font-medium text-foreground uppercase tracking-wide">
							Schema
						</label>
						{schemaListQuery.isLoading ? (
							<div className="flex items-center justify-center rounded-md border border-input bg-card px-3 py-2 min-h-9">
								<span className="text-xs text-muted-foreground">
									Loading...
								</span>
							</div>
						) : (
							<ArkSelect.Select
								className="w-full"
								value={search.schema ? [search.schema] : []}
								collection={schemaCollection}
								positioning={{ sameWidth: true }}
								disabled={schemaListQuery.isLoading}
								onValueChange={(details: { value?: string[] }) => {
									const newSchema = details.value?.[0];
									if (newSchema) {
										setSchema(newSchema);
										navigate({
											search: (prev) => ({
												...prev,
												schema: newSchema,
												table: undefined,
												offset: 0,
												filters: undefined,
											}),
										});
									}
								}}
							>
								<ArkSelect.SelectControl>
									<ArkSelect.SelectTrigger>
										<ArkSelect.SelectValueText placeholder="Select schema" />
										<ArkSelect.SelectIndicator />
									</ArkSelect.SelectTrigger>
								</ArkSelect.SelectControl>
								<ArkSelect.SelectContent>
									{schemaCollection.items.map(
										(item: { label: string; value: string }) => (
											<ArkSelect.SelectItem key={item.value} item={item}>
												{item.label}
											</ArkSelect.SelectItem>
										),
									)}
								</ArkSelect.SelectContent>
							</ArkSelect.Select>
						)}
					</Stack>

					{/* Tables List */}
					<div className="flex-1 h-full min-h-0 flex flex-col gap-2 overflow-hidden">
						<Stack className="flex-1 h-full" gap="2">
							<div className="px-4">
								<label className="text-xs font-medium text-foreground uppercase tracking-wide">
									Tables
								</label>
							</div>
							{tablesListQuery.isLoading ? (
								<div className="p-4 text-center">
									<span className="text-xs text-muted-foreground">
										Loading tables...
									</span>
								</div>
							) : (
								<div className="flex-1 overflow-hidden flex flex-col h-full">
									<div className="px-4">
										<input
											placeholder="Filter tables..."
											className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
											value={tableFilterValue}
											onChange={(e) => setTableFilterValue(e.target.value)}
										/>
									</div>
									<div className="mt-2 flex-1 overflow-y-auto">
										{filteredTables.length === 0 ? (
											<div className="p-4 text-center">
												<span className="text-xs text-muted-foreground">
													{tables.length === 0
														? "No tables found"
														: "No tables match filter"}
												</span>
											</div>
										) : (
											<Listbox.Root collection={tableCollection}>
												<Listbox.Content className="overflow-visible px-4">
													<Listbox.ItemGroup>
														{filteredTables.map((table) => (
															<Listbox.Item
																key={table.name}
																item={{
																	label: table.name,
																	value: table.name,
																}}
																className={`flex items-center px-3 py-2 cursor-pointer text-sm transition-colors rounded-md truncate ${
																	search.table === table.name
																		? "bg-primary/10 text-primary font-medium"
																		: "text-muted-foreground hover:bg-muted hover:text-foreground data-highlighted:bg-muted"
																}`}
																title={table.name}
																onClick={() => {
																	setTable(table.name);
																	navigate({
																		search: (prev) => ({
																			...prev,
																			table: table.name,
																			offset: 0,
																			filters: undefined,
																			orderBy: undefined,
																			orderDirection: undefined,
																			limit: 50,
																		}),
																	});
																}}
															>
																<Listbox.ItemText className="flex-1 truncate">
																	{table.name}
																</Listbox.ItemText>
															</Listbox.Item>
														))}
													</Listbox.ItemGroup>
												</Listbox.Content>
											</Listbox.Root>
										)}
									</div>
								</div>
							)}
						</Stack>
					</div>
				</div>

				{/* Content Area */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{search.table && search.schema ? (
						<>
							{/* View Toggle & Filter Controls */}
							<HStack className="border-b bg-muted/50 px-4 py-2 items-center justify-between">
								<div className="flex gap-2">
									<Tooltip content="View rows">
										<Button
											variant={
												search.viewMode === "rows" ? "default" : "outline"
											}
											size="sm"
											onClick={() =>
												navigate({
													search: (prev) => ({
														...prev,
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
											variant={
												search.viewMode === "structure" ? "default" : "outline"
											}
											size="sm"
											onClick={() =>
												navigate({
													search: (prev) => ({
														...prev,
														viewMode: "structure",
													}),
												})
											}
										>
											<LayoutGrid className="h-4 w-4" />
										</Button>
									</Tooltip>
									{search.viewMode === "rows" && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => {
												if (queryBuilder.filter.conditions.length === 0) {
													queryBuilder.addCondition();
												} else {
													navigate({
														search: (prev) => ({
															...prev,
															filtersOpened: !prev.filtersOpened,
														}),
													});
												}
											}}
											disabled={metadataQuery.isLoading}
										>
											<LucideListFilter className="h-3 w-3 mr-1" />
											Filters
											{` (${search.filters?.conditions.length || 0})`}
											{(search.filters?.conditions ?? []).length > 0 ? (
												search.filtersOpened ? (
													<LucideChevronUp className="h-3 w-3 ml-1" />
												) : (
													<LucideChevronDown className="h-3 w-3 ml-1" />
												)
											) : null}
										</Button>
									)}
									{search.viewMode === "rows" && (
										<OrderBySelect
											columnList={columnMetadata.map((col) => col.name)}
											orderBy={search.orderBy}
											orderDirection={search.orderDirection}
											onOrderChange={(orderBy, direction) => {
												navigate({
													search: (prev) => ({
														...prev,
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
								</div>
								{search.viewMode === "rows" && (
									<NaturalLanguageSearch
										className="w-full"
										availableColumns={columnMetadata.map((col) => col.name)}
										onApplyFilters={(parsed) => {
											const { filters = [], orderBy, limit } = parsed;
											console.log("onApplyFilters", filters);
											// 	// Map NL operators to query filter operators
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
												const currentConditions =
													search.filters?.conditions ?? [];
												// Remove filters related to the NL query
												if (parsed.clear) {
													queryBuilder.updateManyConditions(
														currentConditions.filter((current) => {
															return filters.some(
																(removed) =>
																	current.column === removed.field &&
																	current.operator === removed.operator &&
																	current.value === removed.value,
															);
														}),
													);
												} else {
													// Or add new filters
													queryBuilder.updateManyConditions(
														currentConditions
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
													search: (prev) => ({
														...prev,
														orderBy: orderBy.field,
														orderDirection: orderBy.direction,
													}),
												});
											}

											if (limit) {
												navigate({
													search: (prev) => ({
														...prev,
														limit: limit,
													}),
												});
											}
										}}
									/>
								)}
								{search.viewMode === "rows" && (
									<ColumnVisibilityControls
										table={dataTable}
										columnList={columnMetadata.map((col) => col.name)}
										minimal={true}
									/>
								)}
							</HStack>

							{/* Query Filter Builder */}
							{search.viewMode === "rows" &&
								rowsColumns.length > 0 &&
								search.filtersOpened && (
									<QueryFilterBuilder
										key={search.table}
										conditions={queryBuilder.filter.conditions}
										onUpdateCondition={queryBuilder.updateCondition}
										onRemoveCondition={queryBuilder.removeCondition}
										onLogicalOperatorChange={queryBuilder.setLogicalOperator}
										onAddCondition={queryBuilder.addCondition}
										onClearAll={queryBuilder.clearConditions}
										logicalOperator={queryBuilder.filter.logicalOperator}
										availableColumns={columnMetadata.map((col) => col.name)}
										isLoading={rowsQuery.isLoading}
									/>
								)}

							{/* Content */}
							<div className="flex-1 overflow-hidden flex flex-col">
								{search.viewMode === "structure" ? (
									<StructureTable
										columnMetadata={columnMetadata}
										isLoading={metadataQuery.isLoading}
									/>
								) : (
									<div className="flex-1 overflow-auto flex flex-col">
										{rowsQuery.isLoading ? (
											<Stack className="flex-1 flex items-center justify-center">
												<Spinner />
												<span className="text-muted-foreground">
													Loading table data...
												</span>
											</Stack>
										) : rowsQuery.isError ? (
											<div className="flex-1 flex items-center justify-center p-4">
												<Stack className="max-w-2xl w-full bg-destructive/10 border border-destructive/30 rounded-lg p-4">
													<span className="text-sm font-semibold text-destructive">
														Error loading table data
													</span>
													<span className="text-xs text-destructive/80 font-mono wrap-break-word whitespace-pre-wrap max-h-48 overflow-y-auto">
														{getErrorMessage(rowsQuery.error)}
													</span>
												</Stack>
											</div>
										) : (
											<DataTable
												table={dataTable}
												isLoading={rowsQuery.isLoading}
											/>
										)}
										{/* Status Bar */}
										<div className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
											<div className="flex items-center justify-between gap-4">
												{/* TODO when loading dont show 0 everywhere */}
												<HStack className="flex-1 whitespace-nowrap">
													<span>
														{tableDisplayName}
														<span> ({rowsColumns.length} columns)</span>
													</span>
													<span>
														{search.offset}-{search.offset + search.limit} out
														of {totalRowCount}
													</span>
												</HStack>
												<span>
													{queryResponse.timeTaken > 0 &&
														` • ${queryResponse.timeTaken}ms • Loaded ${formatRelativeTime(queryResponse.ranAt)}`}
												</span>
												<div className="flex items-center gap-3">
													{/* Pagination Controls */}
													<Pagination.Root
														count={totalRowCount}
														pageSize={search.limit}
														siblingCount={1}
														page={Math.floor(search.offset / search.limit) + 1}
														onPageChange={(details) => {
															navigate({
																search: (prev) => ({
																	...prev,
																	offset: (details.page - 1) * search.limit,
																}),
															});
														}}
													>
														<Pagination.Context>
															{(pagination) => (
																<div className="flex items-center gap-1">
																	<Pagination.PrevTrigger asChild>
																		<Button
																			variant="ghost"
																			size="sm"
																			className="h-6 px-1"
																		>
																			‹
																		</Button>
																	</Pagination.PrevTrigger>
																	<span className="text-xs mx-2">
																		{pagination.page} / {pagination.totalPages}
																	</span>
																	<Pagination.NextTrigger asChild>
																		<Button
																			variant="ghost"
																			size="sm"
																			className="h-6 px-1"
																		>
																			›
																		</Button>
																	</Pagination.NextTrigger>
																</div>
															)}
														</Pagination.Context>
													</Pagination.Root>

													<div className="flex items-center gap-2 text-foreground">
														<label className="font-medium uppercase tracking-wide whitespace-nowrap">
															Rows per page:
														</label>
														{/* TODO change to combobox so it can use a custom value */}
														<ArkSelect.Select
															className="w-20"
															value={[search.limit.toString()]}
															collection={ArkSelect.createListCollection({
																items: [
																	{ label: "50", value: "50" },
																	{ label: "100", value: "100" },
																	{ label: "250", value: "250" },
																	{ label: "500", value: "500" },
																],
															})}
															positioning={{ sameWidth: true }}
															onValueChange={(details: {
																value?: string[];
															}) => {
																const newLimit =
																	Number(details.value?.[0]) || 50;
																navigate({
																	search: (prev) => ({
																		...prev,
																		limit: newLimit,
																		offset: 0,
																	}),
																});
															}}
														>
															<ArkSelect.SelectControl>
																<ArkSelect.SelectTrigger>
																	<ArkSelect.SelectValueText />
																	<ArkSelect.SelectIndicator />
																</ArkSelect.SelectTrigger>
															</ArkSelect.SelectControl>
															<ArkSelect.SelectContent>
																{[
																	{ label: "50", value: "50" },
																	{ label: "100", value: "100" },
																	{ label: "250", value: "250" },
																	{ label: "500", value: "500" },
																].map((item) => (
																	<ArkSelect.SelectItem
																		key={item.value}
																		item={item}
																	>
																		{item.label}
																	</ArkSelect.SelectItem>
																))}
															</ArkSelect.SelectContent>
														</ArkSelect.Select>
													</div>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => rowsQuery.refetch()}
														className="h-6 px-2"
													>
														<RefreshCw className="h-3 w-3" />
													</Button>
												</div>
											</div>
										</div>
									</div>
								)}
							</div>
						</>
					) : (
						<div className="flex-1 flex items-center justify-center">
							<div className="text-center">
								<span className="text-muted-foreground">
									Select a schema and table to view data
								</span>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const StructureTable = (props: {
	columnMetadata: Array<{
		name: string;
		dataType: string;
		nullable: boolean;
		primaryKey: boolean;
		defaultValue: string | null;
	}>;
	isLoading: boolean;
}) => {
	{
		const { columnMetadata } = props;

		const structureColumns: Array<ColumnDef<(typeof columnMetadata)[number]>> =
			[
				{
					accessorKey: "name",
					header: "Name",
					enableResizing: true,
				},
				{
					accessorKey: "dataType",
					header: "Data Type",
					size: 120,
					minSize: 80,
					maxSize: 200,
					enableResizing: true,
					cell: (info) => (
						<span className="text-xs font-mono">{info.getValue<string>()}</span>
					),
				},
				{
					accessorKey: "nullable",
					header: "Nullable",
					enableResizing: true,
					cell: (info) => (
						<span className="text-xs">
							{info.getValue<boolean>() ? "Yes" : "No"}
						</span>
					),
				},
				{
					accessorKey: "primaryKey",
					header: "Primary Key",
					enableResizing: true,
					cell: (info) => (
						<span className="text-xs">
							{info.getValue<boolean>() ? "Yes" : "No"}
						</span>
					),
				},
				{
					accessorKey: "defaultValue",
					header: "Default Value",
					enableResizing: true,
					cell: (info) => {
						const value = info.getValue<string | null>();
						return (
							<span className="text-xs font-mono">{value ? value : "—"}</span>
						);
					},
				},
			];

		const structureTable = useDataTable({
			data: columnMetadata,
			columns: structureColumns,
			manualPagination: true,
			rowCount: columnMetadata.length,
		});

		return (
			<div className="flex-1 overflow-auto">
				<DataTable table={structureTable} isLoading={props.isLoading} />
			</div>
		);
	}
};
