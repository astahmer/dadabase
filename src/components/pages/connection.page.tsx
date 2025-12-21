import { Splitter } from "@ark-ui/react";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowDownUp, ArrowUp, Copy } from "lucide-react";
import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import { ColumnHeaderContextProvider } from "#src/components/data-table/column-header-context.tsx";
import { SqlQueryPreview } from "#src/components/pages/connection-page/sql-query-preview.tsx";
import {
	useActiveConnectionUrl,
	useConnectionPageState,
} from "#src/components/pages/connection-page/use-connection-page-state.tsx";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { fromPixelToPercentage } from "#src/lib/calculate-percentage-from-pixels.ts";
import { formatSQL } from "#src/lib/format-sql.ts";
import { cn, tryFn } from "#src/lib/utils.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";
import { explainQueryServerFn } from "#src/server/introspection/start-fns/explain-query.start.ts";
import { getAllTablesColumnsQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-columns.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { DataTable } from "../data-table/data-table.tsx";
import { ScrollToColumnButton } from "../data-table/scroll-to-column.button.tsx";
import { QueryFilterBuilder } from "../query-builder/query-filter-builder.tsx";
import { QueryLoggerPanel } from "../query-logger/query-logger-panel.tsx";
import { ErrorBoundaryCard } from "../shared/error-boundary-card.tsx";
import { Button } from "../ui/button.tsx";
import { Stack } from "../ui/layout.tsx";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuItemText,
	MenuTriggerItem,
} from "../ui/menu.tsx";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../ui/sheet.tsx";
import { Spinner } from "../ui/spinner.tsx";
import { toaster } from "../ui/toaster.tsx";
import { ConnectionForm } from "./connection.form.tsx";
import type { DbConnection } from "./connection.types";
import { ConnectionPageFilters } from "./connection-page/connection-page-filters.tsx";
import { ConnectionPageSidebar } from "./connection-page/connection-page-sidebar.tsx";
import { ConnectionPageStatusBar } from "./connection-page/connection-page-status-bar.tsx";
import { ConnectionPageTabs } from "./connection-page/connection-page-tabs.tsx";
import { ConnectionQuickReferencesDrawer } from "./connection-page/connection-quick-references.drawer.tsx";
import { ConnectionRowJsonViewerDrawer } from "./connection-page/connection-row-json-viewer.drawer.tsx";
import {
	updateTabState,
	useActiveTabState,
} from "./connection-page/create-tab-state.ts";
import { ExplainOutput } from "./connection-page/explain-output.tsx";
import { RelationshipsPanel } from "./connection-page/relationships/relationships-panel.tsx";
import { RowsTableErrorState } from "./connection-page/rows-table-error-state.tsx";
import { SchemaExplorerDrawer } from "./connection-page/schema-explorer-drawer.tsx";
import { StructureTable } from "./connection-page/structure-table.tsx";
import { useStructureFilters } from "./connection-page/use-structure-filter-state.ts";

interface ConnectionPageProps {
	connectionName: string;
}

export const ConnectionPage = ({ connectionName }: ConnectionPageProps) => {
	const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
	const connection = connectionList.data.find((c) => c.name === connectionName);

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

	return <ConnectionPageInner connection={connection} />;
};

const panels = {
	sidebar: "sidebar",
	mainContent: "main-content",
	sqlPreview: "sql-preview",
	rowsContent: "rows-content",
	rowsTable: "rows-table",
	relationships: "relationships",
};

const ConnectionPageInner = ({ connection }: { connection: DbConnection }) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const activeConnectionUrl = useActiveConnectionUrl(connection);

	const [showAddConnectionDrawer, setShowAddConnectionDrawer] = useState(false);
	const sidebarSize = useActiveTabState((_tab, search) => search.sidebarSize);
	const sidebarMinSize = fromPixelToPercentage(224, "horizontal");

	return (
		<div className="h-screen bg-background flex flex-col">
			{/* Main Layout */}
			<div className="flex-1 flex h-full min-h-0 flex-col">
				<Splitter.Root
					orientation="horizontal"
					defaultSize={[sidebarSize ?? sidebarMinSize, 100 - sidebarMinSize]}
					panels={[
						{
							id: panels.sidebar,
							collapsible: true,
							minSize: sidebarMinSize,
							maxSize: fromPixelToPercentage(400, "horizontal"),
						},
						{
							id: panels.mainContent,
							collapsible: false,
						},
					]}
					onResizeEnd={(details) => {
						void navigate({
							search: (prev) => ({ ...prev, sidebarSize: details.size[0] }),
						});
					}}
					onExpand={(details) => {
						if (details.panelId === panels.sidebar) {
							void navigate({
								search: (prev) => ({ ...prev, sidebarSize: details.size }),
							});
						}
					}}
					onCollapse={(details) => {
						if (details.panelId === panels.sidebar) {
							void navigate({
								search: (prev) => ({ ...prev, sidebarSize: details.size }),
							});
						}
					}}
					className="flex-1 flex h-full min-h-0"
				>
					{/* Sidebar Panel */}
					<Splitter.Panel
						id={panels.sidebar}
						className="bg-muted/30 border-r h-full flex flex-col overflow-hidden shrink-0"
					>
						{/* Sidebar */}
						<ConnectionPageSidebar
							connection={connection}
							activeConnectionUrl={activeConnectionUrl}
							onAddConnection={() => setShowAddConnectionDrawer(true)}
						/>
					</Splitter.Panel>

					{/* Resize Handle with Toggle */}
					<Splitter.Context>
						{(ctx) => (
							<Splitter.ResizeTrigger
								id={`${panels.sidebar}:${panels.mainContent}`}
								className={cn(
									tryFn(() => ctx.isPanelCollapsed(panels.sidebar))
										? "w-3"
										: "w-1.5",
									"h-full bg-border hover:bg-primary/50 cursor-row-resize transition-colors",
								)}
								title="Drag to resize, double-click to toggle"
								onDoubleClick={() => {
									ctx.isPanelExpanded(panels.sidebar)
										? ctx.collapsePanel(panels.sidebar)
										: ctx.expandPanel(panels.sidebar);
								}}
							/>
						)}
					</Splitter.Context>

					{/* Main Content Panel */}
					<Splitter.Panel
						id={panels.mainContent}
						className="h-full min-h-0 flex-1 flex flex-col overflow-hidden"
					>
						<MainContent connection={connection} />
					</Splitter.Panel>
				</Splitter.Root>

				{/* Query Logger Panel */}
				<QueryLoggerPanel connectionUrl={activeConnectionUrl} />
			</div>

			{/* Add Connection Drawer */}
			<AddConnectionDrawer
				showAddConnectionDrawer={showAddConnectionDrawer}
				setShowAddConnectionDrawer={setShowAddConnectionDrawer}
				onAddConnection={(newConnectionName) =>
					navigate({
						to: "/connections/$connectionName",
						params: { connectionName: newConnectionName },
					})
				}
			/>

			{/* Quick References */}
			<ConnectionQuickReferencesDrawer connection={connection} />

			{/* Row JSON Viewer */}
			<ConnectionRowJsonViewerDrawer connection={connection} />

			{/* Schema Explorer */}
			<SchemaExplorerDrawer connection={connection} />
		</div>
	);
};

const MainContent = (props: { connection: DbConnection }) => {
	const { connection } = props;
	const pageState = useConnectionPageState({ connection });
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const search = useActiveTabState((tab, search) => {
		return {
			schema: tab.schema,
			table: tab.table,
			filtersOpened: tab.filtersOpened,
			viewMode: tab.viewMode,
			tableSize: tab.tableSize,
			limit: tab.limit,
			sidebarSize: search.sidebarSize,
			sqlPreviewSize: tab.sqlPreviewSize,
			sqlEditorMode: tab.sqlEditorMode,
			customSql: tab.customSql,
		};
	});

	const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(
		null,
	);
	const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);

	// Fetch available tables for intellisense
	const tablesQuery = useQuery({
		...listAvailableTablesQueryOptions({
			url: pageState.activeConnectionUrl,
			schema: search.schema,
		}),
		enabled: !!search.schema,
	});
	const tables = tablesQuery.data || [];

	// Fetch columns for each table
	const columnQuery = useQuery(
		getAllTablesColumnsQueryOptions({
			url: pageState.activeConnectionUrl,
			schema: search.schema,
		}),
	);
	const columns = columnQuery.data ?? [];

	const explainQuery = useQuery({
		enabled: false,
		queryKey: ["remote", "explain", search.customSql],
		queryFn: async () => {
			// Only allow explain for PostgreSQL databases
			if (connection.dialect !== DatabaseDialect.Postgres) {
				alert("Query explain is only supported for PostgreSQL databases");
				return;
			}

			const sqlToExplain = search.customSql || pageState.sqlQuery?.sql;
			if (!sqlToExplain) {
				alert("No SQL query to explain");
				return;
			}

			try {
				setShowExplainPanel(true);
				const result = await explainQueryServerFn({
					data: {
						url: pageState.activeConnectionUrl,
						sql: sqlToExplain,
					},
				});

				if (result) {
					return result.plan;
				}
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to explain query";
				return `Error: ${message}`;
			}
		},
	});
	const [showExplainPanel, setShowExplainPanel] = useState(false);

	const { filters: structureFilters } = useStructureFilters();
	const relationshipPanelSize = fromPixelToPercentage(50, "vertical");

	const onEditorValueChange = useDebouncedCallback(
		(value: string) => {
			return navigate({
				search: (prev) =>
					updateTabState(prev, {
						customSql: value,
					}),
			});
		},
		{ wait: 500 },
	);

	return (
		<>
			{/* Tabs */}
			<Splitter.Context>
				{(ctx) => (
					<ConnectionPageTabs
						activeConnectionUrl={pageState.activeConnectionUrl}
						dialect={connection.dialect}
						onToggleSidebar={() => {
							if (ctx.isPanelExpanded(panels.sidebar)) {
								ctx.collapsePanel(panels.sidebar);
								void navigate({
									search: (prev) => ({ ...prev, sidebarSize: 0 }),
								});
								return;
							}

							ctx.expandPanel(panels.sidebar);
							void navigate({
								search: (prev) => ({
									...prev,
									sidebarSize: ctx.getPanelSize(panels.sidebar),
								}),
							});
						}}
						isSidebarCollapsed={ctx.isPanelCollapsed(panels.sidebar)}
					/>
				)}
			</Splitter.Context>

			{search.table && search.schema ? (
				<>
					{/* Filters */}
					<ConnectionPageFilters
						columnList={pageState.columnNameList}
						table={pageState.rowsDataTable}
						isLoading={
							pageState.rowsQuery.isLoading || pageState.isColumnMetadataLoading
						}
						queryBuilder={pageState.queryBuilder}
						url={pageState.activeConnectionUrl}
						schema={search.schema}
						tableName={search.table}
					/>

					{/* Query Filter Builder */}
					{search.viewMode === "rows" &&
						pageState.rowsColumns.length > 0 &&
						search.filtersOpened && (
							<QueryFilterBuilder
								key={search.table}
								conditions={pageState.queryBuilder.filter.conditions}
								onUpdateCondition={pageState.queryBuilder.updateCondition}
								onRemoveCondition={pageState.queryBuilder.removeCondition}
								onLogicalOperatorChange={
									pageState.queryBuilder.setLogicalOperator
								}
								onAddCondition={pageState.queryBuilder.addCondition}
								onClearAll={pageState.queryBuilder.clearConditions}
								logicalOperator={pageState.queryBuilder.filter.logicalOperator}
								availableColumns={pageState.columnNameList}
								isLoading={pageState.rowsQuery.isLoading}
								disabled={
									Boolean(search.customSql) &&
									search.customSql !== pageState.sqlQuery?.sql
								}
							/>
						)}

					{/* Content */}
					<div className="flex-1 overflow-hidden flex flex-col h-full">
						{search.viewMode === "structure" ? (
							<div className="flex-1 overflow-auto p-2 pt-0">
								<StructureTable
									columnMetadata={pageState.columnMetadata}
									isLoading={pageState.isColumnMetadataLoading}
									tableSize={search.tableSize}
									filters={structureFilters}
								/>
							</div>
						) : (
							<Splitter.Root
								orientation="vertical"
								className="flex-1 flex flex-col h-full overflow-hidden"
								defaultSize={[
									search.sqlPreviewSize ??
										fromPixelToPercentage(200, "vertical"),
									fromPixelToPercentage(656, "vertical"),
								]}
								panels={[
									{
										id: panels.sqlPreview,
										collapsible: true,
										minSize: fromPixelToPercentage(220, "vertical"),
									},
									{ id: panels.rowsContent, collapsible: false },
								]}
								onResizeEnd={(details) => {
									void navigate({
										search: (prev) =>
											updateTabState(prev, {
												sqlPreviewSize: details.size[0],
											}),
									});
								}}
								onExpand={(details) => {
									if (details.panelId === panels.sqlPreview) {
										void navigate({
											search: (prev) =>
												updateTabState(prev, {
													sqlPreviewSize: details.size,
												}),
										});
									}
								}}
								onCollapse={(details) => {
									if (details.panelId === panels.sqlPreview) {
										void navigate({
											search: (prev) =>
												updateTabState(prev, {
													sqlPreviewSize: details.size,
												}),
										});
									}
								}}
							>
								{/* SQL Query Preview */}
								<Splitter.Panel
									id={panels.sqlPreview}
									className="overflow-hidden"
								>
									<Splitter.Context>
										{(ctx) => (
											<SqlQueryPreview
												tables={tables}
												columns={columns}
												sql={pageState.sqlQuery?.sql || ""}
												// isLoading={pageState.sqlQuery.isLoading}
												// error={pageState.sqlQuery.error}
												isCollapsed={Boolean(
													tryFn(() => ctx.isPanelCollapsed(panels.sqlPreview)),
												)}
												onToggleCollapsed={() =>
													ctx.isPanelExpanded(panels.sqlPreview)
														? ctx.collapsePanel(panels.sqlPreview)
														: ctx.expandPanel(panels.sqlPreview)
												}
												editorMode={search.sqlEditorMode ?? "preview"}
												onEditorModeChange={(mode) =>
													navigate({
														search: (prev) =>
															updateTabState(prev, {
																sqlEditorMode: mode,
															}),
													})
												}
												customSql={search.customSql}
												onEditorChange={(value) => onEditorValueChange(value)}
												onResetCustomSql={() =>
													navigate({
														search: (prev) =>
															updateTabState(prev, {
																customSql: undefined,
															}),
													})
												}
												onRun={() => {
													// Trigger refetch of the rows query
													pageState.rowsQuery.refetch();
												}}
												onExplain={explainQuery.refetch}
												disableExplain={
													connection?.dialect !== DatabaseDialect.Postgres
												}
												onFormat={() => {
													const sqlToFormat =
														search.customSql || pageState.sqlQuery?.sql;
													if (!sqlToFormat) {
														alert("No SQL query to format");
														return;
													}

													try {
														const formatted = formatSQL(sqlToFormat, {
															language:
																connection.dialect === DatabaseDialect.Postgres
																	? "postgresql"
																	: "sqlite",
															onError: (error) => {
																toaster.create({
																	title: "Failed to format SQL",
																	description: error.message,
																});
															},
														});
														navigate({
															search: (prev) =>
																updateTabState(prev, {
																	customSql: formatted,
																	sqlEditorMode: "editor",
																}),
														});
													} catch (error) {
														const message =
															error instanceof Error
																? error.message
																: "Failed to format SQL";
														alert(`Error formatting SQL: ${message}`);
													}
												}}
												onToggleFullscreen={() =>
													setIsEditorFullscreen(!isEditorFullscreen)
												}
												isFullscreen={isEditorFullscreen}
												className="text-sm h-full"
											/>
										)}
									</Splitter.Context>
								</Splitter.Panel>

								<Splitter.Context>
									{(ctx) => (
										<Splitter.ResizeTrigger
											id={`${panels.sqlPreview}:${panels.rowsContent}`}
											className={cn(
												tryFn(() => ctx.isPanelCollapsed(panels.sqlPreview))
													? "h-2"
													: "h-1.5",
												"bg-border hover:bg-primary/50 cursor-row-resize transition-colors",
											)}
											title="Drag to resize"
											onDoubleClick={() =>
												ctx.isPanelExpanded(panels.sqlPreview)
													? ctx.collapsePanel(panels.sqlPreview)
													: ctx.expandPanel(panels.sqlPreview)
											}
										/>
									)}
								</Splitter.Context>

								<Splitter.Panel
									id={panels.rowsContent}
									className="overflow-hidden flex flex-col"
								>
									{pageState.rowsQuery.isLoading ? (
										<Stack className="flex-1 flex items-center justify-center">
											<Spinner />
											<span className="text-muted-foreground">
												{pageState.rowsQuery.failureCount > 0 ? (
													<>
														Failed {pageState.rowsQuery.failureCount} time
														{pageState.rowsQuery.failureCount > 1 ? "s" : ""},
														retrying...
													</>
												) : (
													"Loading table data..."
												)}
											</span>
										</Stack>
									) : pageState.rowsQuery.isError ? (
										<div className="flex-1 flex items-center justify-center p-4">
											<Stack className="max-w-2xl w-full">
												<ErrorBoundaryCard
													error={pageState.rowsQuery.error}
													title="Error loading table data"
													onRetry={() => pageState.rowsQuery.refetch()}
												/>
											</Stack>
										</div>
									) : (
										<>
											<Splitter.Root
												orientation="vertical"
												className="flex-1 flex flex-col h-full overflow-hidden"
												panels={[
													{
														id: panels.rowsTable,
														collapsible: true,
														minSize: 0,
													},
													{
														id: panels.relationships,
														collapsible: true,
														collapsedSize: relationshipPanelSize,
														minSize: relationshipPanelSize,
													},
												]}
											>
												<Splitter.Panel
													id={panels.rowsTable}
													className="flex-1 overflow-auto flex flex-col relative"
												>
													<ColumnHeaderContextProvider
														renderColumnHeaderMenuItems={({ column }) => (
															<>
																<Menu
																	positioning={{
																		placement: "right-start",
																		gutter: -2,
																	}}
																	lazyMount
																>
																	<MenuTriggerItem>
																		<ArrowDownUp className="size-4" />
																		Sort with nulls...
																	</MenuTriggerItem>
																	<MenuContent className="z-50">
																		<MenuItem
																			value="sort-asc-nulls-first"
																			onClick={() => {
																				column.toggleSorting(false, false);
																				pageState.onNullsOrderChange("first");
																			}}
																			disabled={
																				column.getIsSorted() === "asc" &&
																				pageState.currentNullsOrder === "first"
																			}
																		>
																			<ArrowUp className="size-4" />
																			<MenuItemText>
																				Sort asc, nulls first
																			</MenuItemText>
																		</MenuItem>
																		<MenuItem
																			value="sort-asc-nulls-last"
																			onClick={() => {
																				column.toggleSorting(false, false);
																				pageState.onNullsOrderChange("last");
																			}}
																			disabled={
																				column.getIsSorted() === "asc" &&
																				pageState.currentNullsOrder === "last"
																			}
																		>
																			<ArrowUp className="size-4" />
																			<MenuItemText>
																				Sort asc, nulls last
																			</MenuItemText>
																		</MenuItem>
																		<MenuItem
																			value="sort-desc-nulls-first"
																			onClick={() => {
																				column.toggleSorting(true, false);
																				pageState.onNullsOrderChange("first");
																			}}
																			disabled={
																				column.getIsSorted() === "desc" &&
																				pageState.currentNullsOrder === "first"
																			}
																		>
																			<ArrowDown className="size-4" />
																			<MenuItemText>
																				Sort desc, nulls first
																			</MenuItemText>
																		</MenuItem>
																		<MenuItem
																			value="sort-desc-nulls-last"
																			onClick={() => {
																				column.toggleSorting(true, false);
																				pageState.onNullsOrderChange("last");
																			}}
																			disabled={
																				column.getIsSorted() === "desc" &&
																				pageState.currentNullsOrder === "last"
																			}
																		>
																			<ArrowDown className="size-4" />
																			<MenuItemText>
																				Sort desc, nulls last
																			</MenuItemText>
																		</MenuItem>
																		{(column.getIsSorted() ||
																			pageState.currentNullsOrder) && (
																			<MenuItem
																				value="clear-sort-and-nulls"
																				onClick={() => {
																					column.clearSorting();
																					pageState.onNullsOrderChange(
																						undefined,
																					);
																				}}
																			>
																				<MenuItemText>
																					Clear sort &amp; nulls order
																				</MenuItemText>
																			</MenuItem>
																		)}
																	</MenuContent>
																</Menu>
															</>
														)}
													>
														<DataTable
															// virtualized={search.limit > 100}
															enableRowVirtualization
															enableColumnOrdering
															table={pageState.rowsDataTable}
															getTableContainer={setTableContainer}
															isLoading={
																pageState.rowsQuery.isLoading ||
																pageState.isColumnMetadataLoading
															}
															size={search.tableSize}
															onColumnFilterClick={(columnId) => {
																navigate({
																	search: (prev) =>
																		updateTabState(prev, (tab) => ({
																			filtersOpened: true,
																			filters: {
																				conditions: [
																					...(tab.filters?.conditions ?? []),
																					{
																						column: columnId,
																						operator: "equals",
																					},
																				],
																				logicalOperator:
																					tab.filters?.logicalOperator ?? "and",
																			},
																		})),
																});
															}}
															onExpandRowJson={(row) => {
																const primaryKeyColumn =
																	pageState.columnMetadata.find(
																		(col) => col.primaryKey,
																	);
																const rowId = primaryKeyColumn
																	? String(row[primaryKeyColumn.name])
																	: undefined;
																navigate({
																	search: (prev) => ({
																		...prev,
																		rowJsonViewerRowId: rowId,
																		rowJsonViewerOpen: !!rowId,
																	}),
																});
															}}
														/>
														{!pageState.rowsQuery.isLoading &&
															!pageState.isColumnMetadataLoading && (
																<ScrollToColumnButton
																	table={pageState.rowsDataTable}
																	containerRef={{
																		current: tableContainer,
																	}}
																/>
															)}
													</ColumnHeaderContextProvider>
												</Splitter.Panel>

												{pageState.relationshipRowId && search.table && (
													<>
														<Splitter.Context>
															{(ctx) => (
																<Splitter.ResizeTrigger
																	id="rows-table:relationships"
																	className={cn(
																		tryFn(() =>
																			ctx.isPanelCollapsed(
																				panels.relationships,
																			),
																		)
																			? "h-2"
																			: "h-1.5",
																		"bg-border hover:bg-primary/50 cursor-row-resize transition-colors",
																	)}
																	title="Drag to resize"
																	onDoubleClick={() =>
																		ctx.isPanelExpanded(panels.rowsTable)
																			? ctx.collapsePanel(panels.rowsTable)
																			: ctx.expandPanel(panels.rowsTable)
																	}
																/>
															)}
														</Splitter.Context>
														<Splitter.Panel
															id={panels.relationships}
															className="overflow-hidden flex flex-col mb-2.5"
														>
															<Splitter.Context>
																{(ctx) => {
																	return (
																		<RelationshipsPanel
																			key={
																				pageState.activeConnectionUrl +
																				search.table +
																				pageState.relationshipRowId
																			}
																			connectionUrl={
																				pageState.activeConnectionUrl
																			}
																			schema={search.schema}
																			table={search.table!}
																			selectedRowId={
																				pageState.relationshipRowId ?? null
																			}
																			rowData={
																				pageState.rowsDataTable
																					.getRowModel()
																					.rows.find(
																						(row) =>
																							row.id ===
																							pageState.relationshipRowId,
																					)?.original ?? {}
																			}
																			isPanelExpanded={Boolean(
																				tryFn(() =>
																					ctx.isPanelExpanded(
																						panels.relationships,
																					),
																				),
																			)}
																			onCollapse={() => {
																				ctx.collapsePanel(panels.relationships);
																			}}
																			onExpand={() => {
																				ctx.expandPanel(panels.relationships);
																			}}
																			onClose={() => {
																				navigate({
																					search: (prev) =>
																						updateTabState(prev, {
																							relationshipRowId: undefined,
																						}),
																				});
																			}}
																		/>
																	);
																}}
															</Splitter.Context>
														</Splitter.Panel>
													</>
												)}
											</Splitter.Root>
										</>
									)}
									{/* Status Bar */}
									<div className="shrink-0 border-t">
										<ConnectionPageStatusBar
											table={pageState.rowsDataTable}
											hasUuid={pageState.hasUuid}
											isLoading={pageState.rowsQuery.isLoading}
											refetch={pageState.rowsQuery.refetch}
											timeTaken={pageState.queryResponse.timeTaken}
											ranAt={pageState.queryResponse.ranAt}
											totalRowCount={pageState.totalRowCount}
											rowsColumnsCount={pageState.rowsColumns.length - 1} // minus select column
										/>
									</div>
								</Splitter.Panel>
							</Splitter.Root>
						)}
					</div>
				</>
			) : (
				<RowsTableErrorState
					activeConnectionUrl={pageState.activeConnectionUrl}
					connection={connection}
				/>
			)}

			<ExplainOutputDrawer
				showExplainPanel={showExplainPanel}
				setShowExplainPanel={setShowExplainPanel}
				output={explainQuery.data ?? null}
			/>
		</>
	);
};

const AddConnectionDrawer = (props: {
	showAddConnectionDrawer: boolean;
	setShowAddConnectionDrawer: Dispatch<SetStateAction<boolean>>;
	onAddConnection: (newConnectionName: string) => void;
}) => {
	const { showAddConnectionDrawer, setShowAddConnectionDrawer } = props;
	return (
		<Sheet
			open={showAddConnectionDrawer}
			onOpenChange={(details) => {
				if (!details.open) setShowAddConnectionDrawer(false);
			}}
		>
			<SheetContent className="z-50 w-full sm:max-w-[540px]">
				<SheetHeader>
					<SheetTitle>Add Connection</SheetTitle>
					<SheetDescription>Create a new database connection</SheetDescription>
				</SheetHeader>
				<div className="px-4">
					<ConnectionForm
						mode="create"
						onSuccess={(newConnectionName) => {
							setShowAddConnectionDrawer(false);
							if (newConnectionName) {
								props.onAddConnection(newConnectionName);
							}
						}}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
};

const ExplainOutputDrawer = (props: {
	showExplainPanel: boolean;
	setShowExplainPanel: Dispatch<SetStateAction<boolean>>;
	output: string | null;
}) => {
	const { showExplainPanel, setShowExplainPanel, output } = props;

	const [viewMode, onViewModeChange] = useState<"smart" | "raw">("smart");

	return (
		<Sheet
			open={showExplainPanel}
			onOpenChange={(details) => {
				if (!details.open) setShowExplainPanel(false);
			}}
		>
			<SheetContent side="right" size="full" className="flex flex-col p-0">
				<SheetHeader className="px-6 pt-6 pb-4 border-b">
					<div className="flex items-center justify-between gap-4">
						<div className="flex-1">
							<SheetTitle>Query Execution Plan</SheetTitle>
							<SheetDescription>
								EXPLAIN ANALYZE output for performance optimization
							</SheetDescription>
						</div>
						<div className="flex items-center gap-2 shrink-0 mr-4">
							<Button
								size="sm"
								onClick={() =>
									onViewModeChange(viewMode === "smart" ? "raw" : "smart")
								}
								className="h-8 px-2 text-xs font-medium"
								title={viewMode === "smart" ? "Show raw" : "Show parsed"}
							>
								Swap to {viewMode === "smart" ? "Raw" : "Smart"} display
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									if (output) {
										navigator.clipboard.writeText(output);
									}
								}}
								className="h-8 w-8 p-0"
								title="Copy raw output"
							>
								<Copy className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</SheetHeader>
				<div className="flex-1 overflow-hidden">
					{output ? (
						<ExplainOutput
							output={output}
							viewMode={viewMode}
							onViewModeChange={onViewModeChange}
						/>
					) : (
						<div className="flex items-center justify-center h-full text-gray-500">
							Loading...
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
};
