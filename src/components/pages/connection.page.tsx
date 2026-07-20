import { BulkActionBar } from "#src/components/app/bulk-action-bar.tsx";
import { ColumnHeaderContextProvider } from "#src/components/data-table/column-header-context.tsx";
import {
  copyToClipboard,
  exportRows,
  rowsToInsertStatements,
} from "#src/components/pages/connection-page/export-rows.ts";
import { SqlQueryPreview } from "#src/components/pages/connection-page/sql-query-preview.tsx";
import {
  type ConnectionPageState,
  useActiveConnectionUrl,
  useConnectionPageState,
} from "#src/components/pages/connection-page/use-connection-page-state.tsx";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { useJsEvalFilter } from "#src/hooks/use-js-eval-filter.ts";
import { fromPixelToPercentage } from "#src/lib/calculate-percentage-from-pixels.ts";
import { formatDbError } from "#src/lib/format-db-error.ts";
import { formatSQL } from "#src/lib/format-sql.ts";
import { invalidateRowsQueries, rowMutationMeta } from "#src/lib/invalidate-rows-queries.ts";
import { cn, tryFn } from "#src/lib/utils.ts";
import { queryClient } from "#src/query-client.ts";
import {
  customSqlExecutionQueryOptions,
  executeAndStoreCustomSqlServerFn,
} from "#src/server/custom-sql/start-fns/execute-custom-sql.start.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import {
  getDestructiveQuerySummary,
  isDestructiveQuery,
} from "#src/server/introspection/detect-destructive-sql.ts";
import { bulkDeleteRowsServerFn } from "#src/server/introspection/start-fns/bulk-delete-rows.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";
import { Splitter } from "@ark-ui/react";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { ArrowDown, ArrowDownUp, ArrowUp, RotateCcw } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { DbConnection } from "./connection.types";

import { DataTable } from "../data-table/data-table.tsx";
import { ScrollToColumnButton } from "../data-table/scroll-to-column.button.tsx";
import { useDataTable } from "../data-table/use-data-table.ts";
import { QueryFilterBuilder } from "../query-builder/query-filter-builder.tsx";
import { QueryLoggerContent } from "../query-logger/query-logger-panel.tsx";
import { ErrorBoundaryCard } from "../shared/error-boundary-card.tsx";
import { Button } from "../ui/button.tsx";
import {
  Dialog,
  DialogCloseTrigger,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog.tsx";
import { Input } from "../ui/input.tsx";
import { Stack } from "../ui/layout.tsx";
import { Menu, MenuContent, MenuItem, MenuItemText, MenuTriggerItem } from "../ui/menu.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet.tsx";
import { Spinner } from "../ui/spinner.tsx";
import { toaster } from "../ui/toaster.tsx";
import { ConnectionPageFilters } from "./connection-page/connection-page-filters.tsx";
import { ConnectionPageSidebar } from "./connection-page/connection-page-sidebar.tsx";
import { ConnectionPageStatusBar } from "./connection-page/connection-page-status-bar.tsx";
import { ConnectionPageTabs } from "./connection-page/connection-page-tabs.tsx";
import { ConnectionQuickReferencesDrawer } from "./connection-page/connection-quick-references.drawer.tsx";
import { ConnectionRowJsonViewerDrawer } from "./connection-page/connection-row-json-viewer.drawer.tsx";
import { updateTabState, useActiveTabState } from "./connection-page/create-tab-state.ts";
import { DestructiveQueryConfirmDialog } from "./connection-page/destructive-query-confirm.dialog.tsx";
import { EmptyTabState } from "./connection-page/empty-tab-state.tsx";
import { ExplainOutputDrawer } from "./connection-page/explain-output-drawer.tsx";
import { useJoinedTables } from "./connection-page/join-tables/use-joined-tables.ts";
import { RelationshipsPanel } from "./connection-page/relationships/relationships-panel.tsx";
import {
  createClosedRowEditorState,
  RowEditorSheet,
  type RowEditorSheetState,
} from "./connection-page/row-editor/row-editor-sheet.tsx";
import {
  extractPrimaryKeyValues,
  getPrimaryKeyColumns,
  hasPrimaryKey,
  hasSystemRowIdentity,
} from "./connection-page/row-editor/row-editor-values.ts";
import { SchemaExplorerDrawer } from "./connection-page/schema-explorer-drawer.tsx";
import { StructureTable } from "./connection-page/structure-table.tsx";
import { TabErrorState } from "./connection-page/tab-error-state.tsx";
import { useExplainQuery } from "./connection-page/use-explain-query.ts";
import { useStructureFilters } from "./connection-page/use-structure-filter-state.ts";
import { useTablesColumnsForIntellisense } from "./connection-page/use-tables-columns-intellisense.ts";
import { ConnectionForm } from "./connection.form.tsx";

interface ConnectionPageProps {
  connectionName: string;
}

export const ConnectionPage = ({ connectionName }: ConnectionPageProps) => {
  const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
  const connection = connectionList.data.find((c) => c.name === connectionName);

  if (!connection) {
    return (
      <div className="bg-background h-screen px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-foreground text-2xl font-bold">Connection not found</h1>
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
  const queryLoggerSize = useActiveTabState((_tab, search) => search.queryLoggerSize);
  const sidebarMinSize = fromPixelToPercentage(224, "horizontal");
  const queryLoggerMinSize = fromPixelToPercentage(48, "vertical");
  const defaultQueryLoggerSize = queryLoggerSize ?? 0;

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
    <div className="bg-background flex h-screen flex-col">
      {/* Main Layout */}
      <div className="flex h-full min-h-0 flex-1 flex-col">
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
          className="flex h-full min-h-0 flex-1"
        >
          {/* Sidebar Panel */}
          <Splitter.Panel
            id={panels.sidebar}
            className="bg-muted/30 flex h-full shrink-0 flex-col overflow-hidden border-r"
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
                  tryFn(() => ctx.isPanelCollapsed(panels.sidebar)) ? "w-3" : "w-1.5",
                  "bg-border hover:bg-primary/50 h-full cursor-col-resize transition-colors",
                )}
                title="Drag to resize, double-click to toggle"
                onDoubleClick={() => {
                  // oxlint-disable-next-line no-unused-expressions
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
            className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
          >
            <Splitter.Context>
              {(sidebarSplitterCtx) => (
                <Splitter.Root
                  orientation="vertical"
                  defaultSize={[100 - defaultQueryLoggerSize, defaultQueryLoggerSize]}
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
                  className="flex h-full min-h-0 flex-1 flex-col"
                >
                  {/* Rows Content Panel */}
                  <Splitter.Panel
                    id={panels.rowsContent}
                    className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    {/* Tabs */}
                    <ConnectionPageTabs
                      activeConnectionUrl={activeConnectionUrl}
                      dialect={connection.dialect}
                      onToggleSidebar={() => {
                        if (sidebarSplitterCtx.isPanelExpanded(panels.sidebar)) {
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
                            sidebarSize: sidebarSplitterCtx.getPanelSize(panels.sidebar),
                          }),
                        });
                      }}
                      isSidebarCollapsed={sidebarSplitterCtx.isPanelCollapsed(panels.sidebar)}
                    />
                    {schemaListQuery.isError ? (
                      <TabErrorState activeConnectionUrl={activeConnectionUrl} />
                    ) : search.table && search.schema ? (
                      <RowsTabContent
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
                          tryFn(() => ctx.isPanelCollapsed(panels.queryLogger)) ? "h-3" : "h-1.5",
                          "bg-border hover:bg-primary/50 w-full cursor-row-resize transition-colors",
                        )}
                        title="Drag to resize, double-click to toggle"
                        onDoubleClick={() => {
                          // oxlint-disable-next-line no-unused-expressions
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
                        className="bg-background flex h-full min-h-0 flex-col overflow-hidden border-t"
                      >
                        <QueryLoggerContent
                          connectionUrl={activeConnectionUrl}
                          isExpanded={ctx.isPanelExpanded(panels.queryLogger)}
                          onCollapse={() => ctx.collapsePanel(panels.queryLogger)}
                          onExpand={() => ctx.expandPanel(panels.queryLogger, 48)}
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

const RowsTabContent = (props: { connection: DbConnection; activeConnectionUrl: string }) => {
  const { connection } = props;
  const [rowEditor, setRowEditor] = useState<RowEditorSheetState>(createClosedRowEditorState);
  const onEditRow = useCallback(
    (row: Record<string, unknown>) => setRowEditor({ open: true, mode: "edit", row }),
    [],
  );
  const onDuplicateRow = useCallback(
    (row: Record<string, unknown>) => setRowEditor({ open: true, mode: "duplicate", row }),
    [],
  );
  const pageState = useConnectionPageState({
    connection,
    onEditRow,
    onDuplicateRow,
  });
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const search = useActiveTabState((tab) => {
    return {
      tabId: tab.tabId,
      schema: tab.schema,
      table: tab.table,
      filtersOpened: tab.filtersOpened,
      viewMode: tab.viewMode,
      tableSize: tab.tableSize,
      sqlPreviewSize: tab.sqlPreviewSize,
      customSql: tab.customSql,
      customSqlId: tab.customSqlId,
      sqlEditorMode: tab.sqlEditorMode,
      orderBy: tab.orderBy,
      orderDirection: tab.orderDirection,
      nullsOrder: tab.nullsOrder,
      filters: tab.filters,
      hiddenColumnList: tab.hiddenColumnList,
      columnVisibilityMode: tab.columnVisibilityMode,
      joins: tab.joins,
      limit: tab.limit,
      offset: tab.offset,
    };
  });
  const { filters: structureFilters } = useStructureFilters();

  const isUsingCustomSql = Boolean(search.customSql?.trim()) || Boolean(search.customSqlId);

  const executeCustomSql = useExecuteCustomSql({
    activeConnectionUrl: pageState.activeConnectionUrl,
  });
  const isCustomSqlMode = Boolean(
    isUsingCustomSql ||
    executeCustomSql.mutation.isPending ||
    executeCustomSql.storedQuery.isLoading,
  );

  const columnQueries = useJoinedTables({
    url: pageState.activeConnectionUrl,
    joins: pageState.joins,
  });

  const handleExportAll = async (
    format: "json" | "csv" | "tsv" | "copy-json" | "copy-csv" | "copy-tsv" | "copy-insert",
  ) => {
    if (!search.schema || !search.table || !search.limit) return;

    const { queryClient } = await import("#src/query-client.ts");

    const visibleColumns = pageState.rowsDataTable.getVisibleLeafColumns().map((c) => c.id);
    const hiddenColumnList = Array.from(search.hiddenColumnList ?? []);
    const columnVisibilityMode = search.columnVisibilityMode ?? "client";

    let selectedColumns: string[] | undefined;
    let excludedColumns: string[] | undefined;
    const columnNameList = pageState.columnNameList;
    if (columnVisibilityMode === "server" && hiddenColumnList.length) {
      const visibleCount = columnNameList.length - hiddenColumnList.length;
      if (visibleCount <= hiddenColumnList.length) {
        selectedColumns = columnNameList.filter((col) => !hiddenColumnList.includes(col));
      } else {
        excludedColumns = hiddenColumnList;
      }
    }

    toaster.create({
      title: "Fetching all rows...",
      description: `This may take a while for large tables`,
      type: "info",
    });

    const allRows: Record<string, unknown>[] = [];
    const pageSize = 1000;
    const totalRowCount = pageState.queryResponse.rowCount;
    let offset = 0;

    while (offset < totalRowCount) {
      const data = await queryClient.fetchQuery(
        queryTableDataQueryOptions({
          url: pageState.activeConnectionUrl,
          schema: search.schema,
          table: search.table,
          limit: pageSize,
          offset,
          orderBy: search.orderBy,
          orderDirection: search.orderDirection,
          nullsOrder: search.nullsOrder,
          filters: search.filters ?? { conditions: [], logicalOperator: "and" },
          joins: search.joins as any,
          selectedColumns,
          excludedColumns,
        }),
      );
      allRows.push(...data.rows);
      offset += pageSize;
    }

    const columns = visibleColumns;
    const tableName = search.table;
    const schemaName = search.schema;

    if (format === "copy-insert") {
      const content = rowsToInsertStatements(allRows, columns, tableName, schemaName);
      const success = await copyToClipboard(content);
      toaster.create({
        title: success ? "Copied" : "Error",
        description: success ? `Copied ${allRows.length} INSERT statements` : "Failed to copy",
        type: success ? "success" : "error",
      });
    } else if (format.startsWith("copy-")) {
      const copyFormat = format.replace("copy-", "") as "json" | "csv" | "tsv";
      let content: string;
      if (copyFormat === "json") {
        content = JSON.stringify(allRows, null, 2);
      } else if (copyFormat === "csv") {
        const header = columns.join(",");
        const csvRows = allRows.map((row) =>
          columns
            .map((col) => {
              const value = row[col];
              const stringValue =
                value === null || value === undefined
                  ? ""
                  : typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value);
              const escaped = stringValue.replace(/"/g, '""');
              return escaped.includes(",") || escaped.includes("\n") ? `"${escaped}"` : escaped;
            })
            .join(","),
        );
        content = [header, ...csvRows].join("\n");
      } else {
        const header = columns.join("\t");
        const tsvRows = allRows.map((row) =>
          columns
            .map((col) => {
              const value = row[col];
              const stringValue =
                value === null || value === undefined
                  ? ""
                  : typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value);
              return stringValue.replace(/\t/g, " ");
            })
            .join("\t"),
        );
        content = [header, ...tsvRows].join("\n");
      }
      const success = await copyToClipboard(content);
      toaster.create({
        title: success ? "Copied" : "Error",
        description: success
          ? `Copied ${allRows.length} rows as ${copyFormat.toUpperCase()}`
          : "Failed to copy",
        type: success ? "success" : "error",
      });
    } else {
      const exportFormat = format as "json" | "csv" | "tsv";
      exportRows(allRows, columns, {
        format: exportFormat,
        filename: `${tableName}-export.${exportFormat}`,
      });
      toaster.create({
        title: "Success",
        description: `Exported ${allRows.length} rows`,
        type: "success",
      });
    }
  };

  return (
    <>
      {/* Show filters and query builder only in table browse mode */}
      {!isCustomSqlMode && (
        <>
          {/* Filters */}
          <ConnectionPageFilters
            columnList={pageState.columnNameList}
            table={pageState.rowsDataTable}
            isLoading={pageState.rowsQuery.isLoading || pageState.isColumnMetadataLoading}
            queryBuilder={pageState.queryBuilder}
            url={pageState.activeConnectionUrl}
            schema={search.schema}
            tableName={search.table}
            columnMetadata={pageState.columnMetadata}
            onAddRow={
              search.table
                ? () => setRowEditor({ open: true, mode: "insert", row: null })
                : undefined
            }
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
                columnMetadata={pageState.columnMetadata
                  .map((meta) => ({
                    ...meta,
                    name: `${search.table}.${meta.name}`,
                  }))
                  .concat(
                    (columnQueries ?? []).flatMap((q, index) =>
                      (q.data ?? []).map((meta) => {
                        const table = pageState.joins[index].table;
                        return {
                          ...meta,
                          name: `${table}.${meta.name}`,
                        };
                      }),
                    ),
                  )}
              />
            )}
        </>
      )}

      {/* Content */}
      <div className="flex h-full flex-1 flex-col overflow-hidden">
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
            className="flex h-full flex-1 flex-col overflow-hidden"
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
                    isCollapsed={Boolean(tryFn(() => ctx.isPanelCollapsed(panels.sqlPreview)))}
                    onExpand={() => ctx.expandPanel(panels.sqlPreview)}
                    onCollapse={() => ctx.collapsePanel(panels.sqlPreview)}
                    activeConnectionUrl={pageState.activeConnectionUrl}
                    sqlQueryAsText={pageState.sqlQueryAsText}
                    onRunQuery={executeCustomSql.onRunQuery}
                    onCancelQuery={executeCustomSql.onCancel}
                    isLoading={executeCustomSql.mutation.isPending}
                  />
                )}
              </Splitter.Context>
            </Splitter.Panel>
            <Splitter.Context>
              {(ctx) => (
                <Splitter.ResizeTrigger
                  id={`${panels.sqlPreview}:${panels.rowsContent}`}
                  className={cn(
                    tryFn(() => ctx.isPanelCollapsed(panels.sqlPreview)) ? "h-2" : "h-1.5",
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

            <Splitter.Panel id={panels.rowsContent} className="flex flex-col overflow-hidden">
              {isCustomSqlMode ? (
                <CustomSqlTabContent executeCustomSql={executeCustomSql} />
              ) : pageState.rowsQuery.isLoading ? (
                <Stack className="flex flex-1 items-center justify-center">
                  <Spinner />
                  <span className="text-muted-foreground">
                    {pageState.rowsQuery.failureCount > 0 ? (
                      <>
                        Failed {pageState.rowsQuery.failureCount} time
                        {pageState.rowsQuery.failureCount > 1 ? "s" : ""}, retrying...
                      </>
                    ) : (
                      "Loading table data..."
                    )}
                  </span>
                </Stack>
              ) : pageState.rowsQuery.isError ? (
                <div className="flex flex-1 items-center justify-center p-4">
                  <Stack className="w-full max-w-2xl">
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
                  onEditRow={onEditRow}
                  onDuplicateRow={onDuplicateRow}
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
                  rowsColumnsCount={pageState.rowsColumns.length - 2}
                  isCustomSql={isCustomSqlMode}
                  schema={search.schema}
                  tableName={search.table}
                  columns={pageState.rowsDataTable.getVisibleLeafColumns().map((col) => col.id)}
                  onExportAll={handleExportAll}
                />
              </div>
            </Splitter.Panel>
          </Splitter.Root>
        )}
      </div>

      {search.schema && search.table && (
        <RowEditorSheet
          open={rowEditor.open}
          mode={rowEditor.mode}
          row={rowEditor.row}
          connectionUrl={pageState.activeConnectionUrl}
          schema={search.schema}
          table={search.table}
          columnMetadata={pageState.columnMetadata}
          onOpenChange={(open) =>
            setRowEditor((prev) => (open ? { ...prev, open } : createClosedRowEditorState()))
          }
        />
      )}
    </>
  );
};

const RowsTableSqlEditor = (
  props: Pick<ConnectionPageState, "activeConnectionUrl" | "sqlQueryAsText"> & {
    connection: DbConnection;
    isCollapsed?: boolean;
    onExpand: () => void;
    onCollapse: () => void;
    onRunQuery: () => void;
    onCancelQuery: () => void;
    isLoading?: boolean;
  },
) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const search = useActiveTabState((tab) => {
    return {
      schema: tab.schema,
      table: tab.table,
      sqlEditorMode: tab.sqlEditorMode,
      customSql: tab.customSql,
      customSqlId: tab.customSqlId,
    };
  });

  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);

  // Keep draft SQL locally - don't switch to custom SQL mode until user runs
  const [draftSql, setDraftSql] = useState<string | null>(null);

  // When the generated SQL changes (e.g., from adding a join via UI), clear the draft
  // so the editor syncs with the new generated SQL
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset draft when generated SQL changes
  useEffect(() => {
    setDraftSql(null);
  }, [props.sqlQueryAsText]);

  // Fetch available tables/columns for intellisense
  const { tables, columns } = useTablesColumnsForIntellisense({
    connectionUrl: props.activeConnectionUrl,
    schema: search.schema,
  });

  // Explain query functionality - use draft SQL if available
  const sqlForExplain = draftSql ?? props.sqlQueryAsText;
  const { explainQuery, showExplainPanel, setShowExplainPanel, isExplainDisabled } =
    useExplainQuery({
      connectionUrl: props.activeConnectionUrl,
      sql: sqlForExplain,
      dialect: props.connection.dialect,
    });

  return (
    <>
      <SqlQueryPreview
        tables={tables}
        columns={columns}
        sql={props.sqlQueryAsText}
        customSql={draftSql ?? undefined}
        isCollapsed={props.isCollapsed}
        isLoading={props.isLoading}
        onToggleCollapsed={() => (props.isCollapsed ? props.onExpand() : props.onCollapse())}
        editorMode={search.sqlEditorMode ?? "preview"}
        onEditorModeChange={(mode) =>
          navigate({
            search: (prev) =>
              updateTabState(prev, {
                sqlEditorMode: mode,
              }),
          })
        }
        onEditorChange={(value) => setDraftSql(value)}
        onRun={props.onRunQuery}
        onCancel={props.onCancelQuery}
        onExplain={explainQuery.refetch}
        disableExplain={isExplainDisabled}
        onFormat={() => {
          try {
            const sqlToFormat = draftSql ?? props.sqlQueryAsText;
            const formatted = formatSQL(sqlToFormat, {
              language:
                props.connection.dialect === DatabaseDialect.Postgres ? "postgresql" : "sqlite",
              onError: (error) => {
                toaster.create({
                  title: "Failed to format SQL",
                  description: error.message,
                });
              },
            });
            // Just update the draft, don't switch to custom SQL mode
            setDraftSql(formatted);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to format SQL";
            alert(`Error formatting SQL: ${message}`);
          }
        }}
        onToggleFullscreen={() => setIsEditorFullscreen(!isEditorFullscreen)}
        isFullscreen={isEditorFullscreen}
        className="h-full text-sm"
        warning={
          draftSql && (
            <div className="ml-auto flex items-center justify-between gap-3 px-4">
              <p className="text-xs font-medium text-amber-900">
                📝 Run custom query with Ctrl+Enter
              </p>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setDraftSql(null);
                  props.onCollapse();
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, {
                        customSql: undefined,
                        customSqlId: undefined,
                        sqlEditorMode: "preview",
                      }),
                  });
                }}
                title="Reset to generated query and restore UI controls"
                className="shrink-0 gap-1 px-2 text-xs"
              >
                <RotateCcw />
                Reset
              </Button>
            </div>
          )
        }
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
  > & {
    onEditRow?: (row: Record<string, unknown>) => void;
    onDuplicateRow?: (row: Record<string, unknown>) => void;
  },
) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(null);
  const relationshipPanelSize = fromPixelToPercentage(50, "vertical");

  const search = useActiveTabState((tab, _search) => {
    return {
      schema: tab.schema,
      table: tab.table,
      tableSize: tab.tableSize,
      relationshipRowId: tab.relationshipRowId,
      nullsOrder: tab.nullsOrder,
      clientFilter: tab.clientFilter,
      clientFilterApproved: tab.clientFilterApproved,
    };
  });

  // Only evaluate the approved filter, not the draft one
  const jsFilterResult = useJsEvalFilter(search.clientFilterApproved, {
    paramName: "r",
    sampleData: props.rowsQuery.data?.rows[0] as Record<string, unknown>,
  });

  const handleJsFilterChange = (value: string) => {
    navigate({
      search: (prev) =>
        updateTabState(prev, {
          clientFilter: value || undefined,
          clientFilterApproved: undefined, // Reset approval when filter changes
        }),
    });
  };

  const handleApproveFilter = () => {
    if (search.clientFilter?.trim()) {
      navigate({
        search: (prev) =>
          updateTabState(prev, {
            clientFilterApproved: search.clientFilter,
          }),
      });
    }
  };

  const onNullsOrderChange = (nullsOrder: "first" | "last" | undefined) => {
    navigate({
      search: (prev) => {
        return updateTabState(prev, {
          nullsOrder,
        });
      },
    });
  };

  // Check if there's a pending (unapproved) filter
  const hasPendingFilter =
    search.clientFilter?.trim() && search.clientFilter !== search.clientFilterApproved;

  const approvedFilter = search.clientFilterApproved;

  return (
    <div className="relative flex h-full flex-1 flex-col">
      <BulkActions
        activeConnectionUrl={props.activeConnectionUrl}
        rowsDataTable={props.rowsDataTable}
        columnMetadata={props.columnMetadata}
        onEditRow={props.onEditRow}
        onDuplicateRow={props.onDuplicateRow}
      />

      <div className="flex flex-col gap-1 border-b px-2 py-1">
        <div className="flex items-center gap-2">
          <Input
            placeholder="r.name.includes('test')"
            value={search.clientFilter || ""}
            onChange={(e) => handleJsFilterChange(e.target.value)}
            className="h-7 flex-1 font-mono text-xs"
          />
          {hasPendingFilter && (
            <Button
              onClick={handleApproveFilter}
              size="sm"
              variant="default"
              className="h-7 px-2 text-xs"
            >
              Run
            </Button>
          )}
          {approvedFilter && !hasPendingFilter && (
            <span className="text-muted-foreground text-xs">(active)</span>
          )}
        </div>
        {jsFilterResult.error && (
          <p className="mt-1 text-xs text-red-500">{jsFilterResult.error}</p>
        )}
      </div>

      <Splitter.Root
        orientation="vertical"
        className="flex h-full flex-1 flex-col overflow-hidden"
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
          className="relative flex flex-1 flex-col overflow-auto"
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
                      disabled={column.getIsSorted() === "asc" && search.nullsOrder === "first"}
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
                      disabled={column.getIsSorted() === "asc" && search.nullsOrder === "last"}
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
                      disabled={column.getIsSorted() === "desc" && search.nullsOrder === "first"}
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
                      disabled={column.getIsSorted() === "desc" && search.nullsOrder === "last"}
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
                        <MenuItemText>Clear sort &amp; nulls order</MenuItemText>
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
              isLoading={props.rowsQuery.isLoading || props.isColumnMetadataLoading}
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
                const primaryKeyColumn = props.columnMetadata.find((col) => col.primaryKey);
                const rowId = primaryKeyColumn ? String(row[primaryKeyColumn.name]) : undefined;
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
                .rows.find((row) => row.id === search.relationshipRowId)?.original ?? {}
            }
          />
        )}
      </Splitter.Root>
    </div>
  );
};

const BulkActions = (
  props: Pick<ConnectionPageState, "activeConnectionUrl" | "rowsDataTable" | "columnMetadata"> & {
    onEditRow?: (row: Record<string, unknown>) => void;
    onDuplicateRow?: (row: Record<string, unknown>) => void;
  },
) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const search = useActiveTabState((tab) => ({
    schema: tab.schema,
    table: tab.table,
  }));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedRows = props.rowsDataTable.getSelectedRowModel().rows;
  const selectedRowsCount = selectedRows.length;
  const pkColumns = getPrimaryKeyColumns(props.columnMetadata);
  const canDelete =
    hasPrimaryKey(props.columnMetadata) ||
    (selectedRowsCount > 0 &&
      selectedRows.every((row) => hasSystemRowIdentity(row.original as Record<string, unknown>)));
  const canEditSelected =
    selectedRowsCount === 1 &&
    Boolean(props.onEditRow) &&
    (hasPrimaryKey(props.columnMetadata) ||
      hasSystemRowIdentity(selectedRows[0]?.original as Record<string, unknown>));

  const deleteMutation = useMutation({
    meta: rowMutationMeta,
    mutationFn: async () => {
      if (!canDelete || !search.schema || !search.table) {
        throw new Error("Missing required metadata for bulk delete");
      }
      const primaryKeys = selectedRows.map((row) =>
        extractPrimaryKeyValues(props.columnMetadata, row.original as Record<string, unknown>),
      );

      await bulkDeleteRowsServerFn({
        data: {
          url: props.activeConnectionUrl,
          schema: search.schema,
          table: search.table,
          primaryKeys: primaryKeys as Array<
            Record<string, string | number | boolean | null | undefined>
          >,
        },
      });

      return primaryKeys.length;
    },
    onSuccess: (deletedCount) => {
      props.rowsDataTable.resetRowSelection();
      invalidateRowsQueries(queryClient);

      toaster.create({
        title: "Success",
        description: `Deleted ${deletedCount} row${deletedCount !== 1 ? "s" : ""}`,
        type: "success",
      });

      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toaster.create({
        title: "Could not delete rows",
        description: formatDbError(error),
        type: "error",
      });
    },
  });

  const handleExportJson = () => {
    const rows = selectedRows.map((row) => row.original as Record<string, unknown>);
    const columns = props.rowsDataTable.getVisibleLeafColumns().map((col) => col.id);

    exportRows(rows, columns, {
      format: "json",
      filename: `${search.table}-export.json`,
    });

    toaster.create({
      title: "Success",
      description: `Exported ${rows.length} row${rows.length !== 1 ? "s" : ""}`,
      type: "success",
    });
  };

  const handleExportCsv = () => {
    const rows = selectedRows.map((row) => row.original as Record<string, unknown>);
    const columns = props.rowsDataTable.getVisibleLeafColumns().map((col) => col.id);

    exportRows(rows, columns, {
      format: "csv",
      filename: `${search.table}-export.csv`,
    });

    toaster.create({
      title: "Success",
      description: `Exported ${rows.length} row${rows.length !== 1 ? "s" : ""}`,
      type: "success",
    });
  };

  const handleCopyJson = async () => {
    const rows = selectedRows.map((row) => row.original as Record<string, unknown>);
    const content = JSON.stringify(rows, null, 2);
    const success = await copyToClipboard(content);

    toaster.create({
      title: success ? "Copied" : "Error",
      description: success
        ? `Copied ${rows.length} row${rows.length !== 1 ? "s" : ""} as JSON`
        : "Failed to copy to clipboard",
      type: success ? "success" : "error",
    });
  };

  const handleCopyCsv = async () => {
    const rows = selectedRows.map((row) => row.original as Record<string, unknown>);
    const columns = props.rowsDataTable.getVisibleLeafColumns().map((col) => col.id);

    const content = rows
      .map((row) =>
        columns
          .map((col) => {
            const value = row[col];
            const stringValue =
              value === null || value === undefined
                ? ""
                : typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value);
            const escaped = stringValue.replace(/"/g, '""');
            return escaped.includes(",") || escaped.includes("\n") ? `"${escaped}"` : escaped;
          })
          .join(","),
      )
      .join("\n");

    const success = await copyToClipboard(content);

    toaster.create({
      title: success ? "Copied" : "Error",
      description: success
        ? `Copied ${rows.length} row${rows.length !== 1 ? "s" : ""} as CSV`
        : "Failed to copy to clipboard",
      type: success ? "success" : "error",
    });
  };

  const handleCopyInsert = async () => {
    const rows = selectedRows.map((row) => row.original as Record<string, unknown>);
    const columns = props.rowsDataTable.getVisibleLeafColumns().map((col) => col.id);

    const content = rowsToInsertStatements(rows, columns, search.table!, search.schema);
    const success = await copyToClipboard(content);

    toaster.create({
      title: success ? "Copied" : "Error",
      description: success
        ? `Copied ${rows.length} INSERT statement${rows.length !== 1 ? "s" : ""}`
        : "Failed to copy to clipboard",
      type: success ? "success" : "error",
    });
  };

  const handleViewJson = () => {
    if (selectedRows.length === 0) return;

    const rowIds = selectedRows.map((row) => {
      if (pkColumns.length === 0) return row.id;
      return pkColumns.map((col) => String(row.original[col.name] ?? "")).join("-");
    });

    navigate({
      search: (prev) => ({
        ...prev,
        rowJsonViewerRowIds: rowIds,
        rowJsonViewerRowId: undefined,
        rowJsonViewerOpen: true,
      }),
    });
  };

  const handleDuplicate = () => {
    if (selectedRowsCount !== 1 || !props.onDuplicateRow) {
      toaster.create({
        title: "Duplicate one row at a time",
        description: "Select a single row to open the duplicate editor.",
        type: "info",
      });
      return;
    }
    props.onDuplicateRow(selectedRows[0].original as Record<string, unknown>);
  };

  const handleEdit = () => {
    if (!canEditSelected || !props.onEditRow) {
      return;
    }
    props.onEditRow(selectedRows[0].original as Record<string, unknown>);
  };

  const handleLogRows = () => {
    const rows = selectedRows.map((row) => row.original as Record<string, unknown>);
    console.log("Rows:", rows);
    toaster.create({
      title: "Logged",
      description: `Logged ${rows.length} row${rows.length !== 1 ? "s" : ""} to console`,
      type: "success",
    });
  };

  const handleExpandRelationships = () => {
    const firstSelectedRow = selectedRows[0];
    if (!firstSelectedRow) return;

    const rowId =
      pkColumns.length > 0
        ? pkColumns.map((col) => String(firstSelectedRow.original[col.name] ?? "")).join("-")
        : firstSelectedRow.id;

    navigate({
      search: (prev) =>
        updateTabState(prev, {
          relationshipRowId: rowId,
        }),
    });
  };

  const handleBulkDelete = () => {
    if (!canDelete) {
      toaster.create({
        title: "Cannot delete without a row identity",
        description:
          "This table has no primary key and selected rows lack a system row id, so bulk delete is disabled.",
        type: "error",
      });
      return;
    }
    setShowDeleteConfirm(true);
  };

  return (
    <>
      <BulkActionBar
        selectedCount={selectedRowsCount}
        onEdit={canEditSelected ? handleEdit : undefined}
        onDelete={canDelete ? handleBulkDelete : undefined}
        onDuplicate={props.onDuplicateRow ? handleDuplicate : undefined}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        onCopyJson={handleCopyJson}
        onCopyCsv={handleCopyCsv}
        onCopyInsert={handleCopyInsert}
        onViewJson={handleViewJson}
        onLogRows={handleLogRows}
        onExpandRelationships={selectedRowsCount === 1 ? handleExpandRelationships : undefined}
        isLoading={deleteMutation.isPending}
      />

      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(details) => setShowDeleteConfirm(details.open)}
      >
        <DialogContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <DialogTitle className="text-lg font-semibold">Delete rows?</DialogTitle>
              <DialogDescription className="text-sm">
                Are you sure you want to delete {selectedRowsCount} row
                {selectedRowsCount !== 1 ? "s" : ""}? This action cannot be undone.
              </DialogDescription>
            </div>
            <div className="flex justify-end gap-3">
              <DialogCloseTrigger asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogCloseTrigger>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const EmptyTabContent = (props: { activeConnectionUrl: string; connection: DbConnection }) => {
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
              tryFn(() => ctx.isPanelCollapsed(panels.relationships)) ? "h-2" : "h-1.5",
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
      <Splitter.Panel id={panels.relationships} className="mb-2.5 flex flex-col overflow-hidden">
        <Splitter.Context>
          {(ctx) => {
            return (
              <RelationshipsPanel
                key={props.activeConnectionUrl + props.table + props.relationshipRowId}
                connectionUrl={props.activeConnectionUrl}
                schema={props.schema}
                table={props.table!}
                selectedRowId={props.relationshipRowId ?? null}
                rowData={props.rowData}
                isPanelExpanded={Boolean(tryFn(() => ctx.isPanelExpanded(panels.relationships)))}
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

const useExecuteCustomSql = (props: { activeConnectionUrl: string }) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const search = useActiveTabState((tab) => ({
    schema: tab.schema,
    table: tab.table,
    customSql: tab.customSql,
    customSqlId: tab.customSqlId,
    sqlEditorMode: tab.sqlEditorMode,
    sqlPreviewSize: tab.sqlPreviewSize,
    tableSize: tab.tableSize,
  }));
  const [showDestructiveConfirm, setShowDestructiveConfirm] = useState(false);
  const [pendingQueryExecution, setPendingQueryExecution] = useState<(() => void) | null>(null);

  const executeCustomSqlMutation = useMutation({
    mutationFn: executeAndStoreCustomSqlServerFn,
    meta: { noInvalidate: true },
    onSuccess: (data) => {
      // After successful execution, update the URL to use the new customSqlId
      // and clear the customSql (since it's now stored in the database)
      if (!data?.customSqlId) return;
      queryClient.invalidateQueries(customSqlExecutionQueryOptions(search.customSqlId));
      navigate({
        search: (prev) =>
          updateTabState(prev, {
            customSqlId: data.customSqlId,
            customSql: undefined,
          }),
      });
    },
  });

  // Check if we already have mutation results (fresh execution)
  const mutationResult = executeCustomSqlMutation.data;
  const hasMutationResult = !!mutationResult?.rows;

  // Query for previously executed custom SQL (when customSqlId is set)
  // Disabled if we already have mutation results (fresh execution)
  const customSqlExecutionQuery = useQuery({
    ...customSqlExecutionQueryOptions(search.customSqlId),
    enabled: !!search.customSqlId && !hasMutationResult && !executeCustomSqlMutation.isPending,
  });

  const storedData = customSqlExecutionQuery.data;

  // console.log({ storedData, displaySql, search });

  // Get execution result (either from mutation or from stored execution)
  const output: {
    rows: Record<string, unknown>[];
    columns: string[];
    rowCount: number;
    rowsAffected: number | undefined;
    timeTaken: number;
    ranAt: number;
  } | null =
    hasMutationResult && mutationResult
      ? {
          rows: mutationResult.rows,
          columns: mutationResult.columns,
          rowCount: mutationResult.rowCount,
          rowsAffected: mutationResult.rowsAffected,
          timeTaken: mutationResult.timeTaken,
          ranAt: mutationResult.ranAt,
        }
      : storedData
        ? {
            // Use stored rows if available
            rows: (storedData.resultRows ?? []) as Record<string, unknown>[],
            columns: (storedData.columns ?? []) as string[],
            rowCount: storedData.rowsReturned ?? 0,
            rowsAffected: storedData.rowsAffected ?? undefined,
            timeTaken: storedData.timeTaken ?? 0,
            ranAt: storedData.startedAt ?? 0,
          }
        : null;

  const onRunQuery = (editorValue?: string) => {
    const sqlToRun =
      editorValue ??
      search.customSql ??
      storedData?.sql ??
      executeCustomSqlMutation.variables?.data.sql;
    console.log("onRunQuery", { sqlToRun });
    if (!sqlToRun) return;

    // If editing from a stored execution, track the parent query
    const previousId = search.customSqlId;

    // Check for destructive queries
    if (isDestructiveQuery(sqlToRun)) {
      setPendingQueryExecution(() => () => {
        executeCustomSqlMutation.mutate({
          data: {
            url: props.activeConnectionUrl,
            sql: sqlToRun,
            schemaName: search.schema,
            tableName: search.table,
            previousId,
          },
        });
        setShowDestructiveConfirm(false);
        setPendingQueryExecution(null);
      });
      setShowDestructiveConfirm(true);
      return;
    }

    executeCustomSqlMutation.mutate({
      data: {
        url: props.activeConnectionUrl,
        sql: sqlToRun,
        schemaName: search.schema,
        tableName: search.table,
        previousId,
      },
    });
  };

  const handleReExecuteStored = () => {
    const sql = storedData?.sql;
    if (!sql) return;

    // Re-executing same query, no previousId needed (it's the same query)
    executeCustomSqlMutation.mutate({
      data: {
        url: props.activeConnectionUrl,
        sql,
        schemaName: search.schema,
        tableName: search.table,
      },
    });
  };

  return {
    onRunQuery,
    onRerunStoredQuery: handleReExecuteStored,
    onCancel: () => executeCustomSqlMutation.reset(),
    output,
    mutation: executeCustomSqlMutation,
    storedQuery: customSqlExecutionQuery,
    hasStoredExecution: !!search.customSqlId,
    hasPendingCustomSql: !!search.customSql?.trim(),
    hasStoredRows: !!storedData?.resultRows?.length,
    hasMutationResult,
    DestructiveDialog: (
      <DestructiveQueryConfirmDialog
        isOpen={showDestructiveConfirm}
        onConfirm={() => {
          pendingQueryExecution?.();
        }}
        onCancel={() => {
          setShowDestructiveConfirm(false);
          setPendingQueryExecution(null);
        }}
        queryType={getDestructiveQuerySummary(search.customSql || storedData?.sql || "")}
        isLoading={executeCustomSqlMutation.isPending}
      />
    ),
  };
};

type UseExecuteCustomSqlOutput = ReturnType<typeof useExecuteCustomSql>;

const CustomSqlTabContent = (props: { executeCustomSql: UseExecuteCustomSqlOutput }) => {
  const { executeCustomSql } = props;

  const outputRows = executeCustomSql.output?.rows ?? [];
  const outputColumns = executeCustomSql.output?.columns ?? [];

  const [jsFilter, setJsFilter] = useState("");

  const jsFilterResult = useJsEvalFilter(jsFilter, {
    paramName: "r",
    sampleData: outputRows.length > 0 ? outputRows[0] : undefined,
  });

  const filteredRows = useMemo(() => {
    if (!jsFilter.trim() || !jsFilterResult.fn) {
      return outputRows;
    }
    try {
      return outputRows.filter((row) => {
        const result = jsFilterResult.fn!(row);
        return result === true;
      });
    } catch {
      return outputRows;
    }
  }, [outputRows, jsFilter, jsFilterResult.fn]);

  const tableColumns = useMemo(() => {
    const columnHelper = createColumnHelper<Record<string, unknown>>();
    return outputColumns.map((col: string) =>
      columnHelper.accessor(col, {
        id: col,
        header: col,
        cell: (info) => {
          const value = info.getValue();
          if (value === null) return <span className="text-muted-foreground italic">NULL</span>;
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        },
      }),
    );
  }, [outputColumns]);

  const table = useDataTable({
    data: filteredRows as Record<string, unknown>[],
    columns: tableColumns,
    manualPagination: true, // Disable pagination to show all results
  });
  const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(null);

  const search = useActiveTabState((tab) => ({
    tableSize: tab.tableSize,
  }));

  // Loading state
  if (executeCustomSql.mutation.isPending || executeCustomSql.storedQuery.isLoading) {
    return (
      <Stack className="flex flex-1 items-center justify-center">
        <Spinner />
        <span className="text-muted-foreground">
          {executeCustomSql.mutation.isPending
            ? "Executing SQL query..."
            : "Fetching previous output..."}
        </span>
      </Stack>
    );
  }

  // Error state
  if (executeCustomSql.mutation.isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Stack className="w-full max-w-2xl">
          <ErrorBoundaryCard
            error={executeCustomSql.mutation.error}
            title="Error executing custom SQL"
            onRetry={executeCustomSql.onRunQuery}
          />
        </Stack>
      </div>
    );
  }

  // Rows affected (non-SELECT query)
  if (
    executeCustomSql.hasMutationResult &&
    executeCustomSql.mutation.data?.rowsAffected !== undefined
  ) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-foreground mb-2 text-lg font-semibold">Query executed successfully</p>
          <p className="text-muted-foreground text-base">
            {executeCustomSql.mutation.data.rowsAffected === 1
              ? `${executeCustomSql.mutation.data.rowsAffected} row affected`
              : `${executeCustomSql.mutation.data.rowsAffected} rows affected`}
          </p>
        </div>
      </div>
    );
  }

  // Pending custom SQL (not yet executed)
  if (executeCustomSql.hasPendingCustomSql && !executeCustomSql.hasMutationResult) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4 text-sm">
            Click Execute or press Ctrl+Enter in the editor to run
          </p>
          <Button onClick={() => executeCustomSql.onRunQuery()} className="gap-2">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Execute Query
          </Button>
        </div>
      </div>
    );
  }

  // Results table
  if (outputRows.length > 0) {
    return (
      <div className="relative flex flex-1 flex-col overflow-auto">
        <div className="flex shrink-0 flex-col gap-1 border-b px-2 py-1">
          <div className="flex items-center gap-2">
            <Input
              placeholder="r.name.includes('test')"
              value={jsFilter}
              onChange={(e) => setJsFilter(e.target.value)}
              className="h-7 font-mono text-xs"
            />
          </div>
          {jsFilterResult.error && (
            <p className="mt-1 text-xs text-red-500">{jsFilterResult.error}</p>
          )}
        </div>
        <ColumnHeaderContextProvider>
          <DataTable
            enableRowVirtualization
            enableColumnOrdering
            table={table}
            getTableContainer={setTableContainer}
            isLoading={false}
            size={search.tableSize}
          />
          <ScrollToColumnButton table={table} containerRef={{ current: tableContainer }} />
        </ColumnHeaderContextProvider>
      </div>
    );
  }

  // Empty result (either from mutation or stored execution)
  if (
    (executeCustomSql.hasMutationResult || executeCustomSql.hasStoredExecution) &&
    executeCustomSql.output &&
    outputRows.length === 0
  ) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-foreground mb-2 text-lg font-semibold">Query executed successfully</p>
          <p className="text-muted-foreground text-sm">No rows returned</p>
        </div>
      </div>
    );
  }

  // Default: show prompt to write SQL
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <p className="text-foreground mb-2 text-lg font-semibold">Write your SQL query</p>
        <p className="text-muted-foreground text-sm">
          Use the editor above to write and execute custom SQL
        </p>
      </div>
    </div>
  );
};
