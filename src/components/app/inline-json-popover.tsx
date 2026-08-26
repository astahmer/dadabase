import { Clipboard, useClipboard } from "@ark-ui/react";
import { Check, Code, Copy, X } from "lucide-react";

import { RelationshipExplorer } from "#src/components/pages/connection-page/relationships/relationship-explorer.tsx";

import { JsonViewerModal } from "../ui/json-viewer.tsx";
import { Stack } from "../ui/layout.tsx";

interface InlineJsonPopoverProps {
  value: unknown;
  onExpandToDialog?: () => void;
  onClose?: () => void;
  /** Optional: Enable relationship explorer mode */
  showRelationships?: boolean;
  /** Optional: Current schema for relationship queries */
  schema?: string;
  /** Optional: Current table for relationship queries */
  table?: string;
  /** Optional: Connection URL for relationship queries */
  connectionUrl?: string;
}

export function InlineJsonPopover({
  value,
  onExpandToDialog,
  onClose,
  showRelationships = false,
  schema,
  table,
  connectionUrl,
}: InlineJsonPopoverProps) {
  function generatePreview(val: unknown): string {
    try {
      const str = JSON.stringify(val);
      if (str.length > 100) {
        return str.substring(0, 100).replace(/\s+/g, " ") + "…";
      }
      return str.replace(/\s+/g, " ");
    } catch {
      return String(val);
    }
  }

  const preview = generatePreview(value);
  const clipboard = useClipboard();

  // Use relationship explorer if requested and we have required data and value is an object
  const useRelationshipExplorer =
    showRelationships &&
    schema &&
    table &&
    connectionUrl &&
    typeof value === "object" &&
    value !== null;

  return (
    <div className="bg-background border-border max-w-2xl min-w-96 overflow-hidden rounded-lg border shadow-lg">
      {/* Header */}
      <div className="border-border bg-muted/30 flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Code className="text-muted-foreground h-3 w-3 shrink-0" />
          <span className="text-muted-foreground text-xs font-semibold">
            {useRelationshipExplorer ? "Data with Relations" : "JSON Data"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clipboard.RootProvider value={clipboard}>
            <button
              className="hover:bg-muted/70 text-muted-foreground rounded p-1 text-xs transition-colors"
              title="Copy JSON"
              onMouseEnter={() => {
                clipboard.setValue(JSON.stringify(value, null, 2));
              }}
              onClick={() => {
                clipboard.copy();
              }}
            >
              <Clipboard.Indicator copied={<Check className="h-3 w-3" />}>
                <Copy className="h-3.5 w-3.5" />
              </Clipboard.Indicator>
            </button>
          </Clipboard.RootProvider>
          {onClose && (
            <button
              onClick={onClose}
              className="hover:bg-muted/70 text-muted-foreground rounded p-1 transition-colors"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Subheader with preview */}
      <div className="text-muted-foreground border-border/50 truncate border-b px-3 py-1.5 font-mono text-xs">
        {preview}
      </div>

      {/* Content */}
      <Stack className="max-h-72 w-full overflow-y-auto p-3">
        <div className="text-sm">
          {useRelationshipExplorer && typeof value === "object" ? (
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="bg-muted border-border h-full min-h-0 overflow-auto rounded border p-3">
                <RelationshipExplorer
                  row={value as Record<string, unknown>}
                  schema={schema}
                  table={table}
                  connectionUrl={connectionUrl}
                  maxDepth={3}
                  showRelationships={true}
                />
              </div>
            </div>
          ) : (
            <JsonViewerModal data={value} />
          )}
        </div>
      </Stack>

      {/* Footer */}
      {onExpandToDialog && (
        <div className="border-border bg-muted/20 border-t px-3 py-2">
          <button
            onClick={onExpandToDialog}
            className="hover:bg-muted/70 text-foreground w-full rounded py-1.5 text-center text-xs font-medium transition-colors"
          >
            Expand JSON viewer →
          </button>
        </div>
      )}
    </div>
  );
}
