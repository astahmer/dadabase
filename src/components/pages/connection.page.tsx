import { Portal, Splitter } from "@ark-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Column } from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowDownToLine,
	ArrowDownUp,
	ArrowUp,
	ArrowUpToLine,
} from "lucide-react";
import { useConnectionPageState } from "#src/components/pages/connection-page/use-connection-page-state.tsx";
import { SqlQueryPreview } from "#src/components/pages/connection-page/sql-query-preview.tsx";
import { ColumnHeaderContextProvider } from "#src/components/data-table/column-header-context.tsx";
import { fromPixelToPercentage } from "#src/lib/calculate-percentage-from-pixels.ts";
import { cn, tryFn } from "#src/lib/utils.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { DataTable } from "../data-table/data-table.tsx";
import { ScrollToColumnButton } from "../data-table/scroll-to-column.button.tsx";
import { QueryFilterBuilder } from "../query-builder/query-filter-builder.tsx";
import { QueryLoggerPanel } from "../query-logger/query-logger-panel.tsx";
import { ErrorBoundaryCard } from "../shared/error-boundary-card.tsx";
import { Stack } from "../ui/layout.tsx";
import {
	MenuItem,
	MenuItemText,
	MenuTriggerItem,
	Menu,
	MenuContent,
} from "../ui/menu.tsx";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../ui/sheet.tsx";
import { Spinner } from "../ui/spinner.tsx";
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
import { RelationshipsPanel } from "./connection-page/relationships/relationships-panel.tsx";
import { RowsTableErrorState } from "./connection-page/rows-table-error-state.tsx";
import { StructureTable } from "./connection-page/structure-table.tsx";
import { SchemaExplorerDrawer } from "./connection-page/schema-explorer-drawer.tsx";
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
};

const ConnectionPageInner = ({ connection }: { connection: DbConnection }) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const [showAddConnectionDrawer, setShowAddConnectionDrawer] = useState(false);
	const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(
		null,
	);

	const search = useActiveTabState((tab, search) => {
		return {
			schema: tab.schema,
			table: tab.table,
			filtersOpened: tab.filtersOpened,
			viewMode: tab.viewMode,
			tableSize: tab.tableSize,
			limit: tab.limit,
			sidebarSize: search.sidebarSize,
		};
	});

	const { filters: structureFilters } = useStructureFilters();

	const pageState = useConnectionPageState({ connection });

	const relationshipPanelSize = fromPixelToPercentage(50);
	const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
	const sidebarMinSize = fromPixelToPercentage(224, windowWidth);

	return (
		<div className="h-screen bg-background flex flex-col">
			{/* Main Layout */}
			<div className="flex-1 flex h-full min-h-0 flex-col">
				<Splitter.Root
					orientation="horizontal"
					defaultSize={[
						search.sidebarSize ?? sidebarMinSize,
						100 - sidebarMinSize,
					]}
					panels={[
						{
							id: panels.sidebar,
							collapsible: true,
							minSize: sidebarMinSize,
							maxSize: fromPixelToPercentage(400, windowWidth),
						},
						{
							id: panels.mainContent,
							collapsible: false,
						},
					]}
					onResizeEnd={(details) => {
						void navigate({
							from: "/connections/$connectionName",
							to: ".",
							search: (prev) => ({ ...prev, sidebarSize: details.size[0] }),
						});
					}}
					onExpand={(details) => {
						if (details.panelId === panels.sidebar) {
							void navigate({
								from: "/connections/$connectionName",
								to: ".",
								search: (prev) => ({ ...prev, sidebarSize: details.size }),
							});
						}
					}}
					onCollapse={(details) => {
						if (details.panelId === panels.sidebar) {
							void navigate({
								from: "/connections/$connectionName",
								to: ".",
								search: (prev) => ({ ...prev, sidebarSize: details.size }),
							});
						}
					}}
					// className="h-full flex flex-col min-h-0 w-full"
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
							activeConnectionUrl={pageState.activeConnectionUrl}
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
												from: "/connections/$connectionName",
												to: ".",
												search: (prev) => ({ ...prev, sidebarSize: 0 }),
											});
											return;
										}

										ctx.expandPanel(panels.sidebar);
										void navigate({
											from: "/connections/$connectionName",
											to: ".",
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
										pageState.rowsQuery.isLoading ||
										pageState.isColumnMetadataLoading
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
											logicalOperator={
												pageState.queryBuilder.filter.logicalOperator
											}
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
										<div className="flex-1 flex flex-col h-full min-h-0 px-2 gap-2">
											{/* SQL Query Preview */}
											<div className="shrink-0 max-h-40 overflow-auto">
												<SqlQueryPreview
													sql={pageState.sqlQuery.data?.sql || ""}
													formattedSql={
														pageState.sqlQuery.data?.formattedSql || ""
													}
													isLoading={pageState.sqlQuery.isLoading}
													error={pageState.sqlQuery.error}
													className="text-sm"
												/>
											</div>

											{pageState.rowsQuery.isLoading ? (
												<Stack className="flex-1 flex items-center justify-center">
													<Spinner />
													<span className="text-muted-foreground">
														{pageState.rowsQuery.failureCount > 0 ? (
															<>
																Failed {pageState.rowsQuery.failureCount} time
																{pageState.rowsQuery.failureCount > 1
																	? "s"
																	: ""}
																, retrying...
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
																id: "rows-table",
																collapsible: true,
																minSize: 0,
															},
															{
																id: "relationships",
																collapsible: true,
																collapsedSize: relationshipPanelSize,
																minSize: relationshipPanelSize,
															},
														]}
													>
														<Splitter.Panel
															id="rows-table"
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
																						pageState.onNullsOrderChange(
																							"first",
																						);
																					}}
																					disabled={
																						column.getIsSorted() === "asc" &&
																						pageState.currentNullsOrder ===
																							"first"
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
																						pageState.onNullsOrderChange(
																							"last",
																						);
																					}}
																					disabled={
																						column.getIsSorted() === "asc" &&
																						pageState.currentNullsOrder ===
																							"last"
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
																						pageState.onNullsOrderChange(
																							"first",
																						);
																					}}
																					disabled={
																						column.getIsSorted() === "desc" &&
																						pageState.currentNullsOrder ===
																							"first"
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
																						pageState.onNullsOrderChange(
																							"last",
																						);
																					}}
																					disabled={
																						column.getIsSorted() === "desc" &&
																						pageState.currentNullsOrder ===
																							"last"
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
																							...(tab.filters?.conditions ??
																								[]),
																							{
																								column: columnId,
																								operator: "equals",
																							},
																						],
																						logicalOperator:
																							tab.filters?.logicalOperator ??
																							"and",
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
																			containerRef={{ current: tableContainer }}
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
																					ctx.isPanelCollapsed("relationships"),
																				)
																					? "h-2"
																					: "h-1.5",
																				"bg-border hover:bg-primary/50 cursor-row-resize transition-colors",
																			)}
																			title="Drag to resize"
																			onDoubleClick={() =>
																				ctx.isPanelExpanded("rows-table")
																					? ctx.collapsePanel("rows-table")
																					: ctx.expandPanel("rows-table")
																			}
																		/>
																	)}
																</Splitter.Context>
																<Splitter.Panel
																	id="relationships"
																	className="overflow-hidden flex flex-col mb-2.5"
																>
																	<Splitter.Context>
																		{(ctx) => {
																			let isPanelExpanded = false;
																			try {
																				isPanelExpanded =
																					ctx.isPanelExpanded("relationships");
																			} catch {}

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
																					isPanelExpanded={isPanelExpanded}
																					onCollapse={() => {
																						ctx.collapsePanel("relationships");
																					}}
																					onExpand={() => {
																						ctx.expandPanel("relationships");
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
										</div>
									)}
								</div>
							</>
						) : (
							<RowsTableErrorState
								activeConnectionUrl={pageState.activeConnectionUrl}
								connection={connection}
							/>
						)}
					</Splitter.Panel>
				</Splitter.Root>

				{/* Query Logger Panel */}
				<QueryLoggerPanel connectionUrl={pageState.activeConnectionUrl} />
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

			{/* Quick References */}
			<ConnectionQuickReferencesDrawer connection={connection} />

			{/* Row JSON Viewer */}
			<ConnectionRowJsonViewerDrawer connection={connection} />

			{/* Schema Explorer */}
			<SchemaExplorerDrawer connection={connection} />
		</div>
	);
};
