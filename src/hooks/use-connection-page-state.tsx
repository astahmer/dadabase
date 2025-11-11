import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccessorKeyColumnDef, ColumnDef } from "@tanstack/react-table";
import { useQueryBuilder } from "#src/hooks/use-query-builder";
import { useTableColumnMetadata } from "#src/hooks/use-table-column-metadata";
import { getColumnTextAlignment } from "#src/lib/data-type-utils";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { findColumnReferencesWithCountsQueryOptions } from "#src/server/pg/start-fns/find-column-references.start.ts";
import { useRef, useEffect } from "react";
import type { ForeignKeyInfo } from "#src/components/cell-context-menu.tsx";
import { MemoizedDataCell } from "#src/components/memoized-data-cell.tsx";
import { ColumnHeaderWithInfo } from "#src/components/ui/column-header-with-info.tsx";
import { ForeignKeyIcon } from "#src/components/ui/foreign-key-icon.tsx";
import { JsonCell } from "#src/components/ui/json-cell.tsx";
import { PrimaryKeyIcon } from "#src/components/ui/primary-key-icon.tsx";
import { RowActionsMenu } from "#src/components/ui/row-actions-menu.tsx";
import { UniqueConstraintIcon } from "#src/components/ui/unique-constraint-icon.tsx";
import { useDataTable } from "#src/components/use-data-table.ts";
import { Checkbox, CheckboxControl } from "#src/components/ui/checkbox.tsx";

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

interface UseConnectionPageStateProps {
	connection: {
		url: string;
	};
}

export const useConnectionPageState = ({
	connection,
}: UseConnectionPageStateProps) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const search = useSearch({
		from: "/connections/$connectionName",
		select: (s) => ({
			dbName: s.dbName,
			schema: s.schema,
			table: s.table,
			filters: s.filters,
			filtersOpened: s.filtersOpened,
			limit: s.limit,
			offset: s.offset,
			orderBy: s.orderBy,
			orderDirection: s.orderDirection,
			hiddenColumnList: s.hiddenColumnList,
			tableSize: s.tableSize,
		}),
	});
	const queryClient = useQueryClient();
	const tableContainerRef = useRef<HTMLDivElement>(null);

	const connectionUrl = connection.url || "";
	const activeConnectionUrl = search.dbName
		? replaceDatabaseInConnectionUrl(connectionUrl, search.dbName)
		: connectionUrl;

	// Query builder setup
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
						offset: 0,
						limit: 50,
						orderBy: undefined,
						orderDirection: undefined,
						tabs: updatedTabs,
					};
				},
			});
		},
	);

	// Fetch rows data
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
		enabled: !!search.schema && !!search.table,
	});

	// Fetch column metadata
	const {
		columnMetadata,
		columnList,
		isLoading: isColumnMetadataLoading,
	} = useTableColumnMetadata({
		url: activeConnectionUrl,
		schema: search.schema || "",
		table: search.table || "",
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

	// Data columns
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

	// Combine columns
	const rowsColumns = useMemo(
		() =>
			dataColumns.length
				? [...staticColumns, ...dataColumns]
				: [
						...staticColumns,
						...(Array.from(
							{ length: 10 },
							(_, i) => ({ id: `__skeleton-${i}` }) as ColumnDef<any>,
						) as typeof staticColumns),
					],
		[staticColumns, dataColumns],
	);

	// Sorting state
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

	// Column visibility state
	const columnVisibilityState = useMemo(() => {
		const visibility: Record<string, boolean> = {};

		rowsColumns.forEach((col) => {
			visibility[
				col.id || ((col as AccessorKeyColumnDef<any>).accessorKey as string)
			] = true;
		});

		if (search.hiddenColumnList?.length) {
			search.hiddenColumnList.forEach((col) => {
				visibility[col.trim()] = false;
			});
		}

		return visibility;
	}, [search.hiddenColumnList, rowsColumns]);

	// Row selection
	const [rowSelection, setRowSelection] = useState({});

	// Default column size calculation
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

	// Data table setup
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
	});

	return {
		tableContainerRef,
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
	};
};
