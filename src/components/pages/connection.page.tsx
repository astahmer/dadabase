import { ColumnHeaderContextProvider } from "#src/components/data-table/column-header-context.tsx";
import { SqlQueryPreview } from "#src/components/pages/connection-page/sql-query-preview.tsx";
import {
	useActiveConnectionUrl,
	useConnectionPageState,
	type ConnectionPageState,
} from "#src/components/pages/connection-page/use-connection-page-state.tsx";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { fromPixelToPercentage } from "#src/lib/calculate-percentage-from-pixels.ts";
import { formatSQL } from "#src/lib/format-sql.ts";
import { cn, tryFn } from "#src/lib/utils.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { Splitter } from "@ark-ui/react";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowDownUp, ArrowUp, Copy } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { DataTable } from "../data-table/data-table.tsx";
import { ScrollToColumnButton } from "../data-table/scroll-to-column.button.tsx";
import { QueryFilterBuilder } from "../query-builder/query-filter-builder.tsx";
import { QueryLoggerContent } from "../query-logger/query-logger-panel.tsx";
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
import { ExplainOutputDrawer } from "./connection-page/explain-output-drawer.tsx";
import { RelationshipsPanel } from "./connection-page/relationships/relationships-panel.tsx";
import { TabErrorState } from "./connection-page/tab-error-state.tsx";
import { SchemaExplorerDrawer } from "./connection-page/schema-explorer-drawer.tsx";
import { StructureTable } from "./connection-page/structure-table.tsx";
import { useStructureFilters } from "./connection-page/use-structure-filter-state.ts";
import { useExplainQuery } from "./connection-page/use-explain-query.ts";
import { useTablesColumnsForIntellisense } from "./connection-page/use-tables-columns-intellisense.ts";
import { ConnectionForm } from "./connection.form.tsx";
import type { DbConnection } from "./connection.types";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { EmptyTabState } from "./connection-page/empty-tab-state.tsx";
import { CustomSqlTabContent } from "./connection-page/custom-sql-tab-content.tsx";

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
	queryLogger: "query-logger",
};

const ConnectionPageInner = ({ connection }: { connection: DbConnection }) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const activeConnectionUrl = useActiveConnectionUrl(connection);

	const [showAddConnectionDrawer, setShowAddConnectionDrawer] = useState(false);
	const sidebarSize = useActiveTabState((_tab, search) => search.sidebarSize);
	const queryLoggerSize = useActiveTabState(
		(_tab, search) => search.queryLoggerSize,
	);
	const sidebarMinSize = fromPixelToPercentage(224, "horizontal");
	const queryLoggerMinSize = fromPixelToPercentage(48, "vertical");
	const defaultQueryLoggerSize = queryLoggerSize ?? 0; // Default 25% if not set

	const search = useActiveTabState((tab) => ({
		schema: tab.schema,
		table: tab.table,
	}));

	const schemaListQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
		enabled: !!activeConnectionUrl,
		retry: 3,
	});

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
									"h-full bg-border hover:bg-primary/50 cursor-col-resize transition-colors",
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

					{/* Main Content Panel - Contains Vertical Splitter for Query Logger */}
					<Splitter.Panel
						id={panels.mainContent}
						className="h-full min-h-0 flex-1 flex flex-col overflow-hidden"
					>
						<Splitter.Context>
							{(sidebarSplitterCtx) => (
								<Splitter.Root
									orientation="vertical"
									defaultSize={[
										100 - defaultQueryLoggerSize,
										defaultQueryLoggerSize,
									]}
									panels={[
										{
											id: panels.rowsContent,
											collapsible: false,
										},
										{
											id: panels.queryLogger,
											collapsible: true,
											collapsedSize: queryLoggerMinSize,
											minSize: queryLoggerMinSize,
											maxSize: 50,
										},
									]}
									onResizeEnd={(details) => {
										void navigate({
											search: (prev) => ({
												...prev,
												queryLoggerSize: details.size[1],
											}),
										});
									}}
									onExpand={(details) => {
										if (details.panelId === panels.queryLogger) {
											void navigate({
												search: (prev) => ({
													...prev,
													queryLoggerSize: details.size,
												}),
											});
										}
									}}
									onCollapse={(details) => {
										if (details.panelId === panels.queryLogger) {
											void navigate({
												search: (prev) => ({
													...prev,
													queryLoggerSize: details.size,
												}),
											});
										}
									}}
									className="flex-1 flex flex-col h-full min-h-0"
								>
									{/* Rows Content Panel */}
									<Splitter.Panel
										id={panels.rowsContent}
										className="h-full min-h-0 flex-1 flex flex-col overflow-hidden"
									>
										{/* Tabs */}
										<ConnectionPageTabs
											activeConnectionUrl={activeConnectionUrl}
											dialect={connection.dialect}
											onToggleSidebar={() => {
												if (
													sidebarSplitterCtx.isPanelExpanded(panels.sidebar)
												) {
													sidebarSplitterCtx.collapsePanel(panels.sidebar);
													void navigate({
														search: (prev) => ({ ...prev, sidebarSize: 0 }),
													});
													return;
												}

												sidebarSplitterCtx.expandPanel(panels.sidebar);
												void navigate({
													search: (prev) => ({
														...prev,
														sidebarSize: sidebarSplitterCtx.getPanelSize(
															panels.sidebar,
														),
													}),
												});
											}}
											isSidebarCollapsed={sidebarSplitterCtx.isPanelCollapsed(
												panels.sidebar,
											)}
										/>
										{schemaListQuery.isError ? (
											<TabErrorState
												activeConnectionUrl={activeConnectionUrl}
											/>
										) : search.table && search.schema ? (
											<MainContentRouter
												connection={connection}
												activeConnectionUrl={activeConnectionUrl}
											/>
										) : (
											<EmptyTabContent
												activeConnectionUrl={activeConnectionUrl}
												connection={connection}
											/>
										)}
									</Splitter.Panel>

									{/* Resize Handle for Query Logger */}
									<Splitter.Context>
										{(ctx) => (
											<Splitter.ResizeTrigger
												id={`${panels.rowsContent}:${panels.queryLogger}`}
												className={cn(
													tryFn(() => ctx.isPanelCollapsed(panels.queryLogger))
														? "h-3"
														: "h-1.5",
													"w-full bg-border hover:bg-primary/50 cursor-row-resize transition-colors",
												)}
												title="Drag to resize, double-click to toggle"
												onDoubleClick={() => {
													ctx.isPanelExpanded(panels.queryLogger)
														? ctx.collapsePanel(panels.queryLogger)
														: ctx.expandPanel(panels.queryLogger);
												}}
											/>
										)}
									</Splitter.Context>

									{/* Query Logger Panel */}
									<Splitter.Context>
										{(ctx) => (
											<Splitter.Panel
												id={panels.queryLogger}
												className="h-full min-h-0 flex flex-col overflow-hidden border-t bg-background"
											>
												<QueryLoggerContent
													connectionUrl={activeConnectionUrl}
													isExpanded={ctx.isPanelExpanded(panels.queryLogger)}
													onCollapse={() =>
														ctx.collapsePanel(panels.queryLogger)
													}
													onExpand={() => ctx.expandPanel(panels.queryLogger)}
												/>
											</Splitter.Panel>
										)}
									</Splitter.Context>
								</Splitter.Root>
							)}
						</Splitter.Context>
					</Splitter.Panel>
				</Splitter.Root>
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

/**
 * Router component to switch between RowsTabContent and CustomSqlTabContent
 * based on whether user is in custom SQL mode
 */
const MainContentRouter = (props: {
	connection: DbConnection;
	activeConnectionUrl: string;
}) => {
	const { connection, activeConnectionUrl } = props;
	const pageState = useConnectionPageState({ connection });

	const search = useActiveTabState((tab) => ({
		customSql: tab.customSql,
		customSqlId: tab.customSqlId,
		viewMode: tab.viewMode,
	}));

	// Determine if we're in custom SQL mode (either pending edit or stored execution)
	const isCustomSqlMode =
		Boolean(search.customSql?.trim()) || Boolean(search.customSqlId);

	// If in custom SQL mode and viewing rows, render the dedicated component
	if (isCustomSqlMode && search.viewMode === "rows") {
		return (
			<CustomSqlTabContent
				connection={connection}
				activeConnectionUrl={activeConnectionUrl}
				baseSql={pageState.sqlQueryAsText}
			/>
		);
	}

	return (
		<RowsTabContent
			connection={connection}
			activeConnectionUrl={activeConnectionUrl}
		/>
	);
};

const RowsTabContent = (props: {
	connection: DbConnection;
	activeConnectionUrl: string;
}) => {
	const { connection } = props;
	const pageState = useConnectionPageState({ connection });
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const search = useActiveTabState((tab, search) => {
		return {
			tabId: tab.tabId,
			schema: tab.schema,
			table: tab.table,
			filtersOpened: tab.filtersOpened,
			viewMode: tab.viewMode,
			tableSize: tab.tableSize,
			sqlPreviewSize: tab.sqlPreviewSize,
		};
	});
	const { filters: structureFilters } = useStructureFilters();

	return (
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
						onLogicalOperatorChange={pageState.queryBuilder.setLogicalOperator}
						onAddCondition={pageState.queryBuilder.addCondition}
						onClearAll={pageState.queryBuilder.clearConditions}
						logicalOperator={pageState.queryBuilder.filter.logicalOperator}
						availableColumns={pageState.columnNameList}
						isLoading={pageState.rowsQuery.isLoading}
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
						key={search.tabId}
						orientation="vertical"
						className="flex-1 flex flex-col h-full overflow-hidden"
						defaultSize={[
							search.sqlPreviewSize ?? fromPixelToPercentage(200, "vertical"),
							search.sqlPreviewSize
								? 100 - search.sqlPreviewSize
								: fromPixelToPercentage(656, "vertical"),
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
						<Splitter.Panel id={panels.sqlPreview} className="overflow-hidden">
							<Splitter.Context>
								{(ctx) => (
									<RowsTableSqlEditor
										connection={props.connection}
										isCollapsed={Boolean(
											tryFn(() => ctx.isPanelCollapsed(panels.sqlPreview)),
										)}
										onExpand={() => ctx.expandPanel(panels.sqlPreview)}
										onCollapse={() => ctx.collapsePanel(panels.sqlPreview)}
										activeConnectionUrl={pageState.activeConnectionUrl}
										sqlQueryAsText={pageState.sqlQueryAsText}
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
								<RowsTableContent
									activeConnectionUrl={pageState.activeConnectionUrl}
									rowsDataTable={pageState.rowsDataTable}
									rowsQuery={pageState.rowsQuery}
									isColumnMetadataLoading={pageState.isColumnMetadataLoading}
									columnMetadata={pageState.columnMetadata}
								/>
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
									totalRowCount={pageState.queryResponse.rowCount}
									rowsColumnsCount={pageState.rowsColumns.length - 1}
									isCustomSql={false}
								/>
							</div>
						</Splitter.Panel>
					</Splitter.Root>
				)}
			</div>
		</>
	);
};

const RowsTableSqlEditor = (
	props: Pick<ConnectionPageState, "activeConnectionUrl" | "sqlQueryAsText"> & {
		connection: DbConnection;
		isCollapsed?: boolean;
		onExpand: () => void;
		onCollapse: () => void;
	},
) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const search = useActiveTabState((tab) => {
		return {
			schema: tab.schema,
			table: tab.table,
			sqlEditorMode: tab.sqlEditorMode,
		};
	});

	const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);

	// Fetch available tables/columns for intellisense
	const { tables, columns } = useTablesColumnsForIntellisense({
		connectionUrl: props.activeConnectionUrl,
		schema: search.schema,
	});

	// Explain query functionality
	const {
		explainQuery,
		showExplainPanel,
		setShowExplainPanel,
		isExplainDisabled,
	} = useExplainQuery({
		connectionUrl: props.activeConnectionUrl,
		sql: props.sqlQueryAsText,
		dialect: props.connection.dialect,
	});

	// When user starts editing in preview mode, switch to custom SQL mode
	const onEditorValueChange = useDebouncedCallback(
		(value: string) => {
			// Set the customSql - this will trigger CustomSqlTabContent to render
			return navigate({
				search: (prev) =>
					updateTabState(prev, {
						customSql: value,
						sqlEditorMode: "editor",
					}),
			});
		},
		{ wait: 500 },
	);

	return (
		<>
			<SqlQueryPreview
				tables={tables}
				columns={columns}
				sql={props.sqlQueryAsText}
				isCollapsed={props.isCollapsed}
				onToggleCollapsed={() =>
					props.isCollapsed ? props.onExpand() : props.onCollapse()
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
				onEditorChange={(value) => onEditorValueChange(value)}
				onExplain={explainQuery.refetch}
				disableExplain={isExplainDisabled}
				onFormat={() => {
					try {
						const formatted = formatSQL(props.sqlQueryAsText, {
							language:
								props.connection.dialect === DatabaseDialect.Postgres
									? "postgresql"
									: "sqlite",
							onError: (error) => {
								toaster.create({
									title: "Failed to format SQL",
									description: error.message,
								});
							},
						});
						// Set formatted SQL as custom SQL (switches to custom SQL mode)
						navigate({
							search: (prev) =>
								updateTabState(prev, {
									customSql: formatted,
									sqlEditorMode: "editor",
								}),
						});
					} catch (error) {
						const message =
							error instanceof Error ? error.message : "Failed to format SQL";
						alert(`Error formatting SQL: ${message}`);
					}
				}}
				onToggleFullscreen={() => setIsEditorFullscreen(!isEditorFullscreen)}
				isFullscreen={isEditorFullscreen}
				className="text-sm h-full"
			/>
			<ExplainOutputDrawer
				showExplainPanel={showExplainPanel}
				setShowExplainPanel={setShowExplainPanel}
				output={explainQuery.data ?? null}
			/>
		</>
	);
};

const RowsTableContent = (
	props: Pick<
		ConnectionPageState,
		| "activeConnectionUrl"
		| "rowsDataTable"
		| "rowsQuery"
		| "isColumnMetadataLoading"
		| "columnMetadata"
	>,
) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(
		null,
	);
	const relationshipPanelSize = fromPixelToPercentage(50, "vertical");

	const search = useActiveTabState((tab, search) => {
		return {
			schema: tab.schema,
			table: tab.table,
			tableSize: tab.tableSize,
			relationshipRowId: tab.relationshipRowId,
			nullsOrder: tab.nullsOrder,
		};
	});

	const onNullsOrderChange = (nullsOrder: "first" | "last" | undefined) => {
		navigate({
			search: (prev) => {
				return updateTabState(prev, {
					nullsOrder,
				});
			},
		});
	};

	return (
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
												onNullsOrderChange("first");
											}}
											disabled={
												column.getIsSorted() === "asc" &&
												search.nullsOrder === "first"
											}
										>
											<ArrowUp className="size-4" />
											<MenuItemText>Sort asc, nulls first</MenuItemText>
										</MenuItem>
										<MenuItem
											value="sort-asc-nulls-last"
											onClick={() => {
												column.toggleSorting(false, false);
												onNullsOrderChange("last");
											}}
											disabled={
												column.getIsSorted() === "asc" &&
												search.nullsOrder === "last"
											}
										>
											<ArrowUp className="size-4" />
											<MenuItemText>Sort asc, nulls last</MenuItemText>
										</MenuItem>
										<MenuItem
											value="sort-desc-nulls-first"
											onClick={() => {
												column.toggleSorting(true, false);
												onNullsOrderChange("first");
											}}
											disabled={
												column.getIsSorted() === "desc" &&
												search.nullsOrder === "first"
											}
										>
											<ArrowDown className="size-4" />
											<MenuItemText>Sort desc, nulls first</MenuItemText>
										</MenuItem>
										<MenuItem
											value="sort-desc-nulls-last"
											onClick={() => {
												column.toggleSorting(true, false);
												onNullsOrderChange("last");
											}}
											disabled={
												column.getIsSorted() === "desc" &&
												search.nullsOrder === "last"
											}
										>
											<ArrowDown className="size-4" />
											<MenuItemText>Sort desc, nulls last</MenuItemText>
										</MenuItem>
										{(column.getIsSorted() || search.nullsOrder) && (
											<MenuItem
												value="clear-sort-and-nulls"
												onClick={() => {
													column.clearSorting();
													onNullsOrderChange(undefined);
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
							table={props.rowsDataTable}
							getTableContainer={setTableContainer}
							isLoading={
								props.rowsQuery.isLoading || props.isColumnMetadataLoading
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
												logicalOperator: tab.filters?.logicalOperator ?? "and",
											},
										})),
								});
							}}
							onExpandRowJson={(row) => {
								const primaryKeyColumn = props.columnMetadata.find(
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
						{!props.rowsQuery.isLoading && !props.isColumnMetadataLoading && (
							<ScrollToColumnButton
								table={props.rowsDataTable}
								containerRef={{
									current: tableContainer,
								}}
							/>
						)}
					</ColumnHeaderContextProvider>
				</Splitter.Panel>

				{search.relationshipRowId && search.table && (
					<BottomRelationshipPanel
						activeConnectionUrl={props.activeConnectionUrl}
						relationshipRowId={search.relationshipRowId}
						schema={search.schema}
						table={search.table!}
						rowData={
							props.rowsDataTable
								.getRowModel()
								.rows.find((row) => row.id === search.relationshipRowId)
								?.original ?? {}
						}
					/>
				)}
			</Splitter.Root>
		</>
	);
};

const EmptyTabContent = (props: {
	activeConnectionUrl: string;
	connection: DbConnection;
}) => {
	const search = useActiveTabState((tab) => ({
		schema: tab.schema,
		table: tab.table,
	}));

	// Fetch available tables/columns for intellisense
	const { tables, columns } = useTablesColumnsForIntellisense({
		connectionUrl: props.activeConnectionUrl,
		schema: search.schema,
	});

	return (
		<EmptyTabState
			activeConnectionUrl={props.activeConnectionUrl}
			connection={props.connection}
			tables={tables}
			columns={columns}
		/>
	);
};

const BottomRelationshipPanel = (props: {
	activeConnectionUrl: string;
	relationshipRowId: string;
	schema: string;
	table: string;
	rowData: Record<string, unknown>;
}) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	return (
		<>
			<Splitter.Context>
				{(ctx) => (
					<Splitter.ResizeTrigger
						id="rows-table:relationships"
						className={cn(
							tryFn(() => ctx.isPanelCollapsed(panels.relationships))
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
									props.activeConnectionUrl +
									props.table +
									props.relationshipRowId
								}
								connectionUrl={props.activeConnectionUrl}
								schema={props.schema}
								table={props.table!}
								selectedRowId={props.relationshipRowId ?? null}
								rowData={props.rowData}
								isPanelExpanded={Boolean(
									tryFn(() => ctx.isPanelExpanded(panels.relationships)),
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
