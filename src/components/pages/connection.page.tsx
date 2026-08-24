import { Portal, Splitter } from "@ark-ui/react";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CircleCheck,
  Code2,
  GripHorizontal,
  Loader2,
  RotateCcw,
  SearchX,
  TriangleAlert,
} from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { TableStructure } from "#src/lib/schema-diff/index.ts";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

import { BulkActionBar } from "#src/components/app/bulk-action-bar.tsx";
import { ColumnHeaderContextProvider } from "#src/components/data-table/column-header-context.tsx";
import {
  getColumnHeaderFilter,
  upsertColumnHeaderFilter,
} from "#src/components/data-table/upsert-column-header-filter.ts";
import {
  getQueryLoggerSplitterDefaultSize,
  getSidebarSplitterDefaultSize,
  getZenLayoutRemountKey,
} from "#src/components/pages/connection-page/connection-layout-sizes.ts";
import { CsvSaveBar } from "#src/components/pages/connection-page/csv-save-bar.tsx";
import {
  copyToClipboard,
  exportRows,
  rowsToInsertStatements,
} from "#src/components/pages/connection-page/export-rows.ts";
import { GroupByHavingControls } from "#src/components/pages/connection-page/group-by-having-controls.tsx";
import {
  isColumnHidden,
  normalizeHiddenColumnList,
  toHiddenColumnKeys,
} from "#src/components/pages/connection-page/hidden-column-list.ts";
import { PendingCellEditsBar } from "#src/components/pages/connection-page/row-editor/pending-cell-edits-bar.tsx";
import {
  PendingCellEditsProvider,
  usePendingCellEdits,
} from "#src/components/pages/connection-page/row-editor/pending-cell-edits-context.tsx";
import { SqlQueryPreview } from "#src/components/pages/connection-page/sql-query-preview.tsx";
import {
  type ConnectionPageState,
  useActiveConnectionUrl,
  useConnectionPageState,
} from "#src/components/pages/connection-page/use-connection-page-state.tsx";
import {
  useZenMode,
  useZenModeActions,
  useZenModeEnabled,
} from "#src/components/pages/connection-page/use-zen-mode.ts";
import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import { useJsEvalFilter } from "#src/hooks/use-js-eval-filter.ts";
import {
  buildCascadeDeletePreview,
  withDependentRowCounts,
} from "#src/lib/cascade-delete-preview.ts";
import {
  buildCommandPaletteCommands,
  COMMAND_PALETTE_IDS,
  parseSwitchConnectionCommandId,
  parseSwitchSchemaCommandId,
  parseSwitchTableCommandId,
} from "#src/lib/command-palette-commands.ts";
import { guardReadOnlyMutation, isReadOnlyConnection } from "#src/lib/connection-security.ts";
import { noteRowMutations } from "#src/lib/csv-unsaved-changes.ts";
import {
  registerCustomSqlRunner,
  runRegisteredCustomSql,
} from "#src/lib/custom-sql-runner-bridge.ts";
import { formatDbError } from "#src/lib/format-db-error.ts";
import { formatSQL } from "#src/lib/format-sql.ts";
import { invalidateRowsQueries, rowMutationMeta } from "#src/lib/invalidate-rows-queries.ts";
import { parsePasteRows } from "#src/lib/paste-rows.ts";
import {
  abortQueryController,
  createQueryAbortController,
  isQueryAbortError,
} from "#src/lib/query-abort-controller.ts";
import { buildDropColumnSql, buildDropTableSql } from "#src/lib/schema-mutate/index.ts";
import {
  getSqlPreviewSplitterDefaultSize,
  isSqlPreviewOpen,
  SQL_PREVIEW_REVEAL_SIZE,
} from "#src/lib/sql-preview-panel.ts";
import { splitSqlStatements } from "#src/lib/sql-statements.ts";
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
  isSelectQuery,
} from "#src/server/introspection/detect-destructive-sql.ts";
import { bulkDeleteRowsServerFn } from "#src/server/introspection/start-fns/bulk-delete-rows.start.ts";
import { countCascadeDependentsServerFn } from "#src/server/introspection/start-fns/count-cascade-dependents.start.ts";
import { executeCustomSqlServerFn } from "#src/server/introspection/start-fns/execute-custom-sql.start.ts";
import { getAllTablesColumnsQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-columns.start.ts";
import { getAllTablesForeignKeysQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-foreign-keys.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { insertRowsServerFn } from "#src/server/introspection/start-fns/insert-rows.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";
import { saveQueryFavoriteServerFn } from "#src/server/query-logger/start-fns/save-query-favorite.start.ts";

import type { DbConnection } from "./connection.types";

import { DataTable } from "../data-table/data-table.tsx";
import { ScrollToColumnButton } from "../data-table/scroll-to-column.button.tsx";
import { useDataTable } from "../data-table/use-data-table.ts";
import { deriveFavoriteLabel } from "../query-logger/derive-favorite-label.ts";
import { QueryLoggerContent } from "../query-logger/query-logger-panel.tsx";
import { ErrorBoundaryCard } from "../shared/error-boundary-card.tsx";
import { Badge } from "../ui/badge.tsx";
import { Button } from "../ui/button.tsx";
import { Input } from "../ui/input.tsx";
import { Stack } from "../ui/layout.tsx";
import { Menu, MenuContent, MenuItem, MenuItemText, MenuTriggerItem } from "../ui/menu.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet.tsx";
import { Spinner } from "../ui/spinner.tsx";
import { toaster } from "../ui/toaster.tsx";
import { ConnectionAiAssistantDrawer } from "./connection-page/ai-assistant.drawer.tsx";
import { CascadeDeleteConfirmDialog } from "./connection-page/cascade-delete-confirm.dialog.tsx";
import { ConnectionCommandPalette } from "./connection-page/command-palette.tsx";
import { ConnectionPageFilters } from "./connection-page/connection-page-filters.tsx";
import { ConnectionPageSidebar } from "./connection-page/connection-page-sidebar.tsx";
import { ConnectionPageStatusBar } from "./connection-page/connection-page-status-bar.tsx";
import { ConnectionPageTabs } from "./connection-page/connection-page-tabs.tsx";
import { ConnectionQuickReferencesDrawer } from "./connection-page/connection-quick-references.drawer.tsx";
import { ConnectionRowJsonViewerDrawer } from "./connection-page/connection-row-json-viewer.drawer.tsx";
import {
  addTabStateAfterCurrent,
  createTabState,
  scrollToTab,
  updateTabState,
  useActiveTabState,
} from "./connection-page/create-tab-state.ts";
import { DestructiveQueryConfirmDialog } from "./connection-page/destructive-query-confirm.dialog.tsx";
import { EmptyTabState } from "./connection-page/empty-tab-state.tsx";
import { ErDiagramView } from "./connection-page/er-diagram-view.tsx";
import { ExplainOutputDrawer } from "./connection-page/explain-output-drawer.tsx";
import { ImportDataSheet, type ImportTask } from "./connection-page/import-data-sheet.tsx";
import {
  IndexFkMutateSheet,
  type IndexFkMutateMode,
} from "./connection-page/index-fk-mutate-sheet.tsx";
import { invalidateSchemaMetadataQueries } from "./connection-page/invalidate-schema-metadata.ts";
import { useJoinedTables } from "./connection-page/join-tables/use-joined-tables.ts";
import { PasteRowsConfirmDialog } from "./connection-page/paste-rows-confirm.dialog.tsx";
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
import { SchemaDiffSheet } from "./connection-page/schema-diff-sheet.tsx";
import { SchemaExplorerDrawer } from "./connection-page/schema-explorer-drawer.tsx";
import {
  SchemaMutateSheet,
  type SchemaMutateSheetState,
} from "./connection-page/schema-mutate-sheet.tsx";
import { StructureTable } from "./connection-page/structure-table.tsx";
import { TabErrorState } from "./connection-page/tab-error-state.tsx";
import { TableIndexesPanel } from "./connection-page/table-indexes-panel.tsx";
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
      <div className="bg-background flex min-h-screen items-center px-4 py-8">
        <div className="bg-card mx-auto w-full max-w-lg rounded-xl border p-6 shadow-sm">
          <p className="text-muted-foreground text-sm font-medium">Connection unavailable</p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">
            This connection no longer exists
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            It may have been renamed or deleted. Choose another saved connection or add a new one.
          </p>
          <Link to="/" className="mt-6 inline-flex">
            <Button>Back to connections</Button>
          </Link>
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
  useZenMode();

  const [showAddConnectionDrawer, setShowAddConnectionDrawer] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [queryLoggerPaletteView, setQueryLoggerPaletteView] = useState<
    "favorites" | "history" | null
  >(null);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const sidebarSize = useActiveTabState((_tab, search) => search.sidebarSize);
  const queryLoggerSize = useActiveTabState((_tab, search) => search.queryLoggerSize);
  // Splitter percentages must be deterministic during SSR. Calculating from the
  // browser viewport caused server/client min-size mismatches and hydration warnings.
  const sidebarMinSize = 20;
  const sidebarMaxSize = 32;

  const search = useActiveTabState((tab) => ({
    schema: tab.schema,
    table: tab.table,
    initialTabMode: tab.initialTabMode,
  }));

  const zenMode = useZenModeEnabled();
  const { toggleZenMode } = useZenModeActions();
  // Workspace state, including pane geometry, is intentionally URL-backed so a
  // shared link restores the recipient's working context.
  const layoutZenMode = useSearch({
    from: "/connections/$connectionName",
    select: (s) => s.zenMode === true,
  });
  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 639px)");
    const updateCompactViewport = () => setIsCompactViewport(compactViewport.matches);

    updateCompactViewport();
    compactViewport.addEventListener("change", updateCompactViewport);
    return () => compactViewport.removeEventListener("change", updateCompactViewport);
  }, []);
  const sidebarSplitterDefaultSize = getSidebarSplitterDefaultSize({
    zenMode: layoutZenMode || isCompactViewport,
    sidebarSize,
    sidebarMinSize,
  });
  const queryLoggerSplitterDefaultSize = getQueryLoggerSplitterDefaultSize({
    zenMode: layoutZenMode,
    queryLoggerSize: queryLoggerSize ?? 0,
  });
  const openQueryLogger = (view: "favorites" | "history") => {
    setQueryLoggerPaletteView(view);
    void navigate({
      search: (prev) => ({ ...prev, queryLoggerSize: 48 }),
    });
  };
  const sidebarPanelMinSize = layoutZenMode || isCompactViewport ? 0 : sidebarMinSize;
  const sidebarPanelMaxSize = isCompactViewport ? 80 : sidebarMaxSize;
  const queryLoggerPanelMinSize = 0;
  const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);

  const schemaListQuery = useQuery({
    ...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
    enabled: !!activeConnectionUrl,
    retry: 1,
  });

  const schemaForTables = search.schema || getDialectDefaultSchema(connection.dialect);

  const tablesListQuery = useQuery({
    ...listAvailableTablesQueryOptions({
      url: activeConnectionUrl,
      schema: schemaForTables,
    }),
    enabled: !!activeConnectionUrl && !!schemaForTables,
    retry: 1,
  });

  const commandPaletteCommands = useMemo(
    () =>
      buildCommandPaletteCommands({
        tables: tablesListQuery.data,
        schemas: schemaListQuery.data,
        connections: connectionList.data.map((c) => ({ name: c.name })),
        currentTable: search.table,
        currentSchema: search.schema,
        currentConnectionName: connection.name,
        zenMode,
      }),
    [
      tablesListQuery.data,
      schemaListQuery.data,
      connectionList.data,
      search.table,
      search.schema,
      connection.name,
      zenMode,
    ],
  );

  const handleCommandPaletteSelect = useCallback(
    (commandId: string) => {
      const switchTable = parseSwitchTableCommandId(commandId);
      if (switchTable) {
        const newTab = createTabState(switchTable.schema, switchTable.table);
        void navigate({
          search: (prev) => ({
            ...prev,
            ...addTabStateAfterCurrent(prev, newTab),
          }),
        }).then(() => scrollToTab(newTab.tabId));
        return;
      }

      const switchSchema = parseSwitchSchemaCommandId(commandId);
      if (switchSchema) {
        void navigate({
          search: (prev) => {
            const updated = updateTabState(prev, {
              schema: switchSchema,
              offset: 0,
              filters: undefined,
            });
            return { ...updated, schema: switchSchema };
          },
        });
        return;
      }

      const switchConnection = parseSwitchConnectionCommandId(commandId);
      if (switchConnection) {
        void navigate({
          to: "/connections/$connectionName",
          params: { connectionName: switchConnection },
        });
        return;
      }

      switch (commandId) {
        case COMMAND_PALETTE_IDS.openCustomSql: {
          const schema = search.schema || getDialectDefaultSchema(connection.dialect);
          const newTab = createTabState(schema, "", {
            initialTabMode: "sql",
            customSql: "",
          });
          void navigate({
            search: (prev) => ({
              ...prev,
              ...addTabStateAfterCurrent(prev, newTab),
            }),
          }).then(() => scrollToTab(newTab.tabId));
          break;
        }
        case COMMAND_PALETTE_IDS.toggleZen:
          toggleZenMode();
          break;
        case COMMAND_PALETTE_IDS.openAi:
          setAiAssistantOpen(true);
          break;
        case COMMAND_PALETTE_IDS.openFavorites:
          setQueryLoggerPaletteView("favorites");
          break;
        case COMMAND_PALETTE_IDS.openHistory:
          setQueryLoggerPaletteView("history");
          break;
        case COMMAND_PALETTE_IDS.explain:
          toaster.create({
            title: "Explain query plan",
            description: "Use Explain in the SQL editor toolbar",
          });
          break;
        case COMMAND_PALETTE_IDS.formatSql:
          toaster.create({
            title: "Format SQL",
            description: "Use Format in the SQL editor toolbar",
          });
          break;
        case COMMAND_PALETTE_IDS.showIndexes:
          void navigate({
            search: (prev) => updateTabState(prev, { viewMode: "structure" }),
          });
          break;
        case COMMAND_PALETTE_IDS.showForeignKeys:
          void navigate({
            search: (prev) => updateTabState(prev, { viewMode: "structure" }),
          });
          break;
        case COMMAND_PALETTE_IDS.openSchemaExplorer:
          void navigate({
            search: (prev) => ({
              ...prev,
              schemaExplorerOpen: true,
            }),
          });
          break;
        default:
          break;
      }
    },
    [navigate, search.schema, connection.dialect, toggleZenMode],
  );

  const openSqlInNewTab = useCallback(
    (sql: string) => {
      const newTab = createTabState(
        search.schema || getDialectDefaultSchema(connection.dialect),
        "",
        {
          initialTabMode: "sql",
          customSql: sql,
          sqlEditorMode: "editor",
        },
      );
      void navigate({
        search: (prev) => ({
          ...prev,
          ...addTabStateAfterCurrent(prev, newTab),
        }),
      }).then(() => scrollToTab(newTab.tabId));
    },
    [navigate, search.schema, connection.dialect],
  );

  return (
    <div className="bg-background flex h-screen flex-col">
      {/* Main Layout */}
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <Splitter.Root
          key={`${getZenLayoutRemountKey(layoutZenMode, "sidebar")}:${isCompactViewport ? "compact" : "wide"}`}
          orientation="horizontal"
          defaultSize={[...sidebarSplitterDefaultSize]}
          panels={[
            {
              id: panels.sidebar,
              collapsible: true,
              collapsedSize: 0,
              minSize: sidebarPanelMinSize,
              maxSize: sidebarPanelMaxSize,
            },
            {
              id: panels.mainContent,
              collapsible: false,
            },
          ]}
          onResizeEnd={(details) => {
            if (layoutZenMode || isCompactViewport) return;
            const size = details.size[0];
            void navigate({
              search: (prev) => ({ ...prev, sidebarSize: size }),
            });
          }}
          onExpand={(details) => {
            if (layoutZenMode || isCompactViewport) return;
            if (details.panelId === panels.sidebar) {
              void navigate({
                search: (prev) => ({ ...prev, sidebarSize: details.size }),
              });
            }
          }}
          onCollapse={(details) => {
            if (layoutZenMode || isCompactViewport) return;
            if (details.panelId === panels.sidebar) {
              void navigate({
                search: (prev) => ({ ...prev, sidebarSize: 0 }),
              });
            }
          }}
          className="flex h-full min-h-0 flex-1"
        >
          {/* Sidebar Panel */}
          <Splitter.Context>
            {(sidebarCtx) => (
              <Splitter.Panel
                id={panels.sidebar}
                data-testid="connection-sidebar"
                data-collapsed={
                  tryFn(() => sidebarCtx.isPanelCollapsed(panels.sidebar)) ? "true" : "false"
                }
                style={
                  tryFn(() => sidebarCtx.isPanelCollapsed(panels.sidebar))
                    ? { minWidth: 0 }
                    : undefined
                }
                className="bg-muted/30 flex h-full shrink-0 flex-col overflow-hidden border-r"
              >
                {/* Sidebar */}
                <ConnectionPageSidebar
                  connection={connection}
                  activeConnectionUrl={activeConnectionUrl}
                  onAddConnection={() => setShowAddConnectionDrawer(true)}
                  onOpenAiAssistant={() => setAiAssistantOpen(true)}
                  onOpenHistory={() => openQueryLogger("history")}
                  onOpenFavorites={() => openQueryLogger("favorites")}
                />
              </Splitter.Panel>
            )}
          </Splitter.Context>

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
                  key={`${getZenLayoutRemountKey(layoutZenMode, "query-logger")}:${queryLoggerSize ?? 0}`}
                  orientation="vertical"
                  defaultSize={[...queryLoggerSplitterDefaultSize]}
                  panels={[
                    {
                      id: panels.rowsContent,
                      collapsible: false,
                    },
                    {
                      id: panels.queryLogger,
                      collapsible: true,
                      collapsedSize: queryLoggerPanelMinSize,
                      minSize: queryLoggerPanelMinSize,
                      maxSize: 50,
                    },
                  ]}
                  onResizeEnd={(details) => {
                    if (layoutZenMode) return;
                    const size = details.size[1];
                    void navigate({
                      search: (prev) => ({ ...prev, queryLoggerSize: size }),
                    });
                  }}
                  onExpand={(details) => {
                    if (layoutZenMode) return;
                    if (details.panelId === panels.queryLogger) {
                      void navigate({
                        search: (prev) => ({ ...prev, queryLoggerSize: details.size }),
                      });
                    }
                  }}
                  onCollapse={(details) => {
                    if (layoutZenMode) return;
                    if (details.panelId === panels.queryLogger) {
                      void navigate({
                        search: (prev) => ({ ...prev, queryLoggerSize: details.size }),
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
                          if (!isCompactViewport) {
                            void navigate({
                              search: (prev) => ({ ...prev, sidebarSize: 0 }),
                            });
                          }
                          return;
                        }

                        sidebarSplitterCtx.expandPanel(
                          panels.sidebar,
                          isCompactViewport ? 60 : undefined,
                        );
                        if (isCompactViewport) return;
                        const size = sidebarSplitterCtx.getPanelSize(panels.sidebar);
                        void navigate({
                          search: (prev) => ({ ...prev, sidebarSize: size }),
                        });
                      }}
                      isSidebarCollapsed={sidebarSplitterCtx.isPanelCollapsed(panels.sidebar)}
                    />
                    {schemaListQuery.isError ? (
                      <TabErrorState activeConnectionUrl={activeConnectionUrl} />
                    ) : search.initialTabMode === "sql" ? (
                      <CustomSqlWorkspace
                        activeConnectionUrl={activeConnectionUrl}
                        connection={connection}
                      />
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
                          layoutZenMode && "hidden",
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
                        data-testid="query-logger-splitter-panel"
                        data-zen-collapsed={layoutZenMode ? "true" : "false"}
                        className={cn(
                          "bg-background flex min-h-0 flex-col overflow-hidden border-t",
                          (layoutZenMode || !queryLoggerSize) && "hidden",
                        )}
                      >
                        <QueryLoggerContent
                          connectionUrl={activeConnectionUrl}
                          connectionId={connection.id}
                          isExpanded={ctx.isPanelExpanded(panels.queryLogger)}
                          onCollapse={() => ctx.collapsePanel(panels.queryLogger)}
                          onExpand={() => ctx.expandPanel(panels.queryLogger, 48)}
                          paletteView={queryLoggerPaletteView}
                          onPaletteViewConsumed={() => setQueryLoggerPaletteView(null)}
                          onOpenQueryInEditor={openSqlInNewTab}
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

      {/* AI assistant (BYOK) */}
      <ConnectionAiAssistantDrawer
        connection={connection}
        activeConnectionUrl={activeConnectionUrl}
        open={aiAssistantOpen}
        onOpenChange={setAiAssistantOpen}
        onGenerateAndRun={(sql) => {
          runRegisteredCustomSql(sql, { revealEditor: true });
        }}
      />

      <ConnectionCommandPalette
        commands={commandPaletteCommands}
        onSelect={handleCommandPaletteSelect}
      />
    </div>
  );
};

const RowsTabContent = (props: { connection: DbConnection; activeConnectionUrl: string }) => {
  const { connection } = props;
  const [rowEditor, setRowEditor] = useState<RowEditorSheetState>(createClosedRowEditorState);
  const [schemaMutate, setSchemaMutate] = useState<SchemaMutateSheetState>({
    open: false,
    mode: "create-table",
    column: null,
  });
  const [importOpen, setImportOpen] = useState(false);
  const [importTask, setImportTask] = useState<ImportTask | null>(null);
  const [schemaDiffOpen, setSchemaDiffOpen] = useState(false);
  const [indexFk, setIndexFk] = useState<{ open: boolean; mode: IndexFkMutateMode }>({
    open: false,
    mode: "create-index",
  });
  const [pendingDdl, setPendingDdl] = useState<{
    sql: string;
    summary: string;
    afterSuccess?: () => void;
  } | null>(null);
  const queryClient = useQueryClient();
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

  const pendingDdlRef = useRef(pendingDdl);
  pendingDdlRef.current = pendingDdl;

  const ddlMutation = useMutation({
    mutationFn: async (sql: string) => {
      const readOnlyError = guardReadOnlyMutation(props.activeConnectionUrl);
      if (readOnlyError) throw new Error(readOnlyError);
      return executeCustomSqlServerFn({
        data: { url: props.activeConnectionUrl, sql },
      });
    },
    meta: { noInvalidate: true },
    onSuccess: () => {
      const pending = pendingDdlRef.current;
      invalidateSchemaMetadataQueries(queryClient, {
        url: props.activeConnectionUrl,
        schema: search.schema || getDialectDefaultSchema(connection.dialect),
      });
      toaster.create({ title: "Schema change applied" });
      pending?.afterSuccess?.();
      setPendingDdl(null);
    },
    onError: (error) => {
      toaster.create({
        title: "Schema change failed",
        description: formatDbError(error),
        type: "error",
      });
      setPendingDdl(null);
    },
  });

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

  const schemaMutateDialect =
    connection.dialect === DatabaseDialect.Postgres
      ? "postgres"
      : connection.dialect === DatabaseDialect.LibSQL
        ? "libsql"
        : "sqlite";
  // SQLite/libSQL alter-column is backed by a rebuild (buildSqliteRebuildAlterSql), so it's
  // exposed for every dialect; the sheet itself handles missing-column-list edge cases.
  const canAlterColumn = true;

  const openSchemaMutate = (mode: SchemaMutateSheetState["mode"], column?: TableColumnMetadata) => {
    setSchemaMutate({
      open: true,
      mode,
      column: column
        ? {
            name: column.name,
            dataType: column.dataType,
            nullable: column.nullable,
            primaryKey: column.primaryKey,
            unique: column.unique,
            defaultValue: column.defaultValue,
          }
        : null,
    });
  };

  const runDestructiveDdl = (sql: string, afterSuccess?: () => void) => {
    setPendingDdl({
      sql,
      summary: getDestructiveQuerySummary(sql),
      afterSuccess,
    });
  };

  const onDropTable = () => {
    if (!search.schema || !search.table) return;
    const droppedTable = search.table;
    const sql = buildDropTableSql({
      dialect: schemaMutateDialect,
      schema: search.schema,
      table: droppedTable,
    });
    runDestructiveDdl(sql, () => {
      // Tab search requires a table; fall back to another known table name from the list query
      // or keep structure view on a placeholder the sidebar will replace when user clicks.
      void navigate({
        search: (prev) => {
          const tabs = prev.tabs ?? [];
          const fallback = tabs.map((t) => t.table).find((t) => t && t !== droppedTable) ?? "users";
          return updateTabState(prev, {
            table: fallback,
            viewMode: "structure",
          });
        },
      });
    });
  };

  const onDropColumn = (column: TableColumnMetadata) => {
    if (!search.schema || !search.table) return;
    const sql = buildDropColumnSql({
      dialect: schemaMutateDialect,
      schema: search.schema,
      table: search.table,
      column: column.name,
    });
    runDestructiveDdl(sql);
  };

  const isUsingCustomSql = Boolean(search.customSql?.trim()) || Boolean(search.customSqlId);

  const executeCustomSql = useExecuteCustomSql({
    activeConnectionUrl: pageState.activeConnectionUrl,
  });
  const isCustomSqlMode = Boolean(
    isUsingCustomSql ||
    executeCustomSql.mutation.isPending ||
    executeCustomSql.storedQuery.isLoading,
  );
  const zenMode = useZenModeEnabled();
  const { toggleZenMode } = useZenModeActions();

  const columnQueries = useJoinedTables({
    url: pageState.activeConnectionUrl,
    joins: pageState.joins,
  });

  const handleExportAll = async (
    format: "json" | "csv" | "tsv" | "sql" | "copy-json" | "copy-csv" | "copy-tsv" | "copy-insert",
  ) => {
    if (!search.schema || !search.table || !search.limit) return;

    const { queryClient } = await import("#src/query-client.ts");

    const visibleColumns = pageState.rowsDataTable.getVisibleLeafColumns().map((c) => c.id);
    const hiddenColumnList = normalizeHiddenColumnList(search.hiddenColumnList, search.table || "");
    const columnVisibilityMode = search.columnVisibilityMode ?? "client";

    let selectedColumns: string[] | undefined;
    let excludedColumns: string[] | undefined;
    const columnNameList = pageState.columnNameList;
    if (columnVisibilityMode === "server" && hiddenColumnList.length) {
      const hiddenKeys = toHiddenColumnKeys(hiddenColumnList);
      const visibleCount = columnNameList.length - hiddenKeys.length;
      if (visibleCount <= hiddenKeys.length) {
        selectedColumns = columnNameList.filter((col) => !isColumnHidden(hiddenColumnList, col));
      } else {
        excludedColumns = hiddenKeys;
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
      const exportFormat = format as "json" | "csv" | "tsv" | "sql";
      exportRows(allRows, columns, {
        format: exportFormat,
        filename: `${tableName}-export.${exportFormat}`,
        tableName,
        schemaName,
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
      {!isCustomSqlMode && !zenMode && (
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
            filterColumnMetadata={pageState.columnMetadata
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
            filterControls={
              <GroupByHavingControls
                availableColumns={pageState.columnNameList}
                groupBy={pageState.groupBy}
                onGroupByChange={(groupBy) => {
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, {
                        groupBy: groupBy.length ? groupBy : undefined,
                        ...(groupBy.length ? {} : { having: undefined }),
                        offset: 0,
                      }),
                  });
                  if (!groupBy.length) {
                    pageState.havingBuilder.clearConditions();
                  }
                }}
                havingBuilder={pageState.havingBuilder}
                isLoading={pageState.rowsQuery.isLoading}
                presentation="popover"
              />
            }
            onAddRow={
              search.table
                ? () => setRowEditor({ open: true, mode: "insert", row: null })
                : undefined
            }
            onCreateTable={() => openSchemaMutate("create-table")}
            onAddColumn={search.table ? () => openSchemaMutate("add-column") : undefined}
            onDropTable={search.table ? onDropTable : undefined}
            onImportData={search.table ? () => setImportOpen(true) : undefined}
            onExportTable={handleExportAll}
            onSchemaDiff={() => setSchemaDiffOpen(true)}
            onCreateIndex={
              search.table ? () => setIndexFk({ open: true, mode: "create-index" }) : undefined
            }
            isReadOnly={isReadOnlyConnection(props.activeConnectionUrl)}
          />
        </>
      )}

      {/* Content */}
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {search.viewMode === "er" ? (
          <ErDiagramView
            connectionUrl={pageState.activeConnectionUrl}
            schema={search.schema || getDialectDefaultSchema(connection.dialect)}
            onOpenTable={(table) => {
              void navigate({
                search: (prev) =>
                  updateTabState(prev, {
                    table,
                    viewMode: "rows",
                  }),
              });
            }}
          />
        ) : search.viewMode === "structure" ? (
          <div className="flex-1 overflow-auto p-2 pt-0">
            <StructureTable
              columnMetadata={pageState.columnMetadata}
              isLoading={pageState.isColumnMetadataLoading}
              tableSize={search.tableSize}
              filters={structureFilters}
              canAlterColumn={canAlterColumn}
              onEditColumn={
                search.table ? (col) => openSchemaMutate("alter-column", col) : undefined
              }
              onDropColumn={search.table ? onDropColumn : undefined}
            />
            {search.schema && search.table ? (
              <TableIndexesPanel
                connectionUrl={props.activeConnectionUrl}
                schema={search.schema}
                table={search.table}
              />
            ) : null}
          </div>
        ) : (
          <Splitter.Root
            key={`${search.tabId}-${isSqlPreviewOpen(search.sqlPreviewSize) ? "sql-open" : "sql-closed"}`}
            orientation="vertical"
            className="flex h-full flex-1 flex-col overflow-hidden"
            defaultSize={getSqlPreviewSplitterDefaultSize(search.sqlPreviewSize)}
            panels={[
              {
                id: panels.sqlPreview,
                collapsible: true,
                collapsedSize: 0,
                // 0 so the panel can fully collapse; empty ~200px gaps were from minSize
                // fighting collapsedSize while Monaco was hidden.
                minSize: 0,
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
                    tryFn(() => ctx.isPanelCollapsed(panels.sqlPreview)) ? "h-2" : "h-3",
                    "bg-border hover:bg-primary/50 flex cursor-row-resize items-center justify-center transition-colors",
                  )}
                  title="Drag to resize. Double-click to collapse or expand."
                  onDoubleClick={() =>
                    ctx.isPanelExpanded(panels.sqlPreview)
                      ? ctx.collapsePanel(panels.sqlPreview)
                      : ctx.expandPanel(panels.sqlPreview)
                  }
                >
                  <GripHorizontal className="text-muted-foreground h-3.5 w-3.5" />
                </Splitter.ResizeTrigger>
              )}
            </Splitter.Context>

            <Splitter.Panel id={panels.rowsContent} className="flex flex-col overflow-hidden">
              {isCustomSqlMode ? (
                <CustomSqlTabContent executeCustomSql={executeCustomSql} />
              ) : pageState.rowsQuery.isPending && !pageState.rowsQuery.data ? (
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
              ) : pageState.rowsQuery.isError && !pageState.rowsQuery.data ? (
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
                  dialect={connection.dialect}
                  onEditRow={onEditRow}
                  onDuplicateRow={onDuplicateRow}
                />
              )}
              {/* Status Bar */}
              <div className="shrink-0 border-t">
                <ConnectionPageStatusBar
                  table={pageState.rowsDataTable}
                  hasUuid={pageState.hasUuid}
                  isLoading={
                    pageState.rowsQuery.isFetching &&
                    (pageState.rowsQuery.isPending || !pageState.rowsQuery.data)
                  }
                  isFetching={pageState.rowsQuery.isFetching}
                  refetch={pageState.rowsQuery.refetch}
                  timeTaken={pageState.queryResponse.timeTaken}
                  ranAt={pageState.queryResponse.ranAt}
                  totalRowCount={pageState.queryResponse.rowCount}
                  rowsColumnsCount={pageState.rowsColumns.length - 3}
                  isCustomSql={isCustomSqlMode}
                  schema={search.schema}
                  tableName={search.table}
                  columns={pageState.rowsDataTable.getVisibleLeafColumns().map((col) => col.id)}
                  zenMode={zenMode}
                  onToggleZenMode={toggleZenMode}
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

      {search.schema && (
        <SchemaMutateSheet
          open={schemaMutate.open}
          mode={schemaMutate.mode}
          column={schemaMutate.column}
          connectionUrl={pageState.activeConnectionUrl}
          dialect={connection.dialect}
          schema={search.schema}
          table={search.table}
          allColumns={pageState.columnMetadata.map((col) => ({
            name: col.name,
            dataType: col.dataType,
            nullable: col.nullable,
            primaryKey: col.primaryKey,
            unique: col.unique,
            defaultValue: col.defaultValue,
          }))}
          onOpenChange={(open) => setSchemaMutate((prev) => ({ ...prev, open }))}
          onSuccess={({ mode, table }) => {
            if (mode === "create-table" && table) {
              void navigate({
                search: (prev) =>
                  updateTabState(prev, {
                    table,
                    viewMode: "structure",
                  }),
              });
            }
          }}
        />
      )}

      {search.schema && search.table ? (
        <ImportDataSheet
          open={importOpen}
          onOpenChange={setImportOpen}
          connectionUrl={pageState.activeConnectionUrl}
          dialect={connection.dialect}
          schema={search.schema}
          table={search.table}
          onSuccess={() => invalidateRowsQueries(queryClient)}
          onTaskChange={setImportTask}
        />
      ) : null}

      {importTask ? (
        <div
          className="bg-popover text-popover-foreground fixed right-4 bottom-4 z-200 flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-lg border p-3 shadow-lg"
          data-testid="import-task-tray"
          role="status"
        >
          {importTask.status === "running" ? (
            <Loader2 className="text-primary mt-0.5 size-4 shrink-0 animate-spin" />
          ) : importTask.status === "success" ? (
            <CircleCheck className="text-success mt-0.5 size-4 shrink-0" />
          ) : (
            <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {importTask.status === "running"
                ? "Import running"
                : importTask.status === "success"
                  ? "Import complete"
                  : "Import failed"}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {importTask.status === "error"
                ? importTask.error
                : importTask.rows === null
                  ? `${importTask.fileName} · ${importTask.table}`
                  : `${importTask.fileName} · ${importTask.rows} rows into ${importTask.table}`}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => setImportTask(null)}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {search.schema && search.table ? (
        <IndexFkMutateSheet
          open={indexFk.open}
          mode={indexFk.mode}
          onOpenChange={(open) => setIndexFk((prev) => ({ ...prev, open }))}
          connectionUrl={pageState.activeConnectionUrl}
          dialect={connection.dialect}
          schema={search.schema}
          table={search.table}
          columnSuggestions={pageState.columnMetadata.map((c) => c.name)}
        />
      ) : null}

      {search.schema ? (
        <SchemaDiffSheetConnected
          open={schemaDiffOpen}
          onOpenChange={setSchemaDiffOpen}
          connectionUrl={pageState.activeConnectionUrl}
          dialect={connection.dialect}
          schema={search.schema}
        />
      ) : null}

      <DestructiveQueryConfirmDialog
        isOpen={!!pendingDdl}
        queryType={pendingDdl?.summary ?? "Execute a destructive operation"}
        isLoading={ddlMutation.isPending}
        onCancel={() => setPendingDdl(null)}
        onConfirm={() => {
          if (pendingDdl?.sql) ddlMutation.mutate(pendingDdl.sql);
        }}
      />
      {executeCustomSql.DestructiveDialog}
    </>
  );
};

function SchemaDiffSheetConnected(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionUrl: string;
  dialect: DatabaseDialect;
  schema: string;
}) {
  const structuresQuery = useQuery({
    ...getAllTablesColumnsQueryOptions({
      url: props.connectionUrl,
      schema: props.schema,
    }),
    enabled: props.open,
  });

  const currentStructures: TableStructure[] = useMemo(
    () =>
      (structuresQuery.data ?? []).map((t) => ({
        schema: props.schema,
        table: t.table,
        columns: t.columns.map((c) => ({
          name: c.name,
          dataType: c.dataType,
          nullable: c.nullable,
          defaultValue: c.defaultValue,
          primaryKey: c.primaryKey,
        })),
      })),
    [props.schema, structuresQuery.data],
  );

  return (
    <SchemaDiffSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      connectionUrl={props.connectionUrl}
      dialect={props.dialect}
      schema={props.schema}
      currentStructures={currentStructures}
    />
  );
}

const RowsTableSqlEditor = (
  props: Pick<ConnectionPageState, "activeConnectionUrl" | "sqlQueryAsText"> & {
    connection: DbConnection;
    isCollapsed?: boolean;
    onExpand: () => void;
    onCollapse: () => void;
    onRunQuery: (editorValue?: string) => void;
    onCancelQuery: () => void;
    isLoading?: boolean;
    allowEmptySql?: boolean;
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

  const revealSqlInEditor = (sql: string) => {
    setDraftSql(sql);
    props.onExpand();
    void navigate({
      search: (prev) =>
        updateTabState(prev, {
          customSql: sql,
          customSqlId: undefined,
          sqlEditorMode: "editor",
          sqlPreviewSize: SQL_PREVIEW_REVEAL_SIZE,
        }),
    });
  };

  useEffect(() => {
    return registerCustomSqlRunner((sql, options) => {
      if (options?.revealEditor) {
        revealSqlInEditor(sql);
      }
      props.onRunQuery(sql);
    });
    // Intentionally re-bind when run handler / expand identity changes.
  }, [props.onRunQuery, props.onExpand]);

  const saveFavoriteMutation = useMutation({
    mutationFn: (sql: string) =>
      saveQueryFavoriteServerFn({
        data: {
          connectionId: props.connection.id,
          label: deriveFavoriteLabel(sql),
          sql,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["app", "queryFavorites"],
      });
      toaster.create({
        title: "Query saved to favorites",
      });
    },
    onError: (error) => {
      toaster.create({
        title: "Failed to save favorite",
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  // Seed draft when AI / URL provides customSql while still on the table editor.
  useEffect(() => {
    if (search.customSql && draftSql == null) {
      setDraftSql(search.customSql);
    }
  }, [search.customSql, draftSql]);

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
        allowEmptySql={props.allowEmptySql}
        isCollapsed={props.isCollapsed}
        isLoading={props.isLoading}
        onToggleCollapsed={() => {
          if (props.isCollapsed) {
            props.onExpand();
            void navigate({
              search: (prev) =>
                updateTabState(prev, {
                  sqlPreviewSize: SQL_PREVIEW_REVEAL_SIZE,
                }),
            });
          } else {
            props.onCollapse();
            void navigate({
              search: (prev) =>
                updateTabState(prev, {
                  sqlPreviewSize: 0,
                }),
            });
          }
        }}
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
        onExpandPanel={() => {
          if (props.isCollapsed) props.onExpand();
          navigate({
            search: (prev) =>
              updateTabState(prev, {
                sqlPreviewSize: 70,
              }),
          });
        }}
        onSaveFavorite={(sql) => saveFavoriteMutation.mutate(sql)}
        isSavingFavorite={saveFavoriteMutation.isPending}
        isFullscreen={isEditorFullscreen}
        className="h-full text-sm"
        warning={
          draftSql && (
            <div className="ml-auto flex items-center justify-between gap-3 px-4">
              <p className="text-xs font-medium text-amber-900">Run custom query with Ctrl+Enter</p>
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
        dialect={props.connection.dialect === DatabaseDialect.Postgres ? "postgres" : "sqlite"}
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
    dialect: DatabaseDialect;
    onEditRow?: (row: Record<string, unknown>) => void;
    onDuplicateRow?: (row: Record<string, unknown>) => void;
  },
) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(null);
  const [pasteConfirm, setPasteConfirm] = useState<{
    rows: Array<Record<string, string | number | boolean | null | undefined>>;
    table: string;
    schema: string;
  } | null>(null);
  const [pastePending, setPastePending] = useState(false);
  const relationshipPanelSize = 7;

  const search = useActiveTabState((tab, _search) => {
    return {
      schema: tab.schema,
      table: tab.table,
      tableSize: tab.tableSize,
      relationshipRowId: tab.relationshipRowId,
      nullsOrder: tab.nullsOrder,
      clientFilter: tab.clientFilter,
      clientFilterApproved: tab.clientFilterApproved,
      filterConditions: tab.filters?.conditions ?? [],
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
  const [isJsFilterOpen, setIsJsFilterOpen] = useState(
    Boolean(search.clientFilter || search.clientFilterApproved),
  );

  return (
    <PendingCellEditsProvider>
      <div className="relative flex h-full flex-1 flex-col">
        <BulkActions
          activeConnectionUrl={props.activeConnectionUrl}
          rowsDataTable={props.rowsDataTable}
          columnMetadata={props.columnMetadata}
          onEditRow={props.onEditRow}
          onDuplicateRow={props.onDuplicateRow}
        />

        <Portal
          container={
            typeof window === "undefined"
              ? undefined
              : { current: document.querySelector("#connection-page-filters-top-row") }
          }
        >
          <Popover
            open={isJsFilterOpen}
            onOpenChange={(details) => setIsJsFilterOpen(details.open)}
          >
            <PopoverTrigger asChild>
              <Button
                variant={approvedFilter ? "secondary" : "outline"}
                size="sm"
                className="h-8 gap-1.5"
                aria-label="Open JavaScript row filter"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">
                  {approvedFilter ? "JS filter active" : "Advanced filter"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="z-200 w-[min(32rem,calc(100vw-2rem))] p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">JavaScript row filter</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Runs locally against the rows currently loaded in this view.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="r.name.includes('test')"
                    value={search.clientFilter || ""}
                    onChange={(e) => handleJsFilterChange(e.target.value)}
                    className="h-8 flex-1 font-mono text-xs"
                    aria-label="JavaScript row filter expression"
                  />
                  {hasPendingFilter && (
                    <Button
                      onClick={handleApproveFilter}
                      size="sm"
                      variant="default"
                      className="h-8"
                    >
                      Apply
                    </Button>
                  )}
                </div>
                {jsFilterResult.error && (
                  <p className="text-xs text-red-500">{jsFilterResult.error}</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </Portal>

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
            data-testid="rows-table-panel"
            onPaste={(event) => {
              const target = event.target as HTMLElement | null;
              if (target?.closest("input, textarea, [contenteditable=true]")) return;
              const text = event.clipboardData.getData("text/plain");
              if (!text.trim() || !search.schema || !search.table) return;
              event.preventDefault();
              const known = props.columnMetadata.map((c) => c.name);
              const parsed = parsePasteRows(text, known);
              if (parsed.rows.length === 0) return;
              setPasteConfirm({
                rows: parsed.rows,
                table: search.table,
                schema: search.schema,
              });
            }}
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
              <RowsPendingEditsBar connectionUrl={props.activeConnectionUrl} />
              <CsvSaveBar connectionUrl={props.activeConnectionUrl} dialect={props.dialect} />
              <DataTable
                // virtualized={search.limit > 100}
                enableRowVirtualization
                enableColumnOrdering
                enableFind
                table={props.rowsDataTable}
                getTableContainer={setTableContainer}
                isLoading={
                  (props.rowsQuery.isPending && !props.rowsQuery.data) ||
                  (props.isColumnMetadataLoading && !props.rowsQuery.data)
                }
                size={search.tableSize}
                getColumnHeaderFilter={(columnId) =>
                  getColumnHeaderFilter(search.filterConditions, columnId)
                }
                onColumnHeaderFilterChange={(columnId, filter) => {
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, (tab) => ({
                        filtersOpened: true,
                        filters: {
                          conditions: upsertColumnHeaderFilter(tab.filters?.conditions ?? [], {
                            column: columnId,
                            operator: filter?.operator ?? "contains",
                            value: filter?.value ?? "",
                          }),
                          logicalOperator: tab.filters?.logicalOperator ?? "and",
                        },
                      })),
                  });
                }}
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
                emptyState={
                  <div className="flex min-h-40 flex-col items-center justify-center gap-2 py-8 text-center">
                    <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                      <SearchX className="text-muted-foreground h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">No matching rows</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {search.filterConditions.length > 0 || search.clientFilterApproved
                          ? "Try changing or clearing your filters."
                          : "This table has no rows yet."}
                      </p>
                    </div>
                    {(search.filterConditions.length > 0 || search.clientFilterApproved) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigate({
                            search: (prev) =>
                              updateTabState(prev, {
                                filters: { conditions: [], logicalOperator: "and" },
                                clientFilter: undefined,
                                clientFilterApproved: undefined,
                              }),
                          });
                        }}
                        className="mt-1 h-8 gap-1.5 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Clear filters
                      </Button>
                    )}
                  </div>
                }
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
      <PasteRowsConfirmDialog
        open={pasteConfirm != null}
        onOpenChange={(open) => {
          if (!open) setPasteConfirm(null);
        }}
        table={pasteConfirm?.table ?? ""}
        rowCount={pasteConfirm?.rows.length ?? 0}
        isPending={pastePending}
        onConfirm={() => {
          if (!pasteConfirm) return;
          void (async () => {
            const readOnlyError = guardReadOnlyMutation(props.activeConnectionUrl);
            if (readOnlyError) {
              toaster.create({
                title: "Read-only connection",
                description: readOnlyError,
                type: "error",
              });
              return;
            }
            setPastePending(true);
            try {
              const result = await insertRowsServerFn({
                data: {
                  url: props.activeConnectionUrl,
                  schema: pasteConfirm.schema,
                  table: pasteConfirm.table,
                  rows: pasteConfirm.rows,
                },
              });
              invalidateRowsQueries(queryClient);
              noteRowMutations(props.activeConnectionUrl, pasteConfirm.table, result.inserted);
              setPasteConfirm(null);
              toaster.create({
                title: "Pasted rows",
                description: `Inserted ${result.inserted} row(s)`,
                type: "success",
              });
            } catch (error) {
              toaster.create({
                title: "Paste failed",
                description: formatDbError(error),
                type: "error",
              });
            } finally {
              setPastePending(false);
            }
          })();
        }}
      />
    </PendingCellEditsProvider>
  );
};

function RowsPendingEditsBar({ connectionUrl }: { connectionUrl: string }) {
  const pending = usePendingCellEdits();
  if (!pending) return null;
  return (
    <PendingCellEditsBar
      connectionUrl={connectionUrl}
      edits={pending.edits}
      onChange={pending.setEdits}
    />
  );
}

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

  const fkEdgesQuery = useQuery({
    ...getAllTablesForeignKeysQueryOptions({
      url: props.activeConnectionUrl,
      schema: search.schema || "",
    }),
    enabled: showDeleteConfirm && Boolean(search.schema),
  });

  const cascadePreview = useMemo(() => {
    if (!search.table) return null;
    const edges = (fkEdgesQuery.data ?? []).map((e) => ({
      fromTable: e.fromTable,
      fromCols: e.fromColumns,
      toTable: e.toTable,
      toCols: e.toColumns,
      onDelete: (e.onDelete || "NO ACTION") as
        | "CASCADE"
        | "SET NULL"
        | "SET DEFAULT"
        | "RESTRICT"
        | "NO ACTION",
    }));
    return buildCascadeDeletePreview({
      edges,
      rootTable: search.table,
      selectedRows: selectedRows.map((r) => r.original as Record<string, unknown>),
    });
  }, [fkEdgesQuery.data, search.table, selectedRows]);

  const cascadeCountsQuery = useQuery({
    queryKey: [
      "cascade-dependent-counts",
      props.activeConnectionUrl,
      search.schema,
      search.table,
      cascadePreview?.affected.map((a) => a.table).join(","),
      selectedRows.map((r) => r.id).join(","),
    ],
    enabled:
      showDeleteConfirm &&
      Boolean(
        search.schema && search.table && cascadePreview && cascadePreview.affected.length > 0,
      ),
    queryFn: async () => {
      if (!cascadePreview || !search.table || !search.schema) return {};
      const affected = [...cascadePreview.affected].sort((a, b) => a.depth - b.depth);
      if (affected.length === 0) return {};

      // Columns needed when seeding a cascaded table for deeper hops.
      const seedColsByTable = new Map<string, Set<string>>();
      for (const item of affected) {
        const set = seedColsByTable.get(item.viaTable) ?? new Set<string>();
        for (const col of item.edge.toCols) set.add(col);
        seedColsByTable.set(item.viaTable, set);
      }

      return countCascadeDependentsServerFn({
        data: {
          url: props.activeConnectionUrl,
          schema: search.schema,
          rootTable: search.table,
          rootRows: selectedRows.map((r) => {
            const original = r.original as Record<string, unknown>;
            const row: Record<string, string | number | boolean | null | undefined> = {};
            for (const [key, value] of Object.entries(original)) {
              if (
                value === null ||
                value === undefined ||
                typeof value === "string" ||
                typeof value === "number" ||
                typeof value === "boolean"
              ) {
                row[key] = value;
              } else {
                row[key] = String(value);
              }
            }
            return row;
          }),
          edges: affected.map((a) => ({
            viaTable: a.viaTable,
            childTable: a.table,
            childColumns: [...a.edge.fromCols],
            parentColumns: [...a.edge.toCols],
            seedChildren: a.action === "cascade-delete",
            seedColumns: Array.from(seedColsByTable.get(a.table) ?? []),
          })),
        },
      });
    },
  });

  const cascadePreviewWithCounts = useMemo(() => {
    if (!cascadePreview) return null;
    if (!cascadeCountsQuery.data) return cascadePreview;
    return withDependentRowCounts(cascadePreview, cascadeCountsQuery.data);
  }, [cascadePreview, cascadeCountsQuery.data]);

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
      const readOnlyError = guardReadOnlyMutation(props.activeConnectionUrl);
      if (readOnlyError) throw new Error(readOnlyError);
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
      if (search.table) noteRowMutations(props.activeConnectionUrl, search.table, deletedCount);
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

  const handleExportSql = () => {
    const rows = selectedRows.map((row) => row.original as Record<string, unknown>);
    const columns = props.rowsDataTable.getVisibleLeafColumns().map((col) => col.id);

    exportRows(rows, columns, {
      format: "sql",
      filename: `${search.table}-export.sql`,
      tableName: search.table,
      schemaName: search.schema,
    });

    toaster.create({
      title: "Success",
      description: `Exported ${rows.length} row${rows.length !== 1 ? "s" : ""} as INSERT statements`,
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
        onExportSql={handleExportSql}
        onCopyJson={handleCopyJson}
        onCopyCsv={handleCopyCsv}
        onCopyInsert={handleCopyInsert}
        onViewJson={handleViewJson}
        onLogRows={handleLogRows}
        onExpandRelationships={selectedRowsCount === 1 ? handleExpandRelationships : undefined}
        isLoading={deleteMutation.isPending}
      />

      <CascadeDeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        preview={cascadePreviewWithCounts}
        onConfirm={() => deleteMutation.mutate()}
        isPending={
          deleteMutation.isPending || fkEdgesQuery.isLoading || cascadeCountsQuery.isFetching
        }
      />
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

const CustomSqlWorkspace = (props: { activeConnectionUrl: string; connection: DbConnection }) => {
  const executeCustomSql = useExecuteCustomSql({ activeConnectionUrl: props.activeConnectionUrl });
  const tab = useActiveTabState((activeTab) => ({
    schema: activeTab.schema,
  }));
  const isReadOnly = isReadOnlyConnection(props.activeConnectionUrl);

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      data-testid="custom-sql-workspace"
    >
      <div className="bg-card flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Connection workspace
          </p>
          <h2 className="text-foreground mt-1 text-base font-semibold">Custom SQL</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge colorPalette="muted" variant="outline" size="2xs">
              {props.connection.name}
            </Badge>
            <Badge colorPalette="muted" variant="outline" size="2xs">
              {props.connection.dialect}
            </Badge>
            {tab.schema ? (
              <Badge colorPalette="muted" variant="outline" size="2xs">
                {tab.schema}
              </Badge>
            ) : null}
            <Badge colorPalette={isReadOnly ? "success" : "warning"} variant="outline" size="2xs">
              {isReadOnly ? "Read-only: writes blocked" : "Writes enabled"}
            </Badge>
          </div>
        </div>
        <div className="text-muted-foreground flex shrink-0 flex-col items-end gap-1 text-xs">
          <kbd className="bg-muted rounded border px-2 py-1 font-mono">Ctrl+Enter</kbd>
          <span>Run selected SQL</span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-64 shrink-0 border-b">
          <RowsTableSqlEditor
            connection={props.connection}
            isCollapsed={false}
            onExpand={() => undefined}
            onCollapse={() => undefined}
            activeConnectionUrl={props.activeConnectionUrl}
            sqlQueryAsText=""
            onRunQuery={executeCustomSql.onRunQuery}
            onCancelQuery={executeCustomSql.onCancel}
            isLoading={executeCustomSql.mutation.isPending}
            allowEmptySql
          />
        </div>
        <CustomSqlTabContent executeCustomSql={executeCustomSql} />
      </div>
      {executeCustomSql.DestructiveDialog}
    </div>
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const [resultSets, setResultSets] = useState<
    Array<{
      sql: string;
      rows: Record<string, unknown>[];
      columns: string[];
      rowCount: number;
      rowsAffected: number | undefined;
      timeTaken: number;
      ranAt: number;
    }>
  >([]);
  const [activeResultIndex, setActiveResultIndex] = useState(0);

  const executeCustomSqlMutation = useMutation({
    mutationFn: async (variables: Parameters<typeof executeAndStoreCustomSqlServerFn>[0]) => {
      const controller = createQueryAbortController(abortControllerRef.current);
      abortControllerRef.current = controller;
      try {
        return await executeAndStoreCustomSqlServerFn({
          ...variables,
          signal: controller.signal,
        });
      } catch (error) {
        // Cancel aborts the client fetch; don't surface that as a query failure.
        if (controller.signal.aborted || isQueryAbortError(error)) {
          throw Object.assign(new Error("Query cancelled"), { name: "AbortError" });
        }
        throw error;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
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

    const statements = splitSqlStatements(sqlToRun);
    const runSingle = (sql: string) => {
      const readOnlyError = guardReadOnlyMutation(props.activeConnectionUrl, {
        isSelect: isSelectQuery(sql),
      });
      if (readOnlyError) {
        toaster.create({
          title: "Read-only connection",
          description: readOnlyError,
          type: "error",
        });
        return;
      }

      const previousId = search.customSqlId;

      if (isDestructiveQuery(sql)) {
        setPendingQueryExecution(() => () => {
          executeCustomSqlMutation.mutate({
            data: {
              url: props.activeConnectionUrl,
              sql,
              schemaName: search.schema || undefined,
              tableName: search.table || undefined,
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
          sql,
          schemaName: search.schema || undefined,
          tableName: search.table || undefined,
          previousId,
        },
      });
    };

    if (statements.length <= 1) {
      setResultSets([]);
      setActiveResultIndex(0);
      runSingle(sqlToRun);
      return;
    }

    // Multi-statement: execute each sequentially and keep all result sets.
    void (async () => {
      const collected: typeof resultSets = [];
      for (const statement of statements) {
        const readOnlyError = guardReadOnlyMutation(props.activeConnectionUrl, {
          isSelect: isSelectQuery(statement.sql),
        });
        if (readOnlyError) {
          toaster.create({
            title: "Read-only connection",
            description: readOnlyError,
            type: "error",
          });
          return;
        }
        try {
          const result = await executeCustomSqlServerFn({
            data: { url: props.activeConnectionUrl, sql: statement.sql },
          });
          collected.push({
            sql: statement.sql,
            rows: (result.rows ?? []) as Record<string, unknown>[],
            columns: result.columns ?? [],
            rowCount: result.rowCount ?? 0,
            rowsAffected: result.rowsAffected,
            timeTaken: result.timeTaken ?? 0,
            ranAt: result.ranAt ?? Date.now(),
          });
        } catch (error) {
          toaster.create({
            title: "Statement failed",
            description: formatDbError(error),
            type: "error",
          });
          break;
        }
      }
      setResultSets(collected);
      setActiveResultIndex(0);
      // Also persist the full script as a custom SQL execution for history.
      if (collected.length > 0) {
        runSingle(sqlToRun);
      }
    })();
  };

  const handleReExecuteStored = () => {
    const sql = storedData?.sql;
    if (!sql) return;

    const readOnlyError = guardReadOnlyMutation(props.activeConnectionUrl, {
      isSelect: isSelectQuery(sql),
    });
    if (readOnlyError) {
      toaster.create({ title: "Read-only connection", description: readOnlyError, type: "error" });
      return;
    }

    // Re-executing same query, no previousId needed (it's the same query)
    executeCustomSqlMutation.mutate({
      data: {
        url: props.activeConnectionUrl,
        sql,
        schemaName: search.schema || undefined,
        tableName: search.table || undefined,
      },
    });
  };

  return {
    onRunQuery,
    onRerunStoredQuery: handleReExecuteStored,
    onCancel: () => {
      abortQueryController(abortControllerRef.current);
      abortControllerRef.current = null;
      // Reset after abort so a late AbortError does not stick the mutation in error.
      executeCustomSqlMutation.reset();
    },
    output,
    resultSets,
    activeResultIndex,
    setActiveResultIndex,
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

  const multi = executeCustomSql.resultSets.length > 1;
  const activeSet = multi ? executeCustomSql.resultSets[executeCustomSql.activeResultIndex] : null;
  const outputRows = activeSet?.rows ?? executeCustomSql.output?.rows ?? [];
  const outputColumns = activeSet?.columns ?? executeCustomSql.output?.columns ?? [];

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
  if (outputRows.length > 0 || executeCustomSql.resultSets.length > 0) {
    return (
      <div className="relative flex flex-1 flex-col overflow-auto">
        {executeCustomSql.resultSets.length > 1 ? (
          <div className="flex shrink-0 gap-1 border-b px-2 py-1" data-testid="sql-result-sets">
            {executeCustomSql.resultSets.map((set, i) => (
              <Button
                key={i}
                size="sm"
                variant={executeCustomSql.activeResultIndex === i ? "default" : "outline"}
                className="h-7 text-xs"
                data-testid={`sql-result-set-${i}`}
                onClick={() => executeCustomSql.setActiveResultIndex(i)}
              >
                Result {i + 1}
                {set.rowsAffected !== undefined
                  ? ` (${set.rowsAffected} affected)`
                  : ` (${set.rowCount})`}
              </Button>
            ))}
          </div>
        ) : null}
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
