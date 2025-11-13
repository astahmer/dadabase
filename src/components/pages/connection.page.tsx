import { useConnectionPageState } from "#src/hooks/use-connection-page-state.tsx";
import { type QueryFilterBuilderReturn } from "#src/hooks/use-query-builder";
import { formatRelativeTime } from "#src/lib/format-relative-time.ts";
import { redactConnectionUrl } from "#src/lib/redact-connection-url";
import { getDbNameFromConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { listAvailableDatabase } from "#src/server/pg/start-fns/get-available-database-list.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/pg/start-fns/get-available-schemas.start";
import { listAvailableTablesQueryOptions } from "#src/server/pg/start-fns/get-available-tables.start";
import { getTableColumnsQueryOptions } from "#src/server/pg/start-fns/get-table-columns.start.ts";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { Splitter, useListCollection } from "@ark-ui/react";
import { Listbox, createListCollection } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { Pagination } from "@ark-ui/react/pagination";
import {
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ColumnDef, Table as TanstackTable } from "@tanstack/react-table";
import { DateTime } from "effect";
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
import { useMemo, useState } from "react";
import { getErrorMessage } from "../../lib/get-error-message.ts";
import { BulkActionBar } from "../bulk-action-bar";
import { CollapsibleSidebar } from "../collapsible-sidebar";
import { ColumnVisibilityControls } from "../column-visibility";
import { DataTable } from "../data-table";
import { NaturalLanguageSearch } from "../natural-language-search";
import { OrderBySelect } from "../order-by-select";
import { RelationshipsPanel } from "../relationships-panel";
import { QueryFilterBuilder } from "../query-filter-builder";
import { ScrollToColumnButton } from "../scroll-to-column.button.tsx";
import { TableTabsBar } from "../table-tabs-bar";
import * as Breadcrumb from "../ui/breadcrumb";
import { Button } from "../ui/button";
import { DarkModeToggle } from "../ui/dark-mode-toggle";
import { DataTypeBadge } from "../ui/data-type-badge";
import { HStack, Stack } from "../ui/layout.tsx";
import * as ListboxMenu from "../ui/listbox-menu";
import { PrimaryKeyIcon } from "../ui/primary-key-icon";
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
import { UniqueConstraintIcon } from "../ui/unique-constraint-icon";
import { useDataTable } from "../use-data-table";
import { ConnectionQuickReferencesDrawer } from "./connection-page/connection-quick-references.drawer.tsx";
import { ConnectionRowJsonViewerDrawer } from "./connection-page/connection-row-json-viewer.drawer.tsx";
import { createTabState } from "./connection-page/create-tab-state.ts";
import { ConnectionForm } from "./connection.form.tsx";
import type { DbConnection } from "./connection.types";
import type { DataTableSize } from "../data-table.styles.ts";
import { getDefaultColumnSize } from "#src/lib/get-default-column-size.ts";

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
	const search = useSearch({
		from: "/connections/$connectionName",
		select: (s) => ({
			dbName: s.dbName,
			schema: s.schema,
			table: s.table,
			filtersOpened: s.filtersOpened,
			viewMode: s.viewMode,
			tableSize: s.tableSize,
		}),
	});

	const [showAddConnectionDrawer, setShowAddConnectionDrawer] = useState(false);
	const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(
		null,
	);
	const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
	const [selectedRowData, setSelectedRowData] = useState<Record<
		string,
		unknown
	> | null>(null);

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
		expandedState,
		relationships,
		RelationshipSubrowComponent,
	} = pageState;

	return (
		<div className="h-screen bg-background flex flex-col">
			{/* Header */}
			<ConnectionPageHeader
				connection={connection}
				onAddConnection={() => setShowAddConnectionDrawer(true)}
			/>

			{/* Main Layout */}
			<div className="flex-1 flex h-full min-h-0">
				{/* Collapsible Sidebar */}
				<ConnectionPageSidebar
					connection={connection}
					activeConnectionUrl={activeConnectionUrl}
				/>

				{/* Content Area */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{/* Table Tabs - Always visible when there are tabs */}
					<ConnectionPageTabs activeConnectionUrl={activeConnectionUrl} />

					{search.table && search.schema ? (
						<>
							{/* View Toggle & Filter Controls */}
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
												<Splitter.Root
													orientation="vertical"
													className="flex-1 flex flex-col h-full overflow-hidden"
													panels={[
														{
															id: "table",
															collapsible: false,
															minSize: 30,
														},
														{
															id: "relationships",
															collapsible: true,
															collapsedSize: 7,
															minSize: 7,
														},
													]}
												>
													<Splitter.Panel
														id="table"
														className="flex-1 overflow-auto flex flex-col relative"
													>
														<DataTable
															virtualized
															enableColumnOrdering
															table={rowsDataTable}
															getTableContainer={setTableContainer}
															isLoading={
																rowsQuery.isLoading || isColumnMetadataLoading
															}
															size={search.tableSize}
															withContextMenu
															expandedState={expandedState}
															relationships={relationships}
															RelationshipSubrowComponent={
																RelationshipSubrowComponent
															}
															onRowClick={(row) => {
																const primaryKeyColumn = columnMetadata.find(
																	(col) => col.primaryKey,
																);
																const rowId = primaryKeyColumn
																	? String(row.original[primaryKeyColumn.name])
																	: undefined;
																if (rowId) {
																	setSelectedRowId(rowId);
																	setSelectedRowData(
																		row.original as Record<string, unknown>,
																	);
																}
															}}
															onColumnFilterClick={(columnId, _columnName) => {
																navigate({
																	search: (prev) => ({
																		...prev,
																		filtersOpened: true,
																		filters: {
																			conditions: [
																				...(prev.filters?.conditions ?? []),
																				{
																					column: columnId,
																					operator: "equals",
																				},
																			],
																			logicalOperator:
																				prev.filters?.logicalOperator ?? "and",
																		},
																	}),
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

													{selectedRowId && selectedRowData && (
														<>
															<Splitter.ResizeTrigger
																id="table:relationships"
																className="h-1 bg-border hover:bg-primary/50 cursor-row-resize transition-colors"
															/>
															<Splitter.Panel
																id="relationships"
																className="overflow-hidden flex flex-col"
															>
																<Splitter.Context>
																	{(ctx) => (
																		<RelationshipsPanel
																			connectionUrl={activeConnectionUrl}
																			schema={search.schema}
																			table={search.table!}
																			selectedRowId={selectedRowId}
																			rowData={selectedRowData}
																			isPanelExpanded={ctx.isPanelExpanded(
																				"relationships",
																			)}
																			onPanelHidden={() => {
																				ctx.collapsePanel("relationships");
																			}}
																			onPanelExpanded={() => {
																				ctx.expandPanel("relationships");
																			}}
																		/>
																	)}
																</Splitter.Context>
															</Splitter.Panel>
														</>
													)}
												</Splitter.Root>
											</>
										)}
										{/* Footer Bar - Bulk Actions & Status */}
										<div className="flex-shrink-0 border-t flex flex-col gap-0">
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

			{/* Quick References Panel */}
			<ConnectionQuickReferencesDrawer connection={connection} />

			{/* Row JSON Viewer Sheet (expanded) */}
			<ConnectionRowJsonViewerDrawer connection={connection} />
		</div>
	);
};

const TableSizeCollection = ArkSelect.createListCollection({
	items: [
		{ label: "Excel", value: "excel" },
		{ label: "Minimal", value: "minimal" },
		{ label: "Compact", value: "compact" },
		{ label: "Cozy", value: "cozy" },
		{
			label: "Comfortable",
			value: "comfortable",
		},
	],
});

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
		isForeignKey?: boolean;
		foreignKey?: {
			referencedSchema: string;
			referencedTable: string;
			referencedColumn: string;
		};
	}>;
	isLoading: boolean;
	tableSize: DataTableSize;
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
					id: "foreignKey",
					header: "Foreign Key",
					enableResizing: true,
					cell: (info) => {
						const row = info.row.original;
						if (!row.isForeignKey || !row.foreignKey) {
							return <span className="text-xs text-muted-foreground">—</span>;
						}
						const fk = row.foreignKey;
						return (
							<span className="text-xs font-mono">
								{fk.referencedSchema}.{fk.referencedTable}.{fk.referencedColumn}
							</span>
						);
					},
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

const ConnectionPageHeader = (props: {
	connection: DbConnection;
	onAddConnection: () => void;
}) => {
	const { connection } = props;
	const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);

	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
	const connectionName = connection.name;
	const redactedUrl = redactConnectionUrl(connection.url);

	return (
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
								<ListboxMenu.ListboxMenuRoot
									open={connectionMenuOpen}
									onOpenChange={(details) => {
										setConnectionMenuOpen(details.open);
									}}
								>
									<ListboxMenu.ListboxMenuTrigger
										variant="unstyled"
										size="unstyled"
										asChild
									>
										<Button variant="ghost" size="sm">
											<span className="text-foreground">{connection.name}</span>
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
													setConnectionMenuOpen(false);
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
														className={
															conn.name === connectionName
																? "bg-primary/15 text-primary font-semibold hover:bg-primary/20"
																: ""
														}
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
														setConnectionMenuOpen(false);
														props.onAddConnection();
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
									quickReferencesCellValue: undefined,
									quickReferencesColumnName: undefined,
									quickReferencesOpen: false,
									tableFilter: prev.tableFilter,
									tabs: [],
									activeTabId: undefined,
								}),
							});
						}}
					>
						Reset page
					</Button>
					<Tooltip content="Refetch all">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								queryClient.invalidateQueries();
							}}
							className="shrink-0"
						>
							<RefreshCw className="h-4 w-4" />
						</Button>
					</Tooltip>
					<DarkModeToggle />
				</div>
			</div>
		</div>
	);
};

const ConnectionPageSidebar = (props: {
	connection: DbConnection;
	activeConnectionUrl: string;
}) => {
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

	const selectedSchema = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.schema,
	});
	const tablesListQuery = useQuery({
		...listAvailableTablesQueryOptions({ url: activeConnectionUrl }),
		enabled: !!selectedSchema,
		retry: 3,
	});

	const allSchemaList = schemaListQuery.data || [];
	const tableList = tablesListQuery.data || [];

	const { contains } = useFilter({ sensitivity: "base" });

	const tableFilter = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.tableFilter,
	});
	const selectedTable = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.table,
	});
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
									{databaseListQuery.failureCount > 1 ? "s" : ""}, retrying...
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
						value={selectedSchema ? [selectedSchema] : []}
						collection={schemaCollection}
						positioning={{ sameWidth: true }}
						disabled={schemaListQuery.isLoading}
						onValueChange={(details: { value?: string[] }) => {
							const newSchema = details.value?.[0];
							if (newSchema) {
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
							{schemaCollection.items.map((item) => (
								<ArkSelect.SelectItem key={item.value} item={item}>
									{item.label}
								</ArkSelect.SelectItem>
							))}
						</ArkSelect.SelectContent>
					</ArkSelect.Select>
				)}
			</Stack>{" "}
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
										{tablesListQuery.failureCount > 1 ? "s" : ""}, retrying...
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
																	// Check if a tab with this tabId already exists
																	const existingTab = (prev.tabs ?? []).find(
																		(t) => t.tabId === tabState.tabId,
																	);

																	// If tab exists, just switch to it, otherwise add it
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

const ConnectionPageTabs = (props: { activeConnectionUrl: string }) => {
	const { activeConnectionUrl } = props;

	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const tabs = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.tabs ?? [],
	});
	const activeTabId = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.activeTabId ?? null,
	});

	const addEmptyTab = () => {
		// Create a placeholder empty tab with a unique ID
		const tabId = `empty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const emptyTabState = {
			tabId,
			schema: "",
			table: "",
			tableFilter: undefined,
			orderBy: undefined,
			orderDirection: undefined,
			limit: 50,
			offset: 0,
			viewMode: "rows" as const,
			tableSize: "cozy" as const,
			hiddenColumnList: undefined,
			filters: undefined,
			filtersOpened: false,
		};
		navigate({
			search: (prev) => ({
				...prev,
				tabs: [...(prev.tabs ?? []), emptyTabState],
				activeTabId: tabId,
			}),
		});
	};

	const closeTab = (tabId: string) => {
		navigate({
			search: (prev) => {
				const updatedTabs = (prev.tabs ?? []).filter((t) => t.tabId !== tabId);
				let newActiveTabId = prev.activeTabId;

				// If we closed the active tab, switch to another tab
				if (prev.activeTabId === tabId) {
					if (updatedTabs.length > 0) {
						newActiveTabId = updatedTabs[updatedTabs.length - 1].tabId;
					} else {
						newActiveTabId = undefined;
					}
				}

				return {
					...prev,
					tabs: updatedTabs,
					activeTabId: newActiveTabId,
				};
			},
		});
	};

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

	const prefetchTableColumns = (schema: string, table: string) => {
		queryClient.prefetchQuery({
			...getTableColumnsQueryOptions({
				url: activeConnectionUrl,
				schema,
				table,
			}),
		});
	};

	return (
		<TableTabsBar
			tabs={tabs}
			activeTabId={activeTabId}
			onTabHover={(tab) => {
				if (tab.schema && tab.table) {
					prefetchTableData(tab.schema, tab.table);
					prefetchTableColumns(tab.schema, tab.table);
				}
			}}
			onTabChange={(tabId) => {
				const tab = tabs.find((t) => t.tabId === tabId);
				if (tab) {
					if (!tab.schema || !tab.table) {
						// Empty tab - just switch to it without selecting a table
						navigate({
							search: (prev) => ({
								...prev,
								table: undefined,
								schema: undefined,
								activeTabId: tabId,
							}),
						});
					} else {
						// Named tab with schema/table - restore its state
						navigate({
							search: (prev) => ({
								...prev,
								schema: tab.schema,
								table: tab.table,
								offset: tab.offset ?? 0,
								limit: tab.limit ?? 50,
								orderBy: tab.orderBy,
								orderDirection: tab.orderDirection,
								filters: tab.filters,
								filtersOpened: tab.filtersOpened ?? false,
								viewMode: tab.viewMode ?? "rows",
								tableSize: tab.tableSize ?? "cozy",
								tableFilter: tab.tableFilter,
								hiddenColumnList: tab.hiddenColumnList,
								fkValue: tab.fkValue,
								activeTabId: tabId,
							}),
						});
					}
				}
			}}
			onTabClose={(tabId) => {
				closeTab(tabId);
				// If there are remaining tabs, navigate to the last one
				const remainingTabs = tabs.filter((t) => t.tabId !== tabId);
				if (remainingTabs.length > 0) {
					const lastTab = remainingTabs[remainingTabs.length - 1];
					if (!lastTab.schema || !lastTab.table) {
						navigate({
							search: (prev) => ({
								...prev,
								table: undefined,
								schema: undefined,
								activeTabId: lastTab.tabId,
							}),
						});
					} else {
						navigate({
							search: (prev) => ({
								...prev,
								schema: lastTab.schema,
								table: lastTab.table,
								offset: lastTab.offset ?? 0,
								limit: lastTab.limit ?? 50,
								orderBy: lastTab.orderBy,
								orderDirection: lastTab.orderDirection,
								filters: lastTab.filters,
								filtersOpened: lastTab.filtersOpened ?? false,
								viewMode: lastTab.viewMode ?? "rows",
								tableSize: lastTab.tableSize ?? "cozy",
								tableFilter: lastTab.tableFilter,
								hiddenColumnList: lastTab.hiddenColumnList,
								activeTabId: lastTab.tabId,
							}),
						});
					}
				} else {
					// No more tabs, go back to no table selected
					navigate({
						search: (prev) => ({
							...prev,
							table: undefined,
							schema: undefined,
							activeTabId: undefined,
						}),
					});
				}
			}}
			onAddTab={() => {
				addEmptyTab();
				navigate({
					search: (prev) => ({
						...prev,
						table: undefined,
					}),
				});
			}}
		/>
	);
};

const RowsTableErrorState = ({
	activeConnectionUrl,
}: {
	activeConnectionUrl: string;
}) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const schemaListQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
		enabled: !!activeConnectionUrl,
		retry: 3,
	});
	return (
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
	);
};

const ConnectionPageFilters = (props: {
	columnList: string[];
	isLoading: boolean;
	table: TanstackTable<any>;
	queryBuilder: QueryFilterBuilderReturn;
}) => {
	const { columnList, isLoading, table, queryBuilder } = props;
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const viewMode = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.viewMode,
	});

	const filtersOpened = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.filtersOpened,
	});

	const filterConditions = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.filters?.conditions ?? [],
	});

	const orderBy = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.orderBy,
	});

	const orderDirection = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.orderDirection,
	});

	return (
		<div className="relative border-b bg-muted/50">
			{isLoading && (
				<div
					// bg-linear-to-r from-primary via-primary to-transparent
					className="absolute inset-x-0 top-0 h-0.5 bg-primary"
					style={{
						background:
							"linear-gradient(90deg, transparent, var(--color-primary), transparent)",
						animation: "shimmer 1.5s infinite",
					}}
				/>
			)}
			<HStack className="px-4 py-2 items-center justify-between">
				<div className="flex gap-2">
					<Tooltip content="View rows">
						<Button
							variant={viewMode === "rows" ? "default" : "outline"}
							size="sm"
							onClick={() =>
								navigate({
									search: (prev) => {
										// Update the currently active tab with the same viewMode
										const updatedTabs = (prev.tabs ?? []).map((tab) => {
											if (tab.tabId === prev.activeTabId) {
												return {
													...tab,
													viewMode: "rows" as const,
												};
											}
											return tab;
										});

										return {
											...prev,
											viewMode: "rows" as const,
											tabs: updatedTabs,
										};
									},
								})
							}
						>
							<Rows className="h-4 w-4" />
						</Button>
					</Tooltip>
					<Tooltip content="View table structure">
						<Button
							variant={viewMode === "structure" ? "default" : "outline"}
							size="sm"
							onClick={() =>
								navigate({
									search: (prev) => {
										// Update the currently active tab with the same viewMode
										const updatedTabs = (prev.tabs ?? []).map((tab) => {
											if (tab.tabId === prev.activeTabId) {
												return {
													...tab,
													viewMode: "structure" as const,
												};
											}
											return tab;
										});

										return {
											...prev,
											viewMode: "structure" as const,
											tabs: updatedTabs,
										};
									},
								})
							}
						>
							<LayoutGrid className="h-4 w-4" />
						</Button>
					</Tooltip>
					{viewMode === "rows" && (
						<Button
							variant={
								filterConditions.length > 0 && !filtersOpened
									? "default"
									: "outline"
							}
							size="sm"
							onClick={() => {
								if (queryBuilder.filter.conditions.length === 0) {
									queryBuilder.addCondition();
								} else {
									navigate({
										search: (prev) => {
											// Update the currently active tab with the same filtersOpened state
											const updatedTabs = (prev.tabs ?? []).map((tab) => {
												if (tab.tabId === prev.activeTabId) {
													return {
														...tab,
														filtersOpened: !prev.filtersOpened,
													};
												}
												return tab;
											});

											return {
												...prev,
												filtersOpened: !prev.filtersOpened,
												tabs: updatedTabs,
											};
										},
									});
								}
							}}
							disabled={isLoading}
							className={filterConditions.length > 0 ? "gap-2" : ""}
						>
							<LucideListFilter className="h-3 w-3" />
							{filterConditions.length > 0
								? filtersOpened
									? "Filters"
									: "Open filters"
								: "Add filter"}
							{filterConditions.length > 0 && (
								<span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-semibold bg-background/20">
									{filterConditions.length || 0}
								</span>
							)}
							{filterConditions.length > 0 ? (
								filtersOpened ? (
									<LucideChevronUp className="h-3 w-3" />
								) : (
									<LucideChevronDown className="h-3 w-3" />
								)
							) : null}
						</Button>
					)}
				</div>
				{viewMode === "rows" && (
					<NaturalLanguageSearch
						className="w-full"
						availableColumns={columnList}
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
								// Remove filters related to the NL query
								if (parsed.clear) {
									queryBuilder.updateManyConditions(
										filterConditions.filter((current) => {
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
										filterConditions
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
				{viewMode === "rows" && (
					<ColumnVisibilityControls
						// key={(search.hiddenColumnList ?? []).join(",")}
						// key={JSON.stringify(columnVisibilityState)}
						table={table}
						columnList={columnList}
						minimal={true}
					/>
				)}
				{viewMode === "rows" && (
					<OrderBySelect
						columnList={columnList}
						orderBy={orderBy}
						orderDirection={orderDirection}
						onOrderChange={(orderBy, direction) => {
							navigate({
								search: (prev) => {
									// Update the currently active tab with the same order updates
									const updatedTabs = (prev.tabs ?? []).map((tab) => {
										if (tab.tabId === prev.activeTabId) {
											return {
												...tab,
												orderBy,
												orderDirection: direction || "asc",
												offset: 0,
											};
										}
										return tab;
									});

									return {
										...prev,
										orderBy,
										orderDirection: direction || "asc",
										offset: 0,
										tabs: updatedTabs,
									};
								},
							});
						}}
						getColumnLabel={(col) => col}
						minimal
					/>
				)}
			</HStack>
		</div>
	);
};

const ConnectionPageStatusBar = (props: {
	table: TanstackTable<any>;
	hasUuid: boolean;
	isLoading: boolean;
	refetch: () => void;
	timeTaken: number;
	ranAt: number;
	totalRowCount: number;
	rowsColumnsCount: number;
}) => {
	const { isLoading, refetch } = props;

	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const selectedSchema = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.schema,
	});
	const selectedTable = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.table,
	});
	const tableDisplayName = selectedTable
		? `${selectedSchema}.${selectedTable}`
		: "No table selected";

	const offset = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.offset,
	});
	const limit = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.limit,
	});

	const tableSize = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.tableSize,
	});

	return (
		<div className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
			<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4">
				{/* Left side - Table info */}
				<HStack className="flex-1 min-w-0 whitespace-nowrap overflow-x-auto">
					{isLoading ? (
						<span className="text-muted-foreground/50">Loading...</span>
					) : (
						<>
							<span className="truncate">
								{tableDisplayName}
								<span className="hidden sm:inline">
									{" "}
									({props.rowsColumnsCount} columns)
								</span>
							</span>
							<span className="shrink-0">
								{offset}-{Math.min(props.totalRowCount, offset + limit)}{" "}
								<span className="hidden md:inline">out of </span>
								<span className="hidden md:inline">{props.totalRowCount}</span>
							</span>
						</>
					)}
				</HStack>
				{/* Middle - Query time info */}
				<span className="hidden lg:inline text-muted-foreground text-xs">
					{props.timeTaken > 0 && (
						<HStack gap="1" align="center">
							{`${props.timeTaken}ms`}
							<span>•</span>
							<Tooltip
								content={DateTime.formatIso(DateTime.unsafeMake(props.ranAt))}
							>
								<span>Loaded {formatRelativeTime(props.ranAt)}</span>
							</Tooltip>
						</HStack>
					)}
				</span>
				{/* Right side - Controls */}
				<div className="flex flex-wrap items-center gap-2 lg:gap-3">
					{/* Pagination Controls */}
					<Pagination.Root
						count={props.totalRowCount}
						pageSize={limit}
						siblingCount={1}
						page={Math.floor(offset / limit) + 1}
						onPageChange={(details) => {
							navigate({
								search: (prev) => {
									// Update the currently active tab with the same offset
									const updatedTabs = (prev.tabs ?? []).map((tab) => {
										if (tab.tabId === prev.activeTabId) {
											return {
												...tab,
												offset: (details.page - 1) * limit,
											};
										}
										return tab;
									});

									return {
										...prev,
										offset: (details.page - 1) * limit,
										tabs: updatedTabs,
									};
								},
							});
						}}
					>
						<Pagination.Context>
							{(pagination) => (
								<div className="flex items-center gap-1">
									<Pagination.PrevTrigger asChild>
										<Button variant="ghost" size="sm" className="h-6 px-1">
											‹
										</Button>
									</Pagination.PrevTrigger>
									<span className="text-xs mx-2">
										{pagination.page} /{" "}
										{pagination.totalPages === 0
											? "..."
											: pagination.totalPages}
									</span>
									<Pagination.NextTrigger asChild>
										<Button variant="ghost" size="sm" className="h-6 px-1">
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
							value={limit}
							onValueChange={(newLimit) => {
								navigate({
									search: (prev) => {
										// Update the currently active tab with the same limit updates
										const updatedTabs = (prev.tabs ?? []).map((tab) => {
											if (tab.tabId === prev.activeTabId) {
												return {
													...tab,
													limit: newLimit,
													offset: 0,
												};
											}
											return tab;
										});

										return {
											...prev,
											limit: newLimit,
											offset: 0,
											tabs: updatedTabs,
										};
									},
								});
							}}
						/>
					</div>
					<div className="flex items-center gap-2 text-foreground">
						<ArkSelect.Select
							className="w-28"
							value={[tableSize]}
							collection={TableSizeCollection}
							positioning={{ sameWidth: true }}
							onValueChange={(details) => {
								const newSize = (details.value?.[0] || "cozy") as DataTableSize;
								navigate({
									search: (prev) => {
										// Update the currently active tab with the same tableSize
										const updatedTabs = (prev.tabs ?? []).map((tab) => {
											if (tab.tabId === prev.activeTabId) {
												return {
													...tab,
													tableSize: newSize,
												};
											}
											return tab;
										});

										return {
											...prev,
											tableSize: newSize,
											tabs: updatedTabs,
										};
									},
								});

								const newSizing: Record<string, number> = {};
								const defaultSIze = getDefaultColumnSize({
									tableSize: newSize,
									hasUuid: props.hasUuid,
								});
								for (const col of props.table.getAllColumns()) {
									newSizing[col.id] = defaultSIze;
								}

								props.table.setColumnSizing(newSizing);
							}}
						>
							<ArkSelect.SelectControl>
								<ArkSelect.SelectTrigger>
									<ArkSelect.SelectValueText />
									<ArkSelect.SelectIndicator />
								</ArkSelect.SelectTrigger>
							</ArkSelect.SelectControl>
							<ArkSelect.SelectContent>
								{TableSizeCollection.items.map((item) => (
									<ArkSelect.SelectItem key={item.value} item={item}>
										{item.label}
									</ArkSelect.SelectItem>
								))}
							</ArkSelect.SelectContent>
						</ArkSelect.Select>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => refetch()}
						className="h-6 px-2"
					>
						<RefreshCw className="h-3 w-3" />
					</Button>
				</div>
			</div>
		</div>
	);
};
