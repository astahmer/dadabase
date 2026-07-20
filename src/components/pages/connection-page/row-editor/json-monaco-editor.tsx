import { lazy, Suspense, useEffect, useEffectEvent, useState } from "react";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

interface JsonMonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  height?: number;
}

/**
 * Compact Monaco editor for JSON/JSONB column values in the row editor.
 * Monaco is lazy-loaded client-side to avoid SSR CSS module errors.
 */
export function JsonMonacoEditor(props: JsonMonacoEditorProps) {
  const { value, onChange, disabled, height = 160 } = props;
  const theme = useMonacoTheme();
  const [mounted, setMounted] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
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

  return (
    <div className="flex flex-col gap-1" data-testid="json-monaco-editor">
      <div className="overflow-hidden rounded-md border">
        {mounted ? (
          <Suspense
            fallback={
              <textarea
                className="bg-background min-h-[160px] w-full resize-y p-2 font-mono text-xs"
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
              />
            }
          >
            <MonacoEditor
              height={height}
              language="json"
              theme={theme}
              value={value}
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
          </Suspense>
        ) : (
          <textarea
            className="bg-background min-h-[160px] w-full resize-y p-2 font-mono text-xs"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
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

function useMonacoTheme() {
  const [theme, setTheme] = useState<"vs-light" | "vs-dark">("vs-light");

  const getTheme = useEffectEvent((): "vs-light" | "vs-dark" => {
    return document.documentElement.classList.contains("dark") ? "vs-dark" : "vs-light";
  });

  useEffect(() => {
    setTheme(getTheme());
    const observer = new MutationObserver(() => setTheme(getTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
