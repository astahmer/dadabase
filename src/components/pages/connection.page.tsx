import { useConnectionStorage } from "#src/hooks/use-connection-storage";
import { useQueryBuilder } from "#src/hooks/use-query-builder";
import { getColumnTextAlignment } from "#src/lib/data-type-utils";
import { redactConnectionUrl } from "#src/lib/redact-connection-url";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/pg/start-fns/get-available-schemas.start";
import { listAvailableTablesQueryOptions } from "#src/server/pg/start-fns/get-available-tables.start";
import { getTableColumnsQueryOptions } from "#src/server/pg/start-fns/get-table-columns.start";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { listAvailableDatabase } from "#src/server/pg/start-fns/get-available-database-list.start.ts";
import { useListCollection } from "@ark-ui/react";
import { Listbox, createListCollection } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { Pagination } from "@ark-ui/react/pagination";
import {
	keepPreviousData,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { AccessorKeyColumnDef, ColumnDef } from "@tanstack/react-table";
import {
	ChevronDownIcon,
	LayoutGrid,
	LucideChevronDown,
	LucideChevronUp,
	LucideListFilter,
	LucidePlus,
	RefreshCw,
	Rows,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getErrorMessage } from "../../lib/get-error-message.ts";
import { BulkActionBar } from "../bulk-action-bar";
import { ColumnVisibilityControls } from "../column-visibility";
import { DataTable } from "../data-table";
import { NaturalLanguageSearch } from "../natural-language-search";
import { OrderBySelect } from "../order-by-select";
import { QueryFilterBuilder } from "../query-filter-builder";
import { Button } from "../ui/button";
import * as Breadcrumb from "../ui/breadcrumb";
import { Badge } from "../ui/badge";
import { Checkbox, CheckboxControl } from "../ui/checkbox.tsx";
import { ColumnHeaderWithInfo } from "../ui/column-header-with-info";
import { DarkModeToggle } from "../ui/dark-mode-toggle";
import { DataTypeBadge } from "../ui/data-type-badge";
import { JsonCell } from "../ui/json-cell";
import { HStack, Stack } from "../ui/layout.tsx";
import * as ListboxMenu from "../ui/listbox-menu";
import { PrimaryKeyIcon } from "../ui/primary-key-icon";
import { UniqueConstraintIcon } from "../ui/unique-constraint-icon";
import * as ArkSelect from "../ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../ui/sheet.tsx";
import { Spinner } from "../ui/spinner.tsx";
import { Tooltip } from "../ui/tooltip.tsx";
import { useDataTable } from "../use-data-table";
import { ConnectionForm } from "./connection.form.tsx";
import { DateTime } from "effect";
import { RowActionsMenu } from "../ui/row-actions-menu";

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

function getDbNameFromConnectionUrl(connectionUrl: string) {
	try {
		const url = new URL(connectionUrl);
		const databaseName = url.pathname.replace("/", "");
		return databaseName;
	} catch {
		return "";
	}
}

function replaceDatabaseInConnectionUrl(
	connectionUrl: string,
	newDatabase: string,
) {
	try {
		const url = new URL(connectionUrl);
		url.pathname = `/${newDatabase}`;
		return url.toString();
	} catch {
		return connectionUrl;
	}
}

function safeJsonParse(value: string) {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

export const ConnectionPage = ({ connectionName }: ConnectionPageProps) => {
	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const [showAddConnectionDrawer, setShowAddConnectionDrawer] = useState(false);

	const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
	const connection = connectionList.data.find((c) => c.name === connectionName);
	const connectionUrl = connection?.url || "";
	const search = useSearch({ from: "/connections/$connectionName" });

	const { setSchema, setTable } = useConnectionStorage(connectionName);

	// Use the selected database from search params, fall back to the default
	const defaultDatabaseName = getDbNameFromConnectionUrl(connectionUrl);
	const selectedDbName = search.dbName;

	// Build the connection URL with the selected database
	const activeConnectionUrl = selectedDbName
		? replaceDatabaseInConnectionUrl(connectionUrl, selectedDbName)
		: connectionUrl;

	const databaseListQuery = useQuery({
		...listAvailableDatabase({ url: connectionUrl }),
		enabled: !!connection?.url,
		retry: 3,
	});

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
		...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
		enabled: !!activeConnectionUrl,
		retry: 3,
	});

	const tablesListQuery = useQuery({
		...listAvailableTablesQueryOptions({ url: activeConnectionUrl }),
		enabled: !!activeConnectionUrl && !!search.schema,
		retry: 3,
	});

	const rowsQuery = useQuery({
		...queryTableDataQueryOptions({
			url: activeConnectionUrl,
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
		placeholderData: keepPreviousData,
		enabled: !!activeConnectionUrl && !!search.schema && !!search.table,
	});
	// console.log("query", {
	// 	url: activeConnectionUrl,
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
			url: activeConnectionUrl,
			schema: search.schema || "",
			table: search.table || "",
		}),
		enabled: !!activeConnectionUrl && !!search.schema && !!search.table,
	});
	const columnMetadata = metadataQuery.data ?? [];

	const allSchemaList = schemaListQuery.data || [];
	const tableList = tablesListQuery.data || [];
	const schemaList = allSchemaList.filter((schema) =>
		tableList.some((t) => t.schema === schema),
	);

	// Calculate counts for databases and schemas
	const schemaTableCounts = useMemo(() => {
		const counts = new Map<string, number>();
		tableList.forEach((table) => {
			if (table.schema) {
				counts.set(table.schema, (counts.get(table.schema) || 0) + 1);
			}
		});
		return counts;
	}, [tableList]);

	// Filter tables based on search term
	const { contains } = useFilter({ sensitivity: "base" });

	const filteredTables = useMemo(
		() =>
			tableList.filter(
				(table) =>
					(search.tableFilter
						? contains(table.name, search.tableFilter)
						: true) && search.schema === table.schema,
			),
		[tableList, search.tableFilter, search.schema, contains],
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
	const rowsList = queryResponse.rows;
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

			if (value.at(0) === "{" && value.at(-1) === "}") {
				// Check if it looks like a JSON object
				return safeJsonParse(value);
			}
		}
		return value;
	};

	const formattedTableRowsData = useMemo(
		() =>
			rowsList.map((row) => {
				const formatted: Record<string, unknown> = {};
				for (const [key, value] of Object.entries(row)) {
					formatted[key] = formatTableValue(value);
				}
				return formatted;
			}),
		[rowsList],
	);

	const rowsColumns: Array<ColumnDef<Record<string, unknown>>> = useMemo(
		() =>
			columnMetadata.length > 0
				? [
						{
							id: "__select",
							header: ({ table }: { table: any }) => {
								const checkboxRef = useRef<HTMLInputElement>(null);
								useEffect(() => {
									if (checkboxRef.current) {
										checkboxRef.current.indeterminate =
											table.getIsSomeRowsSelected();
									}
								}, [table]);
								return (
									<Checkbox
										className="flex items-center gap-2"
										checked={table.getIsAllRowsSelected()}
										onChange={table.getToggleAllRowsSelectedHandler()}
										aria-label="Select all rows"
									>
										<CheckboxControl />
									</Checkbox>
								);
							},
							cell: ({ row }: { row: any }) => (
								<Checkbox
									className="flex items-center gap-2"
									checked={row.getIsSelected()}
									disabled={!row.getCanSelect()}
									onChange={row.getToggleSelectedHandler()}
									aria-label="Select row"
								>
									<CheckboxControl />
								</Checkbox>
							),
							size: 40,
							minSize: 40,
							maxSize: 40,
							enableResizing: false,
							enableSorting: false,
						},
						{
							id: "__actions",
							header: () => null,
							cell: ({ row }: { row: any }) => (
								<RowActionsMenu row={row.original} />
							),
							size: 40,
							minSize: 40,
							maxSize: 40,
							enableResizing: false,
							enableSorting: false,
						},
						...columnMetadata.map(
							(col) =>
								({
									accessorKey: col.name,
									header: () => (
										<ColumnHeaderWithInfo
											columnName={col.name}
											dataType={col.dataType}
											showBadge
											isPrimaryKey={col.primaryKey}
											isUnique={col.unique}
										>
											<PrimaryKeyIcon isPrimaryKey={col.primaryKey} />
											<UniqueConstraintIcon isUnique={col.unique} />
										</ColumnHeaderWithInfo>
									),
									meta: {
										textAlign: getColumnTextAlignment(col.dataType),
									},
									cell: col.dataType.toLowerCase().includes("json")
										? (ctx) => <JsonCell value={ctx.row.original[col.name]} />
										: (ctx) => {
												const value = ctx.getValue();
												if (typeof value === "object" && value !== null) {
													return (
														<JsonCell value={ctx.row.original[col.name]} />
													);
												}
												// Handle boolean values with colored badges
												if (typeof value === "boolean") {
													return (
														<Badge
															colorPalette={value ? "success" : "error"}
															size="xs"
														>
															{value ? "true" : "false"}
														</Badge>
													);
												}
												// Handle null/undefined with a neutral badge
												if (value === null || value === undefined) {
													return (
														<Badge colorPalette="muted" size="xs">
															null
														</Badge>
													);
												}
												return ctx.renderValue();
											},
									enableResizing: true,
									enableSorting: true,
								}) as ColumnDef<any> as any,
						),
					]
				: [],
		[columnMetadata],
	);

	// Create sorting state from URL params
	const sortingState = useMemo(
		() =>
			search.orderBy
				? [
						{
							id: search.orderBy,
							desc: search.orderDirection === "desc",
						},
					]
				: [],
		[search.orderBy, search.orderDirection],
	);

	// Create column visibility state from URL params
	// Parse the comma-separated list of hidden columns
	const columnVisibilityState = useMemo(() => {
		const visibility: Record<string, boolean> = {};

		// By default, all columns are visible
		rowsColumns.forEach((col) => {
			visibility[
				col.id || ((col as AccessorKeyColumnDef<any>).accessorKey as string)
			] = true;
		});

		// Hide columns specified in the URL (stored as hidden columns)
		if (search.hiddenColumnList?.length) {
			search.hiddenColumnList.forEach((col) => {
				visibility[col.trim()] = false;
			});
		}

		return visibility;
	}, [search.hiddenColumnList, rowsColumns]);

	const rowsDataTable = useDataTable({
		data: formattedTableRowsData,
		columns: rowsColumns,
		state: {
			pagination: {
				pageIndex: Math.floor(search.offset / search.limit),
				pageSize: search.limit,
			},
			sorting: sortingState,
			columnVisibility: columnVisibilityState,
		},
		manualPagination: true,
		manualSorting: true,
		enableRowSelection: true,
		rowCount: totalRowCount,
		defaultColumn: {
			size: 150,
			minSize: 20,
			maxSize: 500,
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
		onColumnVisibilityChange: (updater) => {
			const newVisibility =
				typeof updater === "function"
					? updater(columnVisibilityState)
					: updater;
			// Store hidden columns as array in URL (inverse of visible)
			const hiddenCols = Object.keys(newVisibility)
				.filter((key) => !newVisibility[key])
				.sort();
			navigate({
				search: (prev) => ({
					...prev,
					hiddenColumnList: hiddenCols.length > 0 ? hiddenCols : undefined,
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
		items: schemaList.map((s: string) => {
			const tableCount = schemaTableCounts.get(s) || 0;
			return {
				label: `${s} (${tableCount} tables)`,
				value: s,
			};
		}),
	});

	const filterConditions = search.filters?.conditions ?? [];

	return (
		<div className="h-screen bg-background flex flex-col">
			{/* Header */}
			<div className="border-b bg-card px-4 py-2 sm:px-6 space-y-2">
				<div className="flex items-center justify-between gap-4">
					<div className="flex-1 min-w-0">
						<Breadcrumb.BreadcrumbRoot>
							<Breadcrumb.BreadcrumbList size="sm">
								<Breadcrumb.BreadcrumbItem>
									<Breadcrumb.BreadcrumbLink
										href="#"
										onClick={(e) => {
											e.preventDefault();
											navigate({ to: "/" });
										}}
									>
										Connections
									</Breadcrumb.BreadcrumbLink>
								</Breadcrumb.BreadcrumbItem>
								<Breadcrumb.BreadcrumbSeparator />
								<Breadcrumb.BreadcrumbItem>
									<ListboxMenu.ListboxMenuRoot>
										<ListboxMenu.ListboxMenuTrigger
											variant="unstyled"
											size="unstyled"
											asChild
										>
											<Button variant="ghost" size="sm">
												<span className="text-foreground">
													{connection.name}
												</span>
												<ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
											</Button>
										</ListboxMenu.ListboxMenuTrigger>
										<ListboxMenu.ListboxMenuContent>
											<ListboxMenu.ListboxRoot
												collection={createListCollection({
													items: connectionList.data.map((conn) => ({
														label: conn.name,
														value: conn.name,
													})),
												})}
												onValueChange={(details) => {
													if (
														details.value &&
														details.value[0] !== connectionName
													) {
														navigate({
															to: "/connections/$connectionName",
															params: { connectionName: details.value[0] },
														});
													}
												}}
											>
												<ListboxMenu.ListboxMenuList>
													{connectionList.data.map((conn) => (
														<ListboxMenu.ListboxMenuItem
															key={conn.name}
															item={{ label: conn.name, value: conn.name }}
															showIndicator={conn.name === connectionName}
														>
															{conn.name}
														</ListboxMenu.ListboxMenuItem>
													))}
													<div className="border-t" />
													<ListboxMenu.ListboxMenuItem
														item={{
															label: "Add new connection",
															value: "__add",
														}}
														onClick={() => {
															setShowAddConnectionDrawer(true);
														}}
													>
														<HStack gap="1" align="center">
															<LucidePlus className="h-3 w-3" />
															<span>Add new connection</span>
														</HStack>
													</ListboxMenu.ListboxMenuItem>
												</ListboxMenu.ListboxMenuList>
											</ListboxMenu.ListboxRoot>
										</ListboxMenu.ListboxMenuContent>
									</ListboxMenu.ListboxMenuRoot>
								</Breadcrumb.BreadcrumbItem>
							</Breadcrumb.BreadcrumbList>
						</Breadcrumb.BreadcrumbRoot>
						<span className="text-xs text-muted-foreground truncate block">
							{redactedUrl}
						</span>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								navigate({
									search: (prev) => ({
										dbName: prev.dbName,
										schema: prev.schema,
										table: prev.table,
										viewMode: prev.viewMode,
										tableSize: prev.tableSize,
										hiddenColumnList: [],
										filters: undefined,
										filtersOpened: false,
										offset: 0, // Reset to first page when filters change
										limit: 50,
										orderBy: undefined,
										orderDirection: undefined,
									}),
								});
							}}
						>
							Reset page
						</Button>
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
						<DarkModeToggle />
					</div>
				</div>
			</div>

			{/* Main Layout */}
			<div className="flex-1 flex h-full min-h-0">
				{/* Sidebar */}
				<div className="w-64 border-r bg-muted/30 flex flex-col overflow-hidden h-full min-h-0">
					{/* Database Selector */}
					<Stack className="px-4 pt-4 shrink-0" gap="2">
						<label className="text-xs font-medium text-foreground uppercase tracking-wide">
							Database
						</label>
						{databaseListQuery.isError ? (
							<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
								<div className="text-xs font-semibold text-destructive mb-1">
									Failed to load databases
								</div>
								<div className="text-xs text-destructive/80 font-mono wrap-break-word mb-2 max-h-24 overflow-y-auto">
									{getErrorMessage(databaseListQuery.error)}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => databaseListQuery.refetch()}
									className="w-full text-xs h-7"
								>
									Retry
								</Button>
							</div>
						) : databaseListQuery.isLoading ? (
							<div className="flex items-center justify-center rounded-md border border-input bg-card px-3 py-2 min-h-9 gap-2">
								<Spinner />
								<div className="text-xs text-muted-foreground">
									{databaseListQuery.failureCount > 0 ? (
										<>
											Failed {databaseListQuery.failureCount} time
											{databaseListQuery.failureCount > 1 ? "s" : ""},
											retrying...
										</>
									) : (
										"Loading databases..."
									)}
								</div>
							</div>
						) : (
							<ArkSelect.Select
								className="w-full"
								value={
									search.dbName
										? [search.dbName]
										: defaultDatabaseName
											? [defaultDatabaseName]
											: []
								}
								collection={ArkSelect.createListCollection({
									items: (databaseListQuery.data || []).map((db: any) => ({
										label: db.datname,
										value: db.datname,
									})),
								})}
								positioning={{ sameWidth: true }}
								disabled={databaseListQuery.isLoading}
								onValueChange={(details: { value?: string[] }) => {
									const newDbName = details.value?.[0];
									if (newDbName) {
										navigate({
											search: (prev) => ({
												...prev,
												dbName: newDbName,
												schema: undefined,
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
										<ArkSelect.SelectValueText placeholder="Select database" />
										<ArkSelect.SelectIndicator />
									</ArkSelect.SelectTrigger>
								</ArkSelect.SelectControl>
								<ArkSelect.SelectContent>
									{(databaseListQuery.data || []).map((db: any) => (
										<ArkSelect.SelectItem
											key={db.datname}
											item={{ label: db.datname, value: db.datname }}
										>
											{db.datname}
										</ArkSelect.SelectItem>
									))}
								</ArkSelect.SelectContent>
							</ArkSelect.Select>
						)}
					</Stack>
					{/* Schema Selector */}
					<Stack className="px-4 pt-4 shrink-0" gap="2">
						<label className="text-xs font-medium text-foreground uppercase tracking-wide">
							Schema
						</label>
						{schemaListQuery.isError ? (
							<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
								<div className="text-xs font-semibold text-destructive mb-1">
									Failed to load schemas
								</div>
								<div className="text-xs text-destructive/80 font-mono wrap-break-word mb-2 max-h-24 overflow-y-auto">
									{getErrorMessage(schemaListQuery.error)}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => schemaListQuery.refetch()}
									className="w-full text-xs h-7"
								>
									Retry
								</Button>
							</div>
						) : schemaListQuery.isLoading ? (
							<div className="flex items-center justify-center rounded-md border border-input bg-card px-3 py-2 min-h-9 gap-2">
								<Spinner />
								<div className="text-xs text-muted-foreground">
									{schemaListQuery.failureCount > 0 ? (
										<>
											Failed {schemaListQuery.failureCount} time
											{schemaListQuery.failureCount > 1 ? "s" : ""}, retrying...
										</>
									) : (
										"Loading schemas..."
									)}
								</div>
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
					</Stack>{" "}
					{/* Tables List */}
					<div className="flex-1 h-full min-h-0 flex flex-col gap-2 overflow-hidden">
						<Stack className="flex-1 h-full" gap="2">
							<div className="px-4">
								<label className="text-xs font-medium text-foreground uppercase tracking-wide">
									Tables
								</label>
							</div>
							{tablesListQuery.isError ? (
								<div className="p-4">
									<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
										<div className="text-xs font-semibold text-destructive mb-1">
											Failed to load tables
										</div>
										<div className="text-xs text-destructive/80 font-mono wrap-break-word mb-2 max-h-24 overflow-y-auto">
											{getErrorMessage(tablesListQuery.error)}
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => tablesListQuery.refetch()}
											className="w-full text-xs h-7"
										>
											Retry
										</Button>
									</div>
								</div>
							) : tablesListQuery.isLoading ? (
								<div className="p-4 flex items-center justify-center gap-2">
									<Spinner />
									<div className="text-xs text-muted-foreground">
										{tablesListQuery.failureCount > 0 ? (
											<>
												Failed {tablesListQuery.failureCount} time
												{tablesListQuery.failureCount > 1 ? "s" : ""},
												retrying...
											</>
										) : (
											"Loading tables..."
										)}
									</div>
								</div>
							) : (
								<div className="flex-1 overflow-hidden flex flex-col h-full">
									<div className="px-4">
										<input
											placeholder="Filter tables..."
											className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
											defaultValue={search.tableFilter}
											onChange={(e) =>
												navigate({
													replace: true,
													search: (prev) => ({
														...prev,
														tableFilter: e.target.value,
													}),
												})
											}
										/>
									</div>
									<div className="mt-2 flex-1 overflow-y-auto">
										{filteredTables.length === 0 ? (
											<div className="p-4 text-center">
												<span className="text-xs text-muted-foreground">
													{tableList.length === 0
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
							<div className="relative border-b bg-muted/50">
								{(rowsQuery.isLoading || metadataQuery.isLoading) && (
									<div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-primary via-primary to-transparent animate-pulse" />
								)}
								<HStack className="px-4 py-2 items-center justify-between">
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
													search.viewMode === "structure"
														? "default"
														: "outline"
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
												variant={
													filterConditions.length > 0 ? "default" : "outline"
												}
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
												className={filterConditions.length > 0 ? "gap-2" : ""}
											>
												<LucideListFilter className="h-3 w-3" />
												{filterConditions.length > 0
													? search.filtersOpened
														? "Filters"
														: "Open filters"
													: "Add filter"}
												{filterConditions.length > 0 && (
													<span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-semibold bg-background/20">
														{search.filters?.conditions.length || 0}
													</span>
												)}
												{filterConditions.length > 0 ? (
													search.filtersOpened ? (
														<LucideChevronUp className="h-3 w-3" />
													) : (
														<LucideChevronDown className="h-3 w-3" />
													)
												) : null}
											</Button>
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
																		operator:
																			operatorMap[f.operator] || "equals",
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
											// key={(search.hiddenColumnList ?? []).join(",")}
											key={JSON.stringify(columnVisibilityState)}
											table={rowsDataTable}
											columnList={columnMetadata.map((col) => col.name)}
											minimal={true}
										/>
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
								</HStack>
							</div>

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
									<div className="flex-1 p-2 pt-0 overflow-auto">
										<StructureTable
											columnMetadata={columnMetadata}
											isLoading={metadataQuery.isLoading}
											tableSize={search.tableSize}
										/>
									</div>
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
											<>
												<DataTable
													table={rowsDataTable}
													isLoading={rowsQuery.isLoading}
													size={search.tableSize}
												/>
												<BulkActionBar
													selectedCount={
														rowsDataTable.getSelectedRowModel().rows.length
													}
													onDelete={() => {
														// Placeholder - implement deletion logic
														console.log("Delete selected rows");
													}}
													onExport={() => {
														// Placeholder - implement export logic
														console.log("Export selected rows");
													}}
													isLoading={rowsQuery.isLoading}
												/>
											</>
										)}
										{/* Status Bar */}
										<div className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
											<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4">
												{/* Left side - Table info */}
												<HStack className="flex-1 min-w-0 whitespace-nowrap overflow-x-auto">
													{rowsQuery.isLoading ? (
														<span className="text-muted-foreground/50">
															Loading...
														</span>
													) : (
														<>
															<span className="truncate">
																{tableDisplayName}
																<span className="hidden sm:inline">
																	{" "}
																	({rowsColumns.length} columns)
																</span>
															</span>
															<span className="shrink-0">
																{search.offset}-
																{Math.min(
																	totalRowCount,
																	search.offset + search.limit,
																)}{" "}
																<span className="hidden md:inline">
																	out of{" "}
																</span>
																<span className="hidden md:inline">
																	{totalRowCount}
																</span>
															</span>
														</>
													)}
												</HStack>
												{/* Middle - Query time info */}
												<span className="hidden lg:inline text-muted-foreground text-xs">
													{queryResponse.timeTaken > 0 && (
														<HStack gap="1" align="center">
															{`${queryResponse.timeTaken}ms`}
															<span>•</span>
															<Tooltip
																content={DateTime.formatIso(
																	DateTime.unsafeMake(queryResponse.ranAt),
																)}
															>
																<span>
																	Loaded{" "}
																	{formatRelativeTime(queryResponse.ranAt)}
																</span>
															</Tooltip>
														</HStack>
													)}
												</span>
												{/* Right side - Controls */}
												<div className="flex flex-wrap items-center gap-2 lg:gap-3">
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
															Limit:
														</label>
														<RowsPerPageSelector
															value={search.limit}
															onValueChange={(newLimit) => {
																navigate({
																	search: (prev) => ({
																		...prev,
																		limit: newLimit,
																		offset: 0,
																	}),
																});
															}}
														/>
													</div>
													<div className="flex items-center gap-2 text-foreground">
														<ArkSelect.Select
															className="w-28"
															value={[search.tableSize]}
															collection={ArkSelect.createListCollection({
																items: [
																	{ label: "Compact", value: "compact" },
																	{ label: "Cozy", value: "cozy" },
																	{
																		label: "Comfortable",
																		value: "comfortable",
																	},
																],
															})}
															positioning={{ sameWidth: true }}
															onValueChange={(details: {
																value?: string[];
															}) => {
																const newSize = (details.value?.[0] ||
																	"cozy") as "compact" | "cozy" | "comfortable";
																navigate({
																	search: (prev) => ({
																		...prev,
																		tableSize: newSize,
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
																	{ label: "Compact", value: "compact" },
																	{ label: "Cozy", value: "cozy" },
																	{
																		label: "Comfortable",
																		value: "comfortable",
																	},
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
						// Show error if schema query failed, otherwise ask to select schema/table
						<div className="flex-1 flex items-center justify-center">
							{schemaListQuery.isError ? (
								<div className="max-w-2xl w-full mx-4 bg-destructive/10 border border-destructive/30 rounded-lg p-6">
									<div className="flex flex-col gap-3">
										<span className="text-sm font-semibold text-destructive">
											Failed to connect to database
										</span>
										<span className="text-xs text-destructive/80 font-mono wrap-break-word whitespace-pre-wrap max-h-48 overflow-y-auto">
											{getErrorMessage(schemaListQuery.error)}
										</span>
										<div className="flex gap-2 pt-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => schemaListQuery.refetch()}
											>
												Retry Connection
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													navigate({ to: "/" });
												}}
											>
												Back to Connections
											</Button>
										</div>
									</div>
								</div>
							) : (
								<div className="text-center">
									<span className="text-muted-foreground">
										Select a schema and table to view data
									</span>
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Add Connection Drawer */}
			<Sheet
				open={showAddConnectionDrawer}
				onOpenChange={(details) => {
					if (!details.open) setShowAddConnectionDrawer(false);
				}}
			>
				<SheetContent className="z-50 w-full sm:max-w-[540px]">
					<SheetHeader>
						<SheetTitle>Add Connection</SheetTitle>
						<SheetDescription>
							Create a new database connection
						</SheetDescription>
					</SheetHeader>
					<div className="px-4">
						<ConnectionForm
							mode="create"
							onSuccess={(newConnectionName) => {
								setShowAddConnectionDrawer(false);
								// Navigate to the new connection page
								if (newConnectionName) {
									navigate({
										to: "/connections/$connectionName",
										params: { connectionName: newConnectionName },
									});
								}
							}}
						/>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
};

interface RowsPerPageSelectorProps {
	value: number;
	onValueChange: (newLimit: number) => void;
}

const items = [
	{ label: "50", value: 50 },
	{ label: "100", value: 100 },
	{ label: "250", value: 250 },
	{ label: "500", value: 500 },
];

function RowsPerPageSelector({
	value,
	onValueChange,
}: RowsPerPageSelectorProps) {
	const [open, setOpen] = useState(false);

	const filters = useFilter({ sensitivity: "base" });
	const list = useListCollection({
		initialItems: items,
		filter: filters.contains,
	});

	const filteredItems = list.collection.items;

	const handleSelect = (newValue: number) => {
		onValueChange(newValue);
		setOpen(false);
	};

	return (
		<ListboxMenu.ListboxMenuRoot
			open={open}
			onOpenChange={(e) => setOpen(e.open)}
		>
			<ListboxMenu.ListboxMenuTrigger size="sm" asChild>
				<Button
					variant="outline"
					className="flex flex-1 items-center justify-between gap-5 bg-transparent px-3 py-2 outline-none outline-hidden placeholder:text-muted-foreground/70 has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 data-placeholder-shown:text-muted-foreground"
				>
					<span className="text-sm font-medium text-foreground">{value}</span>
					<ChevronDownIcon className="size-4 shrink-0 in-aria-invalid:text-destructive/80 text-muted-foreground/80" />
				</Button>
			</ListboxMenu.ListboxMenuTrigger>
			<ListboxMenu.ListboxMenuContent>
				<ListboxMenu.ListboxRoot collection={list.collection}>
					<ListboxMenu.ListboxMenuFilterContainer>
						<Stack>
							<ListboxMenu.ListboxMenuFilterInput
								placeholder="Use a custom value"
								autoFocus
								type="number"
								// onChange={(e) => {
								// 	list.filter(e.target.value);
								// }}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										const target = e.target as HTMLInputElement;
										const exits = list.collection.items.some(
											(item) => item.value === target.valueAsNumber,
										);
										if (
											exits ||
											target.valueAsNumber < 1 ||
											target.valueAsNumber > 1000
										) {
											setOpen(false);
											return;
										}

										const insertAfterIndex = list.collection.items.findIndex(
											(item) => item.value > target.valueAsNumber,
										);
										list.insert(
											insertAfterIndex === -1
												? list.collection.items.length
												: insertAfterIndex,
											{
												label: target.value,
												value: target.valueAsNumber,
											},
										);
										handleSelect(target.valueAsNumber);
									}
								}}
							/>
							<span className="text-xs text-muted-foreground">Max: 1000</span>
						</Stack>
					</ListboxMenu.ListboxMenuFilterContainer>
					<ListboxMenu.ListboxMenuList>
						{filteredItems.length > 0 ? (
							<ListboxMenu.ListboxMenuItemGroup>
								{filteredItems.map((item: { label: string; value: number }) => (
									<ListboxMenu.ListboxMenuItem
										key={item.value}
										item={item}
										onClick={() => handleSelect(item.value)}
										showIndicator={item.value === value}
									>
										{item.label}
									</ListboxMenu.ListboxMenuItem>
								))}
							</ListboxMenu.ListboxMenuItemGroup>
						) : (
							<ListboxMenu.ListboxMenuEmpty>
								No items found
							</ListboxMenu.ListboxMenuEmpty>
						)}
					</ListboxMenu.ListboxMenuList>
				</ListboxMenu.ListboxRoot>
			</ListboxMenu.ListboxMenuContent>
		</ListboxMenu.ListboxMenuRoot>
	);
}

const StructureTable = (props: {
	columnMetadata: Array<{
		name: string;
		dataType: string;
		nullable: boolean;
		primaryKey: boolean;
		unique: boolean;
		defaultValue: string | null;
	}>;
	isLoading: boolean;
	tableSize: "compact" | "cozy" | "comfortable";
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
						<div className="flex items-center gap-2">
							<DataTypeBadge dataType={info.getValue<string>()} />
							<span className="text-xs font-mono text-muted-foreground">
								{info.getValue<string>()}
							</span>
						</div>
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
						<HStack className="text-xs">
							{info.getValue<boolean>() ? "Yes" : "No"}
							<PrimaryKeyIcon isPrimaryKey={info.getValue<boolean>()} />
						</HStack>
					),
				},
				{
					accessorKey: "unique",
					header: "Unique",
					enableResizing: true,
					cell: (info) => (
						<HStack className="text-xs">
							{info.getValue<boolean>() ? "Yes" : "No"}
							<UniqueConstraintIcon isUnique={info.getValue<boolean>()} />
						</HStack>
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
			<DataTable
				table={structureTable}
				isLoading={props.isLoading}
				size={props.tableSize}
			/>
		);
	}
};
