import type { ForeignKeyInfo } from "#src/components/cell-context-menu.tsx";
import { MemoizedDataCell } from "#src/components/memoized-data-cell.tsx";
import { createTabState } from "#src/components/pages/connection-page/create-tab-state.ts";
import { Checkbox, CheckboxControl } from "#src/components/ui/checkbox.tsx";
import { ColumnHeaderWithInfo } from "#src/components/ui/column-header-with-info.tsx";
import { ForeignKeyIcon } from "#src/components/ui/foreign-key-icon.tsx";
import { JsonCell } from "#src/components/ui/json-cell.tsx";
import { PrimaryKeyIcon } from "#src/components/ui/primary-key-icon.tsx";
import { RowActionsMenu } from "#src/components/ui/row-actions-menu.tsx";
import { UniqueConstraintIcon } from "#src/components/ui/unique-constraint-icon.tsx";
import { useDataTable } from "#src/components/use-data-table.ts";
import { useQueryBuilder } from "#src/hooks/use-query-builder";
import { useTableColumnMetadata } from "#src/hooks/use-table-column-metadata";
import { getColumnTextAlignment } from "#src/lib/data-type-utils";
import { getDefaultColumnSize } from "#src/lib/get-default-column-size.ts";
import { findColumnReferencesWithCountsQueryOptions } from "#src/server/pg/start-fns/find-column-references.start.ts";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type {
	AccessorKeyColumnDef,
	ColumnDef,
	ColumnPinningState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

interface UseConnectionPageStateProps {
	connection: {
		url: string;
	};
}

export const useConnectionPageState = ({
	connection,
}: UseConnectionPageStateProps) => {
	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const search = useSearch({
		from: "/connections/$connectionName",
		select: (s) => ({
			dbName: s.dbName,
			tableSize: s.tableSize,
			activeTabId: s.activeTabId,
			tabs: s.tabs ?? [],
		}),
	});

	// Get the active tab from the tabs array
	const activeTab = search.tabs.find((tab) => tab.tabId === search.activeTabId);

	// Extract state from active tab with fallbacks
	const schema = activeTab?.schema || "";
	const table = activeTab?.table || "";
	const filters = activeTab?.filters ?? {
		conditions: [],
		logicalOperator: "and",
	};
	const filtersOpened = activeTab?.filtersOpened ?? false;
	const limit = activeTab?.limit ?? 50;
	const offset = activeTab?.offset ?? 0;
	const orderBy = activeTab?.orderBy;
	const orderDirection = activeTab?.orderDirection ?? "asc";
	const hiddenColumnList = activeTab?.hiddenColumnList;
	const tableSize = activeTab?.tableSize ?? "cozy";
	const columnPinning = activeTab?.columnPinning;
	const columnOrder = activeTab?.columnOrder;

	const connectionUrl = connection.url || "";
	const activeConnectionUrl = search.dbName
		? replaceDatabaseInConnectionUrl(connectionUrl, search.dbName)
		: connectionUrl;

	// Query builder setup
	const queryBuilder = useQueryBuilder(filters, (updatedFilter) => {
		let shouldOpenFilters = filtersOpened;
		if (!filters?.conditions?.length && updatedFilter.conditions.length) {
			shouldOpenFilters = true;
		}

		navigate({
			search: (prev) => {
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
					tabs: updatedTabs,
				};
			},
		});
	});

	// Fetch rows data
	const rowsQuery = useQuery({
		...queryTableDataQueryOptions({
			url: activeConnectionUrl,
			schema: schema,
			table: table,
			limit: limit,
			offset: offset,
			orderBy: orderBy,
			orderDirection: orderDirection,
			filters: queryBuilder.getWhereClause() ?? {
				conditions: [],
				logicalOperator: "and",
			},
		}),
		enabled: !!schema && !!table,
	});

	// Fetch column metadata
	const {
		columnMetadata,
		columnList,
		isLoading: isColumnMetadataLoading,
	} = useTableColumnMetadata({
		url: activeConnectionUrl,
		schema: schema,
		table: table,
	});

	// Format row data
	const queryResponse = rowsQuery.data || {
		rows: [],
		rowCount: 0,
		timeTaken: 0,
		ranAt: 0,
	};
	const rowsList = queryResponse.rows;
	const totalRowCount = queryResponse.rowCount;

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

	// Static columns
	const staticColumns: Array<ColumnDef<Record<string, unknown>>> = useMemo(
		() => [
			{
				id: "__select",
				meta: { enableColumnOrdering: false },
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
				enablePinning: false,
			} as ColumnDef<Record<string, unknown>>,
			{
				id: "__actions",
				meta: { enableColumnOrdering: false },
				header: () => null,
				cell: (ctx) => (
					<RowActionsMenu
						row={ctx.row.original}
						onViewJson={() => {
							const primaryKeyColumn = columnMetadata.find(
								(col) => col.primaryKey,
							);
							const rowId = primaryKeyColumn
								? String(ctx.row.original[primaryKeyColumn.name])
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
				),
				size: 40,
				minSize: 40,
				maxSize: 40,
				enableResizing: false,
				enableSorting: false,
				enablePinning: false,
			} as ColumnDef<Record<string, unknown>>,
		],
		[columnMetadata, navigate],
	);

	// Navigation callbacks
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
					tableSize: search.tableSize,
				},
			);
			navigate({
				search: (prev) => ({
					...prev,
					activeTabId: newTabState.tabId,
					tabs: [...(prev.tabs ?? []), newTabState],
				}),
			});
		},
		[navigate],
	);

	const handleFindReferences = useCallback(
		(columnName: string, cellValue: unknown) => {
			navigate({
				search: (prev) => {
					const updatedTabs = (prev.tabs ?? []).map((tab) => {
						if (tab.tabId === prev.activeTabId) {
							return {
								...tab,
								filtersOpened: true,
								filters: {
									conditions: [
										{
											column: columnName,
											operator: "equals" as const,
											value: String(cellValue),
										},
									],
									logicalOperator: "and" as const,
								},
								offset: 0,
							};
						}
						return tab;
					});

					return {
						...prev,
						tabs: updatedTabs,
					};
				},
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
				tableSize: search.tableSize,
			});
			navigate({
				search: (prev) => ({
					...prev,
					activeTabId: newTabState.tabId,
					tabs: [...(prev.tabs ?? []), newTabState],
				}),
			});
		},
		[navigate],
	);

	// Data columns
	const dataColumns: Array<ColumnDef<Record<string, unknown>>> = useMemo(() => {
		if (!columnMetadata.length) return [];
		return columnMetadata.map(
			(col) =>
				({
					accessorKey: col.name,
					header: () => {
						const sortOrder =
							orderBy === col.name ? (orderDirection as "asc" | "desc") : false;
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
						: (ctx) => {
								return (
									<MemoizedDataCell
										ctx={ctx}
										col={col}
										schema={schema}
										table={table}
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
														referencedSchema: schema,
														referencedTable: table,
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
														referencedSchema: schema,
														referencedTable: table,
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
								);
							},
					enableResizing: true,
					enableSorting: true,
				}) as ColumnDef<any> as any,
		);
	}, [
		columnMetadata,
		activeConnectionUrl,
		handleFollowFK,
		handleFindReferences,
		handleNavigateToReference,
		navigate,
		queryClient,
		schema,
		table,
		orderBy,
		orderDirection,
	]);

	// Combine columns
	const rowsColumns = useMemo(
		() =>
			dataColumns.length
				? [...staticColumns, ...dataColumns]
				: [
						...staticColumns,
						...(Array.from(
							{ length: 10 },
							(_, i) =>
								({
									id: `__skeleton-${i}`,
									cell: () => (
										<div className="h-3 bg-muted rounded animate-pulse" />
									),
								}) as ColumnDef<any>,
						) as typeof staticColumns),
					],
		[staticColumns, dataColumns],
	);

	// Sorting state
	const sortingState = useMemo(
		() =>
			orderBy
				? [
						{
							id: orderBy,
							desc: orderDirection === "desc",
						},
					]
				: [],
		[orderBy, orderDirection],
	);

	// Column visibility state
	const columnVisibilityState = useMemo(() => {
		const visibility: Record<string, boolean> = {};

		rowsColumns.forEach((col) => {
			visibility[
				col.id || ((col as AccessorKeyColumnDef<any>).accessorKey as string)
			] = true;
		});

		if (hiddenColumnList?.length) {
			hiddenColumnList.forEach((col: string) => {
				visibility[col.trim()] = false;
			});
		}

		return visibility;
	}, [hiddenColumnList, rowsColumns]);

	// Row selection
	const [rowSelection, setRowSelection] = useState({});

	// Column pinning state
	const columnPinningState: ColumnPinningState = useMemo(() => {
		const state = {
			left: Array.from(columnPinning?.left ?? []) as string[],
			right: Array.from(columnPinning?.right ?? []) as string[],
		};

		// Add __select column if it doesn't exist
		if (!state.left.some((col) => col === "__select")) {
			state.left.unshift(
				// ...(staticColumns.map((col) => col.id).filter(Boolean) as string[]),
				"__select",
			);
		}
		return state;
	}, [columnPinning, staticColumns]);

	// Column order state
	const columnOrderState = useMemo(() => {
		const fromTab = Array.from(columnOrder ?? []);
		if (fromTab.length) {
			return fromTab;
		}

		return staticColumns
			.map((col) => col.id)
			.concat(columnList)
			.filter(Boolean) as string[];
	}, [columnOrder, staticColumns, columnList]);

	const hasUuid = columnMetadata.some((col) => col.dataType.includes("uuid"));
	const defaultColumnSize = getDefaultColumnSize({
		tableSize: tableSize,
		hasUuid,
	});

	// Data table setup
	const rowsDataTable = useDataTable({
		data: formattedTableRowsData,
		columns: rowsColumns,
		state: {
			pagination: {
				pageIndex: Math.floor(offset / limit),
				pageSize: limit,
			},
			sorting: sortingState,
			columnVisibility: columnVisibilityState,
			rowSelection,
			columnPinning: columnPinningState,
			columnOrder: columnOrderState,
		},
		manualPagination: true,
		manualSorting: true,
		enableRowSelection: true,
		enableColumnPinning: true,
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
						tabs: updatedTabs,
					};
				},
			});
		},
		onPaginationChange: (updater) => {
			const current = {
				pageIndex: Math.floor(offset / limit),
				pageSize: limit,
			};
			const newPagination =
				typeof updater === "function" ? updater(current) : updater;
			navigate({
				search: (prev) => {
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
			const hiddenCols = Object.keys(newVisibility)
				.filter((key) => !newVisibility[key])
				.sort();
			navigate({
				search: (prev) => {
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
		onColumnPinningChange: (updater) => {
			const newPinning =
				typeof updater === "function" ? updater(columnPinningState) : updater;
			navigate({
				search: (prev) => {
					const updatedTabs = (prev.tabs ?? []).map((tab) => {
						if (tab.tabId === prev.activeTabId) {
							return {
								...tab,
								columnPinning: newPinning,
							};
						}
						return tab;
					});

					return {
						...prev,
						columnPinning: newPinning,
						tabs: updatedTabs,
					};
				},
			});
		},
		onColumnOrderChange: (updater) => {
			const newOrder =
				typeof updater === "function" ? updater(columnOrderState) : updater;
			navigate({
				search: (prev) => {
					const updatedTabs = (prev.tabs ?? []).map((tab) => {
						if (tab.tabId === prev.activeTabId) {
							return {
								...tab,
								columnOrder: newOrder,
							};
						}
						return tab;
					});

					return {
						...prev,
						columnOrder: newOrder,
						tabs: updatedTabs,
					};
				},
			});
		},
	});

	return {
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
	};
};
