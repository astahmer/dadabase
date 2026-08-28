import { createListCollection } from "@ark-ui/react/select";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  Clipboard,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileText,
  KeyRound,
  MessageSquarePlus,
  MoreHorizontal,
  PencilLine,
  Pin,
  PinOff,
  PanelLeft,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { FilterOperatorType } from "#src/components/query-builder/query-filter.ts";
import type { AiSchemaContext, AiTableContext } from "#src/lib/ai/ai-types.ts";
import type { ChatSidechatSide } from "#src/lib/ai/chat-sidechat-preferences.ts";
import type { Conversation } from "#src/lib/chat/protocol/resources.ts";

import { getDialectDefaultSchema, type DatabaseDialect } from "#src/db/dialect.ts";
import { useDocumentTitle } from "#src/hooks/use-document-title.ts";
import {
  clearStoredByokConfig,
  getRecentChatModels,
  getStoredByokConfig,
  getStoredEnabledChatTools,
  hasUsableByokConfig,
  rememberChatModel,
  setStoredByokConfig,
  setStoredChatModel,
  setStoredEnabledChatTools,
} from "#src/lib/ai-byok.ts";
import {
  AI_PROVIDER_PRESETS,
  CUSTOM_PROVIDER_ID,
  getAiProviderPreset,
  isProviderKeyOptional,
} from "#src/lib/ai/ai-providers.ts";
import {
  parseComposerCommand,
  runComposerCommand,
  UNKNOWN_COMMAND_HINT,
} from "#src/lib/ai/chat-composer-commands.ts";
import {
  grantSchemaSharingConsent,
  hasSchemaSharingConsent,
  revokeSchemaSharingConsent,
} from "#src/lib/ai/chat-consent.ts";
import {
  consumeChatContextPromotion,
  chatContextAttachmentKey,
  dataClassesForChatContext,
  sanitizeChatContextAttachments,
  type ChatContextAttachment,
} from "#src/lib/ai/chat-context.ts";
import {
  DEFAULT_CHAT_DATA_ACCESS,
  getStoredChatDataAccess,
  setStoredChatDataAccess,
  type ChatDataAccess,
} from "#src/lib/ai/chat-data-access.ts";
import {
  applySelectedTables,
  getStoredChatSchemaSelection,
  getLastResolvedAutoTables,
  SCHEMA_RESOLVED_EVENT,
  SCHEMA_SELECTION_CHANGED_EVENT,
  setStoredChatSchemaSelection,
  type ChatSchemaMode,
  type StoredChatSchemaSelection,
} from "#src/lib/ai/chat-schema-selection.ts";
import { CHAT_TOOLS, DEFAULT_ENABLED_CHAT_TOOLS } from "#src/lib/ai/chat-tools.ts";
import { findPendingApproval } from "#src/lib/chat/chat/ui-messages.ts";
import {
  ChatProvider,
  useChatActions,
  useChatRuntime,
  useChatSelector,
} from "#src/lib/chat/react-hooks.ts";
import { conversationMarkdown } from "#src/lib/chat/web/conversation/conversation-markdown.ts";
import { ThreadMessage } from "#src/lib/chat/web/thread/thread-message.tsx";
import { stageChatReturn, stageCustomSqlRun } from "#src/lib/custom-sql-run-handoff.ts";
import { SQL_PREVIEW_REVEAL_SIZE } from "#src/lib/sql-preview-panel.ts";
import { cn } from "#src/lib/utils.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { getAllTablesColumnsQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-columns.start.ts";

import type { DbConnection } from "../connection.types.ts";

import { announce } from "../../ui/aria-live.tsx";
import { Badge } from "../../ui/badge.tsx";
import { Button, buttonVariants } from "../../ui/button.tsx";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../../ui/checkbox.tsx";
import { Input } from "../../ui/input.tsx";
import { Label } from "../../ui/label.tsx";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../../ui/menu.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemGroup,
  SelectItemGroupLabel,
  SelectTrigger,
  SelectValueText,
} from "../../ui/select.tsx";
import { Spinner } from "../../ui/spinner.tsx";
import { Textarea } from "../../ui/textarea.tsx";
import { toaster } from "../../ui/toaster.tsx";
import { createTabState } from "./create-tab-state.ts";
import {
  BYOK_CHANGED_EVENT,
  chatComposerDraftStorageKey,
  useDadabaseChatRuntime,
} from "./use-chat-runtime.tsx";

/**
 * First-class AI chat surface (replaces the retired assistant drawer):
 * full-height thread + composer + provider settings + thread list.
 *
 * The NL → SQL bridge deep-links back to the connection page with the SQL
 * seeded into the tab's custom-SQL editor (`updateTabState`), mirroring what
 * the drawer's Apply button did. "Run" additionally stages an auto-run in
 * sessionStorage keyed by the NEW tab id; the freshly-mounted editor consumes
 * it exactly once on mount (see custom-sql-run-handoff.ts) — no timing-
 * sensitive polling across navigation.
 */
export const AiChatPage = ({
  connectionName,
  initialConversationId,
  initialAskTable,
  initialAiIntent,
  embedded,
  variant = "page",
  onClose,
  onOpenFullChat,
  contextAttachments,
  sidechatSide,
  onSidechatSideChange,
}: {
  connectionName: string;
  /** Audit S8: `?thread=` deep link — select this conversation on mount. */
  initialConversationId?: string;
  /** Audit K4: `?askTable=` deep link — scope schema + pre-seed a draft. */
  initialAskTable?: string;
  /** "sql" seeds a propose-a-query draft instead of explore phrasing. */
  initialAiIntent?: "chat" | "sql";
  /** Rendered inside a workspace tab: keep tab-state URLs intact, skip
   * flat-route URL cleanup, and never discard sibling tabs on "Use this SQL". */
  embedded?: boolean;
  /** Full-page deep work or compact contextual workspace sidechat. */
  variant?: "page" | "sidechat";
  onClose?: () => void;
  onOpenFullChat?: (
    attachments?: readonly ChatContextAttachment[],
    conversationId?: string,
  ) => void;
  /** Ephemeral workspace context; row/result values are disclosure-gated. */
  contextAttachments?: readonly ChatContextAttachment[];
  sidechatSide?: ChatSidechatSide;
  onSidechatSideChange?: (side: ChatSidechatSide) => void;
}) => {
  const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
  useDocumentTitle(`${connectionName} · AI assistant — Dadabase`);
  const connection: DbConnection | undefined = connectionList.data.find(
    (c) => c.name === connectionName,
  );
  const [promotedContextAttachments, setPromotedContextAttachments] = useState<
    readonly ChatContextAttachment[]
  >([]);
  useEffect(() => {
    if (variant !== "page") return;
    setPromotedContextAttachments(consumeChatContextPromotion(connectionName));
  }, [connectionName, variant]);

  if (!connection) {
    return (
      <div className="bg-background flex h-full min-h-0 items-center px-4 py-8">
        <div className="bg-card mx-auto w-full max-w-lg rounded-xl border p-6 shadow-sm">
          <p className="text-muted-foreground text-sm font-medium">Connection unavailable</p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">
            This connection no longer exists
          </h1>
          <Link to="/" className="mt-6 inline-flex">
            <Button>Back to connections</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AiChatPageInner
      connection={connection}
      initialConversationId={initialConversationId}
      initialAskTable={initialAskTable}
      initialAiIntent={initialAiIntent}
      embedded={embedded}
      variant={variant}
      onClose={onClose}
      onOpenFullChat={onOpenFullChat}
      sidechatSide={sidechatSide}
      onSidechatSideChange={onSidechatSideChange}
      contextAttachments={[...(promotedContextAttachments ?? []), ...(contextAttachments ?? [])]}
    />
  );
};

const AiChatPageInner = ({
  connection,
  initialConversationId,
  initialAskTable,
  initialAiIntent,
  embedded,
  variant,
  onClose,
  onOpenFullChat,
  contextAttachments,
  sidechatSide,
  onSidechatSideChange,
}: {
  connection: DbConnection;
  initialConversationId?: string;
  initialAskTable?: string;
  initialAiIntent?: "chat" | "sql";
  embedded?: boolean;
  variant: "page" | "sidechat";
  onClose?: () => void;
  onOpenFullChat?: (
    attachments?: readonly ChatContextAttachment[],
    conversationId?: string,
  ) => void;
  sidechatSide?: ChatSidechatSide;
  onSidechatSideChange?: (side: ChatSidechatSide) => void;
  contextAttachments?: readonly ChatContextAttachment[];
}) => {
  const navigate = useNavigate();
  // The full-page chat is still rendered inside the connection workspace
  // shell. Keep inherited workspace search state intact so its tabs and pane
  // layout survive an AI visit and the back link can restore the exact view.
  // Dialect-aware: SQLite/LibSQL live in "main", Postgres in "public".
  const [schema] = useState(() => getDialectDefaultSchema(connection.dialect));
  // Keep the conversation visible on first visit. Missing setup is explained
  // inline with one CTA; the full provider form remains one click away.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Audit S2: consent is a durable per-connection decision, not component
  // state — re-gating every visit trains users to stop reading the banner.
  // Storage read happens in an effect (not a lazy initializer) so server and
  // client first renders agree; the banner may flash for one frame.
  const [hasApprovedSchemaSharing, setHasApprovedSchemaSharing] = useState(false);
  useEffect(() => {
    setHasApprovedSchemaSharing(hasSchemaSharingConsent(connection.name));
  }, [connection.name]);
  const [chatDataAccess, setChatDataAccess] = useState<ChatDataAccess>(DEFAULT_CHAT_DATA_ACCESS);
  useEffect(() => {
    setChatDataAccess(getStoredChatDataAccess(connection.name));
  }, [connection.name]);
  const updateChatDataAccess = (patch: Partial<ChatDataAccess>) => {
    setChatDataAccess((current) => {
      const next = { ...current, ...patch };
      setStoredChatDataAccess(connection.name, next);
      window.dispatchEvent(new Event(BYOK_CHANGED_EVENT));
      return next;
    });
  };
  const [threadListOpen, setThreadListOpen] = useState(false);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [pendingFullChatPromotion, setPendingFullChatPromotion] = useState(false);

  /**
   * Reactive BYOK state: localStorage is not a React data source, so the page
   * listens for settings saves/clears and re-reads here. Without this, the
   * Send button stays disabled after saving a config until some unrelated
   * re-render happens (audit C2 "stale render/event issue").
   */
  const [byokState, setByokState] = useState<"loading" | "usable" | "missing">("loading");
  useEffect(() => {
    const refresh = () => setByokState(hasUsableByokConfig() ? "usable" : "missing");
    refresh();
    window.addEventListener(BYOK_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(BYOK_CHANGED_EVENT, refresh);
  }, []);

  const allTablesColumnsQuery = useQuery({
    ...getAllTablesColumnsQueryOptions({ url: connection.url, schema }),
    enabled: !!schema && !!connection.url,
    staleTime: 5 * 60 * 1000,
  });

  const schemaContext = useMemo<AiSchemaContext>(() => {
    const tables: AiTableContext[] = (allTablesColumnsQuery.data ?? []).map((t) => ({
      schema,
      table: t.table,
      dialect: connection.dialect,
      columns: t.columns,
    }));
    return { schema, dialect: connection.dialect, tables };
  }, [allTablesColumnsQuery.data, connection.dialect, schema]);

  const effectiveContextAttachments = useMemo<readonly ChatContextAttachment[]>(() => {
    const current = [...(contextAttachments ?? [])];
    if (
      initialAskTable &&
      !current.some(
        (attachment) => attachment.kind === "table" && attachment.table === initialAskTable,
      )
    ) {
      current.unshift({ kind: "table", schema, table: initialAskTable });
    }
    return [
      ...new Map(
        current.map((attachment) => [chatContextAttachmentKey(attachment), attachment]),
      ).values(),
    ];
  }, [contextAttachments, initialAskTable, schema]);
  const currentContextAttachmentsRef = useRef<readonly ChatContextAttachment[]>(
    effectiveContextAttachments,
  );
  const currentConversationIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    currentContextAttachmentsRef.current = effectiveContextAttachments;
  }, [effectiveContextAttachments]);

  /** Fresh SQL-editor tab pre-seeded with generated SQL. */
  const createEditorTab = (sql: string) => {
    const schema = getDialectDefaultSchema(connection.dialect);
    return createTabState(schema, "", {
      initialTabMode: "sql",
      customSql: sql,
      sqlPreviewSize: SQL_PREVIEW_REVEAL_SIZE,
    });
  };

  /** Audit S8: meta identifies the originating thread for the back-link. */
  const navigateToEditor = (sql: string, newTab = createEditorTab(sql), meta?: ChatReturnMeta) => {
    const schema = getDialectDefaultSchema(connection.dialect);
    if (meta !== undefined) stageChatReturn(newTab.tabId, meta);
    return navigate({
      to: "/connections/$connectionName",
      params: { connectionName: connection.name },
      search: (prev) => {
        // Embedded (workspace tab): add/activate the editor tab WITHOUT
        // discarding sibling tabs — the whole point of AI-as-a-tab.
        if (!embedded || !prev.tabs?.length) {
          return { schema, activeTabId: newTab.tabId, tabs: [newTab] };
        }
        const tabs = prev.tabs.some((t) => t.tabId === newTab.tabId)
          ? prev.tabs.map((t) => (t.tabId === newTab.tabId ? { ...t, ...newTab } : t))
          : [...prev.tabs, newTab];
        return { ...prev, schema, activeTabId: newTab.tabId, tabs };
      },
    });
  };

  const applySqlToEditor = (sql: string, meta?: ChatReturnMeta) => {
    void navigateToEditor(sql, undefined, meta);
  };

  /**
   * Deep-link seeded editor + auto-run: stage the run under the new tab id
   * BEFORE navigating; the mounted editor consumes and executes it exactly
   * once (custom-sql-run-handoff.ts).
   */
  const applySqlAndRun = (sql: string, meta?: ChatReturnMeta) => {
    const newTab = createEditorTab(sql);
    stageCustomSqlRun(newTab.tabId, { sql });
    if (meta !== undefined) stageChatReturn(newTab.tabId, meta);
    void navigateToEditor(sql, newTab);
  };

  /** open_workspace_view card click: browse tab pre-set with the model's state. */
  const openWorkspaceViewTab = (view: {
    table: string;
    schema?: string;
    filters?: Array<{
      column: string;
      operator: FilterOperatorType;
      value?: string | number | boolean;
    }>;
    orderBy?: { column: string; direction: "asc" | "desc" };
    limit?: number;
  }) => {
    const viewSchema = view.schema || getDialectDefaultSchema(connection.dialect);
    const newTab = createTabState(viewSchema, view.table, {
      ...(view.filters
        ? {
            filters: {
              conditions: view.filters.map((filter) =>
                filter.value === undefined
                  ? { column: filter.column, operator: filter.operator }
                  : {
                      column: filter.column,
                      operator: filter.operator,
                      value: filter.value,
                    },
              ),
              logicalOperator: "and" as const,
            },
            filtersOpened: true,
          }
        : {}),
      ...(view.orderBy
        ? { orderBy: view.orderBy.column, orderDirection: view.orderBy.direction }
        : {}),
      ...(view.limit !== undefined ? { limit: view.limit, offset: 0 } : {}),
    });
    return navigate({
      to: "/connections/$connectionName",
      params: { connectionName: connection.name },
      search: (prev) => {
        if (!embedded || !prev.tabs?.length) {
          return { schema: viewSchema, activeTabId: newTab.tabId, tabs: [newTab] };
        }
        const tabs = prev.tabs.some((t) => t.tabId === newTab.tabId)
          ? prev.tabs.map((t) => (t.tabId === newTab.tabId ? { ...t, ...newTab } : t))
          : [...prev.tabs, newTab];
        return { ...prev, schema: viewSchema, activeTabId: newTab.tabId, tabs };
      },
    });
  };

  useEffect(() => {
    if (variant !== "sidechat") return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="ai-sidechat-close"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [variant]);

  useEffect(() => {
    if (variant !== "sidechat") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const root = document.querySelector<HTMLElement>('[data-ai-chat-variant="sidechat"]');
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, variant]);

  const promoteToFullChat = useCallback(() => {
    onOpenFullChat?.(currentContextAttachmentsRef.current, currentConversationIdRef.current);
  }, [onOpenFullChat]);

  useEffect(() => {
    if (!pendingFullChatPromotion || chatStreaming) return;
    setPendingFullChatPromotion(false);
    promoteToFullChat();
  }, [chatStreaming, pendingFullChatPromotion, promoteToFullChat]);

  return (
    <div
      className={cn(
        "bg-background flex h-full min-h-0 flex-col",
        variant === "sidechat" &&
          cn("border-border shadow-2xl", sidechatSide === "left" ? "border-r" : "border-l"),
      )}
      data-testid="ai-chat-page"
      data-ai-chat-variant={variant}
      {...(variant === "sidechat"
        ? {
            role: "dialog" as const,
            "aria-modal": true,
            "aria-labelledby": "ai-sidechat-title",
            "aria-describedby": "ai-sidechat-description",
          }
        : {})}
    >
      {variant === "sidechat" ? (
        <span id="ai-sidechat-description" className="sr-only">
          Ask questions about the current workspace context. Review the sharing permissions before
          sending data to the configured AI provider.
        </span>
      ) : null}
      <header className="border-border flex min-h-12 items-center gap-2 border-b px-3 py-2 sm:gap-3 sm:px-4">
        {variant === "sidechat" ? (
          <div className="flex min-w-0 items-center gap-2" aria-hidden="true">
            <Sparkles className="text-primary size-4 shrink-0" />
            <span className="sr-only">AI sidechat</span>
          </div>
        ) : (
          <Link
            to="/connections/$connectionName"
            params={{ connectionName: connection.name }}
            search={(prev) => prev}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            data-testid="ai-chat-back"
          >
            <ArrowLeft className="size-4" />
            {connection.name}
          </Link>
        )}
        <h1
          id={variant === "sidechat" ? "ai-sidechat-title" : undefined}
          className="min-w-0 truncate text-sm font-semibold"
        >
          {variant === "sidechat" ? connection.name : "AI assistant"}
        </h1>
        <Badge
          variant="outline"
          colorPalette={
            byokState === "loading" ? "muted" : byokState === "usable" ? "success" : "warning"
          }
          size="xs"
          title={
            byokState === "usable"
              ? "Provider is configured in this browser."
              : "Provider setup is required before sending a message."
          }
        >
          {variant === "sidechat"
            ? byokState === "loading"
              ? "Checking provider"
              : byokState === "usable"
                ? "Ready"
                : "Needs setup"
            : byokState === "loading"
              ? "Checking provider"
              : byokState === "usable"
                ? "Provider configured"
                : "Not configured"}
        </Badge>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {variant === "page" ? (
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setThreadListOpen(true)}
              data-testid="ai-threads-toggle"
              aria-label="Show chats"
            >
              <PanelLeft className="size-4" />
              Threads
            </Button>
          ) : (
            <>
              {onOpenFullChat ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    if (chatStreaming) {
                      setPendingFullChatPromotion(true);
                      announce("Full chat will open when this response finishes.");
                      return;
                    }
                    promoteToFullChat();
                  }}
                  disabled={pendingFullChatPromotion}
                  title="Open this conversation in the full chat tab"
                >
                  <span className="hidden sm:inline">
                    {pendingFullChatPromotion ? "Opening…" : "Open full chat"}
                  </span>
                  <span className="sm:hidden">Full chat</span>
                </Button>
              ) : null}
            </>
          )}
          <Button
            variant="ghost"
            size={variant === "sidechat" ? "icon" : "sm"}
            onClick={() => setSettingsOpen((open) => !open)}
            data-testid="ai-settings-toggle"
            aria-expanded={settingsOpen}
            aria-label={`${settingsOpen ? "Hide" : "Show"} AI settings`}
            title={
              sidechatSide === undefined
                ? `${settingsOpen ? "Hide" : "Show"} AI settings`
                : `${settingsOpen ? "Hide" : "Show"} AI settings and sidechat placement`
            }
          >
            <Settings2 className="size-4" />
            {variant === "page" ? <span>Settings</span> : null}
          </Button>
          {variant === "sidechat" && onClose ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label="Close AI sidechat"
              data-testid="ai-sidechat-close"
              title="Close AI sidechat"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </header>

      {settingsOpen && (
        <div
          className={cn(
            "border-border min-h-0 overflow-y-auto border-b",
            variant === "sidechat" ? "max-h-[min(48dvh,30rem)]" : "max-h-[min(55dvh,38rem)]",
          )}
          data-testid="ai-settings-panel"
        >
          <div className="bg-background/95 border-border sticky top-0 z-10 flex items-center justify-between border-b px-4 py-2 backdrop-blur">
            <div>
              <p className="text-sm font-medium">AI settings</p>
              <p className="text-muted-foreground text-[11px]">
                Provider, permissions, tools, and schema scope
              </p>
            </div>
            <Button size="xs" variant="outline" onClick={() => setSettingsOpen(false)}>
              Done
            </Button>
          </div>
          <ProviderSettingsSection
            // Keyed on byokState: defaultOpen must be evaluated AFTER the BYOK
            // probe resolves, not during the initial "loading" pass.
            key={`provider-${byokState}`}
            onDone={() => setSettingsOpen(false)}
            defaultOpen={byokState !== "usable"}
            variant={variant}
          />
          <ToolsSettingsSection defaultOpen={false} />
          <SchemaSettingsSection
            schemaContext={schemaContext}
            schemaLoading={allTablesColumnsQuery.isLoading}
            connectionName={connection.name}
            defaultOpen={false}
          />
          {variant === "sidechat" && onSidechatSideChange ? (
            <SidechatPlacementSettings
              side={sidechatSide ?? "right"}
              onChange={onSidechatSideChange}
            />
          ) : null}
          <ChatDataAccessSettings
            approved={hasApprovedSchemaSharing}
            access={chatDataAccess}
            onChange={updateChatDataAccess}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <AiChatBody
          connection={connection}
          schemaContext={schemaContext}
          schemaLoading={allTablesColumnsQuery.isLoading}
          initialConversationId={initialConversationId}
          providerReady={byokState === "usable"}
          hasApprovedSchemaSharing={hasApprovedSchemaSharing}
          chatDataAccess={chatDataAccess}
          onChatDataAccessChange={updateChatDataAccess}
          onApproveSchemaSharing={() => {
            grantSchemaSharingConsent(connection.name);
            setHasApprovedSchemaSharing(true);
            announce("Schema sharing approved.");
          }}
          onRevokeSchemaSharing={() => {
            revokeSchemaSharingConsent(connection.name);
            setHasApprovedSchemaSharing(false);
            // Audit G6: trust decisions must reach assistive tech.
            announce("Schema-sharing consent revoked.");
          }}
          onApplySql={applySqlToEditor}
          onRunSql={applySqlAndRun}
          onOpenWorkspaceView={openWorkspaceViewTab}
          onOpenProviderSettings={() => setSettingsOpen(true)}
          initialAskTable={initialAskTable}
          initialAiIntent={initialAiIntent}
          onAdoptAutoTables={(tables) => {
            // Audit T2: clicking auto-picked table chips adopts them as the
            // manual selection — "Auto guessed wrong" becomes one click away.
            setStoredChatSchemaSelection(connection.name, {
              mode: "selected",
              selectedTables: [...tables],
            });
            window.dispatchEvent(new Event(SCHEMA_SELECTION_CHANGED_EVENT));
            announce(
              `Schema selection set to ${tables.length} table${tables.length === 1 ? "" : "s"}.`,
            );
          }}
          onOpenSchemaPanel={() => setSettingsOpen(true)}
          contextAttachments={effectiveContextAttachments}
          onContextAttachmentsChange={(attachments) => {
            currentContextAttachmentsRef.current = attachments;
          }}
          onConversationIdChange={(conversationId) => {
            currentConversationIdRef.current = conversationId;
          }}
          onStreamingChange={setChatStreaming}
          threadList={{
            open: threadListOpen,
            onClose: () => setThreadListOpen(false),
          }}
          variant={variant}
        />
      </div>
    </div>
  );
};

const SidechatPlacementSettings = ({
  side,
  onChange,
}: {
  side: ChatSidechatSide;
  onChange: (side: ChatSidechatSide) => void;
}) => (
  <section className="border-border border-t px-4 py-3" data-testid="ai-sidechat-placement">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-medium">Sidechat placement</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Choose which side the panel opens on.
        </p>
      </div>
      <div className="flex shrink-0 gap-1" role="group" aria-label="Sidechat placement">
        {(["left", "right"] as const).map((option) => (
          <Button
            key={option}
            size="xs"
            variant={side === option ? "secondary" : "outline"}
            aria-pressed={side === option}
            onClick={() => onChange(option)}
          >
            {option[0].toUpperCase() + option.slice(1)}
          </Button>
        ))}
      </div>
    </div>
  </section>
);

const ChatDataAccessSettings = ({
  approved,
  access,
  onChange,
}: {
  approved: boolean;
  access: ChatDataAccess;
  onChange: (patch: Partial<ChatDataAccess>) => void;
}) => (
  <section className="border-border border-t px-4 py-3" data-testid="ai-settings-data-access">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-medium">Data sharing</h2>
      <span className="text-muted-foreground text-xs">
        {approved ? "Schema metadata enabled" : "Schema approval required"}
      </span>
    </div>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <label className="flex items-start gap-2 text-xs">
        <Checkbox
          checked={access.sampleRows}
          disabled={!approved}
          onCheckedChange={(details) => onChange({ sampleRows: details.checked === true })}
        >
          <CheckboxControl />
        </Checkbox>
        <span>
          <span className="font-medium">Sample rows</span>
          <span className="text-muted-foreground block">Up to 25 values for preview rows.</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-xs">
        <Checkbox
          checked={access.queryResults}
          disabled={!approved}
          onCheckedChange={(details) => onChange({ queryResults: details.checked === true })}
        >
          <CheckboxControl />
        </Checkbox>
        <span>
          <span className="font-medium">Query results</span>
          <span className="text-muted-foreground block">Approved SQL results for summaries.</span>
        </span>
      </label>
    </div>
  </section>
);

const ContextTablePicker = ({
  open,
  onOpenChange,
  schema,
  tables,
  selectedKeys,
  search,
  onSearchChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema?: string;
  tables: readonly AiTableContext[];
  selectedKeys: ReadonlySet<string>;
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (table: string) => void;
}) => (
  <Popover open={open} onOpenChange={(details) => onOpenChange(details.open)}>
    <PopoverTrigger asChild>
      <Button size="xs" variant="outline" aria-label="Add tables to chat context">
        Add tables
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-72 p-2">
      <p className="px-2 py-1 text-sm font-medium">Add tables</p>
      <Input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search tables"
        aria-label="Search tables to add"
        className="mb-1 h-8 text-xs"
      />
      <div className="max-h-56 overflow-y-auto">
        {tables.length === 0 ? (
          <p className="text-muted-foreground px-2 py-3 text-xs">No tables found.</p>
        ) : (
          tables.map((table) => {
            const key = chatContextAttachmentKey({ kind: "table", schema, table: table.table });
            return (
              <button
                key={table.table}
                type="button"
                className="hover:bg-muted flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs"
                onClick={() => onAdd(table.table)}
              >
                <span className="truncate">{table.table}</span>
                {selectedKeys.has(key) ? <Check className="text-primary size-3.5" /> : null}
              </button>
            );
          })
        )}
      </div>
    </PopoverContent>
  </Popover>
);

/** Provider/key configuration — identical storage contract as the old drawer. */
const ProviderSettingsSection = ({
  onDone,
  defaultOpen = true,
  variant = "page",
}: {
  onDone?: () => void;
  defaultOpen?: boolean;
  variant?: "page" | "sidechat";
}) => {
  const [providerIdDraft, setProviderIdDraft] = useState("openai");
  const [baseUrlDraft, setBaseUrlDraft] = useState("");
  const [modelDraft, setModelDraft] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [hasConfig, setHasConfig] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Audit C16: saves used to be silent — flash an explicit confirmation.
  const [saveFlash, setSaveFlash] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState<string | undefined>(undefined);
  // Audit C7: configured sections start collapsed so the thread leads.
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = getStoredByokConfig();
    setHasConfig(hasUsableByokConfig());
    setProviderIdDraft(stored?.providerId ?? "openai");
    setBaseUrlDraft(stored?.baseUrl ?? "");
    setModelDraft(stored?.model ?? "");
    setKeyDraft(stored?.apiKey ?? "");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !open || hasConfig) return;
    const frame = window.requestAnimationFrame(() => {
      const target =
        providerIdDraft === CUSTOM_PROVIDER_ID && baseUrlDraft.trim() === ""
          ? document.getElementById("ai-base-url")
          : document.getElementById("ai-api-key");
      target?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [baseUrlDraft, hasConfig, hydrated, open, providerIdDraft, variant]);

  const saveConfig = () => {
    setStoredByokConfig({
      providerId: providerIdDraft,
      baseUrl: baseUrlDraft.trim() || undefined,
      apiKey: keyDraft,
      model: modelDraft.trim() || undefined,
    });
    setHasConfig(hasUsableByokConfig());
    window.dispatchEvent(new Event(BYOK_CHANGED_EVENT));
    setSaveFlash(true);
    // Audit G6: save confirmations must reach assistive tech, not just sighted users.
    announce("Provider settings saved.");
    window.setTimeout(() => setSaveFlash(false), 2500);
    onDone?.();
  };

  const clearConfig = () => {
    clearStoredByokConfig();
    setProviderIdDraft("openai");
    setBaseUrlDraft("");
    setModelDraft("");
    setKeyDraft("");
    setHasConfig(false);
    window.dispatchEvent(new Event(BYOK_CHANGED_EVENT));
  };

  const selectedPreset = AI_PROVIDER_PRESETS.find((p) => p.id === providerIdDraft);
  const keyOptional = isProviderKeyOptional(providerIdDraft);
  const resolvedBaseUrl = baseUrlDraft.trim() || selectedPreset?.defaultBaseUrl || "";
  const baseUrlError =
    providerIdDraft === CUSTOM_PROVIDER_ID && baseUrlDraft.trim() === ""
      ? "A base URL is required for a custom provider."
      : undefined;
  const apiKeyError =
    !keyOptional && keyDraft.trim() === "" ? "An API key is required." : undefined;

  const testConnection = async () => {
    if (!canSaveConfig({ providerId: providerIdDraft, baseUrl: baseUrlDraft, apiKey: keyDraft })) {
      setTestState("error");
      setTestError(baseUrlError ?? apiKeyError ?? "Complete the provider fields first.");
      announce("Complete the provider fields before testing the connection.");
      return;
    }
    setTestState("testing");
    setTestError(undefined);
    try {
      const modelsUrl = new URL("models", `${resolvedBaseUrl.replace(/\/+$/, "")}/`).toString();
      const response = await fetch(modelsUrl, {
        headers: keyDraft.trim() ? { Authorization: `Bearer ${keyDraft.trim()}` } : undefined,
      });
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
      setTestState("success");
      announce("Provider connection verified.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection could not be verified.";
      setTestState("error");
      setTestError(message);
      announce("Provider connection could not be verified.");
    }
  };

  if (!hydrated) return null;

  return (
    <section
      className="border-border border-b px-4 py-2"
      data-testid="ai-provider-settings"
      data-open={open}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 py-1 text-left"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="ai-section-toggle-provider"
      >
        <ChevronDown
          className={`text-muted-foreground size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <KeyRound className="text-muted-foreground size-3.5" />
        <h2 className="text-sm font-medium">Provider</h2>
        <span className="text-muted-foreground ml-auto text-right text-[11px]">
          <span className="sm:hidden">Browser-only BYOK</span>
          <span className="hidden sm:inline">
            BYOK · saved in this browser · requests are proxied, never stored server-side
          </span>
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div
            className={cn(
              "grid grid-cols-1 gap-2",
              variant === "page" && "lg:grid-cols-[200px_1fr_1fr_auto] lg:items-end",
            )}
          >
            <div>
              <Label className="text-muted-foreground text-xs">OpenAI-compatible provider</Label>
              <Select
                collection={providerCollection}
                value={[providerIdDraft]}
                onValueChange={(details) => setProviderIdDraft(details.value[0] ?? "openai")}
                positioning={{ sameWidth: true }}
              >
                <SelectTrigger data-testid="ai-provider-select" aria-label="AI provider">
                  <SelectValueText placeholder="Pick a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItemGroup>
                    <SelectItemGroupLabel>Hosted</SelectItemGroupLabel>
                    {providerCollection.items
                      .filter(
                        (item) =>
                          !isProviderKeyOptional(item.value) && item.value !== CUSTOM_PROVIDER_ID,
                      )
                      .map((item) => (
                        <SelectItem key={item.value} item={item}>
                          {item.label}
                        </SelectItem>
                      ))}
                  </SelectItemGroup>
                  <SelectItemGroup>
                    <SelectItemGroupLabel>Local / custom</SelectItemGroupLabel>
                    {providerCollection.items
                      .filter((item) => isProviderKeyOptional(item.value))
                      .map((item) => (
                        <SelectItem key={item.value} item={item}>
                          {item.label}
                        </SelectItem>
                      ))}
                  </SelectItemGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ai-base-url" className="text-muted-foreground text-xs">
                Base URL{selectedPreset?.defaultBaseUrl ? " (preset default, editable)" : ""}
              </Label>
              <Input
                id="ai-base-url"
                type="text"
                placeholder={
                  selectedPreset?.defaultBaseUrl || "https://your-endpoint.example.com/v1"
                }
                value={baseUrlDraft}
                onChange={(e) => setBaseUrlDraft(e.target.value)}
                aria-invalid={baseUrlError !== undefined}
                aria-describedby={baseUrlError ? "ai-base-url-error" : undefined}
              />
              {baseUrlError ? (
                <p id="ai-base-url-error" className="text-destructive mt-1 text-[11px]">
                  {baseUrlError}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="ai-model" className="text-muted-foreground text-xs">
                Model (e.g. gpt-4o-mini, llama3.1)
              </Label>
              <Input
                id="ai-model"
                type="text"
                placeholder="gpt-4o-mini"
                value={modelDraft}
                onChange={(e) => setModelDraft(e.target.value)}
              />
            </div>
            {!keyOptional ? (
              <div>
                <Label htmlFor="ai-api-key" className="text-muted-foreground text-xs">
                  API key — localStorage only
                </Label>
                <div className="relative">
                  <Input
                    id="ai-api-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="sk-…"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    className="pe-9"
                    aria-invalid={apiKeyError !== undefined}
                    aria-describedby={apiKeyError ? "ai-api-key-error" : undefined}
                  />
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
                    onClick={() => setShowApiKey((visible) => !visible)}
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                    title={showApiKey ? "Hide API key" : "Show API key"}
                  >
                    {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {apiKeyError ? (
                  <p id="ai-api-key-error" className="text-destructive mt-1 text-[11px]">
                    {apiKeyError}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground self-end pb-2 text-xs">
                No API key needed for this provider.
              </p>
            )}
          </div>
          {selectedPreset ? (
            <div
              className="border-primary/20 bg-primary/5 rounded-md border px-3 py-2 text-xs"
              data-testid="ai-provider-preset-summary"
            >
              <span className="text-foreground font-medium">{selectedPreset.label}:</span>{" "}
              <span className="text-muted-foreground">
                Save uses{" "}
                <span className="font-mono">
                  {baseUrlDraft.trim() || selectedPreset.defaultBaseUrl || "the entered base URL"}
                </span>
                {keyOptional
                  ? " and does not require an API key."
                  : " with the API key kept in this browser only."}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={saveConfig}
              disabled={
                !canSaveConfig({
                  providerId: providerIdDraft,
                  baseUrl: baseUrlDraft,
                  apiKey: keyDraft,
                })
              }
            >
              Save changes
            </Button>
            {saveFlash && (
              <span className="text-success text-xs font-medium" data-testid="ai-provider-saved">
                <Check className="inline size-3" /> Saved
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={clearConfig}
              disabled={!hasConfig}
              aria-label="Clear AI provider config"
            >
              <Trash2 className="size-3.5" />
              Clear
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void testConnection()}
              disabled={
                testState === "testing" ||
                !canSaveConfig({
                  providerId: providerIdDraft,
                  baseUrl: baseUrlDraft,
                  apiKey: keyDraft,
                })
              }
              data-testid="ai-provider-test"
            >
              {testState === "testing" ? <Spinner size="xs" label="Testing connection" /> : null}
              Test connection
            </Button>
          </div>
          {testState === "success" ? (
            <p className="text-success flex items-center gap-1 text-xs" role="status">
              <CircleCheck className="size-3.5" /> Provider connection verified.
            </p>
          ) : null}
          {testState === "error" ? (
            <p className="text-destructive flex items-start gap-1 text-xs" role="alert">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>{testError ?? "Connection could not be verified."}</span>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
};

/**
 * Tool selection — which tools the assistant may use. Auto-saves on change;
 * the runtime picks the new set up on the next request via BYOK_CHANGED_EVENT.
 */
const ToolsSettingsSection = ({ defaultOpen = false }: { defaultOpen?: boolean }) => {
  const [enabled, setEnabled] = useState(DEFAULT_ENABLED_CHAT_TOOLS);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setEnabled(getStoredEnabledChatTools());
    setHydrated(true);
    // Storage is the source of truth: any other surface (or a remount racing
    // hydration) must never let a stale in-memory selection win a persist.
    const sync = () => setEnabled(getStoredEnabledChatTools());
    window.addEventListener(BYOK_CHANGED_EVENT, sync);
    return () => window.removeEventListener(BYOK_CHANGED_EVENT, sync);
  }, []);

  const persist = (next: (typeof CHAT_TOOLS)[number]["id"][]) => {
    setEnabled(next);
    setStoredEnabledChatTools(next);
    window.dispatchEvent(new Event(BYOK_CHANGED_EVENT));
  };

  const toggleTool = (id: (typeof CHAT_TOOLS)[number]["id"], checked: boolean) => {
    persist(checked ? [...enabled, id] : enabled.filter((tool) => tool !== id));
  };

  if (!hydrated) return null;

  return (
    <section
      className="border-border border-b px-4 py-2"
      data-testid="ai-tools-settings"
      data-open={open}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 py-1 text-left"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          data-testid="ai-section-toggle-tools"
        >
          <ChevronDown
            className={`text-muted-foreground size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <h2 className="text-sm font-medium">Tools</h2>
          <span className="text-muted-foreground text-xs">
            What the assistant is allowed to do.
          </span>
        </button>
        {open && (
          <span className="flex gap-1.5">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => persist(CHAT_TOOLS.map((tool) => tool.id))}
              data-testid="ai-tools-select-all"
            >
              Select all
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => persist([])}
              data-testid="ai-tools-select-none"
            >
              Select none
            </Button>
          </span>
        )}
      </div>
      {open && (
        <ul className="mt-1 space-y-1.5 pb-2">
          {CHAT_TOOLS.map((tool) => (
            <li key={tool.id}>
              <Checkbox
                checked={enabled.includes(tool.id)}
                onCheckedChange={(details) => toggleTool(tool.id, details.checked === true)}
                data-testid={`ai-tool-checkbox-${tool.id}`}
                className="flex items-start gap-2 text-sm"
              >
                <CheckboxControl />
                <CheckboxLabel className="cursor-pointer">
                  <span className="font-medium">
                    {tool.label}{" "}
                    <span className="text-muted-foreground font-normal">
                      {tool.dataClass === "schema"
                        ? "· schema only"
                        : tool.dataClass === "sample-rows"
                          ? "· shares sample rows"
                          : "· shares query results"}
                    </span>
                  </span>
                  <span className="text-muted-foreground block text-xs">{tool.description}</span>
                </CheckboxLabel>
              </Checkbox>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/**
 * Schema scope — which tables ride along as context. Auto-saves on change;
 * the runtime re-reads storage on every request. "Auto" asks the provider to
 * pick the needed subset with one lightweight pre-request per message.
 */
const SCHEMA_MODE_LABELS: Array<{ mode: ChatSchemaMode; label: string; hint: string }> = [
  { mode: "all", label: "All", hint: "Send every table in the schema." },
  { mode: "selected", label: "Selected", hint: "Send only the tables checked below." },
  {
    mode: "auto",
    label: "Auto",
    hint: "One lightweight request picks the tables each question needs.",
  },
];

const SchemaSettingsSection = ({
  schemaContext,
  schemaLoading,
  connectionName,
  defaultOpen = false,
}: {
  schemaContext: AiSchemaContext;
  schemaLoading: boolean;
  connectionName: string;
  defaultOpen?: boolean;
}) => {
  const [selection, setSelection] = useState<StoredChatSchemaSelection>({ mode: "all" });
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setSelection(getStoredChatSchemaSelection(connectionName));
    setHydrated(true);
  }, [connectionName]);

  const persist = (next: StoredChatSchemaSelection) => {
    setSelection(next);
    setStoredChatSchemaSelection(connectionName, next);
    window.dispatchEvent(new Event(SCHEMA_SELECTION_CHANGED_EVENT));
  };

  const tableNames = schemaContext.tables.map((table) => table.table);
  const selectedCount = applySelectedTables(schemaContext, selection.selectedTables).tables.length;

  if (!hydrated) return null;

  return (
    <section
      className="border-border border-b px-4 py-2"
      data-testid="ai-schema-settings"
      data-open={open}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 py-1 text-left"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          data-testid="ai-section-toggle-schema"
        >
          <ChevronDown
            className={`text-muted-foreground size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <h2 className="text-sm font-medium">Database schema</h2>
          <span className="text-muted-foreground text-xs">
            {schemaLoading
              ? "Reading available tables…"
              : `Which tables the assistant can see (${tableNames.length} total).`}
          </span>
        </button>
      </div>
      {open && (
        <div className="mt-1 space-y-2 pb-2">
          <div className="flex gap-1.5" role="radiogroup" aria-label="Schema selection mode">
            {SCHEMA_MODE_LABELS.map(({ mode, label, hint }) => (
              <button
                key={mode}
                type="button"
                className={buttonVariants({
                  size: "xs",
                  variant: selection.mode === mode ? "default" : "outline",
                })}
                /* Audit C5: real radio semantics + unmistakable selected state. */
                role="radio"
                aria-checked={selection.mode === mode}
                title={hint}
                onClick={() => persist({ ...selection, mode })}
                data-testid={`ai-schema-mode-${mode}`}
              >
                {label}
              </button>
            ))}
          </div>
          {selection.mode === "selected" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs">
                  {selectedCount} of {tableNames.length} tables selected
                </span>
                <span className="ml-auto flex gap-1.5">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => persist({ mode: "selected", selectedTables: [...tableNames] })}
                    data-testid="ai-schema-select-all"
                  >
                    Select all
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => persist({ mode: "selected", selectedTables: [] })}
                    data-testid="ai-schema-select-none"
                  >
                    Select none
                  </Button>
                </span>
              </div>
              <ul className="grid max-h-48 grid-cols-1 gap-x-4 gap-y-0.5 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                {tableNames.map((name) => {
                  const checked = selection.selectedTables?.includes(name) ?? false;
                  return (
                    <li key={name}>
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(details) => {
                            const current = new Set(selection.selectedTables ?? []);
                            if (details.checked === true) current.add(name);
                            else current.delete(name);
                            persist({ mode: "selected", selectedTables: [...current] });
                          }}
                          data-testid={`ai-schema-table-checkbox-${name}`}
                        >
                          <CheckboxControl />
                        </Checkbox>
                        <span className="truncate" title={name}>
                          {name}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

/** Consent gate + thread sidebar + chat surface. */
const AiChatBody = ({
  connection,
  schemaContext,
  schemaLoading,
  providerReady,
  hasApprovedSchemaSharing,
  onApproveSchemaSharing,
  onRevokeSchemaSharing,
  chatDataAccess,
  onChatDataAccessChange,
  onApplySql,
  onRunSql,
  onOpenWorkspaceView,
  onOpenProviderSettings,
  initialConversationId,
  initialAskTable,
  initialAiIntent,
  onAdoptAutoTables,
  onOpenSchemaPanel,
  contextAttachments,
  onContextAttachmentsChange,
  onConversationIdChange,
  onStreamingChange,
  threadList,
  variant,
}: {
  connection: DbConnection;
  schemaContext: AiSchemaContext;
  /** Introspection in flight — the status line must not report counts yet. */
  schemaLoading: boolean;
  /** Reactive: stored BYOK config satisfies its provider's key requirement. */
  providerReady: boolean;
  hasApprovedSchemaSharing: boolean;
  onApproveSchemaSharing: () => void;
  /** Audit S2: a persisted grant needs an explicit, announced revoke. */
  onRevokeSchemaSharing: () => void;
  chatDataAccess: ChatDataAccess;
  onChatDataAccessChange: (patch: Partial<ChatDataAccess>) => void;
  /** Audit S8: meta identifies the thread a seeded editor can link back to. */
  onApplySql: (sql: string, meta?: ChatReturnMeta) => void;
  onRunSql: (sql: string, meta?: ChatReturnMeta) => void;
  /** open_workspace_view card click: browse tab with the model's state. */
  onOpenWorkspaceView: (view: {
    table: string;
    schema?: string;
    filters?: Array<{
      column: string;
      operator: FilterOperatorType;
      value?: string | number | boolean;
    }>;
    orderBy?: { column: string; direction: "asc" | "desc" };
    limit?: number;
  }) => void;
  /** Audit S10: auth-class errors deep-link back into provider settings. */
  onOpenProviderSettings: () => void;
  /** Audit S8: `?thread=` deep link consumed once on mount. */
  initialConversationId?: string;
  /** Audit K4: `?askTable=` pre-seeds draft + Selected scope for one table. */
  initialAskTable?: string;
  initialAiIntent?: "chat" | "sql";
  /** Audit T2: adopt auto-picked tables as a manual selection. */
  onAdoptAutoTables: (tables: readonly string[]) => void;
  /** Audit K6: `/schema` opens the schema settings panel. */
  onOpenSchemaPanel: () => void;
  /** Ephemeral table/filter/selection/SQL/result context for this surface. */
  contextAttachments?: readonly ChatContextAttachment[];
  onContextAttachmentsChange: (attachments: readonly ChatContextAttachment[]) => void;
  onConversationIdChange: (conversationId: string | undefined) => void;
  onStreamingChange: (streaming: boolean) => void;
  /** Audit C6/R1: narrow-viewport thread-list drawer state. */
  threadList: { open: boolean; onClose: () => void };
  variant: "page" | "sidechat";
}) => {
  // Audit S8: the ?thread= consumer must live INSIDE ChatProvider (it calls
  // useChatActions); see InitialThreadConsumer below.
  const schemaContextRef = useRef<AiSchemaContext | undefined>(schemaContext);
  schemaContextRef.current = schemaContext;
  const [removedContextKeys, setRemovedContextKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [addedContextAttachments, setAddedContextAttachments] = useState<ChatContextAttachment[]>(
    [],
  );
  const [addTablesOpen, setAddTablesOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const allContextAttachments = useMemo(
    () =>
      [...(contextAttachments ?? []), ...addedContextAttachments].reduce<ChatContextAttachment[]>(
        (items, attachment) => {
          const key = chatContextAttachmentKey(attachment);
          const existingIndex = items.findIndex((item) => chatContextAttachmentKey(item) === key);
          if (existingIndex === -1) return [...items, attachment];
          const next = [...items];
          next[existingIndex] = attachment;
          return next;
        },
        [],
      ),
    [addedContextAttachments, contextAttachments],
  );
  const activeContextAttachments = useMemo(
    () =>
      allContextAttachments.filter(
        (attachment) => !removedContextKeys.has(chatContextAttachmentKey(attachment)),
      ),
    [allContextAttachments, removedContextKeys],
  );
  const contextAttachmentsRef = useRef<readonly ChatContextAttachment[]>(activeContextAttachments);
  contextAttachmentsRef.current = activeContextAttachments;
  const visibleContextAttachments = useMemo(
    () => sanitizeChatContextAttachments(activeContextAttachments, chatDataAccess),
    [activeContextAttachments, chatDataAccess],
  );
  const contextDataClasses = useMemo(
    () => dataClassesForChatContext(visibleContextAttachments),
    [visibleContextAttachments],
  );
  const removeContextAttachment = (attachment: ChatContextAttachment) => {
    const label =
      attachment.kind === "table"
        ? `table ${attachment.table}`
        : attachment.kind === "filters"
          ? `filters for ${attachment.table}`
          : attachment.kind === "selection"
            ? `selection from ${attachment.table}`
            : attachment.kind === "sql"
              ? "SQL draft"
              : "query result";
    setRemovedContextKeys((current) => {
      const next = new Set(current);
      next.add(chatContextAttachmentKey(attachment));
      return next;
    });
    onContextAttachmentsChange(
      activeContextAttachments.filter(
        (currentAttachment) =>
          chatContextAttachmentKey(currentAttachment) !== chatContextAttachmentKey(attachment),
      ),
    );
    announce(`${label} removed for this turn.`);
  };
  const contextTables = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    return schemaContext.tables.filter(
      (table) => query === "" || table.table.toLowerCase().includes(query),
    );
  }, [schemaContext.tables, tableSearch]);
  const addContextTable = (table: string) => {
    const attachment: ChatContextAttachment = {
      kind: "table",
      schema: schemaContext.schema,
      table,
    };
    const key = chatContextAttachmentKey(attachment);
    setRemovedContextKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    if (!activeContextAttachments.some((current) => chatContextAttachmentKey(current) === key)) {
      setAddedContextAttachments((current) =>
        current.some((item) => chatContextAttachmentKey(item) === key)
          ? current
          : [...current, attachment],
      );
      onContextAttachmentsChange([...activeContextAttachments, attachment]);
    }
    announce(`${table} added to chat context.`);
    setAddTablesOpen(false);
    setTableSearch("");
  };

  // Live schema-scope status: mode + how many tables actually go out. Auto's
  // exact count arrives with the first response header, so it re-reads on
  // both the selection-changed and schema-resolved events.
  const [schemaStatus, setSchemaStatus] = useState("");
  useEffect(() => {
    const refresh = () => {
      const selection = getStoredChatSchemaSelection(connection.name);
      const current = schemaContextRef.current;
      if (current === undefined) {
        setSchemaStatus("");
        return;
      }
      const total = current.tables.length;
      // Never report counts before introspection resolves (audit C3: the
      // status line used to say "0 tables" while the sidebar showed six).
      if (total === 0) {
        setSchemaStatus(schemaLoading ? "Reading database schema…" : "");
        return;
      }
      if (selection.mode === "selected") {
        const sent = applySelectedTables(current, selection.selectedTables).tables.length;
        setSchemaStatus(`Using ${sent} of ${total} tables (manually selected).`);
        return;
      }
      if (selection.mode === "auto") {
        const resolved = getLastResolvedAutoTables();
        setSchemaStatus(
          resolved === null
            ? `Auto schema: tables picked per question (${total} available).`
            : `Auto schema: using ${resolved.length} of ${total} tables.`,
        );
        return;
      }
      setSchemaStatus(`Using whole database schema (${total} tables in ${current.schema}).`);
    };
    refresh();
    window.addEventListener(SCHEMA_SELECTION_CHANGED_EVENT, refresh);
    window.addEventListener(SCHEMA_RESOLVED_EVENT, refresh);
    return () => {
      window.removeEventListener(SCHEMA_SELECTION_CHANGED_EVENT, refresh);
      window.removeEventListener(SCHEMA_RESOLVED_EVENT, refresh);
    };
  }, [connection.name, schemaContext, schemaLoading]);

  const runtime = useDadabaseChatRuntime({
    connectionName: connection.name,
    schemaContextRef,
    contextAttachmentsRef,
  });

  return (
    <ChatProvider runtime={runtime}>
      {initialConversationId !== undefined && (
        <InitialThreadConsumer initialConversationId={initialConversationId} />
      )}
      {variant === "page" ? (
        <ThreadListPanel overlayOpen={threadList.open} onClose={threadList.onClose} />
      ) : null}
      <main className="flex min-w-0 flex-1 flex-col">
        {visibleContextAttachments.length > 0 ? (
          <div
            className="border-border bg-muted/20 mx-3 mt-3 rounded-md border px-3 py-2 text-xs"
            data-testid="ai-context-attachments"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-medium">Context for this chat</span>
                <span className="text-muted-foreground">
                  {visibleContextAttachments.length} attachment
                  {visibleContextAttachments.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[11px]">
                  {contextDataClasses.includes("sample-rows") ||
                  contextDataClasses.includes("query-results")
                    ? "Values allowed by permission"
                    : "Metadata only"}
                </span>
                <ContextTablePicker
                  open={addTablesOpen}
                  onOpenChange={setAddTablesOpen}
                  schema={schemaContext.schema}
                  tables={contextTables}
                  selectedKeys={
                    new Set(
                      activeContextAttachments.map((attachment) =>
                        chatContextAttachmentKey(attachment),
                      ),
                    )
                  }
                  search={tableSearch}
                  onSearchChange={setTableSearch}
                  onAdd={addContextTable}
                />
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {visibleContextAttachments.map((attachment, index) => {
                const dataClass =
                  attachment.kind === "selection" && attachment.rows?.length
                    ? "values"
                    : attachment.kind === "result" && attachment.rows?.length
                      ? "values"
                      : "metadata only";
                const label =
                  attachment.kind === "table"
                    ? `table: ${attachment.table} · schema`
                    : attachment.kind === "filters"
                      ? `filters: ${attachment.table} · ${attachment.filters.length}`
                      : attachment.kind === "selection"
                        ? `selection: ${attachment.table} · ${attachment.rows?.length ?? attachment.rowIds?.length ?? 0} rows · ${dataClass}`
                        : attachment.kind === "sql"
                          ? `SQL draft · ${attachment.sql.length.toLocaleString()} chars`
                          : `result · ${attachment.rowCount.toLocaleString()} rows · ${dataClass}`;
                return (
                  <div
                    key={`${attachment.kind}-${index}`}
                    className="bg-muted inline-flex max-w-full items-start gap-1 rounded px-1.5 py-0.5 text-left"
                  >
                    {attachment.kind === "sql" || attachment.kind === "result" ? (
                      <details className="min-w-0">
                        <summary className="hover:text-foreground cursor-pointer truncate">
                          {label}
                        </summary>
                        {attachment.kind === "sql" ? (
                          <pre className="bg-background border-border mt-1 max-h-32 max-w-[min(28rem,70vw)] overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap">
                            {attachment.sql}
                          </pre>
                        ) : (
                          <p className="text-muted-foreground mt-1 max-w-[18rem] text-[11px]">
                            Columns: {attachment.columns.join(", ") || "none"}. Values are{" "}
                            {attachment.rows?.length ? "attached." : "not attached."}
                          </p>
                        )}
                      </details>
                    ) : (
                      <span className="truncate">{label}</span>
                    )}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded focus-visible:ring-2 focus-visible:outline-none"
                      title="Remove from this turn"
                      aria-label={`Remove ${label} from this turn`}
                      onClick={() => removeContextAttachment(attachment)}
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-muted-foreground mt-1.5 text-[11px]">
              Included in the next message · remove a chip to exclude it for this turn.
            </p>
          </div>
        ) : variant === "sidechat" ? (
          <div
            className="border-border bg-muted/20 text-muted-foreground mx-3 mt-3 rounded-md border px-3 py-2 text-xs"
            data-testid="ai-context-empty"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-foreground font-medium">Context for this chat</span>
                <span className="ml-2">No tables attached</span>
              </div>
              <ContextTablePicker
                open={addTablesOpen}
                onOpenChange={setAddTablesOpen}
                schema={schemaContext.schema}
                tables={contextTables}
                selectedKeys={
                  new Set(
                    activeContextAttachments.map((attachment) =>
                      chatContextAttachmentKey(attachment),
                    ),
                  )
                }
                search={tableSearch}
                onSearchChange={setTableSearch}
                onAdd={addContextTable}
              />
            </div>
            <p className="mt-1">Add tables here, or open a table/selection to attach it.</p>
          </div>
        ) : null}
        {variant === "sidechat" && (!providerReady || !hasApprovedSchemaSharing) ? (
          <div
            className="border-primary/20 bg-primary/5 mx-3 mt-3 flex items-start justify-between gap-3 rounded-md border px-3 py-2.5"
            data-testid="ai-sidechat-first-run"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {!providerReady ? "Connect an AI provider" : "Approve schema sharing"}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                {!providerReady
                  ? "Add a provider in this browser to start asking questions."
                  : "Share schema names and columns so the assistant can draft SQL. Row values stay off unless you allow them."}
              </p>
            </div>
            {!providerReady ? (
              <Button
                size="xs"
                variant="outline"
                className="shrink-0"
                onClick={onOpenProviderSettings}
                data-testid="ai-sidechat-configure-provider"
              >
                Configure provider
              </Button>
            ) : (
              <Button
                size="xs"
                className="shrink-0"
                onClick={onApproveSchemaSharing}
                data-testid="ai-sidechat-approve-schema"
              >
                Approve schema
              </Button>
            )}
          </div>
        ) : null}
        {variant === "page" && !providerReady ? (
          <div
            className="border-primary/20 bg-primary/5 mx-auto mt-4 flex w-full max-w-3xl items-start justify-between gap-3 rounded-md border px-4 py-3"
            data-testid="ai-page-provider-setup"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">Connect an AI provider to start chatting</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                Your provider settings stay in this browser. The conversation remains visible while
                you finish setup.
              </p>
            </div>
            <Button
              size="xs"
              variant="outline"
              className="shrink-0"
              onClick={onOpenProviderSettings}
              data-testid="ai-page-configure-provider"
            >
              Configure provider
            </Button>
          </div>
        ) : null}
        {/* Audit C1: the full chat surface stays mounted pre-consent — users
            must see what they are unlocking. Only Send is gated. */}
        {!hasApprovedSchemaSharing && variant === "page" && (
          <div className="border-border bg-muted/30 mx-auto mt-4 w-full max-w-3xl px-4">
            <label className="border-border bg-background flex items-start gap-2 rounded-md border p-3 text-sm leading-6">
              <Checkbox
                checked={false}
                aria-labelledby="ai-consent-label"
                onCheckedChange={(details) => {
                  if (details.checked === true) onApproveSchemaSharing();
                }}
                data-testid="ai-schema-sharing-consent"
              >
                <CheckboxControl />
              </Checkbox>
              <span id="ai-consent-label">
                <span className="font-medium">Share schema context with the AI provider</span>
                <span className="text-muted-foreground block text-xs">
                  Dadabase sends this prompt plus schema, table, and column names to draft SQL. It
                  does not send row values under this permission. You review generated SQL before it
                  runs.
                </span>
              </span>
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="border-border bg-background flex items-start gap-2 rounded-md border p-2 text-xs">
                <Checkbox
                  checked={chatDataAccess.sampleRows}
                  disabled={!hasApprovedSchemaSharing}
                  onCheckedChange={(details) =>
                    onChatDataAccessChange({ sampleRows: details.checked === true })
                  }
                  data-testid="ai-sample-rows-consent"
                >
                  <CheckboxControl />
                </Checkbox>
                <span>
                  <span className="font-medium">Allow sample rows</span>
                  <span className="text-muted-foreground block">
                    Let Preview rows share up to 25 row values with the provider.
                  </span>
                </span>
              </label>
              <label className="border-border bg-background flex items-start gap-2 rounded-md border p-2 text-xs">
                <Checkbox
                  checked={chatDataAccess.queryResults}
                  disabled={!hasApprovedSchemaSharing}
                  onCheckedChange={(details) =>
                    onChatDataAccessChange({ queryResults: details.checked === true })
                  }
                  data-testid="ai-query-results-consent"
                >
                  <CheckboxControl />
                </Checkbox>
                <span>
                  <span className="font-medium">Allow query results</span>
                  <span className="text-muted-foreground block">
                    Let approved SQL results be sent back for summarizing.
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}
        {hasApprovedSchemaSharing && variant === "page" && (
          <div
            className="border-border bg-muted/30 mx-auto mt-4 w-full max-w-3xl px-4"
            data-testid="ai-data-access-settings"
          >
            <div className="border-border bg-background rounded-md border p-3 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">Data shared with the AI provider</span>
                <span className="text-muted-foreground">Schema metadata is enabled.</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-start gap-2">
                  <Checkbox
                    checked={chatDataAccess.sampleRows}
                    onCheckedChange={(details) =>
                      onChatDataAccessChange({ sampleRows: details.checked === true })
                    }
                    data-testid="ai-sample-rows-consent"
                  >
                    <CheckboxControl />
                  </Checkbox>
                  <span>
                    <span className="font-medium">Sample rows</span>
                    <span className="text-muted-foreground block">
                      Up to 25 row values for Preview rows.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <Checkbox
                    checked={chatDataAccess.queryResults}
                    onCheckedChange={(details) =>
                      onChatDataAccessChange({ queryResults: details.checked === true })
                    }
                    data-testid="ai-query-results-consent"
                  >
                    <CheckboxControl />
                  </Checkbox>
                  <span>
                    <span className="font-medium">Query results</span>
                    <span className="text-muted-foreground block">
                      Results from approved SQL for summarizing.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
        <ChatSurface
          connectionName={connection.name}
          onApplySql={onApplySql}
          onRunSql={onRunSql}
          onOpenWorkspaceView={onOpenWorkspaceView}
          onOpenProviderSettings={onOpenProviderSettings}
          schemaHint={schemaStatus}
          consentRequired={!hasApprovedSchemaSharing}
          onRevokeSchemaSharing={onRevokeSchemaSharing}
          chatDataAccess={chatDataAccess}
          providerReady={providerReady}
          dialect={connection.dialect}
          initialConversationId={initialConversationId}
          initialAskTable={initialAskTable}
          initialAiIntent={initialAiIntent}
          onAdoptAutoTables={onAdoptAutoTables}
          onOpenSchemaPanel={onOpenSchemaPanel}
          contextAttachments={visibleContextAttachments}
          onConversationIdChange={onConversationIdChange}
          onStreamingChange={onStreamingChange}
          variant={variant}
        />
      </main>
    </ChatProvider>
  );
};

/**
 * Audit K3: date-group hydrated threads for scanability. Pinned threads are
 * lifted into their own bucket regardless of recency.
 */
const THREAD_GROUP_LABELS = ["Pinned", "Today", "Yesterday", "Earlier"] as const;
type ThreadGroupLabel = (typeof THREAD_GROUP_LABELS)[number];

const groupThreadsByRecency = (
  threads: ReadonlyArray<Conversation>,
): Array<[ThreadGroupLabel, Array<Conversation>]> => {
  const buckets = new Map<ThreadGroupLabel, Array<Conversation>>(
    THREAD_GROUP_LABELS.map((label) => [label, []]),
  );
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday.getTime() - 86_400_000;
  for (const thread of threads) {
    let label: ThreadGroupLabel = "Earlier";
    if (thread.pinned === true) {
      label = "Pinned";
    } else {
      const updated = Date.parse(thread.updatedAt);
      if (!Number.isNaN(updated)) {
        if (updated >= startOfToday.getTime()) label = "Today";
        else if (updated >= startOfYesterday) label = "Yesterday";
      }
    }
    buckets.get(label)?.push(thread);
  }
  return [...buckets.entries()].filter(([, group]) => group.length > 0);
};

/** One saved-chat row: select / rename / pin / two-step delete (audit S3). */
const ThreadListItem = ({
  thread,
  active,
  renaming,
  renameDraft,
  confirmingDelete,
  onSelect,
  onRenameStart,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onTogglePin,
  onDeleteRequest,
  onDeleteConfirm,
}: {
  thread: Conversation;
  active: boolean;
  renaming: boolean;
  renameDraft: string;
  confirmingDelete: boolean;
  onSelect: () => void;
  onRenameStart: () => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onTogglePin: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
}) => {
  const title = thread.title || "New chat";
  return (
    <li className="group/thread flex items-center gap-0.5">
      {renaming ? (
        <input
          /* eslint-disable-next-line jsx-a11y/no-autofocus */
          autoFocus
          value={renameDraft}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            // IME-safe: composition-confirming Enter does not commit.
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault();
              onRenameCommit();
            }
            if (e.key === "Escape") onRenameCancel();
          }}
          onBlur={onRenameCommit}
          aria-label="Chat name"
          data-testid="ai-thread-rename-input"
          className="border-input focus-visible:border-ring min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-xs outline-none"
        />
      ) : (
        <button
          type="button"
          className={`hover:bg-muted/60 min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
            active ? "bg-muted font-medium" : ""
          }`}
          onClick={onSelect}
          data-testid="ai-thread-item"
        >
          {thread.pinned === true ? <Pin className="mr-1 inline size-3 shrink-0" /> : null}
          <span className="truncate">{title}</span>
        </button>
      )}
      {!renaming && (
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {confirmingDelete ? (
            <Button
              size="xs"
              variant="outline"
              className="text-destructive"
              aria-label={`Confirm deleting chat ${title}`}
              onClick={onDeleteConfirm}
              data-testid="ai-thread-delete-confirm"
            >
              Confirm
            </Button>
          ) : (
            <Menu>
              <MenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  aria-label={`Actions for chat ${title}`}
                  title="Chat actions"
                  data-testid="ai-thread-actions"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem value="toggle-pin" onClick={onTogglePin}>
                  {thread.pinned === true ? (
                    <PinOff className="size-3.5" />
                  ) : (
                    <Pin className="size-3.5" />
                  )}
                  {thread.pinned === true ? "Unpin chat" : "Pin chat"}
                </MenuItem>
                <MenuItem value="rename" onClick={onRenameStart}>
                  <PencilLine className="size-3.5" />
                  Rename chat
                </MenuItem>
                <MenuItem value="delete" onClick={onDeleteRequest}>
                  <Trash2 className="text-destructive size-3.5" />
                  Delete chat
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
        </div>
      )}
    </li>
  );
};

/**
 * Audit S8: consume the `?thread=` deep link exactly once — select that
 * conversation, then strip the param so refreshes don't re-select forever.
 * Must be a child of ChatProvider (useChatActions) — hence its own component.
 * Deferred one tick like the thread-list hydration effect: xstate v5 drops
 * events sent to an actor before start() runs.
 */
const InitialThreadConsumer = ({ initialConversationId }: { initialConversationId?: string }) => {
  const actions = useChatActions();
  const consumed = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (initialConversationId === undefined || initialConversationId === "") return;
    if (consumed.current === initialConversationId) return;
    consumed.current = initialConversationId;
    const timer = window.setTimeout(() => {
      actions.selectConversation({ conversationId: initialConversationId });
      const url = new URL(window.location.href);
      if (url.searchParams.has("thread")) {
        url.searchParams.delete("thread");
        window.history.replaceState({}, "", url);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialConversationId, actions]);
  return null;
};

/** Saved-thread list; ghost entry before the first thread exists (audit C12). */
const ThreadListPanel = ({
  overlayOpen,
  onClose,
}: {
  overlayOpen: boolean;
  onClose: () => void;
}) => {
  // Audit S1: persistence was write-only — nothing ever asked the store for
  // the conversation history, so THREADS stayed empty until the first send
  // identified a conversation. One search request hydrates the list on mount;
  // after sends it refreshes via the runtime's conversation-identified event.
  const conversations = useChatSelector((s) => s.conversations.items);
  const conversationsLoading = useChatSelector((s) => s.conversations.loading);
  const conversationsError = useChatSelector((s) => s.conversations.error);
  const activeConversationId = useChatSelector((s) => s.activeThread.conversationId);
  const actions = useChatActions();

  // Audit K3: search + date grouping over the hydrated thread list.
  const [search, setSearch] = useState("");
  const visibleConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === "") return conversations;
    return conversations.filter((thread) =>
      (thread.title || "New chat").toLowerCase().includes(query),
    );
  }, [conversations, search]);

  /** Audit S3: one inline flow at a time (rename target / delete confirm). */
  const [renamingId, setRenamingId] = useState<string | undefined>(undefined);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Deferred one tick: this panel mounts as a child of ChatProvider, and
    // child effects flush before the provider's start() effect — xstate v5
    // drops events sent to an unstarted actor.
    const timer = window.setTimeout(() => actions.setConversationSearch({ search: "" }), 0);
    return () => window.clearTimeout(timer);
  }, [actions]);

  const content =
    conversations.length === 0 ? (
      conversationsLoading ? (
        <p className="text-muted-foreground px-2 py-4 text-xs" data-testid="ai-thread-list-loading">
          Loading chats…
        </p>
      ) : conversationsError !== undefined ? (
        <div className="px-2 py-4 text-xs" data-testid="ai-thread-list-error">
          <p className="text-destructive">Couldn’t load chats.</p>
          <Button
            size="xs"
            variant="outline"
            className="mt-2"
            onClick={() => actions.setConversationSearch({ search: "" })}
          >
            Reload chats
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground px-2 py-4 text-xs" data-testid="ai-thread-list-ghost">
          Chats will appear here once you start chatting.
        </p>
      )
    ) : (
      <div>
        {/* Audit K3: search over hydrated threads; the input is scoped to this
            panel so it never collides with workspace search fields. */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats"
          aria-label="Search chats"
          data-testid="ai-thread-search"
          className="border-input placeholder:text-muted-foreground/70 focus-visible:border-ring mb-1 w-full rounded-md border bg-transparent px-2 py-1 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--ring)]/30"
        />
        {visibleConversations.length === 0 ? (
          <p
            className="text-muted-foreground px-2 py-4 text-xs"
            data-testid="ai-thread-search-empty"
          >
            No chats match “{search}”.
          </p>
        ) : (
          groupThreadsByRecency(visibleConversations).map(([label, threads]) => (
            <section key={label} data-testid="ai-thread-group" data-group={label}>
              <p className="text-muted-foreground/80 px-2 pt-1.5 pb-0.5 text-[10px] font-semibold tracking-wide uppercase">
                {label}
              </p>
              <ul className="space-y-0.5">
                {threads.map((thread) => (
                  <ThreadListItem
                    key={thread.id}
                    thread={thread}
                    active={thread.id === activeConversationId}
                    renaming={renamingId === thread.id}
                    renameDraft={renamingId === thread.id ? renameDraft : ""}
                    confirmingDelete={confirmDeleteId === thread.id}
                    onSelect={() => {
                      // Flat model: the conversation IS the thread — selecting one
                      // loads its persisted messages into the runtime session.
                      actions.selectConversation({ conversationId: thread.id });
                      onClose();
                    }}
                    onRenameStart={() => {
                      setRenamingId(thread.id);
                      setRenameDraft(thread.title || "New chat");
                    }}
                    onRenameChange={(value) => setRenameDraft(value)}
                    onRenameCommit={() => {
                      const title = renameDraft.trim();
                      if (title !== "") {
                        actions.updateConversation({ conversationId: thread.id, title });
                        announce("Chat renamed.");
                      }
                      setRenamingId(undefined);
                    }}
                    onRenameCancel={() => setRenamingId(undefined)}
                    onTogglePin={() => {
                      actions.updateConversation({
                        conversationId: thread.id,
                        pinned: !thread.pinned,
                      });
                      announce(thread.pinned === true ? "Chat unpinned." : "Chat pinned.");
                    }}
                    onDeleteRequest={() =>
                      setConfirmDeleteId((current) =>
                        current === thread.id ? undefined : thread.id,
                      )
                    }
                    onDeleteConfirm={() => {
                      actions.deleteConversation({
                        conversationId: thread.id,
                        resetSession: thread.id === activeConversationId,
                      });
                      // Audit G6: destructive action feedback must reach AT.
                      announce("Chat deleted.");
                      setConfirmDeleteId(undefined);
                    }}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    );

  const header = (
    <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase">
      Threads
    </p>
  );

  return (
    <>
      {overlayOpen ? (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-30 bg-black/30"
            onClick={onClose}
            aria-hidden="true"
            data-testid="ai-thread-overlay-backdrop"
          />
          <aside
            className="border-border bg-background fixed inset-y-0 left-0 z-40 w-[min(20rem,85vw)] overflow-auto border-r p-2 shadow-xl"
            data-testid="ai-thread-list"
          >
            <div className="flex items-center justify-between">
              {header}
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                aria-label="Close chats"
                onClick={onClose}
                data-testid="ai-thread-list-close"
              >
                <X className="size-3.5" />
              </Button>
            </div>
            {content}
          </aside>
        </div>
      ) : null}
      <aside
        className="border-border hidden w-72 shrink-0 overflow-auto border-r p-2 md:block"
        data-testid="ai-thread-list-desktop"
      >
        {header}
        {content}
      </aside>
    </>
  );
};

const CUSTOM_MODEL_OPTION = "__custom__";

/** Audit C9: the composer example should make sense for the wired dialect. */
const composerPlaceholder = (dialect: DatabaseDialect): string => {
  switch (dialect) {
    case "csv":
      return "e.g. which rows have the highest values in the largest column?";
    case "duckdb":
      return "e.g. summarize this table by month";
    case "clickhouse":
      return "e.g. count events per day for the last week";
    case "mssql":
      return "e.g. list the top 10 customers by revenue";
    case "sqlite":
    case "libsql":
      return "e.g. show recent orders from the last 30 days";
    default:
      return "e.g. show pending orders from the last 7 days";
  }
};

const mergeModelOptions = (candidates: Array<string | undefined>): string[] => {
  const seen = new Set<string>();
  const models: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed != null && trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      models.push(trimmed);
    }
  }
  return models;
};

/**
 * Compact model selector inside the composer: recently-used / configured
 * models plus a free-text "Custom…" option. Writes straight through to the
 * stored BYOK config (the runtime picks it up via BYOK_CHANGED_EVENT).
 */
const ComposerModelPicker = () => {
  const [options, setOptions] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const customInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const storedModel = getStoredByokConfig()?.model;
    setSelectedModel(storedModel ?? "");
    setOptions(mergeModelOptions([storedModel, ...getRecentChatModels()]));
    setHydrated(true);
  }, []);

  const commitModel = (rawModel: string) => {
    const model = rawModel.trim();
    if (model.length === 0) return;
    setStoredChatModel(model);
    setSelectedModel(model);
    setCustomMode(false);
    setCustomDraft("");
    // Refresh the option list first so the new model appears as an item.
    const nextOptions = mergeModelOptions([
      model,
      ...getRecentChatModels().filter((m) => m !== model),
    ]);
    setOptions(nextOptions);
    rememberChatModel(model);
    window.dispatchEvent(new Event(BYOK_CHANGED_EVENT));
  };

  // Re-claim focus once ark-ui's popup-close focus restore settles, otherwise
  // the freshly-mounted input instantly blurs and cancels itself.
  useEffect(() => {
    if (!customMode) return;
    const timer = window.setTimeout(() => customInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [customMode]);

  const modelCollection = useMemo(
    () =>
      createListCollection({
        items: [
          ...options.map((model) => ({ label: model, value: model })),
          { label: "Custom…", value: CUSTOM_MODEL_OPTION },
        ],
      }),
    [options],
  );

  if (!hydrated || (options.length === 0 && !customMode)) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Select
        collection={modelCollection}
        value={[customMode ? CUSTOM_MODEL_OPTION : selectedModel]}
        onValueChange={(details) => {
          const value = details.value[0];
          if (value === undefined) return;
          if (value === CUSTOM_MODEL_OPTION) {
            setCustomMode(true);
            setCustomDraft(selectedModel);
            return;
          }
          commitModel(value);
        }}
        positioning={{ sameWidth: false }}
      >
        <SelectTrigger className="text-xs" data-testid="ai-model-picker" aria-label="Chat model">
          <SelectValueText placeholder="Model" />
        </SelectTrigger>
        <SelectContent>
          {/* Audit C10/P4: models belong to the active provider — group them
              under its name and tag keyless runtimes instead of a bare id
              soup. */}
          {(() => {
            const stored = getStoredByokConfig();
            const preset = getAiProviderPreset(stored?.providerId);
            const providerLabel = preset
              ? `${preset.label}${preset.keyOptional ? " · no API key needed" : ""}`
              : "Models";
            return (
              <>
                <SelectItemGroup>
                  <SelectItemGroupLabel>{providerLabel}</SelectItemGroupLabel>
                  {options.map((model) => (
                    <SelectItem key={model} item={{ label: model, value: model }}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectItemGroup>
                <SelectItemGroup>
                  <SelectItemGroupLabel>Other</SelectItemGroupLabel>
                  <SelectItem item={{ label: "Custom…", value: CUSTOM_MODEL_OPTION }}>
                    Custom…
                  </SelectItem>
                </SelectItemGroup>
              </>
            );
          })()}
        </SelectContent>
      </Select>
      {customMode && (
        // Raw input: the styled Input omits onKeyDown/autoFocus, but Enter-to-
        // commit matters for this transient field. Blur CANCELS (ark-ui steals
        // focus right after the popup closes — committing there would race).
        <span className="flex items-center gap-1">
          <input
            ref={customInputRef}
            className="border-input bg-background focus:ring-ring h-7 w-44 rounded-md border px-2 text-xs outline-none focus:ring-1"
            placeholder="vendor/model-id"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitModel(customDraft);
              if (e.key === "Escape") {
                setCustomMode(false);
                setCustomDraft("");
              }
            }}
            data-testid="ai-model-custom-input"
            aria-label="Custom model id"
          />
          <Button
            size="xs"
            variant="outline"
            onClick={() => commitModel(customDraft)}
            disabled={customDraft.trim().length === 0}
            aria-label="Confirm custom model"
            data-testid="ai-model-custom-confirm"
          >
            <Check className="size-3" />
          </Button>
        </span>
      )}
    </div>
  );
};

/** Audit S8: identifies the thread a seeded editor tab can link back to. */
type ChatReturnMeta = { conversationId: string; title: string };

/** Audit S10: classify a raw transport error into user-actionable buckets. */
const classifyChatError = (
  raw: string,
): {
  kind: "auth" | "model" | "quota" | "network" | "unknown";
  headline: string;
  hint?: string;
} => {
  const text = raw.toLowerCase();
  if (/401|403|unauthorized|invalid[ _-]api[ _-]?key|incorrect api key|api key/.test(text)) {
    return {
      kind: "auth",
      headline: "The provider rejected the credentials.",
      hint: "Check the API key in provider settings.",
    };
  }
  if (/404|does not exist|not found/.test(text) && /model/.test(text)) {
    return {
      kind: "model",
      headline: "That model is not available on this provider.",
      hint: "Pick a different model in the composer.",
    };
  }
  if (/429|quota|rate limit|billing|insufficient/.test(text)) {
    return {
      kind: "quota",
      headline: "Provider quota or rate limit hit.",
      hint: "Wait a moment or switch provider/model.",
    };
  }
  if (/fetch failed|failed to fetch|network|econnrefused|enotfound|econnreset/.test(text)) {
    return {
      kind: "network",
      headline: "Could not reach the provider endpoint.",
      hint: "Check the base URL and your connection.",
    };
  }
  return { kind: "unknown", headline: raw };
};

/** Runtime-driven thread viewport + approval bar + composer. */
const ChatSurface = ({
  connectionName,
  onApplySql,
  onRunSql,
  onOpenWorkspaceView,
  onOpenProviderSettings,
  schemaHint,
  consentRequired,
  onRevokeSchemaSharing,
  chatDataAccess,
  providerReady,
  dialect,
  onAdoptAutoTables,
  onOpenSchemaPanel,
  initialConversationId,
  initialAskTable,
  initialAiIntent,
  contextAttachments,
  onConversationIdChange,
  onStreamingChange,
  variant,
}: {
  connectionName: string;
  onApplySql: (sql: string, meta?: ChatReturnMeta) => void;
  onRunSql: (sql: string, meta?: ChatReturnMeta) => void;
  /** open_workspace_view card click: browse tab with the model's state. */
  onOpenWorkspaceView: (view: {
    table: string;
    schema?: string;
    filters?: Array<{
      column: string;
      operator: FilterOperatorType;
      value?: string | number | boolean;
    }>;
    orderBy?: { column: string; direction: "asc" | "desc" };
    limit?: number;
  }) => void;
  /** Audit S10: auth-class errors deep-link back into provider settings. */
  onOpenProviderSettings: () => void;
  /** Post-consent transparency line about the schema context in use. */
  schemaHint: string;
  /** Schema-sharing consent outstanding — Send stays disabled until approved. */
  consentRequired: boolean;
  onRevokeSchemaSharing: () => void;
  chatDataAccess: ChatDataAccess;
  /** Stored BYOK config satisfies its provider's key requirement. */
  providerReady: boolean;
  dialect: DatabaseDialect;
  /** Audit T2: clicking an auto chip adopts those tables as a manual selection. */
  onAdoptAutoTables: (tables: readonly string[]) => void;
  /** Audit K6: `/schema` opens the schema settings panel. */
  onOpenSchemaPanel: () => void;
  /** Conversation id requested by the full-page route, used for loading feedback. */
  initialConversationId?: string;
  /** Audit K4: `?askTable=` pre-seeds draft + Selected scope for one table. */
  initialAskTable?: string;
  initialAiIntent?: "chat" | "sql";
  contextAttachments: readonly ChatContextAttachment[];
  onConversationIdChange: (conversationId: string | undefined) => void;
  onStreamingChange: (streaming: boolean) => void;
  variant: "page" | "sidechat";
}) => {
  const messages = useChatSelector((s) => s.activeThread.messages);
  const isStreaming = useChatSelector((s) => s.activeThread.isStreaming);
  const streamOutcome = useChatSelector((s) => s.activeThread.streamOutcome);
  const failedStreamMessageId = useChatSelector((s) => s.activeThread.failedStreamMessageId);
  const draft = useChatSelector((s) => s.composer.text);
  const activeConversationId = useChatSelector((s) => s.activeThread.conversationId);
  const conversations = useChatSelector((s) => s.conversations.items);
  const conversationLoading = useChatSelector((s) => s.conversations.activeLoading);
  const historyWarning = useChatSelector((s) => s.historyWarning);
  const error = useChatSelector((s) => s.error);
  const actions = useChatActions();
  const providerId = useChatSelector((s) => s.settings.provider);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onStreamingChange(isStreaming);
  }, [isStreaming, onStreamingChange]);

  // Audit K7: finishing a stream in an unfocused tab gets a title badge so
  // users switching back know the answer landed.
  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && document.hidden) {
      const original = document.title;
      document.title = `● Reply ready — Dadabase`;
      const restore = () => {
        document.title = original;
        window.removeEventListener("focus", restore);
        window.removeEventListener("visibilitychange", restore);
      };
      window.addEventListener("focus", restore);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) restore();
      });
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Audit K4: `?askTable=<name>` scopes the schema to that table and pre-seeds
  // a draft, then strips the param so refreshes never re-seed.
  // The seed re-asserts itself briefly: thread hydration (audit S1) resolves
  // asynchronously after mount and resets the composer to the persisted draft,
  // which would clobber a single fire-and-forget setDraft.
  const consumedAskTable = useRef<string | undefined>(undefined);
  const runtimeForSeed = useChatRuntime();
  useEffect(() => {
    // SQL suggestions from a custom SQL tab have no table to scope, but still
    // need a useful draft seed. Ordinary new AI tabs intentionally stay blank.
    if ((initialAskTable === undefined || initialAskTable === "") && initialAiIntent !== "sql") {
      return;
    }
    const seedKey = initialAskTable || "__current_schema__";
    if (consumedAskTable.current === seedKey) return;
    consumedAskTable.current = seedKey;
    if (initialAskTable !== undefined && initialAskTable !== "") {
      setStoredChatSchemaSelection(connectionName, {
        mode: "selected",
        selectedTables: [initialAskTable],
      });
      window.dispatchEvent(new Event(SCHEMA_SELECTION_CHANGED_EVENT));
    }
    const seededText =
      initialAiIntent === "sql"
        ? initialAskTable
          ? `Write a SQL query for \`${initialAskTable}\`:`
          : "Write a SQL query for the current schema:"
        : `Explore the \`${initialAskTable}\` table:`;
    let attempts = 0;
    const seed = (): void => {
      attempts += 1;
      runtimeForSeed.actions.setDraft({ text: seededText });
      if (runtimeForSeed.getState().composer.text === seededText) return;
      if (attempts < 20) window.setTimeout(seed, 250);
    };
    window.setTimeout(seed, 0);
    const url = new URL(window.location.href);
    if (url.searchParams.has("askTable")) {
      url.searchParams.delete("askTable");
      window.history.replaceState({}, "", url);
    }
    // Run once per param value; the draft belongs to the runtime afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAskTable, initialAiIntent]);

  // Audit S6: the runtime persists the composer draft per connection, but
  // nothing re-read it after a reload until the next conversation switch —
  // restore it once on mount so a refresh never eats an in-progress question.
  useEffect(() => {
    if (draft !== "") return;
    let stored: string | null = null;
    try {
      stored = globalThis.localStorage.getItem(chatComposerDraftStorageKey(connectionName));
    } catch {
      return;
    }
    if (typeof stored === "string" && stored !== "") actions.setDraft({ text: stored });
    // Once on mount; later draft state belongs to the runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Audit G7: async failures must not live only in inline text — surface them
  // as toasts and announce them so they reach users regardless of focus.
  const lastAnnouncedError = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!error || error === lastAnnouncedError.current) return;
    lastAnnouncedError.current = error;
    toaster.create({ title: "Chat error", description: error, type: "error" });
    announce("Chat error.");
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }, [error]);

  // Audit C11: elapsed time gives the stream a sense of progress; the Cancel
  // button wires the transport's existing "stream-cancelled" path to the UI.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!isStreaming) return;
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [isStreaming]);

  // Audit C14: after Approve/Reject the bar vanishes (the call is no longer
  // pending) — keep the decision visible until the resumed stream finishes.
  const [lastDecision, setLastDecision] = useState<"approved" | "rejected" | undefined>(undefined);
  const [generationStopped, setGenerationStopped] = useState(false);
  useEffect(() => {
    if (isStreaming) setGenerationStopped(false);
  }, [isStreaming]);

  // Audit S7: track distance from the thread bottom; offer a manual jump when
  // the user scrolled away while new content streams in.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const onViewportScroll = () => {
    const el = viewportRef.current;
    if (el === null) return;
    setShowJumpToLatest(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
  };
  const scrollToLatest = () => {
    const el = viewportRef.current;
    if (el === null) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    setShowJumpToLatest(false);
  };

  const composerFocus = () => composerRef.current?.focus();
  const starterPrompts = useMemo(() => {
    const table =
      initialAskTable ||
      contextAttachments.find((attachment) => attachment.kind === "table")?.table;
    const selection = contextAttachments.find((attachment) => attachment.kind === "selection");
    const result = contextAttachments.find((attachment) => attachment.kind === "result");
    if (result?.kind === "result") {
      return [
        "Summarize this query result.",
        "What stands out in this result?",
        "Suggest a useful next question.",
      ];
    }
    if (selection?.kind === "selection") {
      return [
        `Explain these ${selection.rows?.length ?? selection.rowIds?.length ?? 0} selected rows.`,
        "What patterns or anomalies are in this selection?",
        "Suggest a follow-up query for this selection.",
      ];
    }
    if (initialAiIntent === "sql") {
      return [
        "Explain this SQL.",
        "Find possible issues in this SQL.",
        "Suggest an improvement to this SQL.",
      ];
    }
    if (!table) {
      return [
        "Show me the available tables.",
        "Help me explore this database.",
        "What would be useful to investigate?",
      ];
    }
    return [
      `How many rows are in \`${table}\`?`,
      `What columns are in \`${table}\`?`,
      `Show me a useful summary of \`${table}\`.`,
    ];
  }, [contextAttachments, initialAiIntent, initialAskTable]);

  useEffect(() => {
    const element = composerRef.current;
    if (element === null) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 192)}px`;
  }, [draft]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const pendingApproval = isStreaming ? undefined : findPendingApproval(lastAssistant);
  const pendingApprovalSql =
    pendingApproval?.input &&
    typeof pendingApproval.input === "object" &&
    pendingApproval.input !== null &&
    "sql" in pendingApproval.input &&
    typeof pendingApproval.input.sql === "string"
      ? pendingApproval.input.sql
      : undefined;

  // Audit S8: identify the originating thread so seeded editor tabs can link
  // back to this conversation.
  // Audit S8: identify the originating thread so seeded editor tabs can link
  // back to this conversation. The runtime mirrors the id from the SSE
  // response header; listen for it instead of polling internals.
  const activeConversationTitle =
    conversations.find((c) => c.id === activeConversationId)?.title || "New chat";
  const conversationIdForMeta = activeConversationId;
  useEffect(() => {
    onConversationIdChange(conversationIdForMeta);
  }, [conversationIdForMeta, onConversationIdChange]);
  const chatMeta: ChatReturnMeta | undefined =
    conversationIdForMeta === undefined || conversationIdForMeta === ""
      ? undefined
      : { conversationId: conversationIdForMeta, title: activeConversationTitle };

  // Audit K1: single gate shared by the button and the Enter handler.
  const sendDisabled = consentRequired || !providerReady || draft.trim() === "" || isStreaming;
  const hasValueAttachments = contextAttachments.some(
    (attachment) =>
      (attachment.kind === "selection" && attachment.rows?.length) ||
      (attachment.kind === "result" && attachment.rows?.length),
  );
  // Audit T4: the transparency line retires itself after the first send.
  const [trustNoteDismissed, setTrustNoteDismissed] = useState(() => {
    try {
      return globalThis.localStorage.getItem(`dadabase.chat.trust-note.${connectionName}`) === "1";
    } catch {
      return true;
    }
  });
  const [copiedAction, setCopiedAction] = useState<"markdown" | "text" | undefined>(undefined);
  const providerLabel = getAiProviderPreset(providerId)?.label ?? providerId;
  const exportableMessages = useMemo(
    () =>
      messages.map((message) => ({
        id: message.id,
        parentId: null,
        createdAt: typeof message.createdAt === "string" ? message.createdAt : "",
        role: message.role,
        parts: message.parts,
      })),
    [messages],
  );
  const markdown = useMemo(() => conversationMarkdown(exportableMessages), [exportableMessages]);
  const plainText = useMemo(
    () =>
      messages
        .map((message) =>
          message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n"),
        )
        .filter((text) => text.trim() !== "")
        .join("\n\n"),
    [messages],
  );
  const copyConversation = async (
    value: string,
    announcement: string,
    action: "markdown" | "text",
  ) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedAction(action);
      window.setTimeout(() => setCopiedAction(undefined), 1500);
      announce(announcement);
    } catch {
      toaster.create({
        title: "Copy failed",
        description: "Your browser could not access the clipboard.",
        type: "error",
      });
    }
  };
  const downloadMarkdown = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeConversationTitle.replace(/[^\w.-]+/g, "_").slice(0, 60) || "chat"}.md`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    announce("Chat exported as markdown.");
  };
  const sendCurrentDraft = () => {
    if (sendDisabled) return;
    // Audit K6: leading slash routes to commands instead of the model.
    const parsed = parseComposerCommand(draft);
    if (parsed.kind === "unknown") {
      toaster.create({ title: UNKNOWN_COMMAND_HINT, type: "info" });
      return;
    }
    if (parsed.kind === "command") {
      runComposerCommand({
        command: parsed.command,
        onClear: () => actions.startNewConversation(),
        onOpenSchemaPanel,
        announce,
      });
      actions.setDraft({ text: "" });
      return;
    }
    if (!trustNoteDismissed) {
      setTrustNoteDismissed(true);
      try {
        globalThis.localStorage.setItem(`dadabase.chat.trust-note.${connectionName}`, "1");
      } catch {
        // Private mode: the note simply stays visible; never blocks sending.
      }
    }
    actions.sendMessage({ text: draft });
  };
  // Audit M4/T3: thread total across per-message usage.
  const threadTokens = messages.reduce(
    (total, message) => total + (message.usage?.totalTokens ?? 0),
    0,
  );
  useEffect(() => {
    if (!isStreaming && !findPendingApproval(lastAssistant)) setLastDecision(undefined);
  }, [isStreaming, lastAssistant]);

  // Audit C4: the proposed SQL must be readable while the model streams —
  // purpose line + SQL, expanded by default instead of a collapsed details.
  const renderToolInput = ({ toolName, input }: { toolName: string; input: unknown }) => {
    if (
      (toolName === "propose_sql" || toolName === "run_sql") &&
      isRecord(input) &&
      typeof input.sql === "string"
    ) {
      // The model names the purpose via `explanation`; canned/mocked streams
      // have used `reason` — treat them the same.
      const purpose =
        typeof input.explanation === "string" && input.explanation.trim() !== ""
          ? input.explanation
          : typeof input.reason === "string" && input.reason.trim() !== ""
            ? input.reason
            : undefined;
      return (
        <div className="space-y-1.5">
          {purpose !== undefined && <p className="text-muted-foreground text-xs">{purpose}</p>}
          <div className="relative">
            <pre
              className="bg-muted/50 overflow-auto rounded-md p-2 pe-16 font-mono text-xs"
              data-testid="ai-chat-proposed-sql"
            >
              {input.sql}
            </pre>
            <CopySqlButton sql={input.sql} />
          </div>
        </div>
      );
    }
    if (toolName === "open_workspace_view" && isRecord(input) && typeof input.table === "string") {
      return (
        <div className="bg-muted/40 border-border space-y-1.5 rounded-md border p-2.5">
          <p className="text-xs font-medium">Workspace view — {input.table}</p>
          <ul className="text-muted-foreground space-y-0.5 text-xs">
            {Array.isArray(input.filters)
              ? input.filters.map((filter, i) =>
                  isRecord(filter) && typeof filter.column === "string" ? (
                    <li key={i}>
                      {filter.column} {String(filter.operator)} {String(filter.value ?? "")}
                    </li>
                  ) : null,
                )
              : null}
            {isRecord(input.orderBy) && typeof input.orderBy.column === "string" ? (
              <li>
                ordered by {input.orderBy.column} ({String(input.orderBy.direction ?? "asc")})
              </li>
            ) : null}
            {typeof input.limit === "number" ? <li>limit {input.limit}</li> : null}
          </ul>
        </div>
      );
    }
    if (toolName === "explain_sql" && isRecord(input) && typeof input.sql === "string") {
      return (
        <pre className="bg-muted/50 overflow-auto rounded-md p-2 font-mono text-xs">
          {input.sql}
        </pre>
      );
    }
    return undefined;
  };

  const renderToolResult = ({ toolName, result }: { toolName: string; result: unknown }) => {
    if (toolName === "open_workspace_view") {
      const view = isRecord(result) && isRecord(result.view) ? result.view : undefined;
      const viewTable = typeof view?.table === "string" ? view.table : undefined;
      if (viewTable !== undefined && view !== undefined) {
        const viewFilters = Array.isArray(view.filters)
          ? (view.filters as Array<Record<string, unknown>>)
          : [];
        return (
          <div
            className="bg-muted/40 border-border space-y-2 rounded-md border p-2.5"
            data-testid="ai-chat-workspace-view-card"
          >
            <p className="text-xs font-medium">Workspace view ready</p>
            <p className="text-muted-foreground text-xs">
              Browse tab on {viewTable}
              {viewFilters.length > 0
                ? ` with ${viewFilters.length} filter${viewFilters.length === 1 ? "" : "s"}`
                : ""}
              .
            </p>
            <Button
              size="xs"
              onClick={() => onOpenWorkspaceView(view as never)}
              data-testid="ai-chat-open-view"
            >
              Open workspace view
            </Button>
          </div>
        );
      }
    }
    if (toolName === "preview_rows" && isRecord(result) && Array.isArray(result.rows)) {
      const rows = result.rows.filter(isRecord).slice(0, 25);
      const columns = Array.isArray(result.columns)
        ? result.columns.filter((column): column is string => typeof column === "string").slice(0, 25)
        : rows.length > 0
          ? Object.keys(rows[0]).slice(0, 25)
          : [];
      const serverReadableRows = Array.isArray(result.readableRows)
        ? result.readableRows.filter(isRecord).slice(0, 25)
        : undefined;
      const serverReadableColumns = Array.isArray(result.readableColumns)
        ? result.readableColumns.filter((column): column is string => typeof column === "string")
        : undefined;
      const readableColumns =
        serverReadableColumns !== undefined && serverReadableColumns.length > 0
          ? serverReadableColumns
          : readablePreviewColumns(columns, rows);
      const readableRows =
        serverReadableRows !== undefined && serverReadableRows.length > 0
          ? serverReadableRows
          : rows.map((row) =>
              Object.fromEntries(readableColumns.map((column) => [column, row[column]])),
            );
      const relationSummary = Array.isArray(result.readableRelations)
        ? result.readableRelations.filter(isRecord)
        : [];
      return (
        <div className="space-y-2" data-testid="ai-chat-preview-rows">
          <div className="bg-background rounded-md border p-2">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-medium">Readable preview</p>
              {relationSummary.length > 0 ? (
                <p className="text-muted-foreground text-[11px]">
                  Related labels included from {relationSummary.length} table
                  {relationSummary.length === 1 ? "" : "s"}.
                </p>
              ) : null}
            </div>
            <PreviewRowsTable columns={readableColumns} rows={readableRows} readable />
          </div>
          <details className="bg-muted/20 rounded-md border" data-testid="ai-chat-raw-preview">
            <summary className="text-muted-foreground flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-xs font-medium">
              <span>Raw rows</span>
              <span>{rows.length} sampled</span>
            </summary>
            <div className="border-t p-2">
              <PreviewRowsTable columns={columns} rows={rows} />
            </div>
          </details>
        </div>
      );
    }
    if (toolName === "table_details" && isRecord(result) && Array.isArray(result.columns)) {
      const detailColumns = result.columns
        .filter(isRecord)
        .map((column) => String(column.column_name ?? column.name ?? ""))
        .filter(Boolean);
      return (
        <div className="text-xs" data-testid="ai-chat-table-details">
          <p>
            {detailColumns.length} column(s): {detailColumns.join(", ")}
          </p>
          <p className="text-muted-foreground">
            {Array.isArray(result.foreignKeys) ? `${result.foreignKeys.length} FK` : "0 FK"} ·{" "}
            {Array.isArray(result.indexes) ? `${result.indexes.length} index(es)` : "0 index(es)"}
          </p>
        </div>
      );
    }
    if (toolName === "explain_sql" && isRecord(result)) {
      const planText =
        typeof result.plan === "string"
          ? result.plan
          : Array.isArray(result.rows) && result.rows.length > 0
            ? Object.values(result.rows[0] as Record<string, unknown>).join("\n")
            : undefined;
      if (result.ok === false || planText === undefined) {
        return (
          <p className="text-muted-foreground text-xs" data-testid="ai-chat-explain-skipped">
            Plan unavailable — continuing without it.
          </p>
        );
      }
      return (
        <pre
          className="bg-muted/50 overflow-auto rounded-md p-2 font-mono text-xs"
          data-testid="ai-chat-explain-plan"
        >
          {planText.slice(0, 2000)}
        </pre>
      );
    }
    if ((toolName === "propose_sql" || toolName === "run_sql") && isRecord(result)) {
      const sql = typeof result.sql === "string" ? result.sql : undefined;
      if (sql !== undefined) {
        // Audit C14: surface what actually happened right where the decision
        // was made — ran? rows? error?
        let outcome: ReactNode | undefined;
        if (toolName === "run_sql") {
          if (result.ok === false) {
            outcome = (
              <p className="text-destructive text-xs font-medium" data-testid="ai-chat-run-outcome">
                Failed{typeof result.error === "string" ? ` — ${result.error}` : "."}
              </p>
            );
          } else {
            const rowCount = typeof result.rowCount === "number" ? result.rowCount : undefined;
            const truncated = result.truncated === true;
            outcome = (
              <p className="text-success text-xs font-medium" data-testid="ai-chat-run-outcome">
                Ran ✓{" "}
                {rowCount !== undefined
                  ? `· ${rowCount} row${rowCount === 1 ? "" : "s"}${truncated ? " (first 50)" : ""}`
                  : ""}
              </p>
            );
          }
        }
        return (
          <div className="space-y-1.5">
            {outcome}
            <div className="relative">
              <pre className="bg-muted/50 overflow-auto rounded-md p-2 pe-16 font-mono text-xs">
                {sql}
              </pre>
              <CopySqlButton sql={sql} />
            </div>
            <div className="flex gap-1.5">
              <Button
                size="xs"
                variant="outline"
                onClick={() => onApplySql(sql, chatMeta)}
                data-testid="ai-chat-apply-sql"
              >
                Use this SQL
              </Button>
              {toolName === "propose_sql" && (
                <Button
                  size="xs"
                  onClick={() => onRunSql(sql, chatMeta)}
                  data-testid="ai-chat-run-sql"
                >
                  Run
                </Button>
              )}
            </div>
          </div>
        );
      }
    }
    return undefined;
  };

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="border-border bg-background/95 sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-3 py-2 backdrop-blur"
          data-testid="ai-chat-state"
          role="status"
          aria-live="polite"
        >
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <MessageSquarePlus className="text-primary size-3.5 shrink-0" />
            <span className="text-muted-foreground shrink-0">Current chat</span>
            <span className="truncate font-medium">
              {activeConversationTitle === "New chat" ? "Untitled chat" : activeConversationTitle}
            </span>
            {isStreaming ? (
              <Badge size="2xs" colorPalette="info">
                Generating
              </Badge>
            ) : conversationLoading && initialConversationId !== undefined ? (
              <Badge size="2xs" colorPalette="muted">
                Loading chat
              </Badge>
            ) : null}
            {!isStreaming && pendingApproval !== undefined ? (
              <Badge size="2xs" colorPalette="warning">
                Awaiting approval
              </Badge>
            ) : null}
          </div>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => actions.startNewConversation()}
            data-testid="ai-chat-new-chat-header"
            title="Start a new chat"
          >
            <MessageSquarePlus className="size-3.5" />
            <span className="hidden sm:inline">New chat</span>
          </Button>
        </div>
        {/* Audit S7: manual jump-to-latest when the user scrolled up during a
            stream; the auto-stick behaviour alone hides new content. */}
        {showJumpToLatest && (
          <button
            type="button"
            className="bg-background border-border text-muted-foreground hover:text-foreground absolute right-4 bottom-3 z-10 flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs shadow-sm"
            onClick={scrollToLatest}
            data-testid="ai-chat-jump-latest"
          >
            <ArrowDown className="size-3" />
            Jump to latest
          </button>
        )}
        <div
          ref={viewportRef}
          onScroll={onViewportScroll}
          className="mx-auto min-h-0 w-full max-w-4xl flex-1 space-y-5 overflow-auto p-4"
          data-testid="ai-chat-thread"
        >
          {historyWarning !== undefined ? (
            <div
              className="border-warning/40 bg-warning/10 text-warning rounded-md border px-3 py-2 text-xs"
              data-testid="ai-chat-history-warning"
              role="status"
            >
              <p>{historyWarning}</p>
              <p className="mt-0.5 opacity-80">The available messages are still shown below.</p>
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-4 px-1 py-10 text-center text-sm">
              {conversationLoading && initialConversationId !== undefined ? (
                <p data-testid="ai-conversation-loading" role="status" aria-live="polite">
                  Loading this conversation…
                </p>
              ) : (
                <>
                  <p>
                    Ask a question about this database — the assistant proposes SQL, you review it
                    before it runs.
                  </p>
                  {!consentRequired && providerReady && starterPrompts.length > 0 ? (
                    <div className="flex max-w-full flex-wrap justify-center gap-2">
                      {starterPrompts.map((prompt) => (
                        <Button
                          key={prompt}
                          size="xs"
                          variant="outline"
                          disabled={consentRequired || !providerReady}
                          onClick={() => {
                            actions.setDraft({ text: prompt });
                            composerFocus();
                          }}
                          data-testid="ai-starter-prompt"
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {/* Audit C7: one primary action instead of a 90%-empty viewport. */}
                  {!consentRequired && providerReady ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={composerFocus}
                      data-testid="ai-chat-first-question"
                    >
                      <Sparkles className="size-3.5" />
                      Ask your first question
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            messages.map((message, index) => {
              // Retry is an error recovery affordance, never a generic action
              // shown after every completed assistant turn.
              const isLatestTurn = index === messages.length - 1;
              const canRetryFailedTurn =
                !isStreaming &&
                streamOutcome === "failed" &&
                (failedStreamMessageId === message.id || (message.role === "user" && isLatestTurn));
              return (
                <div
                  key={message.id}
                  className={cn("rounded-lg", message.role === "user" && "bg-muted/25 px-3 py-2")}
                  data-testid="ai-chat-message"
                  data-role={message.role}
                >
                  <ThreadMessage
                    message={message}
                    isStreaming={isStreaming && message.role === "assistant"}
                    metadata={{
                      ...(typeof message.model === "string" && message.model !== ""
                        ? { modelLabel: message.model }
                        : {}),
                      ...(message.usage?.totalTokens !== null &&
                      typeof message.usage?.totalTokens === "number" &&
                      message.usage.totalTokens > 0
                        ? { totalTokens: message.usage.totalTokens }
                        : {}),
                      ...(typeof message.createdAt === "string"
                        ? { createdAt: message.createdAt }
                        : {}),
                    }}
                    renderToolResult={renderToolResult}
                    renderToolInput={renderToolInput}
                    {...(canRetryFailedTurn
                      ? {
                          onRegenerate: (messageId: string) => actions.retry({ messageId }),
                          regenerateText: "Try again",
                        }
                      : {})}
                  />
                  {/* Audit T1/T2: per-turn context receipt — the model, schema
                    mode, table subset, tools, and tokens actually sent. In auto
                    mode the picked tables are clickable to adopt as manual
                    selection ("Auto worked" vs "Auto guessed wrong"). */}
                  {message.role === "assistant" && message.context !== undefined ? (
                    <div
                      className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 px-3 text-[11px]"
                      data-testid="ai-chat-context-receipt"
                    >
                      <span>{message.context.mode}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {message.context.tables.length === 0
                          ? "no tables"
                          : `${message.context.tables.length} table${message.context.tables.length === 1 ? "" : "s"}`}
                      </span>
                      {message.context.mode !== "all" ? (
                        <span className="flex flex-wrap gap-1">
                          {message.context.tables.map((table) => {
                            const adoptable =
                              message.context !== undefined && message.context.mode === "auto";
                            return adoptable ? (
                              <button
                                key={table}
                                type="button"
                                className="bg-muted hover:text-foreground rounded px-1 py-px font-mono transition-colors"
                                title={`Adopt \`${table}\` as your schema selection`}
                                onClick={() => onAdoptAutoTables([table])}
                              >
                                {table}
                              </button>
                            ) : (
                              <span key={table} className="bg-muted rounded px-1 py-px font-mono">
                                {table}
                              </span>
                            );
                          })}
                        </span>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <span>
                        {message.context.tools.length === 0
                          ? "tools off"
                          : message.context.tools.join(", ")}
                      </span>
                      {message.context.dataClasses.length > 0 ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {message.context.dataClasses
                              .map((dataClass) =>
                                dataClass === "sample-rows"
                                  ? "sample rows"
                                  : dataClass === "query-results"
                                    ? "query results"
                                    : "schema",
                              )
                              .join(" + ")}
                          </span>
                        </>
                      ) : null}
                      {message.usage?.totalTokens != null && message.usage.totalTokens > 0 ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{message.usage.totalTokens.toLocaleString()} ctx</span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          {pendingApproval !== undefined ? (
            <div
              className="border-border bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              data-testid="ai-chat-approval"
              role="alert"
            >
              <div className="min-w-0">
                <span className="font-medium">
                  Review before running via `{pendingApproval.toolName}`
                </span>
                {pendingApprovalSql ? (
                  <pre className="border-border bg-background mt-1 max-h-24 overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap">
                    {pendingApprovalSql}
                  </pre>
                ) : null}
              </div>
              <span className="flex shrink-0 gap-1.5">
                <Button
                  size="xs"
                  onClick={() => {
                    setLastDecision("approved");
                    actions.approveToolCall({
                      approvalId: pendingApproval.approvalId,
                      approved: true,
                    });
                  }}
                  data-testid="ai-chat-approve"
                >
                  <Check className="size-3" />
                  Approve
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setLastDecision("rejected");
                    actions.approveToolCall({
                      approvalId: pendingApproval.approvalId,
                      approved: false,
                    });
                  }}
                  data-testid="ai-chat-reject"
                >
                  <X className="size-3" />
                  Reject
                </Button>
              </span>
            </div>
          ) : lastDecision !== undefined ? (
            /* Audit C14: keep the decision visible while the resumed stream runs. */
            <div
              className="border-border bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-xs"
              data-testid="ai-chat-decision"
              role="status"
            >
              {lastDecision === "approved"
                ? "Approved — executing the proposed SQL…"
                : "Rejected — nothing was executed."}
            </div>
          ) : null}
          {isStreaming && (
            <div
              className="border-border bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
              data-testid="ai-generating-status"
              role="status"
              aria-live="polite"
            >
              <span className="flex items-center gap-2">
                {/* Audit G5: ui Spinner is the app-wide spinner token. */}
                <Spinner size="xs" label="Generating response" />
                {/* Audit C11: elapsed seconds make progress tangible. */}
                <span className="font-medium">Generating… {elapsedSeconds}s</span>
              </span>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setGenerationStopped(true);
                  actions.stop();
                  announce("Generation stopped.");
                }}
                data-testid="ai-chat-cancel"
                aria-label="Stop generating"
              >
                <Square className="size-3" />
                Stop generating
              </Button>
            </div>
          )}
          {!isStreaming && generationStopped ? (
            <div
              className="border-border bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-xs"
              role="status"
            >
              Generation stopped. You can edit the draft and send again.
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-border border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
          {/* Audit M4/T3: thread-level token total anchors cost awareness. */}
          {threadTokens > 0 && (
            <span className="text-muted-foreground text-[11px]" data-testid="ai-chat-thread-tokens">
              {threadTokens.toLocaleString()} tokens this thread
            </span>
          )}
          <Textarea
            ref={composerRef}
            rows={1}
            className="max-h-48 min-h-10 resize-none overflow-y-auto"
            placeholder={composerPlaceholder(dialect)}
            value={draft}
            onChange={(e) => actions.setDraft({ text: e.target.value })}
            onKeyDown={(e) => {
              // Audit K1: Enter sends, Shift+Enter inserts a newline. IME-safe:
              // composition-confirming Enter never sends.
              if (e.key !== "Enter" || e.shiftKey) {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  sendCurrentDraft();
                }
                return;
              }
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              e.preventDefault();
              sendCurrentDraft();
            }}
            data-testid="ai-chat-input"
            disabled={consentRequired || !providerReady}
            aria-label="Chat message"
          />
          {/* Audit K6: make the keyboard model discoverable. */}
          <p className="text-muted-foreground text-[11px]" data-testid="ai-chat-kbd-hint">
            Enter to send · Shift+Enter for a new line · ⌘/Ctrl+Enter also sends
          </p>
          {/* Audit T4: moment-of-send trust microcopy — retires after the
              first successful send (per connection). */}
          {providerReady && !consentRequired && !trustNoteDismissed ? (
            <p className="text-muted-foreground text-[11px]" data-testid="ai-chat-trust-note">
              Schema and table names are sent to {providerLabel}.
              {chatDataAccess.sampleRows || chatDataAccess.queryResults
                ? ` ${chatDataAccess.sampleRows ? "Sample rows" : ""}${chatDataAccess.sampleRows && chatDataAccess.queryResults ? " and " : ""}${chatDataAccess.queryResults ? "query results" : ""} are allowed for this chat.`
                : " No row values are shared."}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <ComposerModelPicker />
            <Button
              size="sm"
              disabled={sendDisabled}
              onClick={sendCurrentDraft}
              data-testid="ai-chat-send"
            >
              Send
            </Button>
            {messages.length > 0 || variant === "sidechat" ? (
              <>
                {messages.length > 0 && variant === "page" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => actions.startNewConversation()}
                    data-testid="ai-chat-new-chat"
                  >
                    New chat
                  </Button>
                ) : null}
                {/* Keep export actions discoverable without competing with Send. */}
                {messages.length > 0 ? (
                  <Menu>
                    <MenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={copiedAction === undefined ? "More chat actions" : "Copied"}
                        data-testid="ai-chat-actions"
                      >
                        {copiedAction === undefined ? (
                          <MoreHorizontal className="size-3.5" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        <span className="hidden sm:inline">
                          {copiedAction === undefined ? "More" : "Copied"}
                        </span>
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem
                        value="copy-markdown"
                        onClick={() =>
                          void copyConversation(markdown, "Chat copied as markdown.", "markdown")
                        }
                      >
                        <Clipboard className="size-3.5" />
                        Copy as Markdown
                      </MenuItem>
                      <MenuItem value="export-markdown" onClick={downloadMarkdown}>
                        <FileText className="size-3.5" />
                        Export Markdown
                      </MenuItem>
                      <MenuItem
                        value="copy-text"
                        onClick={() =>
                          void copyConversation(plainText, "Chat copied as plain text.", "text")
                        }
                      >
                        <Clipboard className="size-3.5" />
                        Copy plain text
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                ) : null}
              </>
            ) : null}
            {consentRequired ? (
              <span className="text-muted-foreground text-xs" data-testid="ai-chat-send-reason">
                Approve schema sharing above to enable chat.
              </span>
            ) : !providerReady ? (
              <span className="text-muted-foreground text-xs" data-testid="ai-chat-send-reason">
                Configure an OpenAI-compatible provider above to enable chat.
              </span>
            ) : null}
          </div>
          <div
            className="border-border bg-muted/20 text-muted-foreground flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[11px]"
            data-testid="ai-permission-summary"
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="text-primary size-3.5" />
              {consentRequired
                ? "Nothing is shared until schema access is approved."
                : `Shared: schema metadata${hasValueAttachments ? " plus permitted values" : " only"}.`}
            </span>
            <Button
              size="xs"
              variant="ghost"
              onClick={onOpenProviderSettings}
              data-testid="ai-review-sharing"
            >
              Review sharing
            </Button>
          </div>
          {error &&
            (() => {
              // Audit S10: one flat message for every failure mode taught users
              // to ignore errors — classify and make recovery actionable.
              const classified = classifyChatError(error);
              return (
                <div
                  className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-2.5 py-2 text-xs"
                  data-testid="ai-chat-error"
                  role="alert"
                  tabIndex={-1}
                  ref={errorRef}
                >
                  <p className="font-medium">{classified.headline}</p>
                  {classified.hint !== undefined && (
                    <p className="mt-0.5 opacity-80">{classified.hint}</p>
                  )}
                  {classified.kind === "auth" && (
                    <Button
                      size="xs"
                      variant="outline"
                      className="mt-1.5"
                      onClick={onOpenProviderSettings}
                      data-testid="ai-chat-error-open-settings"
                    >
                      Open provider settings
                    </Button>
                  )}
                  {classified.kind !== "auth" && classified.kind !== "unknown" && (
                    <p className="mt-0.5 opacity-70">{error}</p>
                  )}
                </div>
              );
            })()}
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs" data-testid="ai-schema-context-hint">
              {schemaHint}
            </p>
            {/* Audit S2: a persisted grant stays revocable right where the
                trust statement lives. */}
            {!consentRequired && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline underline-offset-2"
                onClick={onRevokeSchemaSharing}
                data-testid="ai-consent-revoke"
              >
                Revoke schema sharing
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const providerCollection = createListCollection({
  items: AI_PROVIDER_PRESETS.map((p) => ({ label: p.label, value: p.id })),
});

const canSaveConfig = (input: { providerId: string; baseUrl: string; apiKey: string }): boolean => {
  if (input.providerId === CUSTOM_PROVIDER_ID && input.baseUrl.trim().length === 0) return false;
  return isProviderKeyOptional(input.providerId) || input.apiKey.trim().length > 0;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const READABLE_PREVIEW_COLUMNS = [
  "display_name",
  "title",
  "name",
  "channel_name",
  "login",
  "username",
  "label",
  "slug",
] as const;

const readablePreviewColumns = (
  columns: ReadonlyArray<string>,
  rows: ReadonlyArray<Record<string, unknown>>,
): string[] => {
  const preferred = columns.filter((column) =>
    READABLE_PREVIEW_COLUMNS.includes(
      column.toLowerCase() as (typeof READABLE_PREVIEW_COLUMNS)[number],
    ),
  );
  if (preferred.length > 0) return preferred.slice(0, 6);
  const relationLabels = columns.filter((column) => column.endsWith("__label"));
  if (relationLabels.length > 0) return relationLabels.slice(0, 6);
  return columns.length > 0 ? columns.slice(0, 4) : rows[0] ? Object.keys(rows[0]).slice(0, 4) : [];
};

const previewColumnLabel = (column: string): string => {
  const relationColumn = column.endsWith("__label") ? column.slice(0, -"__label".length) : column;
  const words = relationColumn.replaceAll("_", " ").trim();
  return column.endsWith("__label")
    ? `${words || "Related"} label`
    : words.charAt(0).toUpperCase() + words.slice(1);
};

const previewCellText = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const PreviewRowsTable = ({
  columns,
  rows,
  readable = false,
}: {
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Record<string, unknown>>;
  readable?: boolean;
}): ReactNode => (
  <div className="overflow-x-auto rounded border">
    <table className="w-full min-w-max text-left text-xs">
      <thead className="bg-muted/50">
        <tr>
          {columns.map((column) => (
            <th key={column} className="whitespace-nowrap px-2 py-1.5 font-medium">
              {readable ? previewColumnLabel(column) : column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 8).map((row, index) => (
          <tr key={index} className="border-t align-top">
            {columns.map((column) => (
              <td key={column} className="max-w-56 px-2 py-1.5 break-words">
                {previewCellText(row[column])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length > 8 ? (
      <p className="text-muted-foreground border-t px-2 py-1.5 text-[11px]">
        Showing 8 of {rows.length} sampled rows.
      </p>
    ) : null}
  </div>
);

/** Audit M2: copy affordance for proposal/result SQL — the product's core output. */
const CopySqlButton = ({ sql }: { sql: string }): ReactNode => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "SQL copied" : "Copy SQL"}
      title="Copy SQL"
      data-testid="copy-proposed-sql"
      onClick={() => {
        void navigator.clipboard.writeText(sql).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
      className="bg-background text-muted-foreground hover:bg-accent absolute end-1.5 top-1.5 cursor-pointer rounded border px-1.5 py-0.5 text-[11px] font-medium"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
};
