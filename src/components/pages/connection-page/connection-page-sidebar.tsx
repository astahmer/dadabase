import { createListCollection, Listbox } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import { getDbNameFromConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { listAvailableDatabase } from "#src/server/introspection/start-fns/get-available-database-list.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";
import { ErrorBoundaryCard } from "../../shared/error-boundary-card.tsx";
import { LoadingSpinner } from "../../shared/loading-spinner";
import { Stack } from "../../ui/layout.tsx";
import * as ArkSelect from "../../ui/select";
import { VirtualizerArea } from "../../ui/virtualizer-area.tsx";
import type { DbConnection } from "../connection.types";
import { ConnectionSwitcher } from "./connection-switcher";
import {
	createTabState,
	updateTabState,
	useActiveTabState,
} from "./create-tab-state.ts";
import { TableContextMenu } from "./table-context-menu.tsx";

interface ConnectionPageSidebarProps {
	connection: DbConnection;
	activeConnectionUrl: string;
	onAddConnection: () => void;
}

export const ConnectionPageSidebar = (props: ConnectionPageSidebarProps) => {
	const { connection, activeConnectionUrl } = props;

	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const connectionUrl = connection.url;
	const defaultDatabaseName = getDbNameFromConnectionUrl(connectionUrl);

	const databaseListQuery = useQuery({
		...listAvailableDatabase({ url: connectionUrl }),
		retry: 3,
	});
	const dbList = databaseListQuery.data || [];
	const selectedDbName = useSearch({
		from: "/connections/$connectionName",
		select: (s) =>
			s.dbName ?? (dbList.length === 1 ? dbList.at(0)?.name : undefined),
	});

	const schemaListQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
		retry: 3,
	});
	const schemaList = schemaListQuery.data || [];
	const selectedSchema = useActiveTabState(
		(s) =>
			s.schema ??
			(schemaList.length === 1 ? schemaList.at(0) : undefined) ??
			getDialectDefaultSchema(connection.dialect),
	);

	const tablesListQuery = useQuery({
		...listAvailableTablesQueryOptions({ url: activeConnectionUrl }),
		enabled: !!selectedSchema,
		retry: 3,
	});
	const tableList = tablesListQuery.data || [];

	const { contains } = useFilter({ sensitivity: "base" });

	const tableFilter = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.tableFilter,
	});
	const selectedTable = useActiveTabState((s) => s.table);

	const isNotSqlite = !(
		connection.dialect === DatabaseDialect.SQLite ||
		connection.dialect === DatabaseDialect.LibSQL
	);

	const filteredTables = useMemo(
		() =>
			tableList.filter(
				(table) =>
					(tableFilter ? contains(table.name, tableFilter) : true) &&
					(isNotSqlite ? selectedSchema === table.schema : true),
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
		items: schemaList
			.filter((schema) => tableList.some((t) => t.schema === schema))
			.map((s) => {
				const tableCount = schemaTableCounts.get(s) || 0;
				return {
					label: `${s} (${tableCount} tables)`,
					value: s,
				};
			}),
	});

	return (
		<>
			{/* Connection Switcher */}
			<ConnectionSwitcher
				connection={connection}
				onAddConnection={props.onAddConnection}
			/>
			{/* Database Selector */}
			{isNotSqlite && (
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
								items: dbList.map((db) => ({
									label: db.name,
									value: db.name,
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
										key={db.name}
										item={{ label: db.name, value: db.name }}
									>
										{db.name}
									</ArkSelect.SelectItem>
								))}
							</ArkSelect.SelectContent>
						</ArkSelect.Select>
					)}
				</Stack>
			)}
			{/* Schema Selector */}
			{isNotSqlite && schemaCollection.size > 1 && (
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
			)}
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
						<Listbox.Root
							collection={tableCollection}
							className="h-full min-h-0"
							onHighlightChange={(details) => {
								const tableName = details.highlightedValue;
								if (!tableName) return;
								const schema = selectedSchema;
								queryClient.prefetchQuery({
									...queryTableDataQueryOptions({
										url: activeConnectionUrl,
										schema,
										table: tableName,
										limit: 50,
										offset: 0,
										orderBy: undefined,
										orderDirection: undefined,
										filters: {
											conditions: [],
											logicalOperator: "and",
										},
									}),
								});
							}}
							onSelect={(details) => {
								const tableName = details.value;
								if (!tableName) return;

								const schema = selectedSchema;
								const tabState = createTabState(schema, tableName);
								navigate({
									search: (prev) => {
										return {
											...prev,
											...tabState,
											tabs: [...(prev.tabs ?? []), tabState],
											activeTabId: tabState.tabId,
										};
									},
								});
							}}
						>
							<div className="flex-1 overflow-hidden flex flex-col h-full">
								<div className="px-4">
									<Listbox.Input
										placeholder="Filter tables..."
										autoFocus
										defaultValue={tableFilter}
										onChange={(e) =>
											navigate({
												replace: true,
												search: (prev) => ({
													...prev,
													tableFilter: e.target.value,
												}),
											})
										}
										className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
									/>
								</div>
								<div className="mt-2 flex-1 overflow-hidden h-full">
									{filteredTables.length === 0 ? (
										<div className="p-4 text-center">
											<span className="text-xs text-muted-foreground">
												{tableList.length === 0
													? "No tables found"
													: "No tables match filter"}
											</span>
										</div>
									) : (
										<VirtualizerArea
											count={filteredTables.length}
											className="overflow-y-auto flex-1 mr-4 h-full max-h-full"
										>
											{({
												virtualItems,
												totalSize,
												paddingTop,
												paddingBottom,
											}) => (
												<div
													style={{ height: `${totalSize}px` }}
													className="relative"
												>
													{paddingTop > 0 && (
														<div style={{ height: `${paddingTop}px` }} />
													)}

													<Listbox.Content className="block">
														<Listbox.ItemGroup>
															{virtualItems.map((virtualItem) => {
																const table = filteredTables[virtualItem.index];
																if (!table) return null;

																return (
																	<TableContextMenu
																		key={table.name}
																		tableName={table.name}
																		schema={table.schema || selectedSchema}
																	>
																		<Listbox.Item
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
																		>
																			<Listbox.ItemText className="flex-1 truncate">
																				{table.name}
																			</Listbox.ItemText>
																		</Listbox.Item>
																	</TableContextMenu>
																);
															})}
														</Listbox.ItemGroup>
													</Listbox.Content>

													{paddingBottom > 0 && (
														<div style={{ height: `${paddingBottom}px` }} />
													)}
												</div>
											)}
										</VirtualizerArea>
									)}
								</div>
							</div>
						</Listbox.Root>
					)}
				</Stack>
			</div>
		</>
	);
};
