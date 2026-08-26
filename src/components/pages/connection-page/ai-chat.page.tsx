import { createListCollection } from "@ark-ui/react/select";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  KeyRound,
  PanelLeft,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { AiSchemaContext, AiTableContext } from "#src/lib/ai/ai-types.ts";

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
import { ChatProvider, useChatActions, useChatSelector } from "#src/lib/chat/react-hooks.ts";
import { ThreadMessage } from "#src/lib/chat/web/thread/thread-message.tsx";
import { stageCustomSqlRun } from "#src/lib/custom-sql-run-handoff.ts";
import { SQL_PREVIEW_REVEAL_SIZE } from "#src/lib/sql-preview-panel.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { getAllTablesColumnsQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-columns.start.ts";

import type { DbConnection } from "../connection.types.ts";

import { Badge } from "../../ui/badge.tsx";
import { announce } from "../../ui/aria-live.tsx";
import {
  grantSchemaSharingConsent,
  hasSchemaSharingConsent,
  revokeSchemaSharingConsent,
} from "#src/lib/ai/chat-consent.ts";
import { Button, buttonVariants } from "../../ui/button.tsx";
import { Spinner } from "../../ui/spinner.tsx";
import { toaster } from "../../ui/toaster.tsx";
import { Checkbox, CheckboxControl } from "../../ui/checkbox.tsx";
import { Input } from "../../ui/input.tsx";
import { Label } from "../../ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemGroup,
  SelectItemGroupLabel,
  SelectTrigger,
  SelectValueText,
} from "../../ui/select.tsx";
import { Textarea } from "../../ui/textarea.tsx";
import { createTabState } from "./create-tab-state.ts";
import { BYOK_CHANGED_EVENT, useDadabaseChatRuntime } from "./use-chat-runtime.tsx";

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
export const AiChatPage = ({ connectionName }: { connectionName: string }) => {
  const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
  useDocumentTitle(`${connectionName} · AI assistant — Dadabase`);
  const connection: DbConnection | undefined = connectionList.data.find(
    (c) => c.name === connectionName,
  );

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

  return <AiChatPageInner connection={connection} />;
};

const AiChatPageInner = ({ connection }: { connection: DbConnection }) => {
  const navigate = useNavigate({ from: "/connections/$connectionName/ai" });
  // Dialect-aware: SQLite/LibSQL live in "main", Postgres in "public".
  const [schema] = useState(() => getDialectDefaultSchema(connection.dialect));
  const [settingsOpen, setSettingsOpen] = useState(() => !hasUsableByokConfig());
  // Audit S2: consent is a durable per-connection decision, not component
  // state — re-gating every visit trains users to stop reading the banner.
  // Storage read happens in an effect (not a lazy initializer) so server and
  // client first renders agree; the banner may flash for one frame.
  const [hasApprovedSchemaSharing, setHasApprovedSchemaSharing] = useState(false);
  useEffect(() => {
    setHasApprovedSchemaSharing(hasSchemaSharingConsent(connection.name));
  }, [connection.name]);
  // Audit C6/R1: below md the thread list becomes an overlay drawer.
  const narrow = useIsNarrowWidth();
  const [threadListOpen, setThreadListOpen] = useState(false);

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

  /** Fresh SQL-editor tab pre-seeded with generated SQL. */
  const createEditorTab = (sql: string) => {
    const schema = getDialectDefaultSchema(connection.dialect);
    return createTabState(schema, "", {
      initialTabMode: "sql",
      customSql: sql,
      sqlPreviewSize: SQL_PREVIEW_REVEAL_SIZE,
    });
  };

  /** Open the connection page on a fresh SQL-editor tab seeded with generated SQL. */
  const navigateToEditor = (sql: string, newTab = createEditorTab(sql)) => {
    const schema = getDialectDefaultSchema(connection.dialect);
    return navigate({
      to: "/connections/$connectionName",
      params: { connectionName: connection.name },
      search: { schema, activeTabId: newTab.tabId, tabs: [newTab] },
    });
  };

  const applySqlToEditor = (sql: string) => {
    void navigateToEditor(sql);
  };

  /**
   * Deep-link seeded editor + auto-run: stage the run under the new tab id
   * BEFORE navigating; the mounted editor consumes and executes it exactly
   * once (custom-sql-run-handoff.ts).
   */
  const applySqlAndRun = (sql: string) => {
    const newTab = createEditorTab(sql);
    stageCustomSqlRun(newTab.tabId, { sql });
    void navigateToEditor(sql, newTab);
  };

  return (
    <div className="bg-background flex h-full min-h-0 flex-col" data-testid="ai-chat-page">
      <header className="border-border flex items-center gap-3 border-b px-4 py-2.5">
        <Link
          to="/connections/$connectionName"
          params={{ connectionName: connection.name }}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          data-testid="ai-chat-back"
        >
          <ArrowLeft className="size-4" />
          {connection.name}
        </Link>
        <h1 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4" />
          AI assistant
        </h1>
        <Badge
          variant="outline"
          colorPalette={
            byokState === "loading" ? "muted" : byokState === "usable" ? "success" : "warning"
          }
          size="xs"
        >
          {byokState === "loading"
            ? "provider"
            : byokState === "usable"
              ? "provider configured"
              : "not configured"}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          {narrow && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setThreadListOpen(true)}
              data-testid="ai-threads-toggle"
              aria-label="Show chats"
            >
              <PanelLeft className="size-4" />
              Threads
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen((open) => !open)}
            data-testid="ai-settings-toggle"
          >
            <Settings2 className="size-4" />
            Provider
          </Button>
        </div>
      </header>

      {settingsOpen && (
        <ProviderSettingsSection
          // Keyed on byokState: defaultOpen must be evaluated AFTER the BYOK
          // probe resolves, not during the initial "loading" pass.
          key={`provider-${byokState}`}
          onDone={() => setSettingsOpen(false)}
          defaultOpen={byokState !== "usable"}
        />
      )}
      {settingsOpen && <ToolsSettingsSection defaultOpen={false} />}
      {settingsOpen && (
        <SchemaSettingsSection
          schemaContext={schemaContext}
          connectionName={connection.name}
          defaultOpen={false}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <AiChatBody
          connection={connection}
          schemaContext={schemaContext}
          schemaLoading={allTablesColumnsQuery.isLoading}
          providerReady={byokState === "usable"}
          hasApprovedSchemaSharing={hasApprovedSchemaSharing}
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
          threadList={{
            narrow,
            open: threadListOpen,
            onClose: () => setThreadListOpen(false),
          }}
        />
      </div>
    </div>
  );
};

/** Provider/key configuration — identical storage contract as the old drawer. */
const ProviderSettingsSection = ({
  onDone,
  defaultOpen = true,
}: {
  onDone?: () => void;
  defaultOpen?: boolean;
}) => {
  const [providerIdDraft, setProviderIdDraft] = useState("openai");
  const [baseUrlDraft, setBaseUrlDraft] = useState("");
  const [modelDraft, setModelDraft] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [hasConfig, setHasConfig] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Audit C16: saves used to be silent — flash an explicit confirmation.
  const [saveFlash, setSaveFlash] = useState(false);
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
        <span className="text-muted-foreground ml-auto text-xs">
          BYOK — config stays in this browser; requests are proxied and never stored server-side.
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr_1fr_auto] sm:items-end">
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
              />
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
                <Input
                  id="ai-api-key"
                  type="password"
                  placeholder="sk-…"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-muted-foreground self-end pb-2 text-xs">
                No API key needed for this provider.
              </p>
            )}
          </div>
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
              Save
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
          </div>
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
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox
                  checked={enabled.includes(tool.id)}
                  onCheckedChange={(details) => toggleTool(tool.id, details.checked === true)}
                  data-testid={`ai-tool-checkbox-${tool.id}`}
                >
                  <CheckboxControl />
                </Checkbox>
                <span>
                  <span className="font-medium">{tool.label}</span>
                  <span className="text-muted-foreground block text-xs">{tool.description}</span>
                </span>
              </label>
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
  connectionName,
  defaultOpen = false,
}: {
  schemaContext: AiSchemaContext;
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
            Which tables the assistant can see ({tableNames.length} total).
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
  onApplySql,
  onRunSql,
  threadList,
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
  onApplySql: (sql: string) => void;
  onRunSql: (sql: string) => void;
  /** Audit C6/R1: narrow-viewport thread-list drawer state. */
  threadList: { narrow: boolean; open: boolean; onClose: () => void };
}) => {
  const schemaContextRef = useRef<AiSchemaContext | undefined>(schemaContext);
  schemaContextRef.current = schemaContext;

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
  });

  return (
    <ChatProvider runtime={runtime}>
      <ThreadListPanel
        narrow={threadList.narrow}
        overlayOpen={threadList.open}
        onClose={threadList.onClose}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Audit C1: the full chat surface stays mounted pre-consent — users
            must see what they are unlocking. Only Send is gated. */}
        {!hasApprovedSchemaSharing && (
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
                  does not send table rows or query results. You review generated SQL before it
                  runs.
                </span>
              </span>
            </label>
          </div>
        )}
        <ChatSurface
          onApplySql={onApplySql}
          onRunSql={onRunSql}
          schemaHint={schemaStatus}
          consentRequired={!hasApprovedSchemaSharing}
          onRevokeSchemaSharing={onRevokeSchemaSharing}
          providerReady={providerReady}
          dialect={connection.dialect}
        />
      </main>
    </ChatProvider>
  );
};

/** Saved-thread list; ghost entry before the first thread exists (audit C12). */
const ThreadListPanel = ({
  narrow,
  overlayOpen,
  onClose,
}: {
  /** Below md the list becomes an overlay drawer instead of a column. */
  narrow: boolean;
  overlayOpen: boolean;
  onClose: () => void;
}) => {
  // Audit S1: persistence was write-only — nothing ever asked the store for
  // the conversation history, so THREADS stayed empty until the first send
  // identified a conversation. One search request hydrates the list on mount;
  // after sends it refreshes via the runtime's conversation-identified event.
  const conversations = useChatSelector((s) => s.conversations.items);
  const activeConversationId = useChatSelector((s) => s.activeThread.conversationId);
  const actions = useChatActions();
  useEffect(() => {
    // Deferred one tick: this panel mounts as a child of ChatProvider, and
    // child effects flush before the provider's start() effect — xstate v5
    // drops events sent to an unstarted actor.
    const timer = window.setTimeout(() => actions.setConversationSearch({ search: "" }), 0);
    return () => window.clearTimeout(timer);
  }, [actions]);

  const content =
    conversations.length === 0 ? (
      <p className="text-muted-foreground px-2 py-4 text-xs" data-testid="ai-thread-list-ghost">
        Chats will appear here once you start chatting.
      </p>
    ) : (
      <ul className="space-y-0.5">
        {conversations.map((thread) => (
          <li key={thread.id} className="group/thread flex items-center gap-0.5">
            <button
              type="button"
              className={`hover:bg-muted/60 min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                thread.id === activeConversationId ? "bg-muted font-medium" : ""
              }`}
              onClick={() => {
                // Flat model: the conversation IS the thread — selecting one
                // loads its persisted messages into the runtime session.
                actions.selectConversation({ conversationId: thread.id });
                onClose();
              }}
              data-testid="ai-thread-item"
            >
              {thread.title || "New chat"}
            </button>
            {/* Audit C15: destructive per-thread action must be named, not a
                bare icon (and previously did not exist at all). */}
            <Button
              size="icon"
              variant="ghost"
              className="size-6 opacity-0 transition-opacity group-hover/thread:opacity-100 focus-visible:opacity-100"
              aria-label={`Delete chat ${thread.title || "New chat"}`}
              title="Delete chat"
              onClick={() => {
                actions.deleteConversation({
                  conversationId: thread.id,
                  resetSession: thread.id === activeConversationId,
                });
                // Audit G6: destructive action feedback must reach AT.
                announce(`Chat deleted.`);
              }}
              data-testid="ai-thread-delete"
            >
              <Trash2 className="size-3" />
            </Button>
          </li>
        ))}
      </ul>
    );

  const header = (
    <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase">
      Threads
    </p>
  );

  // Audit C6/R1: below md the list overlays the thread instead of squeezing
  // it; it never removes the thread from the DOM.
  if (narrow) {
    if (!overlayOpen) return null;
    return (
      <>
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={onClose}
          aria-hidden="true"
          data-testid="ai-thread-overlay-backdrop"
        />
        <aside
          className="border-border bg-background fixed inset-y-0 left-0 z-40 w-64 overflow-auto border-r p-2 shadow-xl"
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
      </>
    );
  }

  return (
    <aside
      className="border-border w-56 shrink-0 overflow-auto border-r p-2"
      data-testid="ai-thread-list"
    >
      {header}
      {content}
    </aside>
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

/** Audit C6/R1: below md the thread list becomes an overlay drawer. */
const useIsNarrowWidth = (): boolean => {
  const [isNarrow, setIsNarrow] = useState(
    () => globalThis.window?.matchMedia("(max-width: 767px)").matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isNarrow;
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

/** Runtime-driven thread viewport + approval bar + composer. */
const ChatSurface = ({
  onApplySql,
  onRunSql,
  schemaHint,
  consentRequired,
  onRevokeSchemaSharing,
  providerReady,
  dialect,
}: {
  onApplySql: (sql: string) => void;
  onRunSql: (sql: string) => void;
  /** Post-consent transparency line about the schema context in use. */
  schemaHint: string;
  /** Schema-sharing consent outstanding — Send stays disabled until approved. */
  consentRequired: boolean;
  onRevokeSchemaSharing: () => void;
  /** Stored BYOK config satisfies its provider's key requirement. */
  providerReady: boolean;
  dialect: DatabaseDialect;
}) => {
  const messages = useChatSelector((s) => s.activeThread.messages);
  const isStreaming = useChatSelector((s) => s.activeThread.isStreaming);
  const draft = useChatSelector((s) => s.composer.text);
  const error = useChatSelector((s) => s.error);
  const actions = useChatActions();

  // Audit G7: async failures must not live only in inline text — surface them
  // as toasts and announce them so they reach users regardless of focus.
  const lastAnnouncedError = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!error || error === lastAnnouncedError.current) return;
    lastAnnouncedError.current = error;
    toaster.create({ title: "Chat error", description: error, type: "error" });
    announce("Chat error.");
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

  const composerFocus = () =>
    document.querySelector<HTMLTextAreaElement>('[data-testid="ai-chat-input"]')?.focus();

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const pendingApproval = isStreaming ? undefined : findPendingApproval(lastAssistant);
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
          <pre
            className="bg-muted/50 overflow-auto rounded-md p-2 font-mono text-xs"
            data-testid="ai-chat-proposed-sql"
          >
            {input.sql}
          </pre>
        </div>
      );
    }
    return undefined;
  };

  const renderToolResult = ({ toolName, result }: { toolName: string; result: unknown }) => {
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
            <pre className="bg-muted/50 overflow-auto rounded-md p-2 font-mono text-xs">{sql}</pre>
            <div className="flex gap-1.5">
              <Button
                size="xs"
                variant="outline"
                onClick={() => onApplySql(sql)}
                data-testid="ai-chat-apply-sql"
              >
                Use this SQL
              </Button>
              {toolName === "propose_sql" && (
                <Button size="xs" onClick={() => onRunSql(sql)} data-testid="ai-chat-run-sql">
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
      <div
        className="mx-auto min-h-0 w-full max-w-3xl flex-1 space-y-3 overflow-auto p-4"
        data-testid="ai-chat-thread"
      >
        {messages.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-4 px-1 py-10 text-center text-sm">
            <p>
              Ask a question about this database — the assistant proposes SQL, you review it before
              it runs.
            </p>
            {/* Audit C7: one primary action instead of a 90%-empty viewport. */}
            <Button
              size="sm"
              variant="outline"
              disabled={consentRequired || !providerReady}
              onClick={composerFocus}
              data-testid="ai-chat-first-question"
            >
              <Sparkles className="size-3.5" />
              Ask your first question
            </Button>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} data-testid="ai-chat-message" data-role={message.role}>
              <ThreadMessage
                message={message}
                isStreaming={isStreaming && message.role === "assistant"}
                renderToolResult={renderToolResult}
                renderToolInput={renderToolInput}
              />
            </div>
          ))
        )}
        {pendingApproval !== undefined ? (
          <div
            className="border-border bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            data-testid="ai-chat-approval"
            role="alert"
          >
            <span className="font-medium">
              Allow running the proposed SQL via `{pendingApproval.toolName}`?
            </span>
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
              onClick={() => actions.stop()}
              data-testid="ai-chat-cancel"
              aria-label="Stop generating"
            >
              <Square className="size-3" />
              Stop
            </Button>
          </div>
        )}
      </div>

      <div className="border-border border-t p-3">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          <Textarea
            rows={3}
            placeholder={composerPlaceholder(dialect)}
            value={draft}
            onChange={(e) => actions.setDraft({ text: e.target.value })}
            data-testid="ai-chat-input"
            disabled={isStreaming}
            aria-label="Chat message"
          />
          <div className="flex flex-wrap items-center gap-2">
            <ComposerModelPicker />
            <Button
              size="sm"
              disabled={consentRequired || !providerReady || draft.trim() === "" || isStreaming}
              onClick={() => actions.sendMessage({ text: draft })}
              data-testid="ai-chat-send"
            >
              Send
            </Button>
            {messages.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => actions.startNewConversation()}
                data-testid="ai-chat-new-chat"
              >
                New chat
              </Button>
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
          {error && (
            <p className="text-destructive text-xs" data-testid="ai-chat-error">
              {error}
            </p>
          )}
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
