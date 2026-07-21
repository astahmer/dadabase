import { Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "#src/components/ui/button.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#src/components/ui/sheet.tsx";

import { ExplainOutput } from "./explain-output.tsx";

interface ExplainOutputDrawerProps {
  showExplainPanel: boolean;
  setShowExplainPanel: (show: boolean) => void;
  output: string | null;
  dialect?: "postgres" | "sqlite";
}

export function ExplainOutputDrawer({
  showExplainPanel,
  setShowExplainPanel,
  output,
  dialect = "postgres",
}: ExplainOutputDrawerProps) {
  const [viewMode, onViewModeChange] = useState<"smart" | "raw">("smart");

  return (
    <Sheet
      open={showExplainPanel}
      onOpenChange={(details) => {
        if (!details.open) setShowExplainPanel(false);
      }}
    >
      <SheetContent side="right" size="full" className="flex flex-col p-0">
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <SheetTitle>Query Execution Plan</SheetTitle>
              <SheetDescription>
                {dialect === "sqlite"
                  ? "EXPLAIN QUERY PLAN output"
                  : "EXPLAIN ANALYZE output for performance optimization"}
              </SheetDescription>
            </div>
            <div className="mr-4 flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                onClick={() => onViewModeChange(viewMode === "smart" ? "raw" : "smart")}
                className="h-8 px-2 text-xs font-medium"
                title={viewMode === "smart" ? "Show raw" : "Show parsed"}
              >
                Swap to {viewMode === "smart" ? "Raw" : "Smart"} display
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (output) {
                    navigator.clipboard.writeText(output);
                  }
                }}
                className="h-8 w-8 p-0"
                title="Copy raw output"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          {output ? (
            <ExplainOutput
              output={output}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              dialect={dialect}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">Loading...</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
