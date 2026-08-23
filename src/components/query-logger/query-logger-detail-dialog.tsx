import { Check, Copy, Maximize2, Minimize2, Play } from "lucide-react";
import { useState } from "react";

import type { QueryLogEntryType } from "#src/server/query-logger/query-logger.types.ts";

import { formatRelativeTime } from "#src/lib/format-relative-time.ts";
import { normalizeSql, replaceSqlParameters } from "#src/lib/replace-sql-parameters.ts";

import { Badge } from "../ui/badge.tsx";
import { Button } from "../ui/button.tsx";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog.tsx";
import { JsonViewer } from "../ui/json-viewer.tsx";
import { HStack } from "../ui/layout.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.tsx";
import { Tooltip } from "../ui/tooltip.tsx";
import { QueryLogLevelBadge, QueryLogTypeBadge } from "./query-log-type-badge.tsx";

interface QueryLoggerDetailDialogProps {
  entry: QueryLogEntryType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenInEditor?: (sql: string) => void;
}

export const QueryLoggerDetailDialog = ({
  entry,
  open,
  onOpenChange,
  onOpenInEditor,
}: QueryLoggerDetailDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("sql");
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!entry) return null;

  const handleOpenInEditor = () => {
    if (!entry || !onOpenInEditor) return;
    onOpenInEditor(replaceSqlParameters(entry.sql, entry.params) || entry.sql);
    onOpenChange(false);
  };

  const statusColorMap: Record<
    string,
    "default" | "secondary" | "destructive" | "success" | "error" | "warning" | "info" | "muted"
  > = {
    success: "success",
    error: "error",
    pending: "warning",
  };

  const relativeTime = formatRelativeTime(entry.startTime.getTime());
  const exactTime = new Date(entry.startTime).toLocaleTimeString();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert array params to mapped object with $1, $2, etc. as keys
  const getMappedParams = (): Record<string, any> | ReadonlyArray<any> | null => {
    if (!entry.params) return null;
    if (Array.isArray(entry.params)) {
      const mapped: Record<string, any> = {};
      for (let i = 0; i < entry.params.length; i++) {
        mapped[`$${i + 1}`] = entry.params[i];
      }
      return mapped;
    }
    return entry.params;
  };

  return (
    <Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <DialogContent
        className="flex h-[90vh] max-w-4xl flex-col gap-0 p-0"
        size={isFullscreen ? "full" : "2xl"}
      >
        <div className="relative flex shrink-0 items-center justify-between gap-2 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            Query Details
            <Badge colorPalette={statusColorMap[entry.status]} size="xs" className="capitalize">
              {entry.status}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="gap-2"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </DialogTitle>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(details) => setActiveTab(details.value)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent px-6 py-0">
            <TabsTrigger value="sql">SQL</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            {entry.error && <TabsTrigger value="error">Error</TabsTrigger>}
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="sql" className="m-0 space-y-4 p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Query</h3>
                  <HStack gap="2">
                    {onOpenInEditor && (
                      <Button size="sm" onClick={handleOpenInEditor} className="gap-2">
                        <Play className="h-4 w-4" />
                        Open in editor
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(entry.sql)}
                      className="gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </HStack>
                </div>
                <pre className="bg-muted overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed wrap-break-word whitespace-pre-wrap">
                  <code>{normalizeSql(entry.sql)}</code>
                </pre>
              </div>

              {entry.params && (
                <div className="space-y-3">
                  <h3 className="mb-3 text-sm font-semibold">Parameters</h3>
                  <pre className="bg-muted overflow-x-auto rounded-lg p-3 font-mono text-xs">
                    <code>{JSON.stringify(getMappedParams(), null, 2)}</code>
                  </pre>

                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Raw SQL (inlined parameters)</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(replaceSqlParameters(entry.sql, entry.params))}
                      className="gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="bg-muted overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed wrap-break-word whitespace-pre-wrap">
                    <code>{normalizeSql(replaceSqlParameters(entry.sql, entry.params))}</code>
                  </pre>
                </div>
              )}
            </TabsContent>

            <TabsContent value="metadata" className="m-0 space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Type</p>
                  <QueryLogTypeBadge type={entry.type} size="sm" />
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Level</p>
                  <QueryLogLevelBadge level={entry.level} size="sm" />
                </div>
                {entry.schema && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Schema</p>
                    <p className="text-sm">{entry.schema}</p>
                  </div>
                )}
                {entry.table && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Table</p>
                    <p className="text-sm">{entry.table}</p>
                  </div>
                )}
                {entry.timeTaken !== undefined && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Duration</p>
                    <p className="text-sm">{entry.timeTaken}ms</p>
                  </div>
                )}
                {entry.rowsReturned !== undefined && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Rows Returned</p>
                    <p className="text-sm">{entry.rowsReturned}</p>
                  </div>
                )}
                {entry.rowsAffected !== undefined && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Rows Affected</p>
                    <p className="text-sm">{entry.rowsAffected}</p>
                  </div>
                )}
                {entry.startTime && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Executed At</p>
                    <Tooltip
                      content={exactTime}
                      portalled
                      showArrow={false}
                      openDelay={300}
                      closeDelay={0}
                    >
                      <p className="cursor-help text-sm">{relativeTime}</p>
                    </Tooltip>
                  </div>
                )}
              </div>
              {entry.meta && (
                // <JsonTreeView.Root
                // 	data={entry.meta}
                // 	defaultExpandedDepth={5}
                // 	className="h-full"
                // >
                // 	<JsonTreeView.Tree arrow={<ChevronRightIcon />} />
                // </JsonTreeView.Root>
                <JsonViewer data={entry.meta} defaultExpanded className="h-full" />
              )}
            </TabsContent>

            {entry.error && (
              <TabsContent value="error" className="m-0 space-y-4 p-6">
                <div>
                  <p className="mb-2 text-sm font-semibold">Error Message</p>
                  <pre className="bg-destructive/10 text-destructive overflow-x-auto rounded-lg p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
                    <code>{entry.error.message}</code>
                  </pre>
                </div>
                {entry.error.stack && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">Stack Trace</p>
                    <pre className="bg-muted overflow-x-auto rounded-lg p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
                      <code>{entry.error.stack}</code>
                    </pre>
                  </div>
                )}
              </TabsContent>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
