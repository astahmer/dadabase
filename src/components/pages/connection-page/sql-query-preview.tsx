import { Portal } from "@ark-ui/react";
import {
  Check,
  CircleDot,
  ChevronDown,
  ChevronRight,
  Copy,
  HelpCircle,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Play,
  RotateCcw,
  Square,
  Star,
  Wand2,
  Zap,
  Sparkles,
} from "lucide-react";
import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react";

import type { SqlEditorViewZoneActionId } from "#src/lib/sql-editor-view-zones.ts";
import type { TableWithColumnsMetadata } from "#src/server/introspection/introspection.ts";

import { Button } from "#src/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#src/components/ui/dialog.tsx";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "#src/components/ui/hovercard.tsx";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuItemText,
  MenuTrigger,
} from "#src/components/ui/menu.tsx";
import { Tooltip } from "#src/components/ui/tooltip.tsx";
import { formatSqlExecutionScope, getSqlExecutionScope } from "#src/lib/sql-execution-scope.ts";
import { cn } from "#src/lib/utils.ts";

import {
  SQL_EDITOR_MAXIMIZE_ACTIONS,
  type SqlEditorMaximizeAction,
} from "./sql-editor-maximize-actions.ts";
import { SqlMonacoEditor } from "./sql-monaco-editor.tsx";
import { SqlSnippetsMenu } from "./sql-snippets-menu.tsx";

export type { SqlEditorMaximizeAction };
export { SQL_EDITOR_MAXIMIZE_ACTIONS };

interface SqlQueryPreviewProps {
  /** The raw SQL query string */
  sql: string;
  /** Formatted SQL with indentation (for display) */
  formattedSql?: string;
  /** Whether the query is loading */
  isLoading?: boolean;
  /** Any error that occurred while generating the SQL */
  error?: Error | null;
  /**
   * @deprecated Unified editor — preview/editor tabs removed. Kept for URL back-compat.
   */
  editorMode?: "preview" | "editor";
  /** @deprecated No-op; editor is always active when expanded. */
  onEditorModeChange?: (mode: "preview" | "editor") => void;
  /** Callback when editor content changes */
  onEditorChange?: (value: string) => void;
  /** Custom SQL that user has edited (if different from generated SQL) */
  customSql?: string;
  allowEmptySql?: boolean;
  /** Callback to run the whole editor value or the active statement. */
  onRun?: (editorValue: string, statementSql?: string) => void;
  /** Explicitly run the complete editor script, even when the cursor is in one statement. */
  onRunAll?: (editorValue: string) => void;
  /** Run the complete script atomically, rolling back if any statement fails. */
  onRunInTransaction?: (editorValue: string) => void;
  /** Begin a connection-scoped transaction session. */
  onBeginTransaction?: () => void;
  /** Commit the active connection-scoped transaction session. */
  onCommitTransaction?: () => void;
  /** Roll back the active connection-scoped transaction session. */
  onRollbackTransaction?: () => void;
  /** Current connection-scoped transaction state. */
  transactionStatus?: "idle" | "active" | "busy";
  /** Whether this connection supports a persistent transaction session. */
  transactionSupported?: boolean;
  /** Callback to cancel the running query */
  onCancel?: () => void;
  /** Callback to explain the whole editor value or the active statement. */
  onExplain?: (statementSql?: string) => void;
  /** Whether to disable the explain button */
  disableExplain?: boolean;
  /** Callback to format the SQL */
  onFormat?: () => void;
  /** Callback to toggle fullscreen editor */
  onToggleFullscreen?: () => void;
  /** Expand the SQL panel (collapse rows) without going fullscreen */
  onExpandPanel?: () => void;
  /** Set a named editor/results split without remounting the editor. */
  onSetPanelSize?: (sqlPanelPercent: number) => void;
  /** Whether editor is in fullscreen mode */
  isFullscreen?: boolean;
  /** Whether the preview is collapsed */
  isCollapsed?: boolean;
  /** Schema-aware snippet insertion (audit S3). */
  snippetTables?: Array<string>;
  /** Table preselected in the snippet picker. */
  snippetActiveTable?: string;
  /** Audit: open an AI tab seeded to propose a query for this context. */
  onSuggestQuery?: () => void;
  /** Open contextual AI with the current SQL draft/editor value. */
  onAskAi?: () => void;
  /** Callback to toggle collapsed state */
  onToggleCollapsed?: (collapsed: boolean) => void;
  /** Available tables for intellisense suggestions */
  tables?: Array<{ schema: string; name: string }>;
  /** Available columns grouped by table */
  columns?: TableWithColumnsMetadata[];
  /** Callback to save the current SQL as a favorite */
  onSaveFavorite?: (sql: string) => void;
  /** Whether a favorite save is in progress */
  isSavingFavorite?: boolean;
  /** Shows durable feedback after the current SQL was saved. */
  favoriteSaved?: boolean;
  /** Callback when a snippet should be inserted into the editor */
  onInsertSnippet?: (sql: string) => void;
  /** Reset the draft back to the generated/stored SQL. */
  onReset?: () => void;
  isDirty?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Warning message to display next to the header */
  warning?: ReactNode;
  /** Small origin/context receipt for SQL opened from a table workspace. */
  contextReceipt?: ReactNode;
}

/**
 * Unified SQL editor for the connection page.
 * Always editable Monaco when expanded — no separate preview/editor modes.
 * Local drafts stick until Reset; generated SQL updates only apply with no draft.
 */
export function SqlQueryPreview({
  sql,
  isLoading = false,
  error = null,
  onEditorModeChange,
  onEditorChange,
  customSql,
  allowEmptySql = false,
  onRun,
  onRunAll,
  onRunInTransaction,
  onBeginTransaction,
  onCommitTransaction,
  onRollbackTransaction,
  transactionStatus = "idle",
  transactionSupported = true,
  onCancel,
  onExplain,
  disableExplain = false,
  onFormat,
  onToggleFullscreen,
  onExpandPanel,
  onSetPanelSize,
  onSaveFavorite,
  isSavingFavorite = false,
  favoriteSaved = false,
  isFullscreen = false,
  isCollapsed = true,
  onToggleCollapsed,
  tables = [],
  columns = [],
  snippetActiveTable,
  onSuggestQuery,
  onAskAi,
  onInsertSnippet,
  onReset,
  isDirty = false,
  className,
  warning,
  contextReceipt,
}: SqlQueryPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [activeStatementSql, setActiveStatementSql] = useState<string | undefined>(undefined);
  const [favoriteSaveAcknowledged, setFavoriteSaveAcknowledged] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const insertTextAtCursorRef = useRef<((text: string) => void) | null>(null);
  // An untouched Monaco never fires onChange; seed from displayed content so
  // Run never submits "" after a deep-link seed (AI chat / URL params).
  const editorValueRef = useRef<string>(customSql ?? sql ?? "");

  useEffect(() => {
    const nextValue = customSql ?? sql ?? "";
    if (nextValue !== editorValueRef.current) {
      editorValueRef.current = nextValue;
      setActiveStatementSql(undefined);
    }
  }, [customSql, sql]);

  const handleCopy = async () => {
    try {
      const textToCopy = editorValueRef.current;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy SQL to clipboard:", err);
    }
  };

  const handleEditorChange = useEffectEvent((value: string) => {
    editorValueRef.current = value;
    setFavoriteSaveAcknowledged(false);
    onEditorChange?.(value);
  });

  const saveFavorite = useEffectEvent(async (statementSql?: string) => {
    const value = statementSql || editorValueRef.current;
    if (!value.trim()) return;
    await onSaveFavorite?.(value);
    setFavoriteSaveAcknowledged(true);
  });

  const handleInsertSnippet = useEffectEvent((snippetSql: string) => {
    if (insertTextAtCursorRef.current) {
      insertTextAtCursorRef.current(snippetSql);
      setFavoriteSaveAcknowledged(false);
      onEditorModeChange?.("editor");
      if (isCollapsed) onToggleCollapsed?.(false);
      onInsertSnippet?.(snippetSql);
      return;
    }
    const current = editorValueRef.current.trimEnd();
    const next = current ? `${current}\n${snippetSql}` : snippetSql;
    editorValueRef.current = next;
    setFavoriteSaveAcknowledged(false);
    onEditorChange?.(next);
    onEditorModeChange?.("editor");
    if (isCollapsed) onToggleCollapsed?.(false);
    onInsertSnippet?.(snippetSql);
  });

  const currentSql = () => editorValueRef.current;
  const executionScope = getSqlExecutionScope(currentSql(), activeStatementSql);
  const fullScriptScope = getSqlExecutionScope(currentSql());
  const layoutPresets = [
    { id: "editor-focus", label: "Editor focus", size: 70 },
    { id: "balanced", label: "Balanced", size: 35 },
    { id: "results-focus", label: "Results focus", size: 20 },
  ] as const;
  const runSql = (statementSql?: string) => {
    onRun?.(currentSql(), statementSql);
  };
  const downloadSql = () => {
    const blob = new Blob([currentSql()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "query.sql";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const resetDraft = () => {
    if (!isDirty || window.confirm("Discard your unsaved SQL changes?")) onReset?.();
  };
  const handleViewZoneAction = useEffectEvent(
    (action: SqlEditorViewZoneActionId, statementSql?: string) => {
      switch (action) {
        case "run":
          runSql(statementSql);
          break;
        case "explain":
          onExplain?.(statementSql);
          break;
        case "format":
          onFormat?.();
          break;
        case "fullscreen":
          onToggleFullscreen?.();
          break;
        case "copy":
          void handleCopy();
          break;
        case "save":
          void saveFavorite(statementSql);
          break;
      }
    },
  );

  // Only block the whole preview while SQL is still being generated.
  // When a query is running (`isLoading` + existing sql), keep the editor so Cancel stays usable.
  if (isLoading && !sql) {
    return (
      <div className={cn("border-border bg-muted/30 rounded border p-4", className)}>
        <div className="text-muted-foreground text-sm">Generating SQL query...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("border-destructive/30 bg-destructive/10 rounded border p-4", className)}>
        <div className="text-foreground text-sm font-medium">Error generating SQL:</div>
        <div className="text-muted-foreground mt-1 text-sm">{error.message || "Unknown error"}</div>
      </div>
    );
  }

  if (!sql && !customSql && !allowEmptySql) {
    return (
      <div className={cn("border-border bg-muted/30 rounded border p-4", className)}>
        <div className="text-muted-foreground text-sm">No SQL query generated</div>
      </div>
    );
  }

  // When collapsed, only render the toolbar toggle (portaled). Painting an empty
  // h-full shell here left a blank band above the table while the splitter still
  // reserved height (minSize vs collapsedSize mismatch).
  if (isCollapsed && !isFullscreen) {
    return (
      <Portal
        container={
          typeof window === "undefined"
            ? undefined
            : {
                current: document.querySelector("#connection-page-filters-top-row"),
              }
        }
      >
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button
              size="sm"
              variant={customSql ? "default" : "ghost"}
              onClick={() => onToggleCollapsed?.(false)}
              className="flex items-center gap-2 self-center text-xs"
              data-testid="sql-query-toggle"
            >
              <ChevronRight className="h-4 w-4" />
              SQL Query
            </Button>
          </HoverCardTrigger>
          <HoverCardContent className="max-w-md">
            <pre className="text-foreground max-h-64 overflow-x-auto font-mono text-xs whitespace-pre-wrap">
              {customSql ?? sql}
            </pre>
          </HoverCardContent>
        </HoverCard>
      </Portal>
    );
  }

  return (
    <div
      className={cn(
        "border-border bg-card flex h-full min-h-0 flex-col rounded border",
        isFullscreen && "bg-background fixed inset-0 z-50 rounded-none border-0",
        className,
      )}
      data-testid="sql-query-editor"
    >
      {/* Header with toggle and actions */}
      <div className="border-border bg-muted/20 border-b px-2 sm:px-4">
        <div className="my-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Tooltip content="Collapse SQL editor">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onToggleCollapsed?.(true)}
                className="h-8 gap-1.5 px-2 text-xs"
                data-testid="sql-query-collapse"
              >
                <ChevronDown className="h-4 w-4" />
                SQL
              </Button>
            </Tooltip>
            <Portal
              container={
                typeof window === "undefined"
                  ? undefined
                  : {
                      current: document.querySelector("#connection-page-filters-top-row"),
                    }
              }
            >
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button
                    size="sm"
                    variant={customSql ? "default" : "ghost"}
                    onClick={() => onToggleCollapsed?.(!isCollapsed)}
                    className="flex items-center gap-2 self-center text-xs"
                    data-testid="sql-query-toggle"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    SQL Query
                  </Button>
                </HoverCardTrigger>
                {isCollapsed && (
                  <HoverCardContent className="max-w-md">
                    <pre className="text-foreground max-h-64 overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                      {sql}
                    </pre>
                  </HoverCardContent>
                )}
              </HoverCard>
            </Portal>

            {warning}
            {contextReceipt ? (
              <span
                className="text-muted-foreground hidden truncate text-xs md:inline"
                data-testid="sql-context-receipt"
              >
                {contextReceipt}
              </span>
            ) : null}
            <span
              className="text-muted-foreground hidden truncate text-xs md:inline"
              title={formatSqlExecutionScope(executionScope)}
            >
              {formatSqlExecutionScope(executionScope)}
            </span>
            {isDirty ? (
              <span className="hidden shrink-0 text-xs text-amber-700 sm:inline dark:text-amber-300">
                Unsaved changes
              </span>
            ) : null}
          </div>

          <div
            className="flex max-w-full min-w-0 flex-wrap items-center justify-end gap-1 sm:gap-2"
            data-testid="sql-editor-actions"
          >
            <SqlSnippetsMenu
              onInsertSnippet={handleInsertSnippet}
              tables={tables.map((table) => table.name)}
              columns={columns}
              activeTable={snippetActiveTable}
            />
            {onSuggestQuery && (
              <Tooltip content="Draft SQL with AI">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSuggestQuery}
                  data-testid="suggest-query-ai"
                  aria-label="Draft SQL with AI"
                  type="button"
                  className="h-8 gap-1.5 px-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Draft SQL
                </Button>
              </Tooltip>
            )}
            {onAskAi && (customSql?.trim() || sql.trim()) && (
              <Tooltip content="Explain this SQL with AI">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAskAi}
                  data-testid="ask-ai-sql"
                  aria-label="Explain this SQL with AI"
                  type="button"
                  className="h-8 gap-1.5 px-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Explain SQL
                </Button>
              </Tooltip>
            )}
            {/* Action buttons — when expanded, or while running so Cancel stays reachable */}
            {(!isCollapsed || isLoading) && (
              <>
                {isLoading ? (
                  <span className="sr-only" role="status" aria-live="polite">
                    Running {formatSqlExecutionScope(executionScope)}
                  </span>
                ) : null}
                {isLoading ? (
                  <Tooltip content="Cancel query">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onCancel}
                      disabled={!onCancel}
                      className="text-destructive hover:text-destructive h-8 gap-1.5 px-2"
                      aria-label="Cancel query"
                    >
                      <Square className="h-4 w-4" />
                      <span className="hidden sm:inline">Cancel</span>
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip content={`${formatSqlExecutionScope(executionScope)} (Ctrl+Enter)`}>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => runSql(activeStatementSql)}
                      className="h-8 gap-1.5 px-2"
                      data-testid="sql-run-button"
                      aria-label={formatSqlExecutionScope(executionScope)}
                    >
                      <Play className="h-4 w-4" />
                      <span className="hidden sm:inline">Run</span>
                    </Button>
                  </Tooltip>
                )}
                {transactionSupported && (onBeginTransaction || transactionStatus !== "idle") ? (
                  <Menu>
                    <MenuTrigger asChild>
                      <Button
                        variant={transactionStatus === "active" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 gap-1.5 px-2"
                        aria-label="Transaction controls"
                        data-testid="sql-transaction-controls"
                      >
                        <CircleDot className="h-4 w-4" />
                        <span className="hidden lg:inline">
                          {transactionStatus === "active" ? "Transaction active" : "Transaction"}
                        </span>
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      {transactionStatus === "idle" ? (
                        <MenuItem
                          value="begin-transaction"
                          disabled={!onBeginTransaction}
                          onClick={() => onBeginTransaction?.()}
                        >
                          <CircleDot className="h-4 w-4" />
                          <MenuItemText>Begin transaction</MenuItemText>
                        </MenuItem>
                      ) : null}
                      {transactionStatus === "active" ? (
                        <>
                          <MenuItem
                            value="commit-transaction"
                            onClick={() => onCommitTransaction?.()}
                          >
                            <Check className="h-4 w-4" />
                            <MenuItemText>Commit transaction</MenuItemText>
                          </MenuItem>
                          <MenuItem
                            value="rollback-transaction"
                            onClick={() => onRollbackTransaction?.()}
                          >
                            <RotateCcw className="h-4 w-4" />
                            <MenuItemText>Rollback transaction</MenuItemText>
                          </MenuItem>
                          <MenuItem value="transaction-help" disabled>
                            <MenuItemText>
                              Queries use the same connection until you finish this transaction.
                            </MenuItemText>
                          </MenuItem>
                        </>
                      ) : null}
                      {transactionStatus === "busy" ? (
                        <MenuItem value="transaction-busy" disabled>
                          <CircleDot className="h-4 w-4" />
                          <MenuItemText>Updating transaction…</MenuItemText>
                        </MenuItem>
                      ) : null}
                    </MenuContent>
                  </Menu>
                ) : null}
                <Menu>
                  <MenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-2"
                      aria-label="SQL tools"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="hidden lg:inline">Tools</span>
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    {onRunAll && executionScope.totalStatementCount > 1 ? (
                      <MenuItem value="run-all-sql" onClick={() => onRunAll(currentSql())}>
                        <Play className="h-4 w-4" />
                        <MenuItemText>
                          Run all {executionScope.totalStatementCount} statements
                        </MenuItemText>
                      </MenuItem>
                    ) : null}
                    {onRunInTransaction &&
                    transactionStatus !== "active" &&
                    executionScope.totalStatementCount > 1 &&
                    fullScriptScope.hasWrites ? (
                      <MenuItem
                        value="run-transaction-sql"
                        onClick={() => onRunInTransaction(currentSql())}
                      >
                        <Play className="h-4 w-4" />
                        <MenuItemText>Run all atomically (rollback on failure)</MenuItemText>
                      </MenuItem>
                    ) : null}
                    <MenuItem
                      value="explain-query"
                      onClick={() => onExplain?.(activeStatementSql)}
                      disabled={disableExplain}
                    >
                      <Zap className="h-4 w-4" />
                      <MenuItemText>Explain query</MenuItemText>
                    </MenuItem>
                    <MenuItem value="format-sql" onClick={onFormat}>
                      <Wand2 className="h-4 w-4" />
                      <MenuItemText>Format SQL</MenuItemText>
                    </MenuItem>
                    <MenuItem value="copy-sql" onClick={handleCopy}>
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <MenuItemText>{copied ? "Copied SQL" : "Copy SQL"}</MenuItemText>
                    </MenuItem>
                    <MenuItem value="download-sql" onClick={downloadSql}>
                      <Copy className="h-4 w-4" />
                      <MenuItemText>Download .sql</MenuItemText>
                    </MenuItem>
                    {onSaveFavorite && (
                      <MenuItem
                        value="save-favorite"
                        disabled={isSavingFavorite}
                        onClick={() => void saveFavorite()}
                        data-testid="sql-save-favorite"
                      >
                        {favoriteSaved || favoriteSaveAcknowledged ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Star className="h-4 w-4" />
                        )}
                        <MenuItemText>
                          {favoriteSaved || favoriteSaveAcknowledged
                            ? "Saved to favorites"
                            : "Save to favorites"}
                        </MenuItemText>
                      </MenuItem>
                    )}
                    {onReset ? (
                      <MenuItem value="reset-sql" onClick={resetDraft} disabled={!isDirty}>
                        <RotateCcw className="h-4 w-4" />
                        <MenuItemText>Reset draft</MenuItemText>
                      </MenuItem>
                    ) : null}
                    <MenuItem value="keyboard-shortcuts" onClick={() => setShortcutHelpOpen(true)}>
                      <HelpCircle className="h-4 w-4" />
                      <MenuItemText>Keyboard shortcuts</MenuItemText>
                    </MenuItem>
                  </MenuContent>
                </Menu>
                {isFullscreen ? (
                  <Tooltip content="Exit fullscreen">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onToggleFullscreen}
                      className="h-8 px-2"
                      data-testid="sql-exit-fullscreen"
                      aria-label="Exit fullscreen SQL editor"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                ) : (
                  <Menu>
                    <MenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        data-testid="sql-maximize-menu"
                        aria-label="Maximize SQL editor"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </MenuTrigger>
                    <Portal>
                      <MenuContent>
                        {onSetPanelSize ? (
                          <>
                            {layoutPresets.map((preset) => (
                              <MenuItem
                                key={preset.id}
                                value={preset.id}
                                onClick={() => onSetPanelSize(preset.size)}
                              >
                                <MenuItemText>{preset.label}</MenuItemText>
                              </MenuItem>
                            ))}
                            <div className="border-border my-1 border-t" />
                          </>
                        ) : null}
                        {SQL_EDITOR_MAXIMIZE_ACTIONS.map((action) => (
                          <MenuItem
                            key={action.id}
                            value={action.id}
                            onClick={() => {
                              if (action.id === "expand-panel") onExpandPanel?.();
                              else onToggleFullscreen?.();
                            }}
                          >
                            <MenuItemText>
                              <span className="flex flex-col gap-0.5">
                                <span>{action.label}</span>
                                <span className="text-muted-foreground text-xs font-normal">
                                  {action.description}
                                </span>
                              </span>
                            </MenuItemText>
                          </MenuItem>
                        ))}
                      </MenuContent>
                    </Portal>
                  </Menu>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {transactionStatus === "active" ? (
        <div
          className="bg-warning/10 border-warning/30 text-foreground flex shrink-0 flex-wrap items-center gap-1.5 border-b px-2 py-1.5 text-xs sm:gap-2 sm:px-4"
          data-testid="sql-transaction-banner"
        >
          <CircleDot className="text-warning size-3.5" />
          <span className="flex-1">
            Transaction active · queries use the same connection until you commit or roll back.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={onCommitTransaction}
          >
            Commit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={onRollbackTransaction}
          >
            Rollback
          </Button>
        </div>
      ) : null}
      {!isCollapsed && (
        <div className="border-border min-h-0 flex-1 border-t" data-testid="sql-monaco-panel">
          <SqlMonacoEditor
            sql={customSql ?? sql}
            onChange={handleEditorChange}
            onSubmit={(value, statementSql) => onRun?.(value, statementSql)}
            onStatementChange={setActiveStatementSql}
            onSave={(value, statementSql) => void saveFavorite(statementSql || value)}
            onViewZoneAction={handleViewZoneAction}
            className="h-full w-full"
            tables={tables}
            columns={columns}
            insertTextAtCursorRef={insertTextAtCursorRef}
          />
        </div>
      )}
      <Dialog open={shortcutHelpOpen} onOpenChange={({ open }) => setShortcutHelpOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>SQL editor shortcuts</DialogTitle>
            <DialogDescription>
              Shortcuts act on the selected text, or the statement under the cursor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-sm">
            <span>Run current scope</span>
            <kbd className="bg-muted rounded px-2 py-1 font-mono">⌘/Ctrl + Enter</kbd>
            <span>Save to favorites</span>
            <kbd className="bg-muted rounded px-2 py-1 font-mono">⌘/Ctrl + S</kbd>
            <span>Format SQL</span>
            <kbd className="bg-muted rounded px-2 py-1 font-mono">⌘/Ctrl + Shift + F</kbd>
            <span>Find in editor</span>
            <kbd className="bg-muted rounded px-2 py-1 font-mono">⌘/Ctrl + F</kbd>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
