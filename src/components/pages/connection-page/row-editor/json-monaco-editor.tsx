import { useEffect, useRef, useState, type ComponentType } from "react";

import { useMonacoTheme } from "#src/hooks/use-monaco-theme.ts";
import { defineCustomMonacoThemes } from "#src/lib/monaco-editor-themes.ts";

interface JsonMonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  height?: number;
}

type MonacoEditorComponent = ComponentType<{
  height?: number | string;
  language?: string;
  theme?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  options?: Record<string, unknown>;
  beforeMount?: (monaco: {
    editor: {
      defineTheme: (name: string, data: unknown) => void;
      setTheme: (name: string) => void;
    };
  }) => void;
  onMount?: (editor: {
    updateOptions: (options: { theme: string }) => void;
    setValue: (value: string) => void;
  }) => void;
}>;

/**
 * Compact Monaco editor for JSON/JSONB column values in the row editor.
 * Monaco is imported only after mount so Vite/Node SSR never touches its CSS.
 */
export function JsonMonacoEditor(props: JsonMonacoEditorProps) {
  const { value, onChange, disabled, height = 160 } = props;
  const theme = useMonacoTheme();
  const [Editor, setEditor] = useState<MonacoEditorComponent | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    void import("@monaco-editor/react").then((mod) => {
      if (!cancelled) {
        setEditor(() => mod.default as MonacoEditorComponent);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!value.trim()) {
      setParseError(null);
      return;
    }
    try {
      JSON.parse(value);
      setParseError(null);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid JSON");
    }
  }, [value]);

  useEffect(() => {
    return () => {
      const win = window as unknown as {
        __dadabaseJsonMonaco?: { setValue: (next: string) => void };
      };
      delete win.__dadabaseJsonMonaco;
    };
  }, []);

  return (
    <div className="flex flex-col gap-1" data-testid="json-monaco-editor">
      <div className="overflow-hidden rounded-md border">
        {Editor ? (
          <Editor
            height={height}
            language="json"
            theme={theme}
            value={value}
            beforeMount={(monaco) => {
              defineCustomMonacoThemes(monaco);
            }}
            onMount={(editor) => {
              editor.updateOptions({ theme });
              // E2E / debug hook — Monaco's hidden textarea is readonly, so tests set
              // values through the real editor instance AND React onChange (controlled).
              const win = window as unknown as {
                __dadabaseJsonMonaco?: { setValue: (next: string) => void };
              };
              win.__dadabaseJsonMonaco = {
                setValue: (next: string) => {
                  editor.setValue(next);
                  onChangeRef.current(next);
                },
              };
            }}
            onChange={(next) => onChange(next ?? "")}
            options={{
              readOnly: disabled,
              minimap: { enabled: false },
              lineNumbers: "off",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              fontSize: 12,
              tabSize: 2,
              automaticLayout: true,
              folding: false,
              glyphMargin: false,
              renderLineHighlight: "none",
              overviewRulerLanes: 0,
              padding: { top: 8, bottom: 8 },
            }}
          />
        ) : (
          <textarea
            className="bg-background min-h-[160px] w-full resize-y p-2 font-mono text-xs"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            data-testid="json-monaco-fallback"
          />
        )}
      </div>
      {parseError && (
        <p className="text-destructive text-xs" data-testid="json-parse-error">
          {parseError}
        </p>
      )}
    </div>
  );
}
