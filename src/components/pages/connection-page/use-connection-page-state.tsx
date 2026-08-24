import type {
  AccessorKeyColumnDef,
  ColumnDef,
  ColumnPinningState,
  Row,
} from "@tanstack/react-table";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { DataTableRowSubrow } from "#src/components/data-table/data-table.row.tsx";
import type { DatabaseDialect } from "#src/db/dialect.ts";

import { RowActionsMenu } from "#src/components/app/row-actions-menu.tsx";
import { RowContextMenu } from "#src/components/app/row-context-menu.tsx";
import { useDataTable } from "#src/components/data-table/use-data-table.ts";
import {
  updateTabState,
  useActiveTabState,
} from "#src/components/pages/connection-page/create-tab-state.ts";
import { formatTableValue } from "#src/components/pages/connection-page/format-table-value.ts";
import {
  hiddenColumnRefsFromKeys,
  isColumnHidden,
  normalizeHiddenColumnList,
  toHiddenColumnKeys,
} from "#src/components/pages/connection-page/hidden-column-list.ts";
import { RelatedRowExpandPreview } from "#src/components/pages/connection-page/relationships/related-row-expand-preview.tsx";
import { useRowsColumns } from "#src/components/pages/connection-page/use-rows-columns.tsx";
import { useTableColumnMetadata } from "#src/components/pages/connection-page/use-table-column-metadata.ts";
import { useTableRelationships } from "#src/components/pages/connection-page/use-table-relationships.ts";
import { useQueryBuilder } from "#src/components/query-builder/use-query-builder.ts";
import { Button } from "#src/components/ui/button.tsx";
import { Checkbox, CheckboxControl } from "#src/components/ui/checkbox.tsx";
import { Tooltip } from "#src/components/ui/tooltip.tsx";
import { useJsEvalFilter } from "#src/hooks/use-js-eval-filter.ts";
import { getStoredPageLimit } from "#src/lib/default-page-limit.ts";
import { getDefaultColumnSize } from "#src/lib/get-default-column-size.ts";
import { replaceDatabaseInConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { DADABASE_ROW_ID } from "#src/server/introspection/fns/row-identity.ts";
import { getQueryAsSql } from "#src/server/introspection/start-fns/get-query-sql.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";

import type { DbConnection } from "../connection.types.ts";

import { useJoinedTables } from "./join-tables/use-joined-tables.ts";
import { canLocateRow } from "./row-editor/row-editor-values.ts";
import { useRowsColumnsAction } from "./use-rows-columns.actions.ts";

export const useActiveConnectionUrl = (connection: DbConnection) => {
  return useSearch({
    from: "/connections/$connectionName",
    select: (s) =>
      s.dbName && connection.url
        ? replaceDatabaseInConnectionUrl(connection.url, s.dbName)
        : connection.url,
  });
};

interface QueryResponse {
  rows: Array<Record<string, unknown>>;
  columns: string[];
  rowCount: number;
  timeTaken: number;
  ranAt: number;
  rowsAffected?: number;
}

export const useConnectionPageState = ({
  connection,
  onEditRow,
  onDuplicateRow,
}: {
  connection: DbConnection;
  onEditRow?: (row: Record<string, unknown>) => void;
  onDuplicateRow?: (row: Record<string, unknown>) => void;
}) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const activeConnectionUrl = useActiveConnectionUrl(connection);
  const search = useActiveTabState((s) => {
    return {
      schema: s.schema,
      table: s.table,
      filters: s.filters,
      filtersOpened: s.filtersOpened,
      groupBy: s.groupBy,
      having: s.having,
      limit: s.limit,
      offset: s.offset,
      orderBy: s.orderBy,
      orderDirection: s.orderDirection,
      nullsOrder: s.nullsOrder,
      hiddenColumnList: s.hiddenColumnList,
      columnAliases: s.columnAliases,
      columnVisibilityMode: s.columnVisibilityMode,
      tableSize: s.tableSize,
      columnPinning: s.columnPinning,
      columnOrder: s.columnOrder,
      relationshipRowId: s.relationshipRowId,
      joins: s.joins,
      customSql: s.customSql,
      clientFilter: s.clientFilter,
      clientFilterApproved: s.clientFilterApproved,
    };
  });
  // console.log(search);

  // Query builder setup
  const queryBuilder = useQueryBuilder(
    search.filters ?? { conditions: [], logicalOperator: "and" },
    (updatedFilter) => {
      let shouldOpenFilters = search.filtersOpened;
      if (!search.filters?.conditions?.length && updatedFilter.conditions.length) {
        shouldOpenFilters = true;
      }

      navigate({
        search: (prev) => {
          return updateTabState(prev, {
            filters: updatedFilter,
            filtersOpened: shouldOpenFilters,
            offset: 0,
            limit: getStoredPageLimit(),
            orderBy: undefined,
            orderDirection: undefined,
          });
        },
      });
    },
  );

  const havingBuilder = useQueryBuilder(
    search.having ?? { conditions: [], logicalOperator: "and" },
    (updatedHaving) => {
      navigate({
        search: (prev) =>
          updateTabState(prev, {
            having: updatedHaving.conditions.length ? updatedHaving : undefined,
            offset: 0,
          }),
      });
    },
  );

  // Fetch column metadata
  const tableMetadata = useTableColumnMetadata({
    url: activeConnectionUrl,
    schema: search.schema || "",
    table: search.table || "",
  });

  const joins = Array.from(search.joins ?? []);
  const columnQueries = useJoinedTables({
    url: activeConnectionUrl,
    joins: joins,
  });
  const columnNameList = joins?.length
    ? tableMetadata.columnList
        .map((col) => `${search.table}.${col}`)
        .concat(
          joins?.length
            ? joins.flatMap((join, joinIndex) =>
                join.columns === "all"
                  ? (columnQueries[joinIndex].data ?? []).map(
                      (col) => `${join.alias || join.table}.${col.name}`,
                    )
                  : join.columns.map((col) => `${join.alias || join.table}.${col}`),
              )
            : [],
        )
    : tableMetadata.columnList;

  const columnVisibilityFilters = {
    selectedColumns: undefined as string[] | undefined,
    excludedColumns: undefined as string[] | undefined,
  };
  const hiddenColumnList = normalizeHiddenColumnList(search.hiddenColumnList, search.table || "");
  if (search.columnVisibilityMode === "server" && hiddenColumnList.length) {
    const hiddenKeys = toHiddenColumnKeys(hiddenColumnList);
    const visibleCount = columnNameList.length - hiddenKeys.length;
    if (visibleCount <= hiddenKeys.length) {
      columnVisibilityFilters.selectedColumns = columnNameList.filter(
        (col) => !isColumnHidden(hiddenColumnList, col),
      );
    } else {
      columnVisibilityFilters.excludedColumns = hiddenKeys;
    }
  }

  const customSql = search.customSql?.trim();
  const isCustomSql = Boolean(customSql);

  const rowsQuery = useQuery({
    ...queryTableDataQueryOptions({
      url: activeConnectionUrl,
      schema: search.schema || "",
      table: search.table || "",
      limit: search.limit,
      offset: search.offset,
      orderBy: search.orderBy,
      orderDirection: search.orderDirection,
      nullsOrder: search.nullsOrder,
      filters: queryBuilder.getWhereClause() ?? {
        conditions: [],
        logicalOperator: "and",
      },
      joins: joins,
      selectedColumns: columnVisibilityFilters.selectedColumns,
      excludedColumns: columnVisibilityFilters.excludedColumns,
    }),
    enabled: !isCustomSql && Boolean(search.schema && search.table),
    placeholderData: keepPreviousData,
  });

  const sqlQueryAsText =
    (isCustomSql
      ? search.customSql
      : getQueryAsSql({
          dialect: connection.dialect as DatabaseDialect,
          schema: search.schema || "",
          table: search.table || "",
          limit: search.limit,
          offset: search.offset,
          orderBy: search.orderBy,
          orderDirection: search.orderDirection,
          nullsOrder: search.nullsOrder,
          filters: queryBuilder.getWhereClause() ?? {
            conditions: [],
            logicalOperator: "and",
          },
          groupBy: search.groupBy ? Array.from(search.groupBy) : undefined,
          having: havingBuilder.getWhereClause() ?? undefined,
          joins: joins,
          selectedColumns: columnVisibilityFilters.selectedColumns,
          excludedColumns: columnVisibilityFilters.excludedColumns,
        }).sql) || "";

  // Format row data
  const queryResponse: QueryResponse = (rowsQuery.data as any) || {
    rows: [],
    columns: [],
    rowCount: 0,
    timeTaken: 0,
    ranAt: 0,
    rowsAffected: undefined,
  };
  // console.log(queryResponse);

  const formattedTableRowsData = useMemo(() => {
    const formatted = queryResponse.rows.map((row) => {
      const formattedRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        formattedRow[key] = formatTableValue(value);
      }
      return formattedRow;
    });

    return formatted;
  }, [queryResponse.rows]);

  const jsFilterResult = useJsEvalFilter(search.clientFilterApproved, {
    paramName: "r",
    sampleData: formattedTableRowsData.length > 0 ? formattedTableRowsData[0] : undefined,
  });

  const filteredTableRowsData = useMemo(() => {
    if (!search.clientFilterApproved?.trim() || !jsFilterResult.fn) {
      return formattedTableRowsData;
    }
    return formattedTableRowsData.filter((row) => {
      const result = jsFilterResult.fn!(row);
      return result === true;
    });
  }, [formattedTableRowsData, search.clientFilterApproved, jsFilterResult.fn]);

  // Static columns
  const staticColumns: Array<ColumnDef<Record<string, unknown>>> = useMemo(
    () => [
      {
        id: "__expand",
        meta: { enableColumnOrdering: false },
        header: () => null,
        cell: (ctx) => {
          const isExpanded = search.relationshipRowId === ctx.row.id;
          return (
            <div className="flex h-full w-full items-center justify-center">
              <Tooltip
                content={isExpanded ? "Collapse relationships panel" : "Expand relationships panel"}
                positioning={{ placement: "right", strategy: "fixed" }}
              >
                <Button
                  size="xs"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  aria-label={isExpanded ? "Collapse related rows" : "Expand related rows"}
                  data-testid={`row-expand-${ctx.row.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate({
                      search: (prev) =>
                        updateTabState(prev, {
                          relationshipRowId: isExpanded ? undefined : ctx.row.id,
                        }),
                    });
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </Button>
              </Tooltip>
            </div>
          );
        },
        size: 28,
        minSize: 28,
        maxSize: 28,
        enableResizing: false,
        enableSorting: false,
        enablePinning: false,
      } as ColumnDef<Record<string, unknown>>,
      {
        id: "__select",
        meta: { enableColumnOrdering: false },
        header: (ctx) => {
          const isSomeRowsSelected = ctx.table.getIsSomeRowsSelected();
          const isAllSelected = ctx.table.getIsAllRowsSelected();

          return (
            <div className="flex h-full w-full items-center justify-center gap-1 text-center">
              <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                Select
              </span>
              <Tooltip content="Select all rows" colorPalette="inverted">
                <Checkbox
                  className="flex items-center gap-2"
                  checked={isAllSelected ? true : isSomeRowsSelected ? "indeterminate" : false}
                  onChange={ctx.table.getToggleAllRowsSelectedHandler()}
                  aria-label="Select all rows"
                >
                  <CheckboxControl />
                </Checkbox>
              </Tooltip>
            </div>
          );
        },
        cell: (ctx) => {
          const isSelected = ctx.row.getIsSelected();

          const rowIndex = ctx.row.index;
          const pageIndex = Math.floor(search.offset / search.limit);
          const pageSize = search.limit;
          const displayedNumber = pageIndex * pageSize + rowIndex + 1;

          return (
            <Tooltip content={`Select row ${displayedNumber}`} colorPalette="inverted">
              <RowContextMenu
                row={ctx.row.original as Record<string, unknown>}
                tableMetadata={{
                  schema: search.schema,
                  table: search.table,
                }}
                connectionUrl={activeConnectionUrl}
                onEdit={
                  onEditRow &&
                  canLocateRow(
                    tableMetadata.columnMetadata,
                    ctx.row.original as Record<string, unknown>,
                  )
                    ? () => onEditRow(ctx.row.original as Record<string, unknown>)
                    : undefined
                }
                onDuplicate={
                  onDuplicateRow
                    ? () => onDuplicateRow(ctx.row.original as Record<string, unknown>)
                    : undefined
                }
                onExpandRelationships={() => {
                  navigate({
                    search: (prev) => {
                      return updateTabState(prev, {
                        relationshipRowId: ctx.row.id,
                      });
                    },
                  });
                }}
                onExpandRowJson={(row) => {
                  const primaryKeyColumn = tableMetadata.columnMetadata.find(
                    (col) => col.primaryKey,
                  );
                  const rowId = primaryKeyColumn ? String(row[primaryKeyColumn.name]) : undefined;
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      rowJsonViewerRowId: rowId,
                      rowJsonViewerOpen: !!rowId,
                    }),
                  });
                }}
              >
                <Checkbox
                  className="flex w-full items-center justify-center"
                  data-testid="row-select-button"
                  checked={isSelected}
                  disabled={!ctx.row.getCanSelect()}
                  aria-label={`Select row ${displayedNumber}`}
                  onChange={ctx.row.getToggleSelectedHandler()}
                >
                  <CheckboxControl />
                </Checkbox>
              </RowContextMenu>
            </Tooltip>
          );
        },
        size: 70,
        minSize: 70,
        maxSize: 70,
        enableResizing: false,
        enableSorting: false,
        enablePinning: false,
      } as ColumnDef<Record<string, unknown>>,
      {
        id: "__actions",
        meta: { enableColumnOrdering: false },
        header: () => null,
        cell: (ctx) => {
          const row = ctx.row.original as Record<string, unknown>;
          const canEdit = Boolean(onEditRow) && canLocateRow(tableMetadata.columnMetadata, row);

          return (
            <div className="flex h-full w-full items-center justify-center">
              <RowActionsMenu
                row={row}
                onEdit={canEdit && onEditRow ? () => onEditRow(row) : undefined}
                onDuplicate={onDuplicateRow ? () => onDuplicateRow(row) : undefined}
                onExpandRelationships={() => {
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, {
                        relationshipRowId: ctx.row.id,
                      }),
                  });
                }}
                onViewJson={() => {
                  const primaryKeyColumn = tableMetadata.columnMetadata.find(
                    (col) => col.primaryKey,
                  );
                  const rowId = primaryKeyColumn
                    ? String(row[primaryKeyColumn.name])
                    : row[DADABASE_ROW_ID] != null
                      ? String(row[DADABASE_ROW_ID])
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
            </div>
          );
        },
        size: 36,
        minSize: 36,
        maxSize: 36,
        enableResizing: false,
        enableSorting: false,
        enablePinning: false,
      } as ColumnDef<Record<string, unknown>>,
    ],
    [
      activeConnectionUrl,
      search.schema,
      search.table,
      search.relationshipRowId,
      tableMetadata.columnMetadata,
      navigate,
      search.offset,
      search.limit,
      onEditRow,
      onDuplicateRow,
    ],
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
    joins: joins,
    activeConnectionUrl,
    enableSorting: true,
    columnAliases: search.columnAliases,
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
    () => [...relationshipsQuery.incomingReferences, ...relationshipsQuery.outgoingForeignKeys],
    [relationshipsQuery.incomingReferences, relationshipsQuery.outgoingForeignKeys],
  );

  const renderSubrows = useCallback(
    (row: Row<Record<string, unknown>>): DataTableRowSubrow[] => {
      // Only render if we have an expanded relationship row set
      if (search.relationshipRowId !== row.id) {
        return [];
      }

      return [
        {
          id: "related-preview",
          content: (
            <RelatedRowExpandPreview
              relationships={relationships}
              rowData={row.original}
              connectionUrl={activeConnectionUrl}
              schema={search.schema || ""}
              table={search.table || ""}
            />
          ),
        },
      ];
    },
    [relationships, search.relationshipRowId, search.schema, search.table, activeConnectionUrl],
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
                cell: () => <div className="bg-muted h-3 animate-pulse rounded" />,
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
      visibility[col.id || ((col as AccessorKeyColumnDef<any>).accessorKey as string)] = true;
    });

    if (search.hiddenColumnList?.length) {
      normalizeHiddenColumnList(search.hiddenColumnList, search.table || "").forEach((ref) => {
        const key = ref.table ? `${ref.table}.${ref.column}` : ref.column;
        visibility[key] = false;
        // Also hide bare column id when the table matches the active table
        if (ref.table && ref.table === search.table) {
          visibility[ref.column] = false;
        } else if (!ref.table) {
          visibility[ref.column] = false;
        }
      });
    }

    return visibility;
  }, [search.hiddenColumnList, search.table, rowsColumns]);

  // Row selection
  const [rowSelection, setRowSelection] = useState({});

  // Column pinning state
  const columnPinningState: ColumnPinningState = useMemo(() => {
    const left = Array.from(search.columnPinning?.left ?? []).filter(
      (col) => col !== "__expand" && col !== "__select",
    );
    return {
      left: ["__expand", "__select", ...left],
      right: Array.from(search.columnPinning?.right ?? []),
    };
  }, [search.columnPinning]);

  // Column order state
  const columnOrderState = useMemo(() => {
    const fromSearch = Array.from(search.columnOrder ?? []);
    if (fromSearch.length) {
      return fromSearch;
    }

    return staticColumns
      .map((col) => col.id)
      .concat(columnNameList)
      .filter(Boolean) as string[];
  }, [search.columnOrder, staticColumns, columnNameList]);

  const hasUuid = tableMetadata.columnMetadata.some((col) => col.dataType.includes("uuid"));
  const defaultColumnSize = getDefaultColumnSize({
    tableSize: search.tableSize,
    hasUuid,
  });

  const primaryCols = tableMetadata.columnMetadata
    .filter((col) => col.primaryKey)
    .map((col) => col.name);
  const rowsDataTable = useDataTable({
    getRowId: primaryCols.length
      ? (row) => primaryCols.map((col) => row[col]).join("-")
      : undefined,
    data: filteredTableRowsData,
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
    rowCount: queryResponse.rowCount,
    defaultColumn: {
      minSize: 100,
      size: defaultColumnSize,
      maxSize: 1000,
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === "function" ? updater(sortingState) : updater;
      const firstSort = newSorting[0];
      navigate({
        search: (prev) => {
          return updateTabState(prev, {
            orderBy: firstSort?.id || undefined,
            orderDirection: (firstSort?.desc ? "desc" : "asc") as "asc" | "desc",
            nullsOrder: undefined,
            offset: 0,
          });
        },
      });
    },
    onPaginationChange: (updater) => {
      const current = {
        pageIndex: Math.floor(search.offset / search.limit),
        pageSize: search.limit,
      };
      const newPagination = typeof updater === "function" ? updater(current) : updater;
      navigate({
        search: (prev) => {
          return updateTabState(prev, {
            offset: newPagination.pageIndex * newPagination.pageSize,
            limit: newPagination.pageSize,
          });
        },
      });
    },
    onColumnVisibilityChange: (updater) => {
      const newVisibility =
        typeof updater === "function" ? updater(columnVisibilityState) : updater;
      const hiddenKeys = Object.keys(newVisibility)
        .filter((key) => !newVisibility[key])
        .toSorted();
      navigate({
        search: (prev) => {
          return updateTabState(prev, {
            hiddenColumnList:
              hiddenKeys.length > 0
                ? hiddenColumnRefsFromKeys(hiddenKeys, search.table || "")
                : undefined,
          });
        },
      });
    },
    onColumnPinningChange: (updater) => {
      const newPinning = typeof updater === "function" ? updater(columnPinningState) : updater;
      navigate({
        search: (prev) => {
          return updateTabState(prev, {
            columnPinning: newPinning,
          });
        },
      });
    },
    onColumnOrderChange: (updater) => {
      const newOrder = typeof updater === "function" ? updater(columnOrderState) : updater;
      navigate({
        search: (prev) => {
          return updateTabState(prev, {
            columnOrder: newOrder,
          });
        },
      });
    },
  });

  return {
    activeConnectionUrl,
    queryBuilder,
    havingBuilder,
    groupBy: search.groupBy ? Array.from(search.groupBy) : [],
    // TODO?
    // rowsQuery: {
    // 	...rowsQuery,
    // 	isLoading: isCustomSql
    // 		? customSqlMutation.isPending
    // 		: tableQuery.isLoading,
    // 	refetch: isCustomSql
    // 		? () =>
    // 				customSqlMutation.mutate({
    // 					data: { url: activeConnectionUrl, sql: search.customSql || "" },
    // 				})
    // 		: tableQuery.refetch,
    // },
    rowsQuery,
    // customSqlMutation,
    sqlQueryAsText: sqlQueryAsText,
    columnMetadata: tableMetadata.columnMetadata,
    columnNameList: columnNameList,
    isColumnMetadataLoading: tableMetadata.isLoading,
    queryResponse,
    rowsDataTable,
    rowsColumns,
    joins,
    hasUuid,
    relationships,
    renderSubrows,
  };
};

export type ConnectionPageState = ReturnType<typeof useConnectionPageState>;
