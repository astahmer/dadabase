import { useConnectionStorage } from "#src/hooks/use-connection-storage";
import { useQueryBuilder } from "#src/hooks/use-query-builder";
import { useTableColumnMetadata } from "#src/hooks/use-table-column-metadata";
import { getColumnTextAlignment } from "#src/lib/data-type-utils";
import { redactConnectionUrl } from "#src/lib/redact-connection-url";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/pg/start-fns/get-available-schemas.start";
import { listAvailableTablesQueryOptions } from "#src/server/pg/start-fns/get-available-tables.start";
import { getAllTablesColumnsQueryOptions } from "#src/server/pg/start-fns/get-all-tables-columns.start";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { listAvailableDatabase } from "#src/server/pg/start-fns/get-available-database-list.start.ts";
import { findColumnReferencesWithCountsQueryOptions } from "#src/server/pg/start-fns/find-column-references.start.ts";
import { useListCollection } from "@ark-ui/react";
import { Listbox, createListCollection } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { Pagination } from "@ark-ui/react/pagination";
import {
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getErrorMessage } from "../../lib/get-error-message.ts";
import { BulkActionBar } from "../bulk-action-bar";
import { CollapsibleSidebar } from "../collapsible-sidebar";
import { ColumnVisibilityControls } from "../column-visibility";
import { DataTable } from "../data-table";
import { ScrollToColumnButton } from "../scroll-to-column.button.tsx";
import { NaturalLanguageSearch } from "../natural-language-search";
import { OrderBySelect } from "../order-by-select";
import { QueryFilterBuilder } from "../query-filter-builder";
import { Button } from "../ui/button";
import * as Breadcrumb from "../ui/breadcrumb";
import { Checkbox, CheckboxControl } from "../ui/checkbox.tsx";
import { ColumnHeaderWithInfo } from "../ui/column-header-with-info";
import { DarkModeToggle } from "../ui/dark-mode-toggle";
import { DataTypeBadge } from "../ui/data-type-badge";
import { ForeignKeyIcon } from "../ui/foreign-key-icon";
import { QuickReferencesPanel } from "../quick-references-panel";
import { JsonCell } from "../ui/json-cell";
import { JsonViewerModal } from "../ui/json-viewer";
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
import { TableTabsBar } from "../table-tabs-bar";
import { DateTime } from "effect";
import { RowActionsMenu } from "../ui/row-actions-menu";
import { MemoizedDataCell } from "../memoized-data-cell";
import type { ForeignKeyInfo } from "../cell-context-menu";

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
	const tableContainerRef = useRef<HTMLDivElement>(null);

	const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
	const connection = connectionList.data.find((c) => c.name === connectionName);
	const connectionUrl = connection?.url || "";

	const search = useSearch({ from: "/connections/$connectionName" });
	// console.log(search);

	// Use explicit tabIds from URL search params
	const tabs = (search.tabs ?? []).map((tabState) => ({
		...tabState,
	}));

	// Use explicit activeTabId from URL search params
	const activeTabId = search.activeTabId ?? null;

	// Helper functions to manage tabs via URL
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

	// Helper function to create a new tab state
	const createTabState = (
		schema: string,
		table: string,
		options?: {
			filters?: any;
			offset?: number;
			limit?: number;
			filtersOpened?: boolean;
			fkValue?: string;
		},
	) => ({
		tabId: `${schema}.${table}:${options?.fkValue ?? ""}`,
		schema,
		table,
		tableFilter: undefined,
		orderBy: undefined,
		orderDirection: undefined,
		limit: options?.limit ?? 50,
		offset: options?.offset ?? 0,
		viewMode: "rows" as const,
		tableSize: "cozy" as const,
		hiddenColumnList: undefined,
		filters: options?.filters,
		filtersOpened: options?.filtersOpened ?? false,
		fkValue: options?.fkValue,
	});

	const { setSchema, setTable } = useConnectionStorage(connectionName);

	// Use the selected database from search params, fall back to the default
	const defaultDatabaseName = getDbNameFromConnectionUrl(connectionUrl);
	const selectedDbName = search.dbName;

	// Build the connection URL with the selected database
	const activeConnectionUrl = selectedDbName
		? replaceDatabaseInConnectionUrl(connectionUrl, selectedDbName)
		: connectionUrl;

	// Helper function to prefetch table data - must be after activeConnectionUrl is defined
	// Uses exact same params that will be used when switching to ensure cache hit
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

	// Helper function to prefetch all tables' column metadata for a schema
	const prefetchAllTablesColumns = (schema: string) => {
		queryClient.prefetchQuery({
			...getAllTablesColumnsQueryOptions({
				url: activeConnectionUrl,
				schema,
			}),
		});
	};

	// Helper function to prefetch column metadata (kept for backward compatibility)
	const prefetchTableColumns = (schema: string) => {
		// First try to prefetch all tables' metadata
		prefetchAllTablesColumns(schema);
	};

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
				search: (prev) => {
					// Update the currently active tab's filters in the tabs array
					const updatedTabs = (prev.tabs ?? []).map((tab) => {
						if (tab.tabId === prev.activeTabId) {
							return {
								...tab,
								filters: updatedFilter,
								filtersOpened: shouldOpenFilters,
							};
						}
						return tab;
					});

					return {
						...prev,
						filters: updatedFilter || undefined,
						filtersOpened: shouldOpenFilters,
						offset: 0, // Reset to first page when filters change
						limit: 50,
						orderBy: undefined,
						orderDirection: undefined,
						tabs: updatedTabs,
					};
				},
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
		// placeholderData: keepPreviousData,
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

	// Fetch table column metadata with hybrid strategy (fast initial + efficient navigation)
	const { columnMetadata, isLoading: isColumnMetadataLoading } =
		useTableColumnMetadata({
			url: activeConnectionUrl,
			schema: search.schema || "",
			table: search.table || "",
		});

	// Row JSON viewer state - stored in URL params
	const rowJsonSheetOpen = search.rowJsonViewerOpen ?? false;
	const primaryKeyColumn = columnMetadata.find((col) => col.primaryKey);

	// Reconstruct row data from URL rowId by looking it up in current table data
	const rowJsonData = useMemo(() => {
		if (!search.rowJsonViewerRowId || !primaryKeyColumn || !rowsQuery.data) {
			return null;
		}
		const rows = rowsQuery.data.rows || [];
		const row = rows.find(
			(r) => String(r[primaryKeyColumn.name]) === search.rowJsonViewerRowId,
		);
		return row || null;
	}, [search.rowJsonViewerRowId, primaryKeyColumn, rowsQuery.data]);

	const setRowJsonData = (data: Record<string, unknown> | null) => {
		const rowId =
			data && primaryKeyColumn
				? String(data[primaryKeyColumn.name])
				: undefined;
		navigate({
			search: (prev) => ({
				...prev,
				rowJsonViewerRowId: rowId,
				rowJsonViewerOpen: !!rowId,
			}),
		});
	};

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

	// Static selection and actions columns (no dependencies)
	const staticColumns: Array<ColumnDef<Record<string, unknown>>> = useMemo(
		() => [
			{
				id: "__select",
				header: (ctx) => {
					const checkboxRef = useRef<HTMLInputElement>(null);
					const isSomeRowsSelected = ctx.table.getIsSomeRowsSelected();
					useEffect(() => {
						if (checkboxRef.current) {
							checkboxRef.current.indeterminate = isSomeRowsSelected;
						}
					}, [isSomeRowsSelected]);
					return (
						<Checkbox
							className="flex items-center gap-2 ml-2"
							checked={ctx.table.getIsAllRowsSelected()}
							onChange={ctx.table.getToggleAllRowsSelectedHandler()}
							aria-label="Select all rows"
						>
							<CheckboxControl />
						</Checkbox>
					);
				},
				cell: (ctx) => (
					<Checkbox
						className="flex items-center gap-2 ml-2"
						checked={ctx.row.getIsSelected()}
						disabled={!ctx.row.getCanSelect()}
						onChange={ctx.row.getToggleSelectedHandler()}
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
			} as ColumnDef<Record<string, unknown>>,
			{
				id: "__actions",
				header: () => null,
				cell: (ctx) => (
					<RowActionsMenu
						row={ctx.row.original}
						onViewJson={() => {
							setRowJsonData(ctx.row.original);
						}}
					/>
				),
				size: 40,
				minSize: 40,
				maxSize: 40,
				enableResizing: false,
				enableSorting: false,
			} as ColumnDef<Record<string, unknown>>,
		],
		[],
	);

	// Stable callbacks for cell actions - extracted to prevent recreation on every render
	const handleFollowFK = useCallback(
		(fkInfo: ForeignKeyInfo, cellValue: unknown) => {
			const newTabState = createTabState(
				fkInfo.referencedSchema,
				fkInfo.referencedTable,
				{
					filters: {
						conditions: [
							{
								column: fkInfo.referencedColumn,
								operator: "equals",
								value: String(cellValue),
							},
						],
						logicalOperator: "and",
					},
					filtersOpened: true,
					fkValue: String(cellValue),
				},
			);
			navigate({
				search: (prev) => ({
					...prev,
					schema: fkInfo.referencedSchema,
					table: fkInfo.referencedTable,
					activeTabId: newTabState.tabId,
					tabs: [...(prev.tabs ?? []), newTabState],
					filters: {
						conditions: [
							{
								column: fkInfo.referencedColumn,
								operator: "equals",
								value: String(cellValue),
							},
						],
						logicalOperator: "and",
					},
					filtersOpened: true,
					offset: 0,
					limit: 50,
					orderBy: undefined,
					orderDirection: undefined,
				}),
			});
		},
		[navigate],
	);

	const handleFindReferences = useCallback(
		(columnName: string, cellValue: unknown) => {
			navigate({
				search: (prev) => ({
					...prev,
					filtersOpened: true,
					filters: {
						conditions: [
							{
								column: columnName,
								operator: "equals",
								value: String(cellValue),
							},
						],
						logicalOperator: "and",
					},
					offset: 0,
				}),
			});
		},
		[navigate],
	);

	const handleNavigateToReference = useCallback(
		(
			ref: { schema: string; table: string; column: string },
			cellValue: unknown,
		) => {
			const newTabState = createTabState(ref.schema, ref.table, {
				filters: {
					conditions: [
						{
							column: ref.column,
							operator: "equals",
							value: String(cellValue),
						},
					],
					logicalOperator: "and",
				},
				filtersOpened: true,
				fkValue: String(cellValue),
			});
			navigate({
				search: (prev) => ({
					...prev,
					schema: ref.schema,
					table: ref.table,
					activeTabId: newTabState.tabId,
					tabs: [...(prev.tabs ?? []), newTabState],
					filters: {
						conditions: [
							{
								column: ref.column,
								operator: "equals",
								value: String(cellValue),
							},
						],
						logicalOperator: "and",
					},
					filtersOpened: true,
					offset: 0,
					limit: 50,
					orderBy: undefined,
					orderDirection: undefined,
				}),
			});
		},
		[navigate],
	);

	// Data columns that depend on columnMetadata and search
	const dataColumns: Array<ColumnDef<Record<string, unknown>>> = useMemo(() => {
		if (!columnMetadata.length) return [];
		return columnMetadata.map(
			(col) =>
				({
					accessorKey: col.name,
					header: () => {
						const sortOrder =
							search.orderBy === col.name
								? (search.orderDirection as "asc" | "desc")
								: false;
						return (
							<ColumnHeaderWithInfo
								columnName={col.name}
								dataType={col.dataType}
								showBadge
								isPrimaryKey={col.primaryKey}
								isUnique={col.unique}
								isForeignKey={col.isForeignKey}
								foreignKey={col.foreignKey}
								sortOrder={sortOrder}
							>
								<PrimaryKeyIcon isPrimaryKey={col.primaryKey} />
								<UniqueConstraintIcon isUnique={col.unique} />
								<ForeignKeyIcon isForeignKey={col.isForeignKey ?? false} />
							</ColumnHeaderWithInfo>
						);
					},
					meta: {
						textAlign: getColumnTextAlignment(col.dataType),
					},
					cell: col.dataType.toLowerCase().includes("json")
						? (ctx) => <JsonCell value={ctx.row.original[col.name]} />
						: (ctx) => (
								<MemoizedDataCell
									ctx={ctx}
									col={col}
									schema={search.schema}
									table={search.table}
									activeConnectionUrl={activeConnectionUrl}
									onFollowFK={handleFollowFK}
									onFindReferences={handleFindReferences}
									onShowQuickReferences={() => {
										navigate({
											search: (prev) => ({
												...prev,
												quickReferencesOpen: true,
												quickReferencesColumnName: col.name,
												quickReferencesCellValue: String(
													ctx.row.original[col.name],
												),
											}),
										});
									}}
									onPrefetchReferences={() => {
										const referenceTarget = col.foreignKey
											? {
													referencedSchema: col.foreignKey.referencedSchema,
													referencedTable: col.foreignKey.referencedTable,
													referencedColumn: col.foreignKey.referencedColumn,
												}
											: {
													referencedSchema: search.schema || "",
													referencedTable: search.table || "",
													referencedColumn: col.name,
												};

										queryClient.prefetchQuery(
											findColumnReferencesWithCountsQueryOptions({
												url: activeConnectionUrl,
												referencedSchema: referenceTarget.referencedSchema,
												referencedTable: referenceTarget.referencedTable,
												referencedColumn: referenceTarget.referencedColumn,
												cellValue: ctx.row.original[col.name],
											}),
										);
									}}
									onNavigateToFK={handleFollowFK}
									onNavigateToReference={handleNavigateToReference}
									onExpandToSheet={() => {
										navigate({
											search: (prev) => ({
												...prev,
												quickReferencesOpen: true,
												quickReferencesColumnName: col.name,
												quickReferencesCellValue: String(
													ctx.row.original[col.name],
												),
											}),
										});
									}}
									onMenuOpen={() => {
										const cellValue = ctx.row.original[col.name];

										const referenceTarget = col.foreignKey
											? {
													referencedSchema: col.foreignKey.referencedSchema,
													referencedTable: col.foreignKey.referencedTable,
													referencedColumn: col.foreignKey.referencedColumn,
												}
											: {
													referencedSchema: search.schema || "",
													referencedTable: search.table || "",
													referencedColumn: col.name,
												};

										queryClient.prefetchQuery(
											findColumnReferencesWithCountsQueryOptions({
												url: activeConnectionUrl,
												referencedSchema: referenceTarget.referencedSchema,
												referencedTable: referenceTarget.referencedTable,
												referencedColumn: referenceTarget.referencedColumn,
												cellValue,
											}),
										);
									}}
								/>
							),
					enableResizing: true,
					enableSorting: true,
				}) as ColumnDef<any> as any,
		);
	}, [
		columnMetadata,
		search.schema,
		search.table,
		search.orderBy,
		search.orderDirection,
		activeConnectionUrl,
		handleFollowFK,
		handleFindReferences,
		handleNavigateToReference,
		navigate,
		queryClient,
	]);

	// Combine static and data columns
	const rowsColumns = useMemo(
		() =>
			dataColumns.length
				? [...staticColumns, ...dataColumns]
				: // For skeletons
					[
						...staticColumns,
						...(Array.from(
							{ length: 10 },
							(_, i) => ({ id: `__skeleton-${i}` }) as ColumnDef<any>,
						) as typeof staticColumns),
					],
		[staticColumns, dataColumns],
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

	// Manage row selection state
	const [rowSelection, setRowSelection] = useState({});

	let defaultColumnSize = columnMetadata.some((col) =>
		col.dataType.includes("uuid"),
	)
		? 280
		: 180;
	if (search.tableSize === "excel") {
		defaultColumnSize -= 50;
	} else if (search.tableSize === "compact") {
		defaultColumnSize += 20;
	} else if (search.tableSize === "cozy") {
		defaultColumnSize += 30;
	} else if (search.tableSize === "comfortable") {
		defaultColumnSize += 60;
	}
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
			rowSelection,
		},
		manualPagination: true,
		manualSorting: true,
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		rowCount: totalRowCount,
		defaultColumn: {
			size: defaultColumnSize,
			minSize: 100,
			maxSize: 1000,
		},
		onSortingChange: (updater) => {
			const newSorting =
				typeof updater === "function" ? updater(sortingState) : updater;
			const firstSort = newSorting[0];
			navigate({
				search: (prev) => {
					// Update the currently active tab with the same sorting updates
					const updatedTabs = (prev.tabs ?? []).map((tab) => {
						if (tab.tabId === prev.activeTabId) {
							return {
								...tab,
								orderBy: firstSort?.id || undefined,
								orderDirection: (firstSort?.desc ? "desc" : "asc") as
									| "asc"
									| "desc",
								offset: 0,
							};
						}
						return tab;
					});

					return {
						...prev,
						orderBy: firstSort?.id || undefined,
						orderDirection: (firstSort?.desc ? "desc" : "asc") as
							| "asc"
							| "desc",
						offset: 0,
						tabs: updatedTabs,
					};
				},
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
				search: (prev) => {
					// Update the currently active tab with the same pagination updates
					const updatedTabs = (prev.tabs ?? []).map((tab) => {
						if (tab.tabId === prev.activeTabId) {
							return {
								...tab,
								offset: newPagination.pageIndex * newPagination.pageSize,
								limit: newPagination.pageSize,
							};
						}
						return tab;
					});

					return {
						...prev,
						offset: newPagination.pageIndex * newPagination.pageSize,
						limit: newPagination.pageSize,
						tabs: updatedTabs,
					};
				},
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
				search: (prev) => {
					// Update the currently active tab with the same visibility updates
					const updatedTabs = (prev.tabs ?? []).map((tab) => {
						if (tab.tabId === prev.activeTabId) {
							return {
								...tab,
								hiddenColumnList:
									hiddenCols.length > 0 ? hiddenCols : undefined,
							};
						}
						return tab;
					});

					return {
						...prev,
						hiddenColumnList: hiddenCols.length > 0 ? hiddenCols : undefined,
						tabs: updatedTabs,
					};
				},
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

			{/* Main Layout */}
			<div className="flex-1 flex h-full min-h-0">
				{/* Collapsible Sidebar */}
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
																	search.table === table.name
																		? "bg-primary/10 text-primary font-medium"
																		: "text-muted-foreground hover:bg-muted hover:text-foreground data-highlighted:bg-muted"
																}`}
																title={table.name}
																onMouseEnter={() => {
																	const schema = search.schema || "public";
																	prefetchTableData(schema, table.name);
																}}
																onClick={() => {
																	const schema = search.schema || "public";
																	setTable(table.name);
																	const tabState = createTabState(
																		schema,
																		table.name,
																	);
																	navigate({
																		search: (prev) => {
																			// Check if a tab with this tabId already exists
																			const existingTab = (
																				prev.tabs ?? []
																			).find((t) => t.tabId === tabState.tabId);

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

				{/* Content Area */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{/* Table Tabs - Always visible when there are tabs */}
					<TableTabsBar
						tabs={tabs}
						activeTabId={activeTabId}
						onTabHover={(tab) => {
							if (tab.schema && tab.table) {
								prefetchTableData(tab.schema, tab.table);
								prefetchTableColumns(tab.schema);
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

					{search.table && search.schema ? (
						<>
							{/* View Toggle & Filter Controls */}
							<div className="relative border-b bg-muted/50">
								{(rowsQuery.isLoading || isColumnMetadataLoading) && (
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
												variant={
													search.viewMode === "rows" ? "default" : "outline"
												}
												size="sm"
												onClick={() =>
													navigate({
														search: (prev) => {
															// Update the currently active tab with the same viewMode
															const updatedTabs = (prev.tabs ?? []).map(
																(tab) => {
																	if (tab.tabId === prev.activeTabId) {
																		return {
																			...tab,
																			viewMode: "rows" as const,
																		};
																	}
																	return tab;
																},
															);

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
												variant={
													search.viewMode === "structure"
														? "default"
														: "outline"
												}
												size="sm"
												onClick={() =>
													navigate({
														search: (prev) => {
															// Update the currently active tab with the same viewMode
															const updatedTabs = (prev.tabs ?? []).map(
																(tab) => {
																	if (tab.tabId === prev.activeTabId) {
																		return {
																			...tab,
																			viewMode: "structure" as const,
																		};
																	}
																	return tab;
																},
															);

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
										{search.viewMode === "rows" && (
											<Button
												variant={
													filterConditions.length > 0 && !search.filtersOpened
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
																const updatedTabs = (prev.tabs ?? []).map(
																	(tab) => {
																		if (tab.tabId === prev.activeTabId) {
																			return {
																				...tab,
																				filtersOpened: !prev.filtersOpened,
																			};
																		}
																		return tab;
																	},
																);

																return {
																	...prev,
																	filtersOpened: !prev.filtersOpened,
																	tabs: updatedTabs,
																};
															},
														});
													}
												}}
												disabled={isColumnMetadataLoading}
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
									<div className="flex-1 overflow-auto flex flex-col h-full px-2">
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
												<div className="flex-1 overflow-auto flex flex-col h-full relative">
													<DataTable
														table={rowsDataTable}
														containerRef={tableContainerRef}
														isLoading={
															rowsQuery.isLoading || isColumnMetadataLoading
														}
														size={search.tableSize}
														withContextMenu
														onExpandRowJson={(row) => {
															setRowJsonData(row);
														}}
													/>
													{!rowsQuery.isLoading && !isColumnMetadataLoading && (
														<ScrollToColumnButton
															columnList={columnMetadata.map((col) => col.name)}
															containerRef={tableContainerRef}
														/>
													)}
												</div>
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
																search: (prev) => {
																	// Update the currently active tab with the same offset
																	const updatedTabs = (prev.tabs ?? []).map(
																		(tab) => {
																			if (tab.tabId === prev.activeTabId) {
																				return {
																					...tab,
																					offset:
																						(details.page - 1) * search.limit,
																				};
																			}
																			return tab;
																		},
																	);

																	return {
																		...prev,
																		offset: (details.page - 1) * search.limit,
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
																		<Button
																			variant="ghost"
																			size="sm"
																			className="h-6 px-1"
																		>
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
																	search: (prev) => {
																		// Update the currently active tab with the same limit updates
																		const updatedTabs = (prev.tabs ?? []).map(
																			(tab) => {
																				if (tab.tabId === prev.activeTabId) {
																					return {
																						...tab,
																						limit: newLimit,
																						offset: 0,
																					};
																				}
																				return tab;
																			},
																		);

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
															value={[search.tableSize]}
															collection={TableSizeCollection}
															positioning={{ sameWidth: true }}
															onValueChange={(details: {
																value?: string[];
															}) => {
																const newSize = (details.value?.[0] ||
																	"cozy") as "compact" | "cozy" | "comfortable";
																navigate({
																	search: (prev) => {
																		// Update the currently active tab with the same tableSize
																		const updatedTabs = (prev.tabs ?? []).map(
																			(tab) => {
																				if (tab.tabId === prev.activeTabId) {
																					return {
																						...tab,
																						tableSize: newSize,
																					};
																				}
																				return tab;
																			},
																		);

																		return {
																			...prev,
																			tableSize: newSize,
																			tabs: updatedTabs,
																		};
																	},
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
																{TableSizeCollection.items.map((item) => (
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

			{/* Quick References Panel */}
			{search.quickReferencesOpen && (
				<Sheet
					open={true}
					onOpenChange={(details) => {
						if (!details.open) {
							navigate({
								search: (prev) => ({
									...prev,
									quickReferencesOpen: false,
									quickReferencesColumnName: undefined,
									quickReferencesCellValue: undefined,
								}),
							});
						}
					}}
				>
					<SheetContent className="z-50 w-full sm:max-w-[500px] p-0 flex flex-col">
						{search.quickReferencesColumnName &&
						search.quickReferencesCellValue &&
						search.schema &&
						search.table &&
						columnMetadata.length > 0 ? (
							(() => {
								const column = columnMetadata.find(
									(c) => c.name === search.quickReferencesColumnName,
								);
								return column ? (
									<QuickReferencesPanel
										key={`${search.schema}.${search.table}.${search.quickReferencesColumnName}.${search.quickReferencesCellValue}`}
										schema={search.schema}
										table={search.table}
										column={column}
										cellValue={search.quickReferencesCellValue}
										connectionUrl={activeConnectionUrl}
										onNavigate={(schema, table, column, value) => {
											const newTabState = createTabState(schema, table, {
												filters: {
													conditions: [
														{
															column,
															operator: "equals",
															value: String(value),
														},
													],
													logicalOperator: "and",
												},
												filtersOpened: true,
												fkValue: String(value),
											});
											navigate({
												search: (prev) => ({
													...prev,
													schema,
													table,
													activeTabId: newTabState.tabId,
													tabs: [...(prev.tabs ?? []), newTabState],
													filters: {
														conditions: [
															{
																column,
																operator: "equals",
																value: String(value),
															},
														],
														logicalOperator: "and",
													},
													filtersOpened: true,
													offset: 0,
													limit: 50,
													orderBy: undefined,
													orderDirection: undefined,
													quickReferencesOpen: false,
													quickReferencesColumnName: undefined,
													quickReferencesCellValue: undefined,
												}),
											});
										}}
									/>
								) : null;
							})()
						) : (
							<div className="w-full h-full flex flex-col">
								{/* Skeleton Header */}
								<div className="bg-linear-to-b from-background to-background/95 px-4 py-3 border-b shrink-0">
									<div className="flex items-start justify-between gap-3 mb-2">
										<div className="flex-1 min-w-0 space-y-2">
											<div className="h-3 w-24 bg-muted/60 rounded animate-pulse" />
											<div className="h-4 w-40 bg-muted/60 rounded animate-pulse" />
											<div className="h-3 w-32 bg-muted/60 rounded animate-pulse mt-2" />
										</div>
									</div>
									<div className="h-3 w-28 bg-muted/60 rounded animate-pulse" />
								</div>
								{/* Skeleton Content */}
								<div className="overflow-y-auto flex-1 p-4 space-y-4">
									{/* Skeleton Button */}
									<div className="h-10 bg-muted/60 rounded animate-pulse" />
									{/* Skeleton List Items */}
									<div className="space-y-2">
										{[1, 2, 3].map((i) => (
											<div
												key={i}
												className="h-8 bg-muted/60 rounded animate-pulse"
											/>
										))}
									</div>
								</div>
							</div>
						)}
					</SheetContent>
				</Sheet>
			)}

			{/* Row JSON Viewer Sheet (expanded) */}
			{rowJsonSheetOpen && (
				<Sheet
					open={true}
					onOpenChange={(details) => {
						if (!details.open) {
							setRowJsonData(null);
						}
					}}
				>
					<SheetContent className="z-50 w-full sm:max-w-[800px] p-0 flex flex-col">
						<SheetHeader>
							<SheetTitle>Row Data</SheetTitle>
							<SheetDescription>Expanded JSON viewer</SheetDescription>
						</SheetHeader>
						<div className="p-4 flex-1 overflow-auto">
							{rowJsonData ? (
								<JsonViewerModal data={rowJsonData} className="h-full" />
							) : !search.rowJsonViewerRowId ? (
								<div className="text-sm text-muted-foreground">No data</div>
							) : (
								// Loading skeleton
								<div className="w-full h-full flex flex-col gap-3">
									{/* Header skeleton */}
									<div className="space-y-2">
										<div className="h-4 w-32 bg-muted/60 rounded animate-pulse" />
										<div className="h-3 w-48 bg-muted/60 rounded animate-pulse" />
									</div>
									{/* Content skeleton - nested object structure */}
									<div className="space-y-3">
										{[1, 2, 3, 4, 5].map((i) => (
											<div
												key={i}
												className="space-y-2 pl-4 border-l border-muted/40"
											>
												<div className="h-3 w-24 bg-muted/60 rounded animate-pulse" />
												<div className="h-3 w-40 bg-muted/60 rounded animate-pulse" />
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</SheetContent>
				</Sheet>
			)}
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
	tableSize: "excel" | "minimal" | "compact" | "cozy" | "comfortable";
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
