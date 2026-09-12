import { Portal, Splitter } from "@ark-ui/react";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useMatches, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowLeft,
  ArrowUp,
  Check,
  CircleCheck,
  Copy,
  Code2,
  Download,
  GripHorizontal,
  History,
  Pin,
  PinOff,
  RotateCcw,
  SearchX,
  Sparkles,
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
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
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
  stringifyRows,
} from "#src/components/pages/connection-page/export-rows.ts";
import { GroupByHavingControls } from "#src/components/pages/connection-page/group-by-having-controls.tsx";
import {
  isColumnHidden,
  normalizeHiddenColumnList,
  toHiddenColumnKeys,
} from "#src/components/pages/connection-page/hidden-column-list.ts";
import { ResultVisualization } from "#src/components/pages/connection-page/result-visualization.tsx";
import { PendingCellEditsBar } from "#src/components/pages/connection-page/row-editor/pending-cell-edits-bar.tsx";
import {
  PendingCellEditsProvider,
  usePendingCellEdits,
} from "#src/components/pages/connection-page/row-editor/pending-cell-edits-context.tsx";
import {
  clearSqlDraft,
  markSqlDraftSessionCleanExit,
  readSqlDraft,
  startSqlDraftSession,
  writeSqlDraft,
} from "#src/components/pages/connection-page/sql-draft-storage.ts";
import {
  appendSqlExecutionTimeline,
  clearSqlExecutionTimeline,
  readSqlExecutionTimeline,
} from "#src/components/pages/connection-page/sql-execution-timeline.ts";
import { SqlQueryPreview } from "#src/components/pages/connection-page/sql-query-preview.tsx";
import {
  pinSqlResult,
  readLatestSqlResult,
  readStoredSqlResults,
  type StoredSqlResult,
  unpinSqlResult,
  writeLatestSqlResult,
} from "#src/components/pages/connection-page/sql-result-storage.ts";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#src/components/ui/dialog.tsx";
import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import { useDocumentTitle } from "#src/hooks/use-document-title.ts";
import { useJsEvalFilter } from "#src/hooks/use-js-eval-filter.ts";
import { storeChatContextPromotion, type ChatContextAttachment } from "#src/lib/ai/chat-context.ts";
import {
  CHAT_SIDECHAT_SIDE_CHANGED_EVENT,
  CHAT_SIDECHAT_WIDTH_CHANGED_EVENT,
  CHAT_SIDECHAT_WIDTH_DEFAULT,
  CHAT_SIDECHAT_WIDTH_MIN,
  getStoredChatSidechatSide,
  getStoredChatSidechatWidth,
  setStoredChatSidechatSide,
  setStoredChatSidechatWidth,
  type ChatSidechatSide,
} from "#src/lib/ai/chat-sidechat-preferences.ts";
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
import { stageCustomSqlRun } from "#src/lib/custom-sql-run-handoff.ts";
import {
  clearChatReturn,
  consumeStagedCustomSqlRun,
  peekChatReturn,
  type StagedChatReturn,
} from "#src/lib/custom-sql-run-handoff.ts";
import { registerCustomSqlRunner } from "#src/lib/custom-sql-runner-bridge.ts";
import { coerceColumnValue } from "#src/lib/data-type-utils.ts";
import { formatDbError } from "#src/lib/format-db-error.ts";
import { formatSQL } from "#src/lib/format-sql.ts";
import { invalidateRowsQueries, rowMutationMeta } from "#src/lib/invalidate-rows-queries.ts";
import { parsePasteRows } from "#src/lib/paste-rows.ts";
import {
  abortQueryController,
  createQueryAbortController,
  isQueryAbortError,
} from "#src/lib/query-abort-controller.ts";
import { queryHistorySkipFlag } from "#src/lib/query-history-settings.ts";
import { buildDropColumnSql, buildDropTableSql } from "#src/lib/schema-mutate/index.ts";
import {
  getSqlPreviewSplitterDefaultSize,
  SQL_PREVIEW_REVEAL_SIZE,
} from "#src/lib/sql-preview-panel.ts";
import { splitSqlStatements } from "#src/lib/sql-statements.ts";
import { createColumnHelper } from "#src/lib/tanstack-table.ts";
import { cn, tryFn } from "#src/lib/utils.ts";
import { queryClient } from "#src/query-client.ts";
import {
  customSqlExecutionQueryOptions,
  executeAndStoreCustomSqlServerFn,
} from "#src/server/custom-sql/start-fns/execute-custom-sql.start.ts";
import {
  beginCustomSqlTransactionServerFn,
  manageCustomSqlTransactionServerFn,
} from "#src/server/custom-sql/start-fns/manage-custom-sql-transaction.start.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import {
  getDestructiveQuerySummary,
  isDestructiveQuery,
  isReadOnlyQuery,
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
import { getQueryFavoritesQueryOptions } from "#src/server/query-logger/start-fns/get-query-favorites.start.ts";
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
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuItemText,
  MenuTrigger,
  MenuTriggerItem,
} from "../ui/menu.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet.tsx";
import { Spinner } from "../ui/spinner.tsx";
import { toaster } from "../ui/toaster.tsx";
import { AiChatPage } from "./connection-page/ai-chat.page.tsx";
import { CascadeDeleteConfirmDialog } from "./connection-page/cascade-delete-confirm.dialog.tsx";
import { ConnectionCommandPalette } from "./connection-page/command-palette.tsx";
import { ConnectionPageFilters } from "./connection-page/connection-page-filters.tsx";
import { ConnectionPageSidebar } from "./connection-page/connection-page-sidebar.tsx";
import { ConnectionPageStatusBar } from "./connection-page/connection-page-status-bar.tsx";
import { ConnectionPageTabs } from "./connection-page/connection-page-tabs.tsx";
import { ConnectionQuickReferencesDrawer } from "./connection-page/connection-quick-references.drawer.tsx";
import { ConnectionRowJsonViewerDrawer } from "./connection-page/connection-row-json-viewer.drawer.tsx";
import { ConnectionSwitcher } from "./connection-page/connection-switcher.tsx";
import {
  addTabStateAfterCurrent,
  aiTabSearchUpdate,
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
  canLocateRow,
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
  useDocumentTitle(connectionName ? `${connectionName} — Dadabase` : "Dadabase");
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

const CHAT_SIDECHAT_MOBILE_HEIGHT_DEFAULT = 620;
const CHAT_SIDECHAT_MOBILE_HEIGHT_MIN = 360;

const ConnectionPageInner = ({ connection }: { connection: DbConnection }) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const activeConnectionUrl = useActiveConnectionUrl(connection);
  useZenMode();

  const [showAddConnectionDrawer, setShowAddConnectionDrawer] = useState(false);
  const [queryLoggerPaletteView, setQueryLoggerPaletteView] = useState<
    "favorites" | "history" | null
  >(null);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [sidechatInitialized, setSidechatInitialized] = useState(false);
  const [sidechatSide, setSidechatSide] = useState<ChatSidechatSide>(getStoredChatSidechatSide);
  const [sidechatWidth, setSidechatWidth] = useState(CHAT_SIDECHAT_WIDTH_DEFAULT);
  const [sidechatMobileHeight, setSidechatMobileHeight] = useState(
    CHAT_SIDECHAT_MOBILE_HEIGHT_DEFAULT,
  );
  const [sidechatContext, setSidechatContext] = useState<readonly ChatContextAttachment[]>([]);
  const sidechatOverlayRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const refresh = () => {
      setSidechatSide(getStoredChatSidechatSide());
      setSidechatWidth(getStoredChatSidechatWidth());
    };
    refresh();
    window.addEventListener(CHAT_SIDECHAT_SIDE_CHANGED_EVENT, refresh);
    window.addEventListener(CHAT_SIDECHAT_WIDTH_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(CHAT_SIDECHAT_SIDE_CHANGED_EVENT, refresh);
      window.removeEventListener(CHAT_SIDECHAT_WIDTH_CHANGED_EVENT, refresh);
    };
  }, []);
  const sidechatResizeRef = useRef<{
    startX: number;
    startWidth: number;
    width: number;
  } | null>(null);
  const getSidechatMaxWidth = useCallback(() => {
    const availableWidth =
      sidechatOverlayRef.current?.parentElement?.getBoundingClientRect().width ??
      (typeof window === "undefined" ? CHAT_SIDECHAT_WIDTH_DEFAULT : window.innerWidth);
    // Do not force the desktop minimum when the main workspace is narrower
    // than it. That would let the overlay spill underneath the database rail.
    return Math.max(1, Math.floor(availableWidth - 24));
  }, []);
  const clampSidechatWidth = useCallback(() => {
    const maxWidth = getSidechatMaxWidth();
    const minWidth = Math.min(CHAT_SIDECHAT_WIDTH_MIN, maxWidth);
    setSidechatWidth((current) => {
      const next = Math.min(maxWidth, Math.max(minWidth, current));
      if (next !== current) setStoredChatSidechatWidth(next);
      return next;
    });
  }, [getSidechatMaxWidth]);
  useEffect(() => {
    if (!sidechatInitialized) return;
    clampSidechatWidth();
    window.addEventListener("resize", clampSidechatWidth);
    return () => window.removeEventListener("resize", clampSidechatWidth);
  }, [clampSidechatWidth, sidechatInitialized]);
  const resizeSidechat = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      sidechatResizeRef.current = {
        startX: event.clientX,
        startWidth: sidechatWidth,
        width: sidechatWidth,
      };
      const onMove = (moveEvent: PointerEvent) => {
        const start = sidechatResizeRef.current;
        if (!start) return;
        const delta =
          sidechatSide === "left"
            ? moveEvent.clientX - start.startX
            : start.startX - moveEvent.clientX;
        const maxWidth = getSidechatMaxWidth();
        const minWidth = Math.min(CHAT_SIDECHAT_WIDTH_MIN, maxWidth);
        const next = Math.round(Math.min(maxWidth, Math.max(minWidth, start.startWidth + delta)));
        start.width = next;
        sidechatOverlayRef.current?.style.setProperty("--ai-sidechat-width", `${next}px`);
      };
      const onUp = () => {
        const width = sidechatResizeRef.current?.width;
        sidechatResizeRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (width !== undefined) {
          setSidechatWidth(width);
          setStoredChatSidechatWidth(width);
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    },
    [getSidechatMaxWidth, sidechatSide, sidechatWidth],
  );
  const sidechatMobileResizeRef = useRef<{
    startY: number;
    startHeight: number;
    height: number;
  } | null>(null);
  const resizeSidechatMobile = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      sidechatMobileResizeRef.current = {
        startY: event.clientY,
        startHeight: sidechatMobileHeight,
        height: sidechatMobileHeight,
      };
      const onMove = (moveEvent: PointerEvent) => {
        const start = sidechatMobileResizeRef.current;
        if (!start) return;
        const maxHeight = Math.max(CHAT_SIDECHAT_MOBILE_HEIGHT_MIN, window.innerHeight - 16);
        const next = Math.round(
          Math.min(
            maxHeight,
            Math.max(
              CHAT_SIDECHAT_MOBILE_HEIGHT_MIN,
              start.startHeight + start.startY - moveEvent.clientY,
            ),
          ),
        );
        start.height = next;
        setSidechatMobileHeight(next);
      };
      const onUp = () => {
        sidechatMobileResizeRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    },
    [sidechatMobileHeight],
  );
  const sidechatReturnFocusRef = useRef<HTMLElement | null>(null);
  const openSidechat = useCallback(
    (attachments: readonly ChatContextAttachment[] = []) => {
      const activeElement = document.activeElement;
      sidechatReturnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
      setSidechatInitialized(true);
      if (attachments.length > 0) setSidechatContext(attachments);
      void navigate({ search: (prev) => ({ ...prev, aiSidechat: true }) });
    },
    [navigate],
  );
  const closeSidechat = () => {
    void navigate({
      search: (prev) => {
        const next = { ...prev };
        delete next.aiSidechat;
        return next;
      },
    });
    window.requestAnimationFrame(() => {
      const returnTarget = sidechatReturnFocusRef.current;
      if (returnTarget?.isConnected) {
        returnTarget.focus();
      } else {
        document.querySelector<HTMLButtonElement>('[data-testid="toggle-ai-sidechat"]')?.focus();
      }
      sidechatReturnFocusRef.current = null;
    });
  };
  const toggleSidechat = () => {
    if (sidechatOpen) {
      closeSidechat();
    } else {
      openSidechat();
    }
  };
  const sidebarSize = useActiveTabState((_tab, search) => search.sidebarSize);
  const queryLoggerSize = useActiveTabState((_tab, search) => search.queryLoggerSize);
  const activeAiThreadId = useSearch({
    from: "/connections/$connectionName",
    select: (currentSearch) => currentSearch.thread,
  });
  const sidechatOpen = useSearch({
    from: "/connections/$connectionName",
    select: (currentSearch) => currentSearch.aiSidechat === true,
  });
  useEffect(() => {
    if (sidechatOpen) setSidechatInitialized(true);
  }, [sidechatOpen]);
  // Splitter percentages must be deterministic during SSR. Calculating from the
  // browser viewport caused server/client min-size mismatches and hydration warnings.
  const sidebarMinSize = 20;
  const sidebarMaxSize = 32;

  const search = useActiveTabState((tab) => ({
    tabId: tab.tabId,
    schema: tab.schema,
    table: tab.table,
    initialTabMode: tab.initialTabMode,
    askTable: tab.askTable,
    aiIntent: tab.aiIntent,
    filters:
      tab.filters?.conditions.map((filter) => ({
        column: filter.column,
        operator: filter.operator,
        ...(filter.value !== undefined ? { value: filter.value } : {}),
      })) ?? [],
  }));
  const workspaceContextAttachments = useMemo<readonly ChatContextAttachment[]>(() => {
    if (!search.table) return [];
    return [
      { kind: "table", schema: search.schema, table: search.table },
      ...(search.filters.length > 0
        ? [
            {
              kind: "filters" as const,
              schema: search.schema,
              table: search.table,
              filters: search.filters,
            },
          ]
        : []),
    ];
  }, [search.filters, search.schema, search.table]);
  const selectedSchema = search.schema || undefined;

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
  // Keep the sidebar action identical to the tab-bar action: AI is an embedded
  // workspace tab, so existing tabs and layout state stay in the URL.
  const openAiAssistant = useCallback(() => {
    void navigate({
      search: (prev) => aiTabSearchUpdate(prev),
    });
  }, [navigate]);
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
        // Schema-less ids (SQLite/LibSQL) resolve to the dialect default,
        // matching how the sidebar opens tables for schema-less dialects.
        const schema = switchTable.schema || getDialectDefaultSchema(connection.dialect);
        const newTab = createTabState(schema, switchTable.table);
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
          openAiAssistant();
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
    [navigate, search.schema, connection.dialect, toggleZenMode, openAiAssistant],
  );

  const openSqlInNewTab = useCallback(
    (sql: string, opts?: { run?: boolean }) => {
      const newTab = createTabState(
        search.schema || getDialectDefaultSchema(connection.dialect),
        "",
        {
          initialTabMode: "sql",
          customSql: sql,
          sqlEditorMode: "editor",
        },
      );
      if (opts?.run) stageCustomSqlRun(newTab.tabId, { sql });
      void navigate({
        search: (prev) => ({
          ...prev,
          ...addTabStateAfterCurrent(prev, newTab),
        }),
      }).then(() => scrollToTab(newTab.tabId));
    },
    [navigate, search.schema, connection.dialect],
  );
  // The AI chat is a child route of this connection page: the workspace shell
  // (sidebar + tabs bar) stays visible and only the main content region swaps.
  const aiChatActive = useMatches().some(
    (match) => match.routeId === "/connections/$connectionName/ai",
  );

  return (
    <div className="bg-background flex h-screen flex-col">
      {/* Main Layout */}
      <div className="flex h-full min-h-0 flex-1 flex-col">
        {/* Icon rail: always visible (except zen mode) so hiding the sidebar
          never hides connection switching / AI / history / favorites. */}
        <div className="flex h-full min-h-0 flex-1">
          {!layoutZenMode && (
            <aside
              className="bg-muted/30 border-border flex h-full shrink-0 flex-col items-center gap-1 overflow-y-auto border-r px-1 py-2"
              data-testid="workspace-icon-rail"
            >
              <ConnectionSwitcher
                connection={connection}
                onAddConnection={() => setShowAddConnectionDrawer(true)}
                onOpenAiAssistant={openAiAssistant}
                onOpenHistory={() => openQueryLogger("history")}
                onOpenFavorites={() => openQueryLogger("favorites")}
                onOpenSchemaExplorer={() =>
                  navigate({
                    to: "/schema/$connectionName",
                    params: { connectionName: connection.name },
                    search: selectedSchema ? { schema: selectedSchema } : {},
                  })
                }
              />
            </aside>
          )}
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
                  {/* Keep the splitter panel mounted for a reversible collapse, but
                    remove its contents entirely so hiding never leaves an icon rail. */}
                  <div
                    hidden={tryFn(() => sidebarCtx.isPanelCollapsed(panels.sidebar))}
                    aria-hidden={tryFn(() => sidebarCtx.isPanelCollapsed(panels.sidebar))}
                    className="h-full min-h-0"
                  >
                    <ConnectionPageSidebar
                      connection={connection}
                      activeConnectionUrl={activeConnectionUrl}
                      onAddConnection={() => setShowAddConnectionDrawer(true)}
                      onOpenAiAssistant={openAiAssistant}
                      onOpenHistory={() => openQueryLogger("history")}
                      onOpenFavorites={() => openQueryLogger("favorites")}
                    />
                  </div>
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
                  aria-label="Sidebar splitter: drag to resize, activate to toggle sidebar"
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
                    key={getZenLayoutRemountKey(layoutZenMode, "query-logger")}
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
                      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
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
                        onToggleSidechat={toggleSidechat}
                        isSidechatOpen={sidechatOpen && !aiChatActive}
                      />
                      {aiChatActive ? (
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                          <Outlet />
                        </div>
                      ) : schemaListQuery.isError ? (
                        <TabErrorState activeConnectionUrl={activeConnectionUrl} />
                      ) : search.initialTabMode === "ai" ? (
                        <AiChatPage
                          connectionName={connection.name}
                          initialConversationId={activeAiThreadId}
                          initialAskTable={search.askTable}
                          initialAiIntent={search.aiIntent}
                        />
                      ) : search.initialTabMode === "sql" ? (
                        <CustomSqlWorkspace
                          activeConnectionUrl={activeConnectionUrl}
                          connection={connection}
                          onOpenAiSidechat={(attachment) => openSidechat([attachment])}
                        />
                      ) : search.table && search.schema ? (
                        <RowsTabContent
                          connection={connection}
                          activeConnectionUrl={activeConnectionUrl}
                          onOpenAiSidechat={(selection) => openSidechat([selection])}
                        />
                      ) : (
                        <EmptyTabContent
                          activeConnectionUrl={activeConnectionUrl}
                          connection={connection}
                          tablesUnavailable={schemaListQuery.isError || tablesListQuery.isError}
                        />
                      )}
                      {sidechatInitialized ? (
                        <div
                          className={cn(
                            "absolute inset-0 z-20 max-w-[calc(100%-1.5rem)] md:inset-y-0 md:w-[var(--ai-sidechat-width)]",
                            sidechatSide === "left"
                              ? "md:right-auto md:left-0"
                              : "md:right-0 md:left-auto",
                          )}
                          hidden={!sidechatOpen || aiChatActive}
                          style={
                            {
                              "--ai-sidechat-width": `${sidechatWidth}px`,
                              width: "min(var(--ai-sidechat-width), calc(100% - 24px))",
                              maxWidth: "calc(100% - 24px)",
                            } as CSSProperties
                          }
                          ref={sidechatOverlayRef}
                          data-testid="ai-sidechat-overlay"
                        >
                          <button
                            type="button"
                            className="absolute inset-0 bg-black/30 md:hidden"
                            aria-label="Close AI sidechat"
                            onClick={closeSidechat}
                          />
                          <div
                            className="absolute inset-x-0 bottom-0 h-[min(var(--ai-sidechat-mobile-height),calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] md:static md:h-full md:max-h-none md:pb-0"
                            style={
                              {
                                "--ai-sidechat-mobile-height": `${sidechatMobileHeight}px`,
                              } as CSSProperties
                            }
                          >
                            <button
                              type="button"
                              className="group bg-background/95 ring-border/80 absolute inset-x-0 -top-3 z-30 mx-auto flex h-7 w-20 touch-none items-center justify-center rounded-full shadow-sm ring-1 md:hidden"
                              aria-label="Resize AI sidechat height"
                              aria-orientation="horizontal"
                              aria-valuemin={CHAT_SIDECHAT_MOBILE_HEIGHT_MIN}
                              aria-valuemax={Math.max(
                                CHAT_SIDECHAT_MOBILE_HEIGHT_MIN,
                                typeof window === "undefined"
                                  ? CHAT_SIDECHAT_MOBILE_HEIGHT_DEFAULT
                                  : window.innerHeight - 16,
                              )}
                              aria-valuenow={sidechatMobileHeight}
                              data-testid="ai-sidechat-mobile-resize-handle"
                              title="Drag to resize AI sidechat"
                              onPointerDown={resizeSidechatMobile}
                              onKeyDown={(event) => {
                                const direction =
                                  event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
                                if (event.key === "Home" || event.key === "End") {
                                  event.preventDefault();
                                  setSidechatMobileHeight(
                                    event.key === "Home"
                                      ? CHAT_SIDECHAT_MOBILE_HEIGHT_MIN
                                      : Math.max(
                                          CHAT_SIDECHAT_MOBILE_HEIGHT_MIN,
                                          window.innerHeight - 16,
                                        ),
                                  );
                                } else if (direction !== 0) {
                                  event.preventDefault();
                                  const maxHeight = Math.max(
                                    CHAT_SIDECHAT_MOBILE_HEIGHT_MIN,
                                    window.innerHeight - 16,
                                  );
                                  setSidechatMobileHeight((height) =>
                                    Math.min(
                                      maxHeight,
                                      Math.max(
                                        CHAT_SIDECHAT_MOBILE_HEIGHT_MIN,
                                        height + direction * (event.shiftKey ? 80 : 24),
                                      ),
                                    ),
                                  );
                                }
                              }}
                            >
                              <GripHorizontal className="text-muted-foreground group-hover:text-foreground size-4" />
                            </button>
                            <AiChatPage
                              connectionName={connection.name}
                              initialConversationId={activeAiThreadId}
                              initialAskTable={search.table}
                              contextAttachments={[
                                ...workspaceContextAttachments,
                                ...sidechatContext,
                              ]}
                              variant="sidechat"
                              sidechatSide={sidechatSide}
                              onSidechatSideChange={(side) => {
                                setSidechatSide(side);
                                setStoredChatSidechatSide(side);
                              }}
                              onClose={closeSidechat}
                              onOpenFullChat={(attachments, conversationId) => {
                                storeChatContextPromotion(
                                  connection.name,
                                  attachments ?? [
                                    ...workspaceContextAttachments,
                                    ...sidechatContext,
                                  ],
                                );
                                void navigate({
                                  to: "/connections/$connectionName/ai",
                                  params: { connectionName: connection.name },
                                  search: (prev) => {
                                    const next = { ...prev };
                                    delete next.aiSidechat;
                                    if (conversationId) next.thread = conversationId;
                                    return next;
                                  },
                                });
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className={cn(
                              "group absolute inset-y-0 z-30 hidden w-3 cursor-col-resize touch-none items-center justify-center md:flex",
                              "focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
                              sidechatSide === "left" ? "-right-1.5" : "-left-1.5",
                            )}
                            aria-label="Resize AI sidechat"
                            aria-orientation="vertical"
                            aria-valuemin={Math.min(
                              CHAT_SIDECHAT_WIDTH_MIN,
                              typeof window === "undefined"
                                ? CHAT_SIDECHAT_WIDTH_MIN
                                : getSidechatMaxWidth(),
                            )}
                            aria-valuemax={Math.max(
                              1,
                              typeof window === "undefined" ? 0 : getSidechatMaxWidth(),
                            )}
                            aria-valuenow={sidechatWidth}
                            data-testid="ai-sidechat-resize-handle"
                            title="Drag to resize AI sidechat"
                            onPointerDown={resizeSidechat}
                            onKeyDown={(event) => {
                              const step = event.shiftKey ? 80 : 24;
                              const direction =
                                sidechatSide === "left"
                                  ? event.key === "ArrowRight"
                                    ? 1
                                    : event.key === "ArrowLeft"
                                      ? -1
                                      : 0
                                  : event.key === "ArrowLeft"
                                    ? 1
                                    : event.key === "ArrowRight"
                                      ? -1
                                      : 0;
                              if (event.key === "Home" || event.key === "End") {
                                event.preventDefault();
                                const maxWidth = getSidechatMaxWidth();
                                const minWidth = Math.min(CHAT_SIDECHAT_WIDTH_MIN, maxWidth);
                                const width = event.key === "Home" ? minWidth : maxWidth;
                                setSidechatWidth(width);
                                setStoredChatSidechatWidth(width);
                              } else if (direction !== 0) {
                                event.preventDefault();
                                const maxWidth = getSidechatMaxWidth();
                                const minWidth = Math.min(CHAT_SIDECHAT_WIDTH_MIN, maxWidth);
                                const width = Math.min(
                                  maxWidth,
                                  Math.max(minWidth, sidechatWidth + direction * step),
                                );
                                setSidechatWidth(width);
                                setStoredChatSidechatWidth(width);
                              }
                            }}
                          >
                            <span className="bg-border group-hover:bg-primary group-focus-visible:bg-primary h-16 w-1 rounded-full" />
                          </button>
                        </div>
                      ) : null}
                    </Splitter.Panel>

                    {/* Resize Handle for Query Logger */}
                    <Splitter.Context>
                      {(ctx) => (
                        <Splitter.ResizeTrigger
                          id={`${panels.rowsContent}:${panels.queryLogger}`}
                          className={cn(
                            tryFn(() => ctx.isPanelCollapsed(panels.queryLogger)) ? "h-3" : "h-1.5",
                            "bg-border hover:bg-primary/50 w-full cursor-row-resize transition-colors",
                            (layoutZenMode || aiChatActive) && "hidden",
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
                            (layoutZenMode || aiChatActive || !queryLoggerSize) && "hidden",
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

      <ConnectionCommandPalette
        commands={commandPaletteCommands}
        onSelect={handleCommandPaletteSelect}
      />
    </div>
  );
};

const RowsTabContent = (props: {
  connection: DbConnection;
  activeConnectionUrl: string;
  onOpenAiSidechat?: (attachment: ChatContextAttachment) => void;
}) => {
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
    connectionId: connection.id,
  });
  const [customSqlDraft, setCustomSqlDraft] = useState<string | null>(null);
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
            key={search.tabId}
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
                    onSetPanelSize={(sqlPanelPercent) => {
                      ctx.setSizes([sqlPanelPercent, 100 - sqlPanelPercent]);
                      void navigate({
                        search: (prev) =>
                          updateTabState(prev, {
                            sqlPreviewSize: sqlPanelPercent,
                          }),
                      });
                    }}
                    activeConnectionUrl={pageState.activeConnectionUrl}
                    sqlQueryAsText={pageState.sqlQueryAsText}
                    onRunQuery={executeCustomSql.onRunQuery}
                    onDraftChange={setCustomSqlDraft}
                    onRunInTransaction={executeCustomSql.onRunInTransaction}
                    onBeginTransaction={executeCustomSql.onBeginTransaction}
                    onCommitTransaction={executeCustomSql.onCommitTransaction}
                    onRollbackTransaction={executeCustomSql.onRollbackTransaction}
                    transactionStatus={executeCustomSql.transactionStatus}
                    transactionSupported={props.connection.dialect !== DatabaseDialect.Clickhouse}
                    onCancelQuery={executeCustomSql.onCancel}
                    isLoading={executeCustomSql.mutation.isPending}
                    onOpenAiSidechat={props.onOpenAiSidechat}
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
                <CustomSqlTabContent
                  executeCustomSql={executeCustomSql}
                  connectionId={props.connection.id}
                  draftSql={customSqlDraft ?? search.customSql ?? ""}
                />
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
                  onOpenAiSidechat={props.onOpenAiSidechat}
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
            <Spinner
              size="sm"
              colorPalette="primary"
              label="Import running"
              className="mt-0.5 shrink-0"
            />
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
    onSetPanelSize?: (sqlPanelPercent: number) => void;
    onRunQuery: (editorValue?: string, statementSql?: string) => void;
    onDraftChange?: (sql: string | null) => void;
    onRunInTransaction?: (editorValue: string) => void;
    onBeginTransaction?: () => void;
    onCommitTransaction?: () => void;
    onRollbackTransaction?: () => void;
    transactionStatus?: "idle" | "active" | "busy";
    transactionSupported?: boolean;
    onCancelQuery: () => void;
    onOpenAiSidechat?: (attachment: ChatContextAttachment) => void;
    isLoading?: boolean;
    allowEmptySql?: boolean;
  },
) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const search = useActiveTabState((tab) => {
    return {
      tabId: tab.tabId,
      schema: tab.schema,
      table: tab.table,
      sqlEditorMode: tab.sqlEditorMode,
      customSql: tab.customSql,
      customSqlId: tab.customSqlId,
    };
  });

  /** Open an AI tab seeded to propose a query for this context. */
  const suggestQueryWithAi = () => {
    const askTable = search.table || undefined;
    const newTab = createTabState(
      search.schema || getDialectDefaultSchema(props.connection.dialect),
      "",
      { initialTabMode: "ai", askTable, aiIntent: "sql" },
    );
    void navigate({
      search: (prev) => ({ ...prev, ...addTabStateAfterCurrent(prev, newTab) }),
    }).then(() => scrollToTab(newTab.tabId));
  };

  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const activeTabId = search.tabId;

  // Keep draft SQL locally - don't switch to custom SQL mode until user runs
  const [draftSql, setDraftSql] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState<{
    sharedDraft: string;
    recoveredDraft: string;
  } | null>(null);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [draftWasInterrupted, setDraftWasInterrupted] = useState(false);

  const updateDraftSql = (value: string | null) => {
    setDraftSql(value);
    props.onDraftChange?.(value ?? props.sqlQueryAsText);
    if (activeTabId) {
      if (value == null || value.trim() === "") clearSqlDraft(props.connection.id, activeTabId);
      else writeSqlDraft(props.connection.id, activeTabId, value);
    }
  };

  const revealSqlInEditor = (sql: string) => {
    updateDraftSql(sql);
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

  /**
   * Auto-run handed off from the AI chat page: consume-once per tab id, so
   * StrictMode double-effects and re-renders never double-execute.
   */
  // Audit S8: when this tab was seeded from the AI chat, offer a way back.
  const [chatReturn, setChatReturn] = useState<StagedChatReturn | null>(null);
  useEffect(() => {
    if (!activeTabId) return;
    setChatReturn(peekChatReturn(activeTabId));
  }, [activeTabId]);
  const runQueryRef = useRef(props.onRunQuery);
  runQueryRef.current = props.onRunQuery;
  useEffect(() => {
    if (!activeTabId) return;
    // Defer past the mount-effect flush: executing synchronously here races
    // router/tab-state settling and leaves the query UI wedged. Consume only
    // when the deferred callback actually fires — early unmount/remount cycles
    // (Suspense resolution, tab-state settling) cancel the first attempt, and
    // the payload must survive until a mounted instance really executes it.
    const timer = window.setTimeout(() => {
      const staged = consumeStagedCustomSqlRun(activeTabId);
      if (staged) runQueryRef.current(staged.sql);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTabId]);

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

  const favoriteQuery = useQuery({
    ...getQueryFavoritesQueryOptions({ connectionId: props.connection.id }),
  });

  // Initialize the local editor when the user switches tabs. Do not subscribe
  // to generated SQL or shared-draft changes here: execution changes those
  // values, and must never overwrite the live editor draft.
  const initializedDraftKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTabId) return;
    const draftKey = `${props.connection.id}:${activeTabId}`;
    if (initializedDraftKeyRef.current === draftKey) return;
    initializedDraftKeyRef.current = draftKey;
    const wasInterrupted = startSqlDraftSession(props.connection.id, activeTabId);
    setDraftWasInterrupted(wasInterrupted);
    const markCleanExit = () => markSqlDraftSessionCleanExit(props.connection.id, activeTabId);
    window.addEventListener("beforeunload", markCleanExit);
    const recoveredDraft = readSqlDraft(props.connection.id, activeTabId);
    const sharedDraft = search.customSql ?? props.sqlQueryAsText;
    if (
      sharedDraft?.trim() &&
      recoveredDraft?.trim() &&
      sharedDraft.trim() !== recoveredDraft.trim()
    ) {
      setDraftSql(sharedDraft);
      setDraftConflict({ sharedDraft, recoveredDraft });
      return () => window.removeEventListener("beforeunload", markCleanExit);
    }
    const initialDraft = search.customSql ?? recoveredDraft ?? props.sqlQueryAsText;
    setDraftSql(search.customSql ?? recoveredDraft);
    props.onDraftChange?.(initialDraft);
    if (
      recoveredDraft?.trim() &&
      !search.customSql?.trim() &&
      recoveredDraft.trim() !== props.sqlQueryAsText.trim()
    ) {
      setDraftRecovered(wasInterrupted);
    }
    return () => window.removeEventListener("beforeunload", markCleanExit);
  }, [activeTabId, props.connection.id]);

  // Fetch available tables/columns for intellisense
  const { tables, columns } = useTablesColumnsForIntellisense({
    connectionUrl: props.activeConnectionUrl,
    schema: search.schema,
  });

  // Explain query functionality - use draft SQL if available
  const sqlForExplain = draftSql ?? props.sqlQueryAsText;
  const { explainQuery, explain, showExplainPanel, setShowExplainPanel, isExplainDisabled } =
    useExplainQuery({
      connectionUrl: props.activeConnectionUrl,
      sql: sqlForExplain,
      dialect: props.connection.dialect,
    });

  return (
    <>
      <Dialog
        open={draftConflict !== null}
        onOpenChange={({ open }) => {
          if (!open) setDraftConflict(null);
        }}
      >
        <DialogContent
          className="max-w-lg"
          data-testid={draftWasInterrupted ? "sql-draft-crash-recovered" : undefined}
        >
          <DialogHeader>
            <DialogTitle>
              {draftWasInterrupted
                ? "Recovered after an interrupted session"
                : "Choose the SQL draft to keep"}
            </DialogTitle>
            <DialogDescription>
              {draftWasInterrupted
                ? "This page recovered a local draft after the previous editor session ended unexpectedly. Choose which draft to keep; nothing will run until you decide."
                : "This tab has a shared draft and a newer draft recovered from this browser. Nothing will run until you choose one."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <Button
              variant="outline"
              className="h-auto justify-start whitespace-normal"
              onClick={() => {
                if (!draftConflict) return;
                updateDraftSql(draftConflict.recoveredDraft);
                setDraftConflict(null);
              }}
            >
              <span className="flex flex-col items-start gap-1">
                <span className="font-semibold">Use recovered browser draft</span>
                <span className="text-muted-foreground line-clamp-2 text-xs">
                  {draftConflict?.recoveredDraft}
                </span>
              </span>
            </Button>
            <Button
              variant="default"
              className="h-auto justify-start whitespace-normal"
              onClick={() => {
                if (!draftConflict) return;
                updateDraftSql(draftConflict.sharedDraft);
                setDraftConflict(null);
              }}
            >
              <span className="flex flex-col items-start gap-1">
                <span className="font-semibold">Use shared draft</span>
                <span className="text-primary-foreground/80 line-clamp-2 text-xs">
                  {draftConflict?.sharedDraft}
                </span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {draftRecovered && draftConflict === null ? (
        <div
          className="bg-muted/50 border-border mb-1 flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-xs"
          data-testid="sql-draft-crash-recovered"
        >
          <span className="text-muted-foreground flex-1">
            Recovered after an interrupted editor session. Keep this draft or discard it before
            continuing.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => setDraftRecovered(false)}
          >
            Keep draft
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => {
              updateDraftSql(null);
              setDraftRecovered(false);
            }}
          >
            Discard draft
          </Button>
        </div>
      ) : null}
      {chatReturn !== null && (
        <div className="mb-1 flex items-center gap-2 px-1">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-xs underline underline-offset-2"
            onClick={() => {
              if (activeTabId) clearChatReturn(activeTabId);
              const conversationId = chatReturn.conversationId;
              setChatReturn(null);
              void navigate({
                to: "/connections/$connectionName/ai",
                params: { connectionName: props.connection.name },
                search: (prev) =>
                  conversationId === "" ? prev : { ...prev, thread: conversationId },
              });
            }}
            data-testid="ai-chat-return-link"
          >
            <ArrowLeft className="size-3" />
            Back to chat · {chatReturn.title}
          </button>
        </div>
      )}
      <SqlQueryPreview
        tables={tables}
        columns={columns}
        snippetActiveTable={search.table}
        onSuggestQuery={suggestQueryWithAi}
        contextReceipt={
          search.schema && search.table ? `Context: ${search.schema}.${search.table}` : undefined
        }
        onAskAi={
          props.onOpenAiSidechat
            ? () => {
                const sql = draftSql ?? props.sqlQueryAsText;
                if (sql.trim()) {
                  props.onOpenAiSidechat?.({ kind: "sql", sql, source: "editor" });
                }
              }
            : undefined
        }
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
        onEditorChange={updateDraftSql}
        onRun={props.onRunQuery}
        onRunAll={(value) => props.onRunQuery(value)}
        onRunInTransaction={
          props.transactionStatus === "active" ? undefined : props.onRunInTransaction
        }
        onBeginTransaction={props.onBeginTransaction}
        onCommitTransaction={props.onCommitTransaction}
        onRollbackTransaction={props.onRollbackTransaction}
        transactionStatus={props.transactionStatus}
        transactionSupported={props.transactionSupported}
        onCancel={props.onCancelQuery}
        onExplain={explain}
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
            updateDraftSql(formatted);
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
        onSetPanelSize={props.onSetPanelSize}
        onSaveFavorite={async (sql) => {
          const normalizedSql = sql.replace(/\s+/g, " ").trim().toLocaleLowerCase();
          const duplicate = favoriteQuery.data?.find(
            (favorite) =>
              favorite.sql.replace(/\s+/g, " ").trim().toLocaleLowerCase() === normalizedSql,
          );
          if (
            duplicate &&
            !window.confirm(
              `This query is already saved as “${duplicate.label}”. Save another copy anyway?`,
            )
          ) {
            toaster.create({ title: "Favorite already saved" });
            return;
          }
          await saveFavoriteMutation.mutateAsync(sql);
        }}
        isSavingFavorite={saveFavoriteMutation.isPending}
        isDirty={Boolean(draftSql && draftSql.trim() !== props.sqlQueryAsText.trim())}
        onReset={() => {
          updateDraftSql(null);
          props.onCollapse();
          void navigate({
            search: (prev) =>
              updateTabState(prev, {
                customSql: undefined,
                customSqlId: undefined,
                sqlEditorMode: "preview",
              }),
          });
        }}
        isFullscreen={isEditorFullscreen}
        className="h-full text-sm"
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
    onOpenAiSidechat?: (attachment: ChatContextAttachment) => void;
  },
) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const pendingCellEdits = usePendingCellEdits();

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

  const queueCellEdit = (rowId: string, columnId: string, rawValue: string) => {
    if (!pendingCellEdits || !search.schema || !search.table) return false;
    if (isReadOnlyConnection(props.activeConnectionUrl)) return false;

    const row = props.rowsDataTable.getRowModel().rows.find((candidate) => candidate.id === rowId);
    const column = props.columnMetadata.find((candidate) => candidate.name === columnId);
    if (!row || !column || column.primaryKey) return false;

    const nextValue =
      rawValue.trim() === "" && column.nullable
        ? null
        : rawValue.trim() === "" && !column.nullable
          ? undefined
          : coerceColumnValue(column.dataType, rawValue);
    if (nextValue === undefined) return false;

    const primaryKey = extractPrimaryKeyValues(
      props.columnMetadata,
      row.original as Record<string, unknown>,
    );
    if (Object.keys(primaryKey).length === 0) return false;

    pendingCellEdits.bufferEdit({
      schema: search.schema,
      table: search.table,
      column: column.name,
      dataType: column.dataType,
      primaryKey,
      previousValue: row.getValue(column.name),
      nextValue,
    });
    return true;
  };

  const handlePasteSelection = ({
    rowId,
    columnId,
    matrix,
    selection,
  }: {
    rowId: string;
    columnId: string;
    matrix: string[][];
    selection: {
      cells: Array<{ row: { id: string }; columnId: string; value: unknown }>;
    };
  }) => {
    const selectedCells = selection.cells;
    const tableRows = props.rowsDataTable.getRowModel().rows;
    const visibleColumns = props.rowsDataTable.getVisibleLeafColumns();
    const startRowIndex = tableRows.findIndex((candidate) => candidate.id === rowId);
    const startColumnIndex = visibleColumns.findIndex((column) => column.id === columnId);
    const targets =
      matrix.length === 1 && matrix[0]?.length === 1 && selectedCells.length > 1
        ? selectedCells.map((cell) => ({
            rowId: cell.row.id,
            columnId: cell.columnId,
            value: matrix[0]?.[0] ?? "",
          }))
        : matrix.flatMap((row, rowOffset) =>
            row.map((value, columnOffset) => ({
              rowId: tableRows[startRowIndex + rowOffset]?.id,
              columnId: visibleColumns[startColumnIndex + columnOffset]?.id,
              value,
            })),
          );

    let applied = 0;
    for (const target of targets) {
      if (
        target.rowId &&
        target.columnId &&
        queueCellEdit(target.rowId, target.columnId, target.value)
      ) {
        applied += 1;
      }
    }
    if (applied > 0) {
      toaster.create({
        title: "Pasted cell changes",
        description: `${applied} cell${applied === 1 ? "" : "s"} queued for review`,
        type: "success",
      });
    }
  };

  const handleBulkFillSelection = ({
    value,
    selection,
  }: {
    value: string;
    selection: { cells: Array<{ row: { id: string }; columnId: string; value: unknown }> };
  }) => {
    let applied = 0;
    for (const cell of selection.cells) {
      if (queueCellEdit(cell.row.id, cell.columnId, value)) applied += 1;
    }
    if (applied > 0) {
      toaster.create({
        title: "Filled selected cells",
        description: `${applied} cell${applied === 1 ? "" : "s"} queued for review`,
        type: "success",
      });
    }
  };

  const handleSelectionExport = async ({
    format,
    download,
    selection,
  }: {
    format: "tsv" | "csv" | "json" | "sql";
    download: boolean;
    selection: {
      columns: string[];
      rows: Array<{ values: Record<string, unknown> }>;
    };
  }) => {
    if (!search.table || selection.rows.length === 0) return false;
    const rows = selection.rows.map(({ values }) => values);
    const content = stringifyRows(rows, selection.columns, {
      format,
      tableName: search.table,
      schemaName: search.schema,
    });
    if (download) {
      exportRows(rows, selection.columns, {
        format,
        tableName: search.table,
        schemaName: search.schema,
        filename: `${search.table}-selection.${format}`,
      });
    } else {
      const copied = await copyToClipboard(content);
      if (!copied) return false;
    }
    toaster.create({
      title: download ? "Selection exported" : "Selection copied",
      description: `${selection.rows.length} row${selection.rows.length === 1 ? "" : "s"} as ${format.toUpperCase()}`,
      type: "success",
    });
    return true;
  };

  return (
    <PendingCellEditsProvider>
      <div className="relative flex h-full flex-1 flex-col">
        <BulkActions
          activeConnectionUrl={props.activeConnectionUrl}
          rowsDataTable={props.rowsDataTable}
          columnMetadata={props.columnMetadata}
          onEditRow={props.onEditRow}
          onDuplicateRow={props.onDuplicateRow}
          onOpenAiSidechat={props.onOpenAiSidechat}
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
              <div className="hidden min-h-0 flex-1 flex-col md:flex">
                <DataTable
                  // virtualized={search.limit > 100}
                  enableRowVirtualization
                  enableColumnOrdering
                  enableFind
                  enableCellSelection
                  onPasteSelection={
                    isReadOnlyConnection(props.activeConnectionUrl)
                      ? undefined
                      : handlePasteSelection
                  }
                  onBulkFillSelection={
                    isReadOnlyConnection(props.activeConnectionUrl)
                      ? undefined
                      : handleBulkFillSelection
                  }
                  onSelectionExport={handleSelectionExport}
                  onRowDoubleClick={
                    props.onEditRow && !isReadOnlyConnection(props.activeConnectionUrl)
                      ? (row) => props.onEditRow?.(row.original as Record<string, unknown>)
                      : undefined
                  }
                  table={props.rowsDataTable}
                  getTableContainer={setTableContainer}
                  hasError={props.rowsQuery.isError}
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
              </div>
              <MobileRowsView
                table={props.rowsDataTable}
                columnMetadata={props.columnMetadata}
                isReadOnly={isReadOnlyConnection(props.activeConnectionUrl)}
                onEditRow={props.onEditRow}
              />
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

function formatMobileRowValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function MobileRowsView(props: {
  table: ConnectionPageState["rowsDataTable"];
  columnMetadata: ConnectionPageState["columnMetadata"];
  isReadOnly: boolean;
  onEditRow?: (row: Record<string, unknown>) => void;
}) {
  const rows = props.table.getRowModel().rows;
  const columns = props.table
    .getVisibleLeafColumns()
    .filter((column) => !column.id.startsWith("__"));
  const metadataByName = new Map(props.columnMetadata.map((column) => [column.name, column]));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto md:hidden" data-testid="mobile-rows-view">
      <div className="text-muted-foreground flex items-center justify-between gap-3 border-b px-3 py-2 text-xs">
        <span>
          {rows.length} loaded row{rows.length === 1 ? "" : "s"} · {columns.length} field
          {columns.length === 1 ? "" : "s"}
        </span>
        <span>Select rows for bulk actions</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-muted-foreground p-6 text-center text-sm">No rows to display.</div>
      ) : (
        <div className="space-y-3 p-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className={cn(
                "bg-card rounded-lg border p-3 shadow-sm",
                row.getIsSelected() && "border-primary ring-primary/20 ring-2",
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={row.getIsSelected()}
                    onChange={(event) => row.toggleSelected(event.currentTarget.checked)}
                    className="accent-primary size-4"
                    aria-label={`Select row ${row.id}`}
                  />
                  <span className="truncate">Row {row.index + 1}</span>
                </label>
                {props.onEditRow &&
                !props.isReadOnly &&
                canLocateRow(props.columnMetadata, row.original as Record<string, unknown>) ? (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => props.onEditRow?.(row.original as Record<string, unknown>)}
                  >
                    Edit row
                  </Button>
                ) : null}
              </div>
              <dl className="divide-border divide-y">
                {columns.map((column) => {
                  const fieldName = column.id.split(".").at(-1) ?? column.id;
                  const metadata = metadataByName.get(fieldName);
                  const value = row.getValue(column.id);
                  return (
                    <div
                      key={column.id}
                      className="grid grid-cols-[minmax(6rem,0.7fr)_minmax(0,1.3fr)] gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <dt
                        className="text-muted-foreground min-w-0 truncate text-xs"
                        title={column.id}
                      >
                        {metadata?.name ?? fieldName}
                      </dt>
                      <dd className="text-foreground min-w-0 text-right font-mono text-xs break-words">
                        {formatMobileRowValue(value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const BulkActions = (
  props: Pick<ConnectionPageState, "activeConnectionUrl" | "rowsDataTable" | "columnMetadata"> & {
    onEditRow?: (row: Record<string, unknown>) => void;
    onDuplicateRow?: (row: Record<string, unknown>) => void;
    onOpenAiSidechat?: (attachment: ChatContextAttachment) => void;
  },
) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const search = useActiveTabState((tab) => ({
    tabId: tab.tabId,
    schema: tab.schema,
    table: tab.table,
  }));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isReadOnly = isReadOnlyConnection(props.activeConnectionUrl);

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
    !isReadOnly &&
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

  const handleAskAi = () => {
    if (!props.onOpenAiSidechat || !search.schema || !search.table) return;
    props.onOpenAiSidechat({
      kind: "selection",
      schema: search.schema,
      table: search.table,
      columns: props.rowsDataTable.getVisibleLeafColumns().map((column) => column.id),
      rowIds: selectedRows.map((row) => row.id),
      rows: selectedRows.map((row) => row.original as Record<string, unknown>),
    });
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
        onDelete={!isReadOnly && canDelete ? handleBulkDelete : undefined}
        onDuplicate={!isReadOnly && props.onDuplicateRow ? handleDuplicate : undefined}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        onExportSql={handleExportSql}
        onCopyJson={handleCopyJson}
        onCopyCsv={handleCopyCsv}
        onCopyInsert={handleCopyInsert}
        onViewJson={handleViewJson}
        onLogRows={handleLogRows}
        onExpandRelationships={selectedRowsCount === 1 ? handleExpandRelationships : undefined}
        onAskAi={props.onOpenAiSidechat ? handleAskAi : undefined}
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

const EmptyTabContent = (props: {
  activeConnectionUrl: string;
  connection: DbConnection;
  tablesUnavailable?: boolean;
}) => {
  const search = useActiveTabState((tab) => ({
    tabId: tab.tabId,
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
      tablesUnavailable={props.tablesUnavailable}
    />
  );
};

const CustomSqlWorkspace = (props: {
  activeConnectionUrl: string;
  connection: DbConnection;
  onOpenAiSidechat?: (attachment: ChatContextAttachment) => void;
}) => {
  const executeCustomSql = useExecuteCustomSql({
    activeConnectionUrl: props.activeConnectionUrl,
    connectionId: props.connection.id,
  });
  const [draftSql, setDraftSql] = useState<string | null>(null);
  const tab = useActiveTabState((activeTab) => ({
    schema: activeTab.schema,
  }));
  const isReadOnly = isReadOnlyConnection(props.activeConnectionUrl);

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      data-testid="custom-sql-workspace"
    >
      <div className="bg-card flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-3 py-2 sm:px-5 sm:py-3">
        <div>
          <p className="text-muted-foreground hidden text-xs font-medium tracking-wide uppercase sm:block">
            Connection workspace
          </p>
          <h2 className="text-foreground text-base font-semibold sm:mt-1">Custom SQL</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:mt-2">
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
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-48 shrink-0 border-b sm:min-h-64">
          <RowsTableSqlEditor
            connection={props.connection}
            isCollapsed={false}
            onExpand={() => undefined}
            onCollapse={() => undefined}
            activeConnectionUrl={props.activeConnectionUrl}
            sqlQueryAsText=""
            onRunQuery={executeCustomSql.onRunQuery}
            onRunInTransaction={executeCustomSql.onRunInTransaction}
            onBeginTransaction={executeCustomSql.onBeginTransaction}
            onCommitTransaction={executeCustomSql.onCommitTransaction}
            onRollbackTransaction={executeCustomSql.onRollbackTransaction}
            onDraftChange={setDraftSql}
            transactionStatus={executeCustomSql.transactionStatus}
            transactionSupported={props.connection.dialect !== DatabaseDialect.Clickhouse}
            onCancelQuery={executeCustomSql.onCancel}
            isLoading={executeCustomSql.mutation.isPending}
            allowEmptySql
            onOpenAiSidechat={props.onOpenAiSidechat}
          />
        </div>
        <CustomSqlTabContent
          executeCustomSql={executeCustomSql}
          onOpenAiSidechat={props.onOpenAiSidechat}
          connectionId={props.connection.id}
          draftSql={draftSql ?? ""}
        />
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

const persistentTransactionStore = (() => {
  const ids = new Map<string, string>();
  const listeners = new Set<() => void>();
  let version = 0;
  const emit = () => {
    version += 1;
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => version,
    getId: (key: string) => ids.get(key),
    setId: (key: string, id: string) => {
      ids.set(key, id);
      emit();
    },
    deleteId: (key: string) => {
      ids.delete(key);
      emit();
    },
  };
})();

const extractSqlRequestId = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.match(/request id:\s*([a-f0-9-]+)/i)?.[1];
};

const useExecuteCustomSql = (props: { activeConnectionUrl: string; connectionId: string }) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const search = useActiveTabState((tab) => ({
    tabId: tab.tabId,
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
  const [pendingQuerySummary, setPendingQuerySummary] = useState<string | null>(null);
  const [isMultiRunPending, setIsMultiRunPending] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  type CustomSqlResultSet = {
    customSqlId?: string;
    requestId?: string;
    sql: string;
    rows: Record<string, unknown>[];
    columns: string[];
    rowCount: number;
    rowsAffected: number | undefined;
    timeTaken: number;
    ranAt: number;
    status: "success" | "error";
    error?: string;
    statementIndex: number;
    totalStatements: number;
  };
  const [resultSets, setResultSets] = useState<CustomSqlResultSet[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [latestPersistedResult, setLatestPersistedResult] = useState<StoredSqlResult | null>(null);
  useEffect(() => {
    setLatestPersistedResult(readLatestSqlResult(props.connectionId, search.tabId));
  }, [props.connectionId, search.tabId]);
  const [executedSql, setExecutedSql] = useState<string | null>(null);
  const latestEditorSqlRef = useRef<string | undefined>(undefined);
  const [transactionBusy, setTransactionBusy] = useState<{
    tabId: string;
    action: "begin" | "commit" | "rollback";
  } | null>(null);
  const transactionActionInFlightRef = useRef(false);

  useSyncExternalStore(
    persistentTransactionStore.subscribe,
    persistentTransactionStore.getSnapshot,
    persistentTransactionStore.getSnapshot,
  );
  const transactionKey = `${props.activeConnectionUrl}:${search.tabId}`;
  const activeTransactionId = persistentTransactionStore.getId(transactionKey);

  const beginTransactionMutation = useMutation({
    mutationFn: (_input: { tabId: string }) =>
      beginCustomSqlTransactionServerFn({ data: { url: props.activeConnectionUrl } }),
    onSuccess: (transaction, variables) => {
      persistentTransactionStore.setId(
        `${props.activeConnectionUrl}:${variables.tabId}`,
        transaction.transactionId,
      );
      toaster.create({
        title: "Transaction started",
        description: "Queries now share one connection.",
      });
    },
    onError: (error) => {
      toaster.create({
        title: "Could not start transaction",
        description: formatDbError(error),
        type: "error",
      });
    },
    onSettled: () => {
      transactionActionInFlightRef.current = false;
      setTransactionBusy(null);
    },
  });

  const manageTransactionMutation = useMutation({
    mutationFn: (input: { tabId: string; transactionId: string; action: "commit" | "rollback" }) =>
      manageCustomSqlTransactionServerFn({
        data: {
          url: props.activeConnectionUrl,
          transactionId: input.transactionId,
          action: input.action,
        },
      }),
    onSuccess: (_result, variables) => {
      persistentTransactionStore.deleteId(`${props.activeConnectionUrl}:${variables.tabId}`);
      toaster.create({
        title: variables.action === "commit" ? "Transaction committed" : "Transaction rolled back",
      });
    },
    onError: (error) => {
      toaster.create({
        title: "Could not finish transaction",
        description: formatDbError(error),
        type: "error",
      });
    },
    onSettled: () => {
      transactionActionInFlightRef.current = false;
      setTransactionBusy(null);
    },
  });

  const executeCustomSqlMutation = useMutation({
    mutationFn: async (variables: Parameters<typeof executeAndStoreCustomSqlServerFn>[0]) => {
      const controller = createQueryAbortController(abortControllerRef.current);
      abortControllerRef.current = controller;
      try {
        return await executeAndStoreCustomSqlServerFn({
          ...variables,
          // Audit S2: honor record-history preference for user-authored SQL.
          ...queryHistorySkipFlag(),
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
    onSuccess: (data, variables) => {
      const persisted = {
        id: data.customSqlId,
        requestId: data.requestId,
        sql: variables.data.sql,
        rows: data.rows,
        columns: data.columns,
        rowCount: data.rowCount,
        rowsAffected: data.rowsAffected,
        timeTaken: data.timeTaken,
        ranAt: data.ranAt,
      } satisfies Omit<StoredSqlResult, "pinnedAt">;
      writeLatestSqlResult(props.connectionId, search.tabId, persisted);
      setLatestPersistedResult({ ...persisted, pinnedAt: Date.now() });
      appendSqlExecutionTimeline(props.connectionId, search.tabId, {
        id: data.customSqlId,
        requestId: data.requestId,
        sql: variables.data.sql,
        status: "success",
        ranAt: data.ranAt,
        timeTaken: data.timeTaken,
        rowCount: data.rowCount,
        rowsAffected: data.rowsAffected,
      });
      // After successful execution, update the URL with the execution id while
      // keeping the full editor draft as the source of truth for the editor.
      if (!data?.customSqlId) return;
      queryClient.invalidateQueries(customSqlExecutionQueryOptions(search.customSqlId));
      navigate({
        search: (prev) =>
          updateTabState(prev, {
            customSqlId: data.customSqlId,
            // Keep the complete editor draft in tab state. A statement-scoped
            // run may submit only one statement, but execution must never
            // replace the user's multi-statement editor contents.
            customSql: latestEditorSqlRef.current ?? search.customSql,
          }),
      });
    },
    onError: (error, variables) => {
      if (isQueryAbortError(error)) return;
      appendSqlExecutionTimeline(props.connectionId, search.tabId, {
        id: `error-${Date.now()}`,
        requestId: extractSqlRequestId(error),
        sql: variables.data.sql,
        status: "error",
        ranAt: Date.now(),
        error: formatDbError(error),
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

  const onBeginTransaction = () => {
    if (activeTransactionId || transactionBusy || transactionActionInFlightRef.current) return;
    const readOnlyError = guardReadOnlyMutation(props.activeConnectionUrl);
    if (readOnlyError) {
      toaster.create({ title: "Read-only connection", description: readOnlyError, type: "error" });
      return;
    }
    transactionActionInFlightRef.current = true;
    setTransactionBusy({ tabId: search.tabId, action: "begin" });
    beginTransactionMutation.mutate({ tabId: search.tabId });
  };

  const onFinishTransaction = (action: "commit" | "rollback") => {
    if (!activeTransactionId || transactionBusy || transactionActionInFlightRef.current) return;
    transactionActionInFlightRef.current = true;
    setTransactionBusy({ tabId: search.tabId, action });
    manageTransactionMutation.mutate({
      tabId: search.tabId,
      transactionId: activeTransactionId,
      action,
    });
  };

  const onCommitTransaction = () => onFinishTransaction("commit");
  const onRollbackTransaction = () => onFinishTransaction("rollback");

  // console.log({ storedData, displaySql, search });

  // Get execution result (either from mutation or from stored execution)
  const output: {
    customSqlId?: string;
    requestId?: string;
    rows: Record<string, unknown>[];
    columns: string[];
    rowCount: number;
    rowsAffected: number | undefined;
    timeTaken: number;
    ranAt: number;
  } | null =
    hasMutationResult && mutationResult
      ? {
          customSqlId: mutationResult.customSqlId,
          requestId: mutationResult.requestId,
          rows: mutationResult.rows,
          columns: mutationResult.columns,
          rowCount: mutationResult.rowCount,
          rowsAffected: mutationResult.rowsAffected,
          timeTaken: mutationResult.timeTaken,
          ranAt: mutationResult.ranAt,
        }
      : storedData
        ? {
            customSqlId: storedData.id,
            // Use stored rows if available
            rows: (storedData.resultRows ?? []) as Record<string, unknown>[],
            columns: (storedData.columns ?? []) as string[],
            rowCount: storedData.rowsReturned ?? 0,
            rowsAffected: storedData.rowsAffected ?? undefined,
            timeTaken: storedData.timeTaken ?? 0,
            ranAt: storedData.startedAt ?? 0,
          }
        : latestPersistedResult &&
            latestPersistedResult.sql.replace(/\s+/g, " ").trim() ===
              (search.customSql ?? "").replace(/\s+/g, " ").trim()
          ? {
              customSqlId: latestPersistedResult.id,
              requestId: latestPersistedResult.requestId,
              rows: latestPersistedResult.rows,
              columns: latestPersistedResult.columns,
              rowCount: latestPersistedResult.rowCount,
              rowsAffected: latestPersistedResult.rowsAffected,
              timeTaken: latestPersistedResult.timeTaken,
              ranAt: latestPersistedResult.ranAt,
            }
          : null;

  const executeMultipleStatements = async (statements: ReturnType<typeof splitSqlStatements>) => {
    const transactionId = activeTransactionId;
    const controller = createQueryAbortController(abortControllerRef.current);
    abortControllerRef.current = controller;
    setIsMultiRunPending(true);
    setResultSets([]);
    setActiveResultIndex(0);
    try {
      const collected: CustomSqlResultSet[] = [];
      for (const [index, statement] of statements.entries()) {
        const readOnlyError = guardReadOnlyMutation(props.activeConnectionUrl, {
          isSelect: isReadOnlyQuery(statement.sql),
        });
        if (readOnlyError) throw new Error(readOnlyError);
        try {
          const result = await executeAndStoreCustomSqlServerFn({
            data: {
              url: props.activeConnectionUrl,
              sql: statement.sql,
              schemaName: search.schema || undefined,
              tableName: search.table || undefined,
              transactionId,
              ...queryHistorySkipFlag(),
            },
          });
          if (controller.signal.aborted) break;
          const persisted = {
            id: result.customSqlId,
            requestId: result.requestId,
            sql: statement.sql,
            rows: (result.rows ?? []) as Record<string, unknown>[],
            columns: result.columns ?? [],
            rowCount: result.rowCount ?? 0,
            rowsAffected: result.rowsAffected,
            timeTaken: result.timeTaken ?? 0,
            ranAt: result.ranAt ?? Date.now(),
          } satisfies Omit<StoredSqlResult, "pinnedAt">;
          writeLatestSqlResult(props.connectionId, search.tabId, persisted);
          setLatestPersistedResult({ ...persisted, pinnedAt: Date.now() });
          collected.push({
            customSqlId: result.customSqlId,
            requestId: result.requestId,
            sql: statement.sql,
            rows: (result.rows ?? []) as Record<string, unknown>[],
            columns: result.columns ?? [],
            rowCount: result.rowCount ?? 0,
            rowsAffected: result.rowsAffected,
            timeTaken: result.timeTaken ?? 0,
            ranAt: result.ranAt ?? Date.now(),
            status: "success",
            statementIndex: index,
            totalStatements: statements.length,
          });
          appendSqlExecutionTimeline(props.connectionId, search.tabId, {
            id: result.customSqlId,
            requestId: result.requestId,
            sql: statement.sql,
            status: "success",
            ranAt: result.ranAt ?? Date.now(),
            timeTaken: result.timeTaken ?? 0,
            rowCount: result.rowCount ?? 0,
            rowsAffected: result.rowsAffected,
            statementIndex: index,
            totalStatements: statements.length,
          });
        } catch (error) {
          if (controller.signal.aborted || isQueryAbortError(error)) throw error;
          collected.push({
            sql: statement.sql,
            rows: [],
            columns: [],
            rowCount: 0,
            rowsAffected: undefined,
            timeTaken: 0,
            ranAt: Date.now(),
            status: "error",
            error: formatDbError(error),
            statementIndex: index,
            totalStatements: statements.length,
          });
          appendSqlExecutionTimeline(props.connectionId, search.tabId, {
            id: `error-${Date.now()}-${index}`,
            requestId: extractSqlRequestId(error),
            sql: statement.sql,
            status: "error",
            ranAt: Date.now(),
            error: formatDbError(error),
            statementIndex: index,
            totalStatements: statements.length,
          });
          break;
        }
      }
      setResultSets(collected);
    } catch (error) {
      if (!isQueryAbortError(error)) {
        toaster.create({
          title: "Statement failed",
          description: formatDbError(error),
          type: "error",
        });
      }
    } finally {
      setIsMultiRunPending(false);
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  const onRunInTransaction = (editorValue: string) => {
    latestEditorSqlRef.current = editorValue;
    if (activeTransactionId) {
      onRunQuery(editorValue);
      return;
    }
    const statements = splitSqlStatements(editorValue);
    if (statements.length <= 1) {
      onRunQuery(editorValue);
      return;
    }
    const readOnlyError = statements
      .map((statement) =>
        guardReadOnlyMutation(props.activeConnectionUrl, {
          isSelect: isReadOnlyQuery(statement.sql),
        }),
      )
      .find(Boolean);
    if (readOnlyError) {
      toaster.create({ title: "Read-only connection", description: readOnlyError, type: "error" });
      return;
    }

    const execute = () => {
      executeCustomSqlMutation.mutate({
        data: {
          url: props.activeConnectionUrl,
          sql: editorValue,
          schemaName: search.schema || undefined,
          tableName: search.table || undefined,
          previousId: search.customSqlId,
          transactionMode: true,
        },
      });
      setShowDestructiveConfirm(false);
      setPendingQueryExecution(null);
    };
    executeCustomSqlMutation.reset();
    if (statements.some((statement) => isDestructiveQuery(statement.sql))) {
      setPendingQuerySummary(`Run ${statements.length} statements atomically`);
      setPendingQueryExecution(() => execute);
      setShowDestructiveConfirm(true);
      return;
    }
    execute();
  };

  const onRunQuery = (editorValue?: string, statementSql?: string) => {
    // An untouched Monaco never fires onChange, so the editor value can be an
    // empty STRING (not just undefined) — fall through to the seeded sources
    // instead of silently no-oping on falsy-but-not-nullish input.
    const editorSql = editorValue != null && editorValue.trim() !== "" ? editorValue : undefined;
    const selectedSql =
      statementSql != null && statementSql.trim() !== "" ? statementSql : undefined;
    const sqlToRun =
      selectedSql ??
      editorSql ??
      search.customSql ??
      storedData?.sql ??
      executeCustomSqlMutation.variables?.data.sql;
    if (!sqlToRun) return;
    latestEditorSqlRef.current = editorSql ?? search.customSql ?? storedData?.sql ?? sqlToRun;

    const statements = splitSqlStatements(sqlToRun);
    const runSingle = (sql: string) => {
      setExecutedSql(sql);
      const readOnlyError = guardReadOnlyMutation(props.activeConnectionUrl, {
        isSelect: isReadOnlyQuery(sql),
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
              transactionId: activeTransactionId,
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
          transactionId: activeTransactionId,
        },
      });
    };

    if (statements.length <= 1) {
      setResultSets([]);
      setActiveResultIndex(0);
      runSingle(sqlToRun);
      return;
    }

    const runAll = () => void executeMultipleStatements(statements);
    executeCustomSqlMutation.reset();
    if (statements.some((statement) => isDestructiveQuery(statement.sql))) {
      setPendingQuerySummary(
        `Run ${statements.length} statements, including destructive operations`,
      );
      setPendingQueryExecution(() => runAll);
      setShowDestructiveConfirm(true);
      return;
    }
    runAll();
  };

  const handleReExecuteStored = () => {
    const sql = storedData?.sql;
    if (!sql) return;
    latestEditorSqlRef.current = sql;
    setExecutedSql(sql);

    const readOnlyError = guardReadOnlyMutation(props.activeConnectionUrl, {
      isSelect: isReadOnlyQuery(sql),
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
        transactionId: activeTransactionId,
      },
    });
  };

  const transactionStatus: "idle" | "active" | "busy" =
    transactionBusy?.tabId === search.tabId ? "busy" : activeTransactionId ? "active" : "idle";

  useEffect(() => {
    if (!activeTransactionId || typeof window === "undefined") return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [activeTransactionId]);

  return {
    onRunQuery,
    onRunInTransaction,
    transactionStatus,
    onBeginTransaction,
    onCommitTransaction,
    onRollbackTransaction,
    onRerunStoredQuery: handleReExecuteStored,
    onCancel: () => {
      abortQueryController(abortControllerRef.current);
      abortControllerRef.current = null;
      setIsMultiRunPending(false);
      // Reset after abort so a late AbortError does not stick the mutation in error.
      executeCustomSqlMutation.reset();
      appendSqlExecutionTimeline(props.connectionId, search.tabId, {
        id: `cancelled-${Date.now()}`,
        sql: executeCustomSqlMutation.variables?.data.sql ?? "",
        status: "cancelled",
        ranAt: Date.now(),
      });
    },
    output,
    executedSql,
    resultSets,
    isMultiRunPending,
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
          setPendingQuerySummary(null);
        }}
        onCancel={() => {
          setShowDestructiveConfirm(false);
          setPendingQueryExecution(null);
          setPendingQuerySummary(null);
        }}
        queryType={
          pendingQuerySummary ??
          getDestructiveQuerySummary(search.customSql || storedData?.sql || "")
        }
        isLoading={executeCustomSqlMutation.isPending || isMultiRunPending}
      />
    ),
  };
};

type UseExecuteCustomSqlOutput = ReturnType<typeof useExecuteCustomSql>;

const CustomSqlTabContent = (props: {
  executeCustomSql: UseExecuteCustomSqlOutput;
  connectionId: string;
  onOpenAiSidechat?: (attachment: ChatContextAttachment) => void;
  draftSql?: string;
}) => {
  const { executeCustomSql } = props;
  const tabId = useActiveTabState((tab) => tab.tabId);

  const [jsFilter, setJsFilter] = useState("");
  const [resultPresentation, setResultPresentation] = useState<"table" | "chart">("table");
  const [inspectedCell, setInspectedCell] = useState<{
    columnId: string;
    value: unknown;
  } | null>(null);
  const [copiedResult, setCopiedResult] = useState<string | null>(null);
  const [pinnedResultIndexes, setPinnedResultIndexes] = useState<Set<number>>(
    () => new Set<number>(),
  );
  const [storedPinnedResults, setStoredPinnedResults] = useState<StoredSqlResult[]>([]);
  const [activePinnedResultId, setActivePinnedResultId] = useState<string | null>(null);
  const [executionTimeline, setExecutionTimeline] = useState<
    ReturnType<typeof readSqlExecutionTimeline>
  >([]);

  useEffect(() => {
    setStoredPinnedResults(readStoredSqlResults(props.connectionId, tabId));
    setActivePinnedResultId(null);
    setExecutionTimeline(readSqlExecutionTimeline(props.connectionId, tabId));
  }, [props.connectionId, tabId]);

  useEffect(() => {
    setExecutionTimeline(readSqlExecutionTimeline(props.connectionId, tabId));
  }, [
    props.connectionId,
    tabId,
    executeCustomSql.mutation.data,
    executeCustomSql.mutation.error,
    executeCustomSql.resultSets.length,
  ]);

  const activePinnedResult =
    storedPinnedResults.find((result) => result.id === activePinnedResultId) ?? null;
  const activeSet = executeCustomSql.resultSets[executeCustomSql.activeResultIndex] ?? null;
  const displayedResult = activePinnedResult ?? activeSet ?? executeCustomSql.output;
  const outputRows = displayedResult?.rows ?? [];
  const outputColumns = displayedResult?.columns ?? [];
  const activeResult = displayedResult;
  const normalizedDraft = props.draftSql?.replace(/\s+/g, " ").trim();
  const normalizedExecuted = executeCustomSql.executedSql?.replace(/\s+/g, " ").trim();
  const isDraftStale =
    !activePinnedResult &&
    executeCustomSql.resultSets.length <= 1 &&
    Boolean(normalizedDraft) &&
    Boolean(normalizedExecuted) &&
    normalizedDraft !== normalizedExecuted;

  const pinCurrentResult = (result: {
    id?: string;
    requestId?: string;
    sql: string;
    rows: Record<string, unknown>[];
    columns: string[];
    rowCount: number;
    rowsAffected?: number;
    timeTaken: number;
    ranAt: number;
    statementIndex?: number;
    totalStatements?: number;
  }) => {
    const id = result.id ?? result.requestId;
    if (!id) return;
    setStoredPinnedResults(
      pinSqlResult(props.connectionId, tabId, {
        ...result,
        id,
      }),
    );
  };

  useEffect(() => {
    if (executeCustomSql.resultSets.length === 0) setPinnedResultIndexes(new Set());
  }, [executeCustomSql.resultSets.length]);

  const filteredRows = useMemo(() => {
    const query = jsFilter.trim().toLocaleLowerCase();
    if (!query) {
      return outputRows;
    }
    return outputRows.filter((row) =>
      Object.values(row).some((value) => {
        const formatted =
          value !== null && typeof value === "object"
            ? JSON.stringify(value)
            : String(value ?? "NULL");
        return formatted.toLocaleLowerCase().includes(query);
      }),
    );
  }, [outputRows, jsFilter]);

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

  const copyResult = async (format: "json" | "csv" | "tsv") => {
    const copied = await copyToClipboard(stringifyRows(filteredRows, outputColumns, { format }));
    if (!copied) return;
    setCopiedResult(format);
    window.setTimeout(() => setCopiedResult(null), 1800);
  };
  const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(null);

  const search = useActiveTabState((tab) => ({
    tabId: tab.tabId,
    tableSize: tab.tableSize,
  }));

  // Loading state
  if (
    executeCustomSql.mutation.isPending ||
    executeCustomSql.isMultiRunPending ||
    (executeCustomSql.storedQuery.isLoading && storedPinnedResults.length === 0)
  ) {
    return (
      <Stack className="flex flex-1 items-center justify-center">
        <Spinner />
        <span className="text-muted-foreground">
          {executeCustomSql.isMultiRunPending
            ? "Executing statements sequentially..."
            : executeCustomSql.mutation.isPending
              ? "Executing SQL query..."
              : "Fetching previous output..."}
        </span>
      </Stack>
    );
  }

  // Error state
  if (executeCustomSql.mutation.isError) {
    const errorMessage = formatDbError(executeCustomSql.mutation.error);
    const canRetry = !/(syntax|permission|read-only|no such column|does not exist)/i.test(
      errorMessage,
    );
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Stack className="w-full max-w-2xl">
          <ErrorBoundaryCard
            error={executeCustomSql.mutation.error}
            title="Error executing custom SQL"
            onRetry={canRetry ? executeCustomSql.onRunQuery : undefined}
          />
        </Stack>
      </div>
    );
  }

  // Rows affected (non-SELECT query)
  if (
    executeCustomSql.resultSets.length === 0 &&
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
          {activeResult ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Completed in {activeResult.timeTaken} ms
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  // Pending custom SQL (not yet executed)
  if (
    executeCustomSql.hasPendingCustomSql &&
    !executeCustomSql.hasMutationResult &&
    storedPinnedResults.length === 0
  ) {
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
  if (
    outputRows.length > 0 ||
    executeCustomSql.resultSets.length > 0 ||
    activePinnedResult ||
    storedPinnedResults.length > 0
  ) {
    const failedStatementIndexes = executeCustomSql.resultSets
      .filter((set) => set.status === "error")
      .map((set) => set.statementIndex + 1);
    const completedStatementIndexes = executeCustomSql.resultSets
      .filter((set) => set.status === "success")
      .map((set) => set.statementIndex + 1);
    return (
      <div className="relative flex flex-1 flex-col overflow-auto">
        {storedPinnedResults.length > 0 ? (
          <div
            className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1"
            data-testid="sql-pinned-results"
          >
            <span className="text-muted-foreground mr-1 text-xs">Pinned:</span>
            {storedPinnedResults.map((result) => (
              <div key={result.id} className="flex items-center gap-0.5">
                <Button
                  size="sm"
                  variant={activePinnedResultId === result.id ? "default" : "outline"}
                  className="h-7 max-w-56 truncate text-xs"
                  onClick={() => setActivePinnedResultId(result.id)}
                  title={result.sql}
                  data-testid={`sql-pinned-result-${result.id}`}
                >
                  {result.sql.replace(/\s+/g, " ").slice(0, 28)}
                  {result.sql.length > 28 ? "…" : ""}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  aria-label={`Unpin result ${result.id}`}
                  onClick={() => {
                    setStoredPinnedResults(unpinSqlResult(props.connectionId, tabId, result.id));
                    if (activePinnedResultId === result.id) setActivePinnedResultId(null);
                  }}
                >
                  <PinOff className="size-3.5" />
                </Button>
              </div>
            ))}
            {activePinnedResultId ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setActivePinnedResultId(null)}
              >
                Current run
              </Button>
            ) : null}
          </div>
        ) : null}
        {executeCustomSql.resultSets.length > 1 ? (
          <>
            <div
              className="flex shrink-0 flex-wrap gap-1 border-b px-2 py-1"
              data-testid="sql-result-sets"
            >
              {executeCustomSql.resultSets.map((set, i) => (
                <div key={i} className="flex items-center gap-0.5">
                  <Button
                    size="sm"
                    variant={executeCustomSql.activeResultIndex === i ? "default" : "outline"}
                    className="h-7 max-w-full text-xs"
                    data-testid={`sql-result-set-${i}`}
                    onClick={() => executeCustomSql.setActiveResultIndex(i)}
                    title={set.sql}
                  >
                    {`#${i + 1} ${set.sql.replace(/\s+/g, " ").slice(0, 22)}${set.sql.length > 22 ? "…" : ""}`}
                    {set.status === "error"
                      ? " (failed)"
                      : set.rowsAffected !== undefined
                        ? ` (${set.rowsAffected} affected)`
                        : ` (${set.rowCount})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    aria-label={`${pinnedResultIndexes.has(i) || storedPinnedResults.some((result) => result.id === (set.customSqlId ?? set.requestId)) ? "Unpin" : "Pin"} result ${i + 1}`}
                    aria-pressed={
                      pinnedResultIndexes.has(i) ||
                      storedPinnedResults.some(
                        (result) => result.id === (set.customSqlId ?? set.requestId),
                      )
                    }
                    data-testid={`sql-pin-result-${i}`}
                    title={
                      pinnedResultIndexes.has(i) ||
                      storedPinnedResults.some(
                        (result) => result.id === (set.customSqlId ?? set.requestId),
                      )
                        ? "Unpin result"
                        : "Pin result across runs"
                    }
                    onClick={() => {
                      const resultId = set.customSqlId ?? set.requestId;
                      if (
                        resultId &&
                        storedPinnedResults.some((result) => result.id === resultId)
                      ) {
                        setStoredPinnedResults(unpinSqlResult(props.connectionId, tabId, resultId));
                      } else {
                        pinCurrentResult(set);
                      }
                      setPinnedResultIndexes((previous) => {
                        const next = new Set(previous);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      });
                    }}
                  >
                    {pinnedResultIndexes.has(i) ||
                    storedPinnedResults.some(
                      (result) => result.id === (set.customSqlId ?? set.requestId),
                    ) ? (
                      <PinOff className="size-3.5" />
                    ) : (
                      <Pin className="size-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
            <p
              className={cn(
                "text-muted-foreground shrink-0 border-b px-3 py-1 text-xs",
                failedStatementIndexes.length > 0 && "text-destructive",
              )}
              role={failedStatementIndexes.length > 0 ? "alert" : "status"}
              aria-live="polite"
            >
              {failedStatementIndexes.length > 0
                ? `Statements completed: ${completedStatementIndexes.join(", ") || "none"}. Failed: ${failedStatementIndexes.join(", ")}. Earlier statements remain applied.`
                : "Statements ran sequentially. Earlier statements remain applied if a later statement fails."}
            </p>
          </>
        ) : null}
        {isDraftStale ? (
          <div
            className="bg-muted/50 text-muted-foreground flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-xs"
            data-testid="sql-result-stale"
            role="status"
          >
            <span className="flex-1">Draft changed since this result was run.</span>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
              onClick={() => executeCustomSql.onRunQuery(props.draftSql || undefined)}
            >
              Run draft
            </Button>
          </div>
        ) : null}
        <div className="flex shrink-0 flex-col gap-1 border-b px-2 py-1">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter loaded rows…"
              aria-label="Filter loaded result rows"
              value={jsFilter}
              onChange={(e) => setJsFilter(e.target.value)}
              className="h-7 font-mono text-xs"
            />
          </div>
          {jsFilter.trim() ? (
            <span className="text-muted-foreground text-xs">
              Showing {filteredRows.length} of {outputRows.length} loaded rows
            </span>
          ) : null}
        </div>
        {activeResult ? (
          <div
            className="text-muted-foreground flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1 text-xs"
            data-testid="sql-result-receipt"
            role="status"
            aria-live="polite"
          >
            <span>
              {activeResult.rowsAffected !== undefined
                ? `${activeResult.rowsAffected} rows affected`
                : `${activeResult.rowCount} rows returned`}
            </span>
            <span>{activeResult.timeTaken} ms</span>
            {activeSet ? <span>Statement {activeSet.statementIndex + 1}</span> : null}
            {activePinnedResult ? <span className="text-foreground">Pinned result</span> : null}
            {(activeSet?.requestId ?? executeCustomSql.output?.requestId) ? (
              <span
                data-testid="sql-request-id"
                title={activeSet?.requestId ?? executeCustomSql.output?.requestId}
              >
                Request {(activeSet?.requestId ?? executeCustomSql.output?.requestId)?.slice(0, 8)}
              </span>
            ) : null}
            {!activePinnedResult && (activeSet ?? executeCustomSql.output) ? (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-6 gap-1 px-2 text-xs"
                onClick={() => {
                  const result = activeSet ?? executeCustomSql.output;
                  if (!result) return;
                  const id = result.customSqlId ?? result.requestId;
                  if (!id) return;
                  const isPinned = storedPinnedResults.some((item) => item.id === id);
                  setStoredPinnedResults(
                    isPinned
                      ? unpinSqlResult(props.connectionId, tabId, id)
                      : pinSqlResult(props.connectionId, tabId, {
                          id,
                          requestId: result.requestId,
                          sql: activeSet?.sql ?? executeCustomSql.executedSql ?? "",
                          rows: result.rows,
                          columns: result.columns,
                          rowCount: result.rowCount,
                          rowsAffected: result.rowsAffected,
                          timeTaken: result.timeTaken,
                          ranAt: result.ranAt,
                        }),
                  );
                }}
                data-testid="sql-pin-current-result"
              >
                {storedPinnedResults.some(
                  (item) =>
                    item.id ===
                    (activeSet?.customSqlId ??
                      activeSet?.requestId ??
                      executeCustomSql.output?.customSqlId ??
                      executeCustomSql.output?.requestId),
                ) ? (
                  <PinOff className="size-3.5" />
                ) : (
                  <Pin className="size-3.5" />
                )}
                {storedPinnedResults.some(
                  (item) =>
                    item.id ===
                    (activeSet?.customSqlId ??
                      activeSet?.requestId ??
                      executeCustomSql.output?.customSqlId ??
                      executeCustomSql.output?.requestId),
                )
                  ? "Unpin"
                  : "Pin result"}
              </Button>
            ) : null}
          </div>
        ) : null}
        {executionTimeline.length > 0 ? (
          <details className="border-b px-3 py-1" data-testid="sql-execution-timeline">
            <summary className="text-muted-foreground flex cursor-pointer list-none items-center gap-1 text-xs">
              <History className="size-3.5" />
              Execution timeline ({executionTimeline.length})
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-6 px-2 text-xs"
                onClick={(event) => {
                  event.preventDefault();
                  clearSqlExecutionTimeline(props.connectionId, tabId);
                  setExecutionTimeline([]);
                }}
              >
                Clear
              </Button>
            </summary>
            <div className="mt-2 grid gap-1 pb-1">
              {executionTimeline.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-muted/30 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 rounded px-2 py-1 text-xs"
                >
                  <span
                    className={cn(
                      "font-medium",
                      entry.status === "success"
                        ? "text-green-700 dark:text-green-300"
                        : entry.status === "error"
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {entry.status}
                  </span>
                  <span className="text-muted-foreground truncate">{entry.sql}</span>
                  {entry.timeTaken !== undefined ? <span>{entry.timeTaken} ms</span> : null}
                  {entry.requestId ? (
                    <span className="text-muted-foreground" title={entry.requestId}>
                      {entry.requestId.slice(0, 8)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
        {activeSet?.status === "error" ? (
          <div
            className="border-destructive/30 bg-destructive/10 text-destructive shrink-0 border-b px-3 py-2 text-sm"
            role="alert"
          >
            Statement {activeSet.statementIndex + 1} failed: {activeSet.error}
          </div>
        ) : null}
        <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1">
          <Button
            size="sm"
            variant={resultPresentation === "table" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setResultPresentation("table")}
          >
            Table
          </Button>
          <Button
            size="sm"
            variant={resultPresentation === "chart" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setResultPresentation("chart")}
          >
            Visualize
          </Button>
          {props.onOpenAiSidechat ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs sm:ml-auto"
              onClick={() =>
                props.onOpenAiSidechat?.({
                  kind: "result",
                  columns: outputColumns,
                  rowCount: executeCustomSql.output?.rowCount ?? outputRows.length,
                  rows: outputRows,
                })
              }
              data-testid="ask-ai-result"
            >
              <Sparkles className="size-3" />
              Explain result
            </Button>
          ) : null}
          <Menu>
            <MenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                aria-label="Export result"
              >
                <Download className="size-3" />
                Export
              </Button>
            </MenuTrigger>
            <MenuContent>
              {(["json", "csv", "tsv"] as const).map((format) => (
                <MenuItem
                  key={format}
                  value={`copy-${format}`}
                  onClick={() => void copyResult(format)}
                >
                  {copiedResult === format ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copiedResult === format
                    ? `Copied ${format.toUpperCase()}`
                    : `Copy ${format.toUpperCase()}`}
                </MenuItem>
              ))}
              <MenuItem
                value="download-json"
                onClick={() =>
                  exportRows(filteredRows, outputColumns, {
                    format: "json",
                    filename: "query-result.json",
                  })
                }
              >
                <Download className="size-4" /> Download JSON
              </MenuItem>
              <MenuItem
                value="download-csv"
                onClick={() =>
                  exportRows(filteredRows, outputColumns, {
                    format: "csv",
                    filename: "query-result.csv",
                  })
                }
              >
                <Download className="size-4" /> Download CSV
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        {resultPresentation === "chart" ? (
          <ResultVisualization rows={filteredRows} columns={outputColumns} />
        ) : null}
        <ColumnHeaderContextProvider>
          {resultPresentation === "table" ? (
            <>
              <DataTable
                enableRowVirtualization
                enableColumnOrdering
                enableFind
                onCellDoubleClick={(_row, columnId, value) => setInspectedCell({ columnId, value })}
                table={table}
                getTableContainer={setTableContainer}
                isLoading={false}
                size={search.tableSize}
              />
              <ScrollToColumnButton table={table} containerRef={{ current: tableContainer }} />
            </>
          ) : null}
        </ColumnHeaderContextProvider>
        <Dialog
          open={inspectedCell !== null}
          onOpenChange={({ open }) => !open && setInspectedCell(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cell value · {inspectedCell?.columnId}</DialogTitle>
              <DialogDescription>
                Double-click any result cell to inspect its complete value.
              </DialogDescription>
            </DialogHeader>
            <pre className="bg-muted max-h-[60vh] overflow-auto rounded p-4 font-mono text-sm break-words whitespace-pre-wrap">
              {inspectedCell
                ? (JSON.stringify(inspectedCell.value, null, 2) ?? String(inspectedCell.value))
                : ""}
            </pre>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  void copyToClipboard(
                    inspectedCell
                      ? (JSON.stringify(inspectedCell.value, null, 2) ??
                          String(inspectedCell.value))
                      : "",
                  )
                }
              >
                <Copy className="size-4" /> Copy value
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
