import { useEffect, useState, type ComponentType } from "react";

import type { TableWithColumnsMetadata } from "#src/server/introspection/introspection.ts";

export interface SqlMonacoEditorProps {
  /** The SQL code to display/edit */
  sql: string;
  /** Callback when editor content changes */
  onChange?: (value: string) => void;
  /** Optional CSS class */
  className?: string;
  /** Available tables for intellisense suggestions */
  tables?: Array<{ schema: string; name: string }>;
  /** Available columns grouped by table */
  columns?: TableWithColumnsMetadata[];
  hasMultipleSchemas?: boolean;
  /** Callback when Ctrl+Enter is pressed */
  onSubmit?: (editorValue: string) => void;
  /** Auto-focus the editor on mount */
  autoFocus?: boolean;
  /** Placeholder text to show when editor is empty */
  placeholder?: string;
  /**
   * Optional handler for Monaco `changeViewZones` action strip clicks.
   * When omitted, Run uses onSubmit, Format runs the built-in formatter, Copy uses clipboard.
   * `statementSql` is set for per-statement zones (multi-statement scripts).
   */
  onViewZoneAction?: (
    id: "run" | "explain" | "format" | "fullscreen" | "copy" | "save",
    statementSql?: string,
  ) => void;
}

/**
 * Client-only Monaco SQL editor wrapper.
 * Monaco (and its CSS) must not be imported during Vite/Node SSR — nub's load hook
 * returns null for those .css files and throws ERR_INVALID_RETURN_PROPERTY_VALUE.
 */
export function SqlMonacoEditor(props: SqlMonacoEditorProps) {
  const [Impl, setImpl] = useState<ComponentType<SqlMonacoEditorProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("./sql-monaco-editor.impl.tsx").then((mod) => {
      if (!cancelled) {
        setImpl(() => mod.SqlMonacoEditorImpl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Impl) {
    return (
      <div
        className={props.className}
        data-testid="sql-monaco-editor-loading"
        style={{ minHeight: 200 }}
      />
    );
  }

  return <Impl {...props} />;
}
