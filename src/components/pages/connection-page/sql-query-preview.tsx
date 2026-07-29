import { Portal } from "@ark-ui/react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Maximize2,
  Minimize2,
  Play,
  Square,
  Star,
  Wand2,
  Zap,
} from "lucide-react";
import { type ReactNode, useEffectEvent, useRef, useState } from "react";

import type { TableWithColumnsMetadata } from "#src/server/introspection/introspection.ts";

import { Button } from "#src/components/ui/button.tsx";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "#src/components/ui/hovercard.tsx";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuItemText,
  MenuTrigger,
} from "#src/components/ui/menu.tsx";
import { Tooltip } from "#src/components/ui/tooltip.tsx";
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
  /** Callback to run the query */
  onRun?: (editorValue: string) => void;
  /** Callback to cancel the running query */
  onCancel?: () => void;
  /** Callback to explain the query */
  onExplain?: () => void;
  /** Whether to disable the explain button */
  disableExplain?: boolean;
  /** Callback to format the SQL */
  onFormat?: () => void;
  /** Callback to toggle fullscreen editor */
  onToggleFullscreen?: () => void;
  /** Expand the SQL panel (collapse rows) without going fullscreen */
  onExpandPanel?: () => void;
  /** Whether editor is in fullscreen mode */
  isFullscreen?: boolean;
  /** Whether the preview is collapsed */
  isCollapsed?: boolean;
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
  /** Callback when a snippet should be inserted into the editor */
  onInsertSnippet?: (sql: string) => void;
  /** Custom CSS class */
  className?: string;
  /** Warning message to display next to the header */
  warning?: ReactNode;
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
  onRun,
  onCancel,
  onExplain,
  disableExplain = false,
  onFormat,
  onToggleFullscreen,
  onExpandPanel,
  onSaveFavorite,
  isSavingFavorite = false,
  isFullscreen = false,
  isCollapsed = true,
  onToggleCollapsed,
  tables = [],
  columns = [],
  onInsertSnippet,
  className,
  warning,
}: SqlQueryPreviewProps) {
  const [copied, setCopied] = useState(false);
  const editorValueRef = useRef<string>(sql);

  const handleCopy = async () => {
    try {
      const textToCopy = editorValueRef.current || customSql || sql;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy SQL to clipboard:", err);
    }
  };

  const handleEditorChange = useEffectEvent((value: string) => {
    editorValueRef.current = value;
    onEditorChange?.(value);
  });

  const handleInsertSnippet = useEffectEvent((snippetSql: string) => {
    const current = (editorValueRef.current || customSql || sql || "").trimEnd();
    const next = current ? `${current}\n${snippetSql}` : snippetSql;
    editorValueRef.current = next;
    onEditorChange?.(next);
    onEditorModeChange?.("editor");
    if (isCollapsed) onToggleCollapsed?.(false);
    onInsertSnippet?.(snippetSql);
  });

  // Only block the whole preview while SQL is still being generated.
  // When a query is running (`isLoading` + existing sql), keep the editor so Cancel stays usable.
  if (isLoading && !sql) {
    return (
      <div className={cn("rounded border border-gray-200 bg-gray-50 p-4", className)}>
        <div className="text-sm text-gray-500">Generating SQL query...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded border border-red-200 bg-red-50 p-4", className)}>
        <div className="text-sm font-medium text-red-900">Error generating SQL:</div>
        <div className="mt-1 text-sm text-red-800">{error.message || "Unknown error"}</div>
      </div>
    );
  }

  if (!sql) {
    return (
      <div className={cn("rounded border border-gray-200 bg-gray-50 p-4", className)}>
        <div className="text-sm text-gray-500">No SQL query generated</div>
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
              {customSql || sql}
            </pre>
          </HoverCardContent>
        </HoverCard>
      </Portal>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded border border-gray-200",
        isFullscreen && "bg-background fixed inset-0 z-50 rounded-none border-0",
        className,
      )}
      data-testid="sql-query-editor"
    >
      {/* Header with toggle and actions */}
      <div className="border-b border-gray-200 px-4">
        <div className="my-1 flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-4">
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
          </div>

          <div className="flex items-center gap-2">
            <SqlSnippetsMenu onInsertSnippet={handleInsertSnippet} />
            {/* Action buttons — when expanded, or while running so Cancel stays reachable */}
            {(!isCollapsed || isLoading) && (
              <>
                {isLoading ? (
                  <Tooltip content="Cancel query">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCancel}
                      disabled={!onCancel}
                      className="text-destructive hover:text-destructive h-8 px-2"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip content="Run query (Ctrl+Enter)">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRun?.(editorValueRef.current ?? "")}
                      className="h-8 px-2"
                      data-testid="sql-run-button"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                )}
                <Tooltip content="Explain query">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onExplain}
                    disabled={disableExplain}
                    className="h-8 px-2"
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Format SQL">
                  <Button variant="ghost" size="sm" onClick={onFormat} className="h-8 px-2">
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Copy SQL to clipboard">
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 px-2">
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </Tooltip>
                {onSaveFavorite && (
                  <Tooltip content="Save as favorite">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isSavingFavorite}
                      onClick={() => onSaveFavorite(editorValueRef.current || customSql || sql)}
                      className="h-8 px-2"
                      data-testid="sql-save-favorite"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                )}
                {isFullscreen ? (
                  <Tooltip content="Exit fullscreen">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onToggleFullscreen}
                      className="h-8 px-2"
                      data-testid="sql-exit-fullscreen"
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
      {!isCollapsed && (
        <div
          className="min-h-0 flex-1 border-t border-gray-200 bg-gray-50"
          data-testid="sql-monaco-panel"
        >
          <SqlMonacoEditor
            sql={customSql || sql}
            onChange={handleEditorChange}
            onSubmit={onRun}
            className="h-full w-full"
            tables={tables}
            columns={columns}
          />
        </div>
      )}
    </div>
  );
}
