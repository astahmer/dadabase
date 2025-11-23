import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useFilter } from "@ark-ui/react/locale";
import { Listbox, createListCollection } from "@ark-ui/react/listbox";
import { useMemo } from "react";
import { listAvailableDatabase } from "#src/server/pg/start-fns/get-available-database-list.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/pg/start-fns/get-available-schemas.start";
import { listAvailableTablesQueryOptions } from "#src/server/pg/start-fns/get-available-tables.start";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { useQueryClient } from "@tanstack/react-query";
import { getDbNameFromConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { CollapsibleSidebar } from "../../collapsible-sidebar";
import { ErrorBoundaryCard } from "../../shared/error-boundary-card.tsx";
import { LoadingSpinner } from "../../shared/loading-spinner";
import * as ArkSelect from "../../ui/select";
import { Stack } from "../../ui/layout.tsx";
import type { DbConnection } from "../connection.types";
import {
	createTabState,
	updateTabState,
	useActiveTabState,
} from "./create-tab-state.ts";

interface ConnectionPageSidebarProps {
	connection: DbConnection;
	activeConnectionUrl: string;
}

export const ConnectionPageSidebar = (props: ConnectionPageSidebarProps) => {
	const { connection, activeConnectionUrl } = props;

	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const connectionUrl = connection.url;
	const defaultDatabaseName = getDbNameFromConnectionUrl(connectionUrl);

	const databaseListQuery = useQuery({
		...listAvailableDatabase({ url: connectionUrl }),
		enabled: !!connection.url,
		retry: 3,
	});

	const selectedDbName = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.dbName,
	});

	const schemaListQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
		enabled: !!activeConnectionUrl,
		retry: 3,
	});

	const selectedSchema = useActiveTabState((s) => s.schema);
	const tablesListQuery = useQuery({
		...listAvailableTablesQueryOptions({ url: activeConnectionUrl }),
		enabled: !!selectedSchema,
		retry: 3,
	});

	const allSchemaList = schemaListQuery.data || [];
	const tableList = tablesListQuery.data || [];

	const { contains } = useFilter({ sensitivity: "base" });

	const tableFilter = useActiveTabState((s) => s.tableFilter);
	const selectedTable = useActiveTabState((s) => s.table);
	const filteredTables = useMemo(
		() =>
			tableList.filter(
				(table) =>
					(tableFilter ? contains(table.name, tableFilter) : true) &&
					selectedSchema === table.schema,
			),
		[tableList, tableFilter, selectedSchema, contains],
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

	const schemaCollection = ArkSelect.createListCollection({
		items: allSchemaList
			.filter((schema) => tableList.some((t) => t.schema === schema))
			.map((s: string) => {
				const tableCount = schemaTableCounts.get(s) || 0;
				return {
					label: `${s} (${tableCount} tables)`,
					value: s,
				};
			}),
	});

	const prefetchTableData = (schema: string, table: string) => {
		queryClient.prefetchQuery({
			...queryTableDataQueryOptions({
				url: activeConnectionUrl,
				schema,
				table,
				limit: 50,
				offset: 0,
				orderBy: undefined,
				orderDirection: undefined,
				filters: { conditions: [], logicalOperator: "and" },
			}),
		});
	};

	return (
		<CollapsibleSidebar>
			{/* Database Selector */}
			<Stack className="px-4 pt-4 shrink-0" gap="2">
				<label className="text-xs font-medium text-foreground uppercase tracking-wide">
					Database
				</label>
				{databaseListQuery.isError ? (
					<ErrorBoundaryCard
						error={databaseListQuery.error}
						title="Failed to load databases"
						onRetry={() => databaseListQuery.refetch()}
					/>
				) : databaseListQuery.isLoading ? (
					<LoadingSpinner
						label="Loading databases..."
						failureCount={databaseListQuery.failureCount}
						layout="horizontal"
						className="rounded-md border border-input bg-card px-3 py-2 min-h-9"
					/>
				) : (
					<ArkSelect.Select
						className="w-full"
						value={
							selectedDbName
								? [selectedDbName]
								: defaultDatabaseName
									? [defaultDatabaseName]
									: []
						}
						collection={ArkSelect.createListCollection({
							items: (databaseListQuery.data || []).map((db) => ({
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
							{(databaseListQuery.data || []).map((db) => (
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
					<ErrorBoundaryCard
						error={schemaListQuery.error}
						title="Failed to load schemas"
						onRetry={() => schemaListQuery.refetch()}
					/>
				) : schemaListQuery.isLoading ? (
					<LoadingSpinner
						label="Loading schemas..."
						failureCount={schemaListQuery.failureCount}
						layout="horizontal"
						className="rounded-md border border-input bg-card px-3 py-2 min-h-9"
					/>
				) : (
					<ArkSelect.Select
						className="w-full"
						value={selectedSchema ? [selectedSchema] : []}
						collection={schemaCollection}
						positioning={{ sameWidth: true }}
						disabled={schemaListQuery.isLoading}
						onValueChange={(details: { value?: string[] }) => {
							const newSchema = details.value?.[0];
							if (newSchema) {
								navigate({
									search: (prev) =>
										updateTabState(prev, {
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
							{schemaCollection.items.map((item) => (
								<ArkSelect.SelectItem key={item.value} item={item}>
									{item.label}
								</ArkSelect.SelectItem>
							))}
						</ArkSelect.SelectContent>
					</ArkSelect.Select>
				)}
			</Stack>
			{/* Tables List */}
			<div
				className="flex-1 h-full min-h-0 flex flex-col gap-2 overflow-hidden"
				data-tables-list
			>
				<Stack className="flex-1 h-full" gap="2">
					<div className="px-4">
						<label className="text-xs font-medium text-foreground uppercase tracking-wide">
							Tables
						</label>
					</div>
					{tablesListQuery.isError ? (
						<div className="p-4">
							<ErrorBoundaryCard
								error={tablesListQuery.error}
								title="Failed to load tables"
								onRetry={() => tablesListQuery.refetch()}
							/>
						</div>
					) : tablesListQuery.isLoading ? (
						<LoadingSpinner
							label="Loading tables..."
							failureCount={tablesListQuery.failureCount}
							layout="horizontal"
							className="p-4"
						/>
					) : (
						<div className="flex-1 overflow-hidden flex flex-col h-full">
							<div className="px-4">
								<input
									placeholder="Filter tables..."
									className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
									defaultValue={tableFilter}
									onChange={(e) =>
										navigate({
											replace: true,
											search: (prev) =>
												updateTabState(prev, { tableFilter: e.target.value }),
										})
									}
								/>
							</div>
							<div className="mt-2 flex-1 overflow-y-auto mr-4">
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
															selectedTable === table.name
																? "bg-primary/10 text-primary font-medium"
																: "text-muted-foreground hover:bg-muted hover:text-foreground data-highlighted:bg-muted"
														}`}
														title={table.name}
														onMouseEnter={() => {
															const schema = selectedSchema || "public";
															prefetchTableData(schema, table.name);
														}}
														onClick={() => {
															const schema = selectedSchema || "public";
															const tabState = createTabState(
																schema,
																table.name,
															);
															navigate({
																search: (prev) => {
																	const existingTab = (prev.tabs ?? []).find(
																		(t) => t.tabId === tabState.tabId,
																	);

																	const updatedTabs = existingTab
																		? (prev.tabs ?? [])
																		: [...(prev.tabs ?? []), tabState];

																	return {
																		...prev,
																		schema,
																		table: table.name,
																		activeTabId: tabState.tabId,
																		tabs: updatedTabs,
																		filters: undefined,
																		filtersOpened: false,
																		offset: 0,
																		limit: 50,
																		orderBy: undefined,
																		relationshipRowId:
																			existingTab?.relationshipRowId,
																		orderDirection: undefined,
																		quickReferencesOpen: false,
																		quickReferencesColumnName: undefined,
																		quickReferencesCellValue: undefined,
																	};
																},
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
		</CollapsibleSidebar>
	);
};
