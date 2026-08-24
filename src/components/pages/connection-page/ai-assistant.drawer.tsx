import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, KeyRound, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { aiStatsFromRows } from "#src/lib/ai/ai-stats.ts";
import { suggestMissingIndexes } from "#src/lib/ai/suggest-missing-indexes.ts";
import { suggestQueriesFromSchema } from "#src/lib/ai/suggest-queries.ts";
import { SQL_PREVIEW_REVEAL_SIZE } from "#src/lib/sql-preview-panel.ts";
import { getAllTablesColumnsQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-columns.start.ts";
import { getTableIndexesQueryOptions } from "#src/server/introspection/start-fns/get-table-indexes.start.ts";

import type { AiSchemaContext, AiTableContext } from "#src/lib/ai/ai-types.ts";

import {
  clearStoredOpenAiApiKey,
  getStoredOpenAiApiKey,
  hasStoredOpenAiApiKey,
  setStoredOpenAiApiKey,
} from "#src/lib/ai-byok.ts";
import { findPendingApproval } from "#src/lib/chat/chat/ui-messages.ts";
import {
  ChatProvider,
  useChatActions,
  useChatSelector,
} from "#src/lib/chat/react-hooks.ts";
import { ThreadMessage } from "#src/lib/chat/web/thread/thread-message.tsx";
import type { DbConnection } from "../connection.types.ts";

import { Badge } from "../../ui/badge.tsx";
import { Button } from "../../ui/button.tsx";
import { Checkbox, CheckboxControl } from "../../ui/checkbox.tsx";
import { Input } from "../../ui/input.tsx";
import { Label } from "../../ui/label.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet.tsx";
import { Textarea } from "../../ui/textarea.tsx";
import { AiStatsPanel } from "./ai-stats-panel.tsx";
import { updateTabState, useActiveTabState } from "./create-tab-state.ts";
import { useDadabaseChatRuntime } from "./use-chat-runtime.tsx";
import { useTableColumnMetadata } from "./use-table-column-metadata.ts";

interface ConnectionAiAssistantDrawerProps {
  connection: DbConnection;
  activeConnectionUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Put SQL in editor and execute (NL → SQL → run → results). */
  onGenerateAndRun?: (sql: string) => void;
}

export const ConnectionAiAssistantDrawer = ({
  connection,
  open,
  onOpenChange,
  onGenerateAndRun,
}: ConnectionAiAssistantDrawerProps) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const tab = useActiveTabState((t) => ({
    schema: t.schema,
    table: t.table,
    orderBy: t.orderBy,
    filters: t.filters,
  }));

  const [hasKey, setHasKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [hasApprovedSchemaSharing, setHasApprovedSchemaSharing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHasKey(hasStoredOpenAiApiKey());
    setKeyDraft(getStoredOpenAiApiKey() ?? "");
  }, [open]);

  const { columnMetadata } = useTableColumnMetadata({
    url: connection.url,
    schema: tab.schema || "",
    table: tab.table || "",
  });

  const allTablesColumnsQuery = useQuery({
    ...getAllTablesColumnsQueryOptions({
      url: connection.url,
      schema: tab.schema || "",
    }),
    enabled: open && !!tab.schema && !!connection.url,
  });

  const indexesQuery = useQuery({
    ...getTableIndexesQueryOptions({
      url: connection.url,
      schema: tab.schema || "",
      table: tab.table || "",
    }),
    enabled: open && !!tab.schema && !!tab.table && !!connection.url,
  });

  const tableContext = useMemo(
    () => ({
      schema: tab.schema || "public",
      table: tab.table || "",
      dialect: connection.dialect,
      columns: columnMetadata,
    }),
    [tab.schema, tab.table, connection.dialect, columnMetadata],
  );

  const schemaContext = useMemo(() => {
    const schema = tab.schema || "public";
    const tablesFromAll: AiTableContext[] = (allTablesColumnsQuery.data ?? []).map((t) => ({
      schema,
      table: t.table,
      dialect: connection.dialect,
      columns: t.columns,
    }));

    // Fallback to active table only while full schema loads
    const tables =
      tablesFromAll.length > 0
        ? tablesFromAll
        : tableContext.table && tableContext.columns.length > 0
          ? [tableContext]
          : [];

    return {
      schema,
      dialect: connection.dialect,
      tables,
      activeTable: tab.table || undefined,
    };
  }, [allTablesColumnsQuery.data, connection.dialect, tab.table, tab.schema, tableContext]);

  const suggestedQueries = useMemo(() => {
    if (!tab.table || columnMetadata.length === 0) return [];
    return suggestQueriesFromSchema(tableContext);
  }, [tab.table, columnMetadata, tableContext]);

  const filterColumns = useMemo(
    () => (tab.filters?.conditions ?? []).map((c) => c.column).filter(Boolean),
    [tab.filters],
  );

  const indexSuggestions = useMemo(() => {
    if (!tab.table || columnMetadata.length === 0) return [];
    return suggestMissingIndexes({
      schema: tab.schema || "public",
      table: tab.table,
      columns: columnMetadata,
      indexes: indexesQuery.data ?? [],
      filterColumns,
      orderColumns: tab.orderBy ? [tab.orderBy] : [],
    });
  }, [tab.table, tab.schema, tab.orderBy, columnMetadata, indexesQuery.data, filterColumns]);

  const demoStats = useMemo(() => {
    if (indexSuggestions.length === 0) return null;
    return aiStatsFromRows(
      "Index suggestions by reason",
      Object.entries(
        indexSuggestions.reduce<Record<string, number>>((acc, s) => {
          acc[s.reason] = (acc[s.reason] ?? 0) + 1;
          return acc;
        }, {}),
      ).map(([label, value]) => ({ label, value })),
      "stat",
    );
  }, [indexSuggestions]);

  const applySqlToEditor = (sql: string) => {
    void navigate({
      search: (prev) =>
        updateTabState(prev, {
          customSql: sql,
          customSqlId: undefined,
          sqlEditorMode: "editor",
          sqlPreviewSize: SQL_PREVIEW_REVEAL_SIZE,
        }),
    });
    onOpenChange(false);
  };

  const applySqlAndRun = (sql: string) => {
    // Runner expands the SQL panel and seeds the editor (revealEditor).
    onGenerateAndRun?.(sql);
    onOpenChange(false);
  };

  const saveKey = () => {
    setStoredOpenAiApiKey(keyDraft);
    setHasKey(hasStoredOpenAiApiKey());
  };

  const clearKey = () => {
    clearStoredOpenAiApiKey();
    setKeyDraft("");
    setHasKey(false);
  };

  return (
    <Sheet open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <SheetContent className="z-50 flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2" data-testid="ai-assistant-drawer">
            <Sparkles className="size-4" />
            AI assistant
          </SheetTitle>
          <SheetDescription className="text-xs">
            BYOK OpenAI — key stays in this browser (`dadabase.openai-api-key`). Requests use a thin
            server proxy; the key is not stored server-side.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-auto p-4">
          {/* Settings */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="text-muted-foreground size-3.5" />
              <h3 className="text-sm font-medium">OpenAI API key</h3>
              {hasKey ? (
                <Badge variant="outline" colorPalette="success" size="xs">
                  saved
                </Badge>
              ) : (
                <Badge variant="outline" colorPalette="warning" size="xs">
                  missing
                </Badge>
              )}
            </div>
            <Label htmlFor="openai-key" className="text-muted-foreground text-xs">
              Paste key — stored only in localStorage
            </Label>
            <Input
              id="openai-key"
              type="password"
              placeholder="sk-…"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveKey} disabled={!keyDraft.trim()}>
                Save key
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearKey}
                disabled={!hasKey && !keyDraft}
                aria-label="Clear API key"
              >
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            </div>
          </section>

          {!hasKey ? (
            <div className="border-border bg-muted/40 rounded-md border border-dashed p-4 text-sm">
              <p className="font-medium">Add OpenAI key</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Save a key above to unlock natural-language SQL. Suggestions below work without a
                key.
              </p>
              <p
                className="text-muted-foreground mt-2 text-xs"
                data-testid="ai-schema-context-hint"
              >
                {schemaContext.tables.length > 0
                  ? `Using whole database schema (${schemaContext.tables.length} tables in ${schemaContext.schema}${
                      tab.table ? `; open: ${tab.table}` : ""
                    }).`
                  : tab.schema
                    ? "Loading schema metadata…"
                    : "Select a schema to include database context."}
              </p>
            </div>
          ) : (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Ask for a query</h3>
              <p className="text-muted-foreground text-xs" data-testid="ai-schema-context-hint">
                {schemaContext.tables.length > 0
                  ? `Using whole database schema (${schemaContext.tables.length} tables in ${schemaContext.schema}${
                      tab.table ? `; open: ${tab.table}` : ""
                    }).`
                  : tab.schema
                    ? "Loading schema metadata…"
                    : "Select a schema to include database context."}
              </p>
              <label className="border-border bg-muted/30 flex items-start gap-2 rounded-md border p-3 text-xs leading-5">
                <Checkbox
                  checked={hasApprovedSchemaSharing}
                  onCheckedChange={(details) =>
                    setHasApprovedSchemaSharing(details.checked === true)
                  }
                  data-testid="ai-schema-sharing-consent"
                >
                  <CheckboxControl />
                </Checkbox>
                <span>
                  <span className="font-medium">Share schema context with OpenAI</span>
                  <span className="text-muted-foreground block">
                    Dadabase sends this prompt plus schema, table, and column names to draft SQL. It
                    does not send table rows or query results. You review generated SQL before it
                    runs.
                  </span>
                </span>
              </label>
              {hasApprovedSchemaSharing && (
                <ChatSection
                  connectionName={connection.name}
                  schemaContext={schemaContext}
                  onApplySql={applySqlToEditor}
                  onRunSql={applySqlAndRun}
                  canRun={onGenerateAndRun !== undefined}
                />
              )}
            </section>
          )}

          {/* Suggested queries */}
          {suggestedQueries.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Suggested queries</h3>
              <ul className="space-y-1.5">
                {suggestedQueries.map((q) => (
                  <li key={`${q.kind}-${q.title}`}>
                    <button
                      type="button"
                      className="hover:bg-muted/60 border-border w-full rounded-md border px-3 py-2 text-left text-xs transition-colors"
                      onClick={() => applySqlToEditor(q.sql)}
                    >
                      <div className="font-medium">{q.title}</div>
                      <div className="text-muted-foreground mt-0.5 truncate">{q.prompt}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Index suggestions */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Missing indexes</h3>
            {!tab.table ? (
              <p className="text-muted-foreground text-xs">Select a table to analyze indexes.</p>
            ) : indexesQuery.isLoading ? (
              <p className="text-muted-foreground text-xs">Loading indexes…</p>
            ) : indexSuggestions.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No heuristic suggestions (FKs / filters / order look covered).
              </p>
            ) : (
              <ul className="space-y-2">
                {indexSuggestions.map((s) => (
                  <li
                    key={`${s.reason}-${s.columns.join(",")}`}
                    className="border-border space-y-1 rounded-md border px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" colorPalette="muted" size="xs">
                        {s.reason}
                      </Badge>
                      <span className="font-medium">{s.columns.join(", ")}</span>
                    </div>
                    <p className="text-muted-foreground">{s.message}</p>
                    <button
                      type="button"
                      className="text-foreground hover:underline"
                      onClick={() => applySqlToEditor(s.createSql)}
                    >
                      Put CREATE INDEX in editor
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {demoStats && <AiStatsPanel data={demoStats} className="pt-2" />}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/** Runtime-driven chat thread + composer + approval bar. */
const ChatSection = ({
  connectionName,
  schemaContext,
  onApplySql,
  onRunSql,
  canRun,
}: {
  connectionName: string;
  schemaContext: AiSchemaContext;
  onApplySql: (sql: string) => void;
  onRunSql: (sql: string) => void;
  canRun: boolean;
}) => {
  const schemaContextRef = useRef<AiSchemaContext | undefined>(schemaContext);
  schemaContextRef.current = schemaContext;

  const runtime = useDadabaseChatRuntime({ connectionName, schemaContextRef });

  return (
    <ChatProvider runtime={runtime}>
      <ChatThread onApplySql={onApplySql} onRunSql={onRunSql} canRun={canRun} />
    </ChatProvider>
  );
};

const ChatThread = ({
  onApplySql,
  onRunSql,
  canRun,
}: {
  onApplySql: (sql: string) => void;
  onRunSql: (sql: string) => void;
  canRun: boolean;
}) => {
  const messages = useChatSelector((s) => s.activeThread.messages);
  const isStreaming = useChatSelector((s) => s.activeThread.isStreaming);
  const draft = useChatSelector((s) => s.composer.text);
  const error = useChatSelector((s) => s.error);
  const actions = useChatActions();

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const pendingApproval = isStreaming ? undefined : findPendingApproval(lastAssistant);

  const renderToolResult = ({ toolName, result }: { toolName: string; result: unknown }) => {
    if ((toolName === "propose_sql" || toolName === "run_sql") && isRecord(result)) {
      const sql = typeof result.sql === "string" ? result.sql : undefined;
      if (sql !== undefined) {
        return (
          <div className="space-y-1.5">
            <pre className="bg-muted/50 overflow-auto rounded-md p-2 font-mono text-xs">{sql}</pre>
            <div className="flex gap-1.5">
              <Button size="xs" variant="outline" onClick={() => onApplySql(sql)}>
                Apply
              </Button>
              {canRun && toolName === "propose_sql" && (
                <Button size="xs" onClick={() => onRunSql(sql)}>
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
    <div className="space-y-2">
      <div
        className="border-border max-h-72 space-y-2 overflow-auto rounded-md border p-2"
        data-testid="ai-chat-thread"
      >
        {messages.length === 0 ? (
          <p className="text-muted-foreground px-1 py-2 text-xs">
            Ask a question — the assistant proposes SQL, you review before it runs.
          </p>
        ) : (
          messages.map((message) => (
            <ThreadMessage
              key={message.id}
              message={message}
              isStreaming={isStreaming && message.role === "assistant"}
              renderToolResult={renderToolResult}
            />
          ))
        )}
        {pendingApproval !== undefined && (
          <div
            className="border-border bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs"
            data-testid="ai-chat-approval"
            role="alert"
          >
            <span className="font-medium">
              Allow running the proposed SQL via `{pendingApproval.toolName}`?
            </span>
            <span className="flex shrink-0 gap-1.5">
              <Button
                size="xs"
                onClick={() =>
                  actions.approveToolCall({
                    approvalId: pendingApproval.approvalId,
                    approved: true,
                  })
                }
              >
                <Check className="size-3" />
                Approve
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  actions.approveToolCall({
                    approvalId: pendingApproval.approvalId,
                    approved: false,
                  })
                }
              >
                <X className="size-3" />
                Reject
              </Button>
            </span>
          </div>
        )}
        {isStreaming && (
          <div
            className="border-border bg-muted/40 flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
            data-testid="ai-generating-status"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />
            <span className="font-medium">Generating…</span>
          </div>
        )}
      </div>
      <Textarea
        rows={3}
        placeholder="e.g. show pending orders from the last 7 days"
        value={draft}
        onChange={(e) => actions.setDraft({ text: e.target.value })}
        data-testid="ai-chat-input"
        disabled={isStreaming}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!hasKeyForChat() || draft.trim() === "" || isStreaming}
          onClick={() => actions.sendMessage({ text: draft })}
          data-testid="ai-chat-send"
        >
          Send
        </Button>
        {messages.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => actions.startNewConversation()}>
            New chat
          </Button>
        ) : null}
      </div>
      {error && (
        <p className="text-destructive text-xs" data-testid="ai-chat-error">
          {error}
        </p>
      )}
    </div>
  );
};

const hasKeyForChat = (): boolean => getStoredOpenAiApiKey() !== null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
