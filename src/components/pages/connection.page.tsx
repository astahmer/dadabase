import { useMemo, useState, useCallback } from "react";
import {
	useQuery,
	useSuspenseQuery,
	useQueryClient,
	keepPreviousData,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Pagination } from "@ark-ui/react/pagination";
import { Listbox, createListCollection } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { useConnectionStorage } from "#src/hooks/use-connection-storage";
import { useQueryBuilder } from "#src/hooks/use-query-builder";
import {
	whereClauseParamsToQueryFilter,
	filterToWhereClause,
} from "#src/lib/query-filter";
import type { QueryFilter } from "#src/lib/query-filter";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/pg/start-fns/get-available-schemas.start";
import { listAvailableTablesQueryOptions } from "#src/server/pg/start-fns/get-available-tables.start";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { getTableColumnsQueryOptions } from "#src/server/pg/start-fns/get-table-columns.start";
import { redactConnectionUrl } from "#src/lib/redact-connection-url";
import { DataTable } from "../data-table";
import { ColumnVisibilityControls } from "../column-visibility";
import { QueryFilterBuilder } from "../query-filter-builder";
import { useDataTable } from "../use-data-table";
import * as ArkSelect from "../ui/select";
import { Button } from "../ui/button";
import { RefreshCw, Rows, LayoutGrid, Plus } from "lucide-react";
import { Route } from "#src/routes/connections/$connectionName";
import { Stack } from "../ui/layout.tsx";

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
	const connections = useSuspenseQuery(listDbConnectionQueryOptions);
	const connection = connections.data.find((c) => c.name === connectionName);

	const search = Route.useSearch();

	const { setSchema, setTable } = useConnectionStorage(connectionName);

	// Handler for filter changes - syncs to URL
	const handleFilterChange = useCallback(
		(updatedFilter: QueryFilter) => {
			const filterConfig = filterToWhereClause(updatedFilter);
			navigate({
				search: (prev) => ({
					...prev,
					filters: filterConfig || undefined,
					offset: 0, // Reset to first page when filters change
				}),
			});
		},
		[navigate],
	);

	// Convert deserialized WhereClauseParams from URL to QueryFilter for the builder
	// Zipson/TanStack Router automatically handles serialization/deserialization
	const initialQueryFilter = whereClauseParamsToQueryFilter(search.filters);
	const queryBuilder = useQueryBuilder(initialQueryFilter, handleFilterChange);

	// Extract search params with defaults
	const selectedSchema = search.schema;
	const selectedTable = search.table;
	const viewMode = search.viewMode || "rows";
	const limit = search.limit || 50;
	const offset = search.offset || 0;
	const orderBy = search.orderBy;
	const orderDirection = search.orderDirection || "asc";

	// Get schemas
	const schemasQuery = useQuery({
		...listAvailableSchemasQueryOptions({
			url: connection?.url || "",
		}),
		enabled: !!connection?.url,
	});

	// Get tables
	const tablesQuery = useQuery({
		...listAvailableTablesQueryOptions({
			url: connection?.url || "",
		}),
		enabled: !!connection?.url && !!selectedSchema,
	});

	// Get the filter config from query builder
	const filterConfig = queryBuilder.getWhereClause();

	// Convert readonly to mutable for server function
	const mutableFilterConfig = filterConfig
		? {
				conditions: [...filterConfig.conditions],
				logicalOperator: filterConfig.logicalOperator,
			}
		: undefined;

	// Get table data
	const tableDataQuery = useQuery({
		...queryTableDataQueryOptions({
			url: connection?.url || "",
			schema: selectedSchema || "",
			table: selectedTable || "",
			limit: limit,
			offset: offset,
			orderBy: orderBy,
			orderDirection: orderDirection,
			filters: mutableFilterConfig,
		}),
		placeholderData: keepPreviousData,
		enabled: !!connection?.url && !!selectedSchema && !!selectedTable,
	});

	// Get table column metadata
	const tableColumnsQuery = useQuery({
		...getTableColumnsQueryOptions({
			url: connection?.url || "",
			schema: selectedSchema || "",
			table: selectedTable || "",
		}),
		enabled: !!connection?.url && !!selectedSchema && !!selectedTable,
	});

	const schemas = schemasQuery.data || [];
	const tables = tablesQuery.data || [];

	// Filter tables based on search term
	const [tableFilterValue, setTableFilterValue] = useState("");
	const { contains } = useFilter({ sensitivity: "base" });

	const filteredTables = tables.filter(
		(table) =>
			contains(table.name, tableFilterValue) && selectedSchema === table.schema,
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

	const queryResponse = (tableDataQuery.data || {
		rows: [],
		rowCount: 0,
		timeTaken: 0,
		ranAt: 0,
	}) as {
		rows: Array<Record<string, unknown>>;
		rowCount: number;
		timeTaken: number;
		ranAt: number;
	};
	const tableData = queryResponse.rows;
	const totalRowCount = queryResponse.rowCount;

	const tableDisplayName = selectedTable
		? `${selectedSchema}.${selectedTable}`
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

	const columns: Array<ColumnDef<Record<string, unknown>>> =
		formattedTableData && formattedTableData.length > 0
			? Object.keys(formattedTableData[0]).map((key) => ({
					accessorKey: key,
					header: key,
					// size: 150,
					// minSize: 75,
					// maxSize: 500,
					enableResizing: true,
					enableSorting: true,
				}))
			: [];

	// Create sorting state from URL params
	const sortingState = orderBy
		? [
				{
					id: orderBy,
					desc: orderDirection === "desc",
				},
			]
		: [];

	const dataTable = useDataTable({
		data: formattedTableData,
		columns,
		initialState: {
			pagination: {
				pageIndex: Math.floor(offset / limit),
				pageSize: limit,
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
				pageIndex: Math.floor(offset / limit),
				pageSize: limit,
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
						<p className="text-xs text-muted-foreground truncate">
							{redactedUrl}
						</p>
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
						{schemasQuery.isLoading ? (
							<div className="flex items-center justify-center rounded-md border border-input bg-card px-3 py-2 min-h-9">
								<span className="text-xs text-muted-foreground">
									Loading...
								</span>
							</div>
						) : (
							<ArkSelect.Select
								className="w-full"
								value={selectedSchema ? [selectedSchema] : []}
								collection={schemaCollection}
								positioning={{ sameWidth: true }}
								disabled={schemasQuery.isLoading}
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
							{tablesQuery.isLoading ? (
								<div className="p-4 text-center">
									<p className="text-xs text-muted-foreground">
										Loading tables...
									</p>
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
												<p className="text-xs text-muted-foreground">
													{tables.length === 0
														? "No tables found"
														: "No tables match filter"}
												</p>
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
																	selectedTable === table.name
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
																			viewMode: "rows",
																			filters: undefined,
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
					{selectedTable && selectedSchema ? (
						<>
							{/* View Toggle & Filter Controls */}
							<div className="border-b bg-muted/50 px-4 py-2 flex items-center justify-between">
								<div className="flex gap-2">
									<Button
										variant={viewMode === "rows" ? "default" : "outline"}
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
									<Button
										variant={viewMode === "structure" ? "default" : "outline"}
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
									{viewMode === "rows" && (
										<Button
											variant="outline"
											size="sm"
											onClick={queryBuilder.addCondition}
											disabled={tableDataQuery.isLoading}
										>
											<Plus className="h-3 w-3 mr-1" />
											Add Filter
										</Button>
									)}
								</div>
								{viewMode === "rows" && (
									<ColumnVisibilityControls table={dataTable} minimal={true} />
								)}
							</div>

							{/* Query Filter Builder */}
							{viewMode === "rows" && columns.length > 0 && (
								<QueryFilterBuilder
									key={selectedTable}
									conditions={queryBuilder.filter.conditions}
									onUpdateCondition={queryBuilder.updateCondition}
									onRemoveCondition={queryBuilder.removeCondition}
									onLogicalOperatorChange={queryBuilder.setLogicalOperator}
									logicalOperator={queryBuilder.filter.logicalOperator}
									availableColumns={Object.keys(formattedTableData[0] || {})}
									isLoading={tableDataQuery.isLoading}
								/>
							)}

							{/* Content */}
							<div className="flex-1 overflow-hidden flex flex-col">
								{viewMode === "structure" ? (
									formattedTableData && formattedTableData.length > 0 ? (
										<StructureTable
											formattedTableData={formattedTableData}
											columnMetadata={tableColumnsQuery.data}
										/>
									) : (
										<div className="p-4 overflow-auto flex-1">
											<div className="space-y-2">
												<h3 className="font-semibold text-sm">
													{tableDisplayName} - Columns
												</h3>
												<p className="text-sm text-muted-foreground">
													No data available to inspect structure
												</p>
											</div>
										</div>
									)
								) : (
									<div className="flex-1 overflow-auto flex flex-col">
										{tableDataQuery.isLoading ? (
											<div className="flex-1 flex items-center justify-center">
												<p className="text-muted-foreground">
													Loading table data...
												</p>
											</div>
										) : tableDataQuery.isError ? (
											<div className="flex-1 flex items-center justify-center">
												<p className="text-destructive">
													Error loading table data
												</p>
											</div>
										) : (
											<DataTable
												table={dataTable}
												isLoading={tableDataQuery.isLoading}
											/>
										)}
										{/* Status Bar */}
										<div className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
											<div className="flex items-center justify-between gap-4">
												<span className="flex-1">
													{tableDisplayName} • {formattedTableData.length} rows
													(0-
													{formattedTableData.length}) • {columns.length}{" "}
													columns
													{queryResponse.timeTaken > 0 &&
														` • ${queryResponse.timeTaken}ms • Loaded ${formatRelativeTime(queryResponse.ranAt)}`}
												</span>
												<div className="flex items-center gap-3">
													{/* Pagination Controls */}
													<Pagination.Root
														count={totalRowCount}
														pageSize={limit}
														siblingCount={1}
														page={Math.floor(offset / limit) + 1}
														onPageChange={(details) => {
															navigate({
																search: (prev) => ({
																	...prev,
																	offset: (details.page - 1) * limit,
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

													<div className="flex items-center gap-2">
														<label className="font-medium uppercase tracking-wide whitespace-nowrap">
															Rows per page:
														</label>
														<ArkSelect.Select
															className="w-20"
															value={[limit.toString()]}
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
														onClick={() => tableDataQuery.refetch()}
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
								<p className="text-muted-foreground">
									Select a schema and table to view data
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const StructureTable = (props: {
	formattedTableData: Record<string, unknown>[];
	columnMetadata?: Array<{
		name: string;
		dataType: string;
		nullable: boolean;
		primaryKey: boolean;
		defaultValue: string | null;
	}>;
}) => {
	{
		const { formattedTableData, columnMetadata } = props;

		// Create structure metadata for columns using backend data when available
		const structureData = Object.keys(formattedTableData[0]).map((colName) => {
			const metadata = columnMetadata?.find((col) => col.name === colName);

			if (metadata) {
				return {
					name: colName,
					datatype: metadata.dataType,
					nullable: metadata.nullable,
					primaryKey: metadata.primaryKey,
					defaultValue: metadata.defaultValue,
				};
			}

			// Fallback to inference from data if metadata not available
			const sample = formattedTableData[0][colName];
			let dataType: string = typeof sample;
			if (Array.isArray(sample)) {
				dataType = "array";
			} else if (sample === null) {
				dataType = "null";
			} else if (
				sample instanceof Date ||
				(typeof sample === "string" && /^\d{4}-\d{2}-\d{2}T/.test(sample))
			) {
				dataType = "timestamp";
			}
			return {
				name: colName,
				datatype: dataType,
				nullable: formattedTableData.some((row) => row[colName] === null),
				primaryKey: false,
				defaultValue: null,
			};
		});

		const structureColumns: Array<ColumnDef<(typeof structureData)[number]>> = [
			{
				accessorKey: "name",
				header: "Name",
				enableResizing: true,
			},
			{
				accessorKey: "datatype",
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
			data: structureData,
			columns: structureColumns,
			manualPagination: true,
			rowCount: structureData.length,
		});

		return (
			<div className="flex-1 overflow-auto">
				<DataTable table={structureTable} isLoading={false} />
			</div>
		);
	}
};
