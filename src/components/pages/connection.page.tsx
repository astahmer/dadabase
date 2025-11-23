import { useConnectionPageState } from "#src/hooks/use-connection-page-state.tsx";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Splitter } from "@ark-ui/react";
import { useState } from "react";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../ui/sheet.tsx";
import { Stack } from "../ui/layout.tsx";
import { Spinner } from "../ui/spinner.tsx";
import { ErrorBoundaryCard } from "../shared/error-boundary-card.tsx";
import { RelationshipsPanel } from "../relationships-panel";
import { QueryFilterBuilder } from "../query-filter-builder";
import { DataTable } from "../data-table";
import { ScrollToColumnButton } from "../scroll-to-column.button.tsx";
import { ConnectionPageHeader } from "./connection-page/connection-page-header.tsx";
import { ConnectionPageSidebar } from "./connection-page/connection-page-sidebar.tsx";
import { ConnectionPageTabs } from "./connection-page/connection-page-tabs.tsx";
import { ConnectionPageFilters } from "./connection-page/connection-page-filters.tsx";
import { ConnectionPageStatusBar } from "./connection-page/connection-page-status-bar.tsx";
import { StructureTable } from "./connection-page/structure-table.tsx";
import { RowsTableErrorState } from "./connection-page/rows-table-error-state.tsx";
import { ConnectionForm } from "./connection.form.tsx";
import { ConnectionQuickReferencesDrawer } from "./connection-page/connection-quick-references.drawer.tsx";
import { ConnectionRowJsonViewerDrawer } from "./connection-page/connection-row-json-viewer.drawer.tsx";
import {
	getActiveTabState,
	updateTabState,
	useActiveTabState,
} from "./connection-page/create-tab-state.ts";
import { fromPixelToPercentage } from "#src/lib/calculate-percentage-from-pixels.ts";
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

	return (
		<div className="h-screen bg-background flex flex-col">
			{/* Header */}
			<ConnectionPageHeader
				connection={connection}
				onAddConnection={() => setShowAddConnectionDrawer(true)}
			/>

			{/* Main Layout */}
			<div className="flex-1 flex h-full min-h-0">
				{/* Sidebar */}
				<ConnectionPageSidebar
					connection={connection}
					activeConnectionUrl={activeConnectionUrl}
				/>

				{/* Content Area */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{/* Tabs */}
					<ConnectionPageTabs activeConnectionUrl={activeConnectionUrl} />

					{search.table && search.schema ? (
						<>
							{/* Filters */}
							<ConnectionPageFilters
								columnList={columnList}
								table={rowsDataTable}
								isLoading={rowsQuery.isLoading || isColumnMetadataLoading}
								queryBuilder={queryBuilder}
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
									<div className="flex-1 p-2 pt-0 overflow-auto">
										<StructureTable
											columnMetadata={columnMetadata}
											isLoading={isColumnMetadataLoading}
											tableSize={search.tableSize}
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
																					tab.filters?.logicalOperator ?? "and",
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
																		className="h-1 bg-border hover:bg-primary/50 cursor-row-resize transition-colors"
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
						<RowsTableErrorState activeConnectionUrl={activeConnectionUrl} />
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
