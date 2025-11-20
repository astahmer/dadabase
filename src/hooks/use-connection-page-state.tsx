import type { DataTableRowSubrow } from "#src/components/data-table.row.tsx";
import { formatTableValue } from "#src/components/pages/connection-page/format-table-value.ts";
import { RelationshipSubrowTable } from "#src/components/relationship-subrow-table.tsx";
import { Button } from "#src/components/ui/button.tsx";
import { Checkbox, CheckboxControl } from "#src/components/ui/checkbox.tsx";
import { Tooltip } from "#src/components/ui/tooltip.tsx";
import { useDataTable } from "#src/components/use-data-table.ts";
import { useQueryBuilder } from "#src/hooks/use-query-builder";
import { useRowsColumns } from "#src/hooks/use-rows-columns.tsx";
import { useTableColumnMetadata } from "#src/hooks/use-table-column-metadata";
import { useTableRelationships } from "#src/hooks/use-table-relationships";
import { getDefaultColumnSize } from "#src/lib/get-default-column-size.ts";
import { replaceDatabaseInConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type {
	AccessorKeyColumnDef,
	ColumnDef,
	ColumnPinningState,
	Row,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { useRowsColumnsAction } from "./use-rows-columns.actions.ts";
import { RowContextMenu } from "#src/components/row-context-menu.tsx";

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
			columnPinning: s.columnPinning,
			columnOrder: s.columnOrder,
		}),
	});

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
	const tableMetadata = useTableColumnMetadata({
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

	const [relationshipRowId, setRelationshipRowId] = useState<string | null>(
		null,
	);

	// Static columns
	const staticColumns: Array<ColumnDef<Record<string, unknown>>> = useMemo(
		() => [
			{
				id: "__select",
				meta: { enableColumnOrdering: false },
				header: (ctx) => {
					const isSomeRowsSelected = ctx.table.getIsSomeRowsSelected();
					const isAllSelected = ctx.table.getIsAllRowsSelected();
					const hasAnySelection = isSomeRowsSelected || isAllSelected;

					return (
						<div className="flex items-center justify-center h-full w-full text-center">
							{hasAnySelection ? (
								<Checkbox
									className="flex items-center gap-2"
									checked={
										isAllSelected
											? true
											: isSomeRowsSelected
												? "indeterminate"
												: false
									}
									onChange={ctx.table.getToggleAllRowsSelectedHandler()}
									aria-label="Select all rows"
									title="Select all rows"
								>
									<CheckboxControl />
								</Checkbox>
							) : (
								<Tooltip
									content="Click to select all rows"
									colorPalette="inverted"
									positioning={{ placement: "right", strategy: "fixed" }}
								>
									<Button
										size="xs"
										className="w-full text-xs text-center"
										variant="ghost"
									>
										#
									</Button>
								</Tooltip>
							)}
						</div>
					);
				},
				cell: (ctx) => {
					const isSelected = ctx.row.getIsSelected();
					const isSomeRowsSelected = ctx.table.getIsSomeRowsSelected();
					const isAllSelected = ctx.table.getIsAllRowsSelected();
					const hasAnySelection = isSomeRowsSelected || isAllSelected;

					const rowIndex = ctx.row.index;
					const pageIndex = Math.floor(search.offset / search.limit);
					const pageSize = search.limit;
					const displayedNumber = pageIndex * pageSize + rowIndex + 1;

					if (hasAnySelection) {
						return (
							<Tooltip
								content={`#${displayedNumber}`}
								colorPalette="inverted"
								portalled={false}
								positioning={{ placement: "right", strategy: "fixed" }}
							>
								<div>
									<Checkbox
										className="flex items-center gap-2 justify-self-center"
										checked={isSelected}
										disabled={!ctx.row.getCanSelect()}
										onChange={ctx.row.getToggleSelectedHandler()}
										aria-label={`Select row ${displayedNumber}`}
									>
										<CheckboxControl />
									</Checkbox>
								</div>
							</Tooltip>
						);
					}

					return (
						<Tooltip
							content="Click to select row, right click to open context menu"
							colorPalette="inverted"
							positioning={{ placement: "right", strategy: "fixed" }}
						>
							<RowContextMenu
								row={ctx.row.original as Record<string, unknown>}
								onExpandRelationships={() => setRelationshipRowId(ctx.row.id)}
								onExpandRowJson={(row) => {
									const primaryKeyColumn = tableMetadata.columnMetadata.find(
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
							>
								<Button
									size="xs"
									className="w-full text-xs text-center"
									variant="ghost"
									onClick={ctx.row.getToggleSelectedHandler()}
								>
									{displayedNumber}
								</Button>
							</RowContextMenu>
						</Tooltip>
					);
				},
				size: 50,
				minSize: 50,
				maxSize: 50,
				enableResizing: false,
				enableSorting: false,
				enablePinning: false,
			} as ColumnDef<Record<string, unknown>>,
			// {
			// 	id: "__actions",
			// 	meta: { enableColumnOrdering: false },
			// 	header: () => null,
			// 	cell: (ctx) => (
			// 		<RowActionsMenu
			// 			row={ctx.row.original}
			// 			onViewJson={() => {
			// 				const primaryKeyColumn = columnMetadata.find(
			// 					(col) => col.primaryKey,
			// 				);
			// 				const rowId = primaryKeyColumn
			// 					? String(ctx.row.original[primaryKeyColumn.name])
			// 					: undefined;
			// 				navigate({
			// 					search: (prev) => ({
			// 						...prev,
			// 						rowJsonViewerRowId: rowId,
			// 						rowJsonViewerOpen: !!rowId,
			// 					}),
			// 				});
			// 			}}
			// 			onExpandRelationships={() => setRelationshipRowId(ctx.row.id)}
			// 		/>
			// 	),
			// 	size: 40,
			// 	minSize: 40,
			// 	maxSize: 40,
			// 	enableResizing: false,
			// 	enableSorting: false,
			// 	enablePinning: false,
			// } as ColumnDef<Record<string, unknown>>,
		],
		[tableMetadata.columnMetadata, navigate, search.offset, search.limit],
	);

	const rowActions = useRowsColumnsAction({
		columnMetadata: tableMetadata.columnMetadata,
		selectedSchema: search.schema || "",
		selectedTable: search.table || "",
		activeConnectionUrl,
	});
	const dataColumns = useRowsColumns({
		columnMetadata: tableMetadata.columnMetadata,
		schema: search.schema || "",
		table: search.table || "",
		activeConnectionUrl,
		enableSorting: true,
		onFollowFK: rowActions.onFollowFK,
		onFindReferences: rowActions.onFindReferences,
		onShowQuickReferences: rowActions.onShowQuickReferences,
		onPrefetchReferences: rowActions.onPrefetchReferences,
		onNavigateToFK: rowActions.onNavigateToFK,
		onNavigateToReference: rowActions.onNavigateToReference,
		onExpandToSheet: rowActions.onExpandToSheet,
		onMenuOpen: rowActions.onMenuOpen,
	});

	// Relationship integration
	const relationshipsQuery = useTableRelationships({
		url: activeConnectionUrl,
		schema: search.schema || "",
		table: search.table || "",
	});

	const relationships = useMemo(
		() => [
			...relationshipsQuery.incomingReferences,
			...relationshipsQuery.outgoingForeignKeys,
		],
		[
			relationshipsQuery.incomingReferences,
			relationshipsQuery.outgoingForeignKeys,
		],
	);

	const renderSubrows = useCallback(
		(row: Row<Record<string, unknown>>): DataTableRowSubrow[] => {
			// Only render if we have an expanded relationship row set
			if (relationshipRowId !== row.id) {
				return [];
			}

			return relationships.map((rel) => ({
				id: `rel_${rel.constraintName}`,
				content: (
					<RelationshipSubrowTable
						relationship={rel}
						parentRowValue={row.original[rel.referencedColumn] as string}
						connection={{ url: activeConnectionUrl }}
					/>
				),
			}));
		},
		[relationships, relationshipRowId, activeConnectionUrl],
	);

	// Combine columns
	const rowsColumns = useMemo(() => {
		return dataColumns.length
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
				];
	}, [staticColumns, dataColumns]);

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

	// Column pinning state
	const columnPinningState: ColumnPinningState = useMemo(() => {
		const state = {
			left: Array.from(search.columnPinning?.left ?? []),
			right: Array.from(search.columnPinning?.right ?? []),
		};

		// Add __select column if it doesn't exist
		if (!state.left.some((col) => col === "__select")) {
			state.left.unshift(
				// ...(staticColumns.map((col) => col.id).filter(Boolean) as string[]),
				"__rowIndex",
				"__select",
			);
		}
		return state;
	}, [search.columnPinning]);

	// Column order state
	const columnOrderState = useMemo(() => {
		const fromSearch = Array.from(search.columnOrder ?? []);
		if (fromSearch.length) {
			return fromSearch;
		}

		return staticColumns
			.map((col) => col.id)
			.concat(tableMetadata.columnList)
			.filter(Boolean) as string[];
	}, [search.columnOrder, staticColumns, tableMetadata.columnList]);

	const hasUuid = tableMetadata.columnMetadata.some((col) =>
		col.dataType.includes("uuid"),
	);
	const defaultColumnSize = getDefaultColumnSize({
		tableSize: search.tableSize,
		hasUuid,
	});

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
		columnMetadata: tableMetadata.columnMetadata,
		columnList: tableMetadata.columnList,
		isColumnMetadataLoading: tableMetadata.isLoading,
		queryResponse,
		totalRowCount,
		rowsDataTable,
		rowsColumns,
		hasUuid,
		relationshipRowId,
		setRelationshipRowId,
		relationships,
		renderSubrows,
	};
};
