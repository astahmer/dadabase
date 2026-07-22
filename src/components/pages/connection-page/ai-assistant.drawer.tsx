import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { KeyRound, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { AiTableContext } from "#src/lib/ai/ai-types.ts";

import {
  clearStoredOpenAiApiKey,
  getStoredOpenAiApiKey,
  hasStoredOpenAiApiKey,
  setStoredOpenAiApiKey,
} from "#src/lib/ai-byok.ts";
import { getAiGeneratingStatus } from "#src/lib/ai/ai-generating-status.ts";
import { aiStatsFromRows } from "#src/lib/ai/ai-stats.ts";
import { generateSqlFromNaturalLanguage } from "#src/lib/ai/generate-sql.ts";
import { suggestMissingIndexes } from "#src/lib/ai/suggest-missing-indexes.ts";
import { suggestQueriesFromSchema } from "#src/lib/ai/suggest-queries.ts";
import { getErrorMessage } from "#src/lib/get-error-message.ts";
import { SQL_PREVIEW_REVEAL_SIZE } from "#src/lib/sql-preview-panel.ts";
import { getAllTablesColumnsQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-columns.start.ts";
import { getTableIndexesQueryOptions } from "#src/server/introspection/start-fns/get-table-indexes.start.ts";

import type { DbConnection } from "../connection.types.ts";

import { Badge } from "../../ui/badge.tsx";
import { Button } from "../../ui/button.tsx";
import { Input } from "../../ui/input.tsx";
import { Label } from "../../ui/label.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet.tsx";
import { Textarea } from "../../ui/textarea.tsx";
import { AiStatsPanel } from "./ai-stats-panel.tsx";
import { updateTabState, useActiveTabState } from "./create-tab-state.ts";
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
  activeConnectionUrl,
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
  const [question, setQuestion] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string; sql?: string }>
  >([]);

  useEffect(() => {
    if (!open) return;
    setHasKey(hasStoredOpenAiApiKey());
    setKeyDraft(getStoredOpenAiApiKey() ?? "");
    setLastError(null);
  }, [open]);

  const { columnMetadata } = useTableColumnMetadata({
    url: activeConnectionUrl,
    schema: tab.schema || "",
    table: tab.table || "",
  });

  const allTablesColumnsQuery = useQuery({
    ...getAllTablesColumnsQueryOptions({
      url: activeConnectionUrl,
      schema: tab.schema || "",
    }),
    enabled: open && !!tab.schema && !!activeConnectionUrl,
  });

  const indexesQuery = useQuery({
    ...getTableIndexesQueryOptions({
      url: activeConnectionUrl,
      schema: tab.schema || "",
      table: tab.table || "",
    }),
    enabled: open && !!tab.schema && !!tab.table && !!activeConnectionUrl,
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
  }, [allTablesColumnsQuery.data, connection.dialect, tab.schema, tab.table, tableContext]);

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
          editorDetached: true,
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

  const canGenerate =
    Boolean(question.trim()) && schemaContext.tables.length > 0 && !allTablesColumnsQuery.isLoading;

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (schemaContext.tables.length === 0) {
        throw new Error("Schema metadata not loaded yet.");
      }
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      return generateSqlFromNaturalLanguage({
        question,
        schema: schemaContext,
        history,
      });
    },
    onSuccess: (result) => {
      setLastError(null);
      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: result.sql, sql: result.sql },
      ]);
      setQuestion("");
    },
    onError: (err) => {
      setLastError(getErrorMessage(err));
    },
  });

  const generateAndRunMutation = useMutation({
    mutationFn: async () => {
      if (schemaContext.tables.length === 0) {
        throw new Error("Schema metadata not loaded yet.");
      }
      if (!onGenerateAndRun) throw new Error("Run handler not wired.");
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      return generateSqlFromNaturalLanguage({
        question,
        schema: schemaContext,
        history,
      });
    },
    onSuccess: (result) => {
      setLastError(null);
      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: result.sql, sql: result.sql },
      ]);
      setQuestion("");
      applySqlAndRun(result.sql);
    },
    onError: (err) => {
      setLastError(getErrorMessage(err));
    },
  });

  const isGenerating = generateMutation.isPending || generateAndRunMutation.isPending;
  const generatingStatus = isGenerating
    ? getAiGeneratingStatus(generateAndRunMutation.isPending ? "generate-and-run" : "generate")
    : null;

  const saveKey = () => {
    setStoredOpenAiApiKey(keyDraft);
    setHasKey(hasStoredOpenAiApiKey());
    setLastError(null);
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
            BYOK OpenAI — key stays in this browser (`dadabase.openai-api-key`). Requests go through
            a thin server proxy (key is not stored server-side); direct browser calls are blocked by
            CORS.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-auto p-4">
          {/* Settings */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="text-muted-foreground size-3.5" />
              <h3 className="text-sm font-medium">OpenAI API key</h3>
              {hasKey ? (
                <Badge variant="outline" colorPalette="success" size="2xs">
                  saved
                </Badge>
              ) : (
                <Badge variant="outline" colorPalette="warning" size="2xs">
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
              {chatMessages.length > 0 ? (
                <div
                  className="border-border max-h-48 space-y-2 overflow-auto rounded-md border p-2"
                  data-testid="ai-chat-thread"
                >
                  {chatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={
                        m.role === "user"
                          ? "bg-muted/50 rounded-md px-2 py-1.5 text-xs"
                          : "border-border rounded-md border px-2 py-1.5 text-xs"
                      }
                    >
                      <div className="text-muted-foreground mb-1 font-medium">{m.role}</div>
                      <pre className="font-mono whitespace-pre-wrap">{m.content}</pre>
                      {m.sql ? (
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applySqlToEditor(m.sql!)}
                          >
                            Apply
                          </Button>
                          {onGenerateAndRun ? (
                            <Button size="sm" onClick={() => applySqlAndRun(m.sql!)}>
                              Run
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              <Textarea
                rows={3}
                placeholder="e.g. show pending orders from the last 7 days"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                data-testid="ai-chat-input"
                disabled={isGenerating}
              />
              {generatingStatus && (
                <div
                  className="border-border bg-muted/40 flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
                  data-testid="ai-generating-status"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />
                  <div className="space-y-0.5">
                    <p className="font-medium">{generatingStatus.title}</p>
                    <p className="text-muted-foreground">{generatingStatus.detail}</p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canGenerate || isGenerating}
                  onClick={() => generateMutation.mutate()}
                  data-testid="ai-chat-send"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    "Send"
                  )}
                </Button>
                {onGenerateAndRun && (
                  <Button
                    size="sm"
                    disabled={!canGenerate || isGenerating}
                    onClick={() => generateAndRunMutation.mutate()}
                    data-testid="ai-chat-send-run"
                  >
                    {generateAndRunMutation.isPending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      "Send → run"
                    )}
                  </Button>
                )}
                {chatMessages.length > 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setChatMessages([])}
                    disabled={isGenerating}
                  >
                    Clear chat
                  </Button>
                ) : null}
              </div>
              {lastError && (
                <p className="text-destructive text-xs" data-testid="ai-chat-error">
                  {lastError}
                </p>
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
                      <Badge variant="outline" colorPalette="muted" size="2xs">
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
