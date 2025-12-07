import { useConnectionPageState } from "#src/components/pages/connection-page/use-connection-page-state.tsx";
import { fromPixelToPercentage } from "#src/lib/calculate-percentage-from-pixels.ts";
import { cn, tryFn } from "#src/lib/utils.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { Splitter } from "@ark-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DataTable } from "../data-table/data-table.tsx";
import { ScrollToColumnButton } from "../data-table/scroll-to-column.button.tsx";
import { QueryFilterBuilder } from "../query-builder/query-filter-builder.tsx";
import { QueryLoggerPanel } from "../query-logger/query-logger-panel.tsx";
import { ErrorBoundaryCard } from "../shared/error-boundary-card.tsx";
import { Stack } from "../ui/layout.tsx";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../ui/sheet.tsx";
import { Spinner } from "../ui/spinner.tsx";
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
import { useStructureFilters } from "./connection-page/use-structure-filter-state.ts";
import { ConnectionForm } from "./connection.form.tsx";
import type { DbConnection } from "./connection.types";

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

const ConnectionPageInner = ({ connection }: { connection: DbConnection }) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const [showAddConnectionDrawer, setShowAddConnectionDrawer] = useState(false);
	const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(
		null,
	);

	const search = useActiveTabState((s) => {
		return {
			schema: s.schema,
			table: s.table,
			filtersOpened: s.filtersOpened,
			viewMode: s.viewMode,
			tableSize: s.tableSize,
			limit: s.limit,
		};
	});

	const { filters: structureFilters } = useStructureFilters();

	const pageState = useConnectionPageState({ connection });
	const {
		activeConnectionUrl,
		queryBuilder,
		rowsQuery,
		columnMetadata,
		columnList,
		isColumnMetadataLoading,
		queryResponse,
		totalRowCount,
		rowsDataTable,
		rowsColumns,
		hasUuid,
		relationshipRowId,
	} = pageState;

	const relationshipPanelSize = fromPixelToPercentage(50);
	const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
	const minSize = fromPixelToPercentage(224, windowWidth);

	return (
		<div className="h-screen bg-background flex flex-col">
			{/* Main Layout */}
			<div className="flex-1 flex h-full min-h-0 flex-col">
				<Splitter.Root
					orientation="horizontal"
					defaultSize={[minSize, 100 - minSize]}
					panels={[
						{
							id: "sidebar",
							collapsible: true,
							minSize: minSize,
							maxSize: fromPixelToPercentage(400, windowWidth),
						},
						{
							id: "main-content",
							collapsible: false,
						},
					]}
					// className="h-full flex flex-col min-h-0 w-full"
					className="flex-1 flex h-full min-h-0"
				>
					{/* Sidebar Panel */}
					<Splitter.Panel
						id="sidebar"
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
								id="sidebar:main-content"
								className={cn(
									tryFn(() => ctx.isPanelCollapsed("sidebar"))
										? "w-3"
										: "w-1.5",
									"h-full bg-border hover:bg-primary/50 cursor-row-resize transition-colors",
								)}
								title="Drag to resize, double-click to toggle"
								onDoubleClick={() => {
									ctx.isPanelExpanded("sidebar")
										? ctx.collapsePanel("sidebar")
										: ctx.expandPanel("sidebar");
								}}
							/>
						)}
					</Splitter.Context>

					{/* Main Content Panel */}
					<Splitter.Panel
						id="main-content"
						className="h-full min-h-0 flex-1 flex flex-col overflow-hidden"
					>
						{/* Tabs */}
						<Splitter.Context>
							{(ctx) => (
								<ConnectionPageTabs
									activeConnectionUrl={activeConnectionUrl}
									dialect={connection.dialect}
									onToggleSidebar={() => {
										ctx.isPanelExpanded("sidebar")
											? ctx.collapsePanel("sidebar")
											: ctx.expandPanel("sidebar");
									}}
									isSidebarCollapsed={ctx.isPanelCollapsed("sidebar")}
								/>
							)}
						</Splitter.Context>

						{search.table && search.schema ? (
							<>
								{/* Filters */}
								<ConnectionPageFilters
									columnList={columnList}
									table={rowsDataTable}
									isLoading={rowsQuery.isLoading || isColumnMetadataLoading}
									queryBuilder={queryBuilder}
									url={activeConnectionUrl}
									schema={search.schema}
									tableName={search.table}
								/>

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
								<div className="flex-1 overflow-hidden flex flex-col h-full">
									{search.viewMode === "structure" ? (
										<div className="flex-1 overflow-auto p-2 pt-0">
											<StructureTable
												columnMetadata={columnMetadata}
												isLoading={isColumnMetadataLoading}
												tableSize={search.tableSize}
												filters={structureFilters}
											/>
										</div>
									) : (
										<div className="flex-1 flex flex-col h-full min-h-0 px-2">
											{rowsQuery.isLoading ? (
												<Stack className="flex-1 flex items-center justify-center">
													<Spinner />
													<span className="text-muted-foreground">
														{rowsQuery.failureCount > 0 ? (
															<>
																Failed {rowsQuery.failureCount} time
																{rowsQuery.failureCount > 1 ? "s" : ""},
																retrying...
															</>
														) : (
															"Loading table data..."
														)}
													</span>
												</Stack>
											) : rowsQuery.isError ? (
												<div className="flex-1 flex items-center justify-center p-4">
													<Stack className="max-w-2xl w-full">
														<ErrorBoundaryCard
															error={rowsQuery.error}
															title="Error loading table data"
															onRetry={() => rowsQuery.refetch()}
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
															<DataTable
																virtualized={search.limit > 100}
																enableColumnOrdering
																table={rowsDataTable}
																getTableContainer={setTableContainer}
																isLoading={
																	rowsQuery.isLoading || isColumnMetadataLoading
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
																						tab.filters?.logicalOperator ??
																						"and",
																				},
																			})),
																	});
																}}
																onExpandRowJson={(row) => {
																	const primaryKeyColumn = columnMetadata.find(
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
															{!rowsQuery.isLoading &&
																!isColumnMetadataLoading && (
																	<ScrollToColumnButton
																		columnList={columnMetadata.map(
																			(col) => col.name,
																		)}
																		containerRef={{ current: tableContainer }}
																	/>
																)}
														</Splitter.Panel>

														{relationshipRowId && search.table && (
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
																						activeConnectionUrl +
																						search.table +
																						relationshipRowId
																					}
																					connectionUrl={activeConnectionUrl}
																					schema={search.schema}
																					table={search.table!}
																					selectedRowId={
																						relationshipRowId ?? null
																					}
																					rowData={
																						rowsDataTable
																							.getRowModel()
																							.rows.find(
																								(row) =>
																									row.id === relationshipRowId,
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
													table={rowsDataTable}
													hasUuid={hasUuid}
													isLoading={rowsQuery.isLoading}
													refetch={rowsQuery.refetch}
													timeTaken={queryResponse.timeTaken}
													ranAt={queryResponse.ranAt}
													totalRowCount={totalRowCount}
													rowsColumnsCount={rowsColumns.length}
												/>
											</div>
										</div>
									)}
								</div>
							</>
						) : (
							<RowsTableErrorState
								activeConnectionUrl={activeConnectionUrl}
								connection={connection}
							/>
						)}
					</Splitter.Panel>
				</Splitter.Root>

				{/* Query Logger Panel */}
				<QueryLoggerPanel connectionUrl={activeConnectionUrl} />
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
		</div>
	);
};
