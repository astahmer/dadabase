import { useMutation } from "@tanstack/react-query";
import { LucideSave } from "lucide-react";

import { Badge } from "#src/components/ui/badge.tsx";
import { Button } from "#src/components/ui/button.tsx";
import { toaster } from "#src/components/ui/toaster.tsx";
import { DatabaseDialect } from "#src/db/dialect.ts";
import {
  clearUnsavedCount,
  useUnloadWarning,
  useUnsavedRowCount,
} from "#src/lib/csv-unsaved-changes.ts";
import { saveCsvTableServerFn } from "#src/server/db-connection/start-fns/save-csv-table.start.ts";

import { useActiveTabState } from "./create-tab-state.ts";

interface CsvSaveBarProps {
  connectionUrl: string;
  dialect: DatabaseDialect;
}

/**
 * Unsaved-changes indicator + explicit per-table Save for CSV connections
 * (§B.3). Edits live in an in-memory DuckDB table until this bar's Save
 * exports it back to the source file (atomic tmp→rename, `.bak` backup).
 */
export function CsvSaveBar({ connectionUrl, dialect }: CsvSaveBarProps) {
  const search = useActiveTabState((tab) => ({ table: tab.table }));
  const table = search.table ?? "";
  const unsavedCount = useUnsavedRowCount(connectionUrl, table);

  // Warn before closing/reloading the tab with staged edits.
  useUnloadWarning(dialect === DatabaseDialect.Csv && unsavedCount > 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return saveCsvTableServerFn({
        data: { url: connectionUrl, table },
      });
    },
    onSuccess: (result) => {
      if (!result.success) {
        toaster.create({ title: "Could not save CSV", description: result.message, type: "error" });
        return;
      }
      clearUnsavedCount(connectionUrl, table);
      toaster.create({
        title: "CSV saved",
        description:
          `${result.rowsWritten} row${result.rowsWritten === 1 ? "" : "s"} written to ${result.fileName}` +
          (result.backupPath ? " — previous version kept as .bak" : ""),
        type: "success",
      });
    },
    onError: (error) => {
      toaster.create({
        title: "Could not save CSV",
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      });
    },
  });

  if (dialect !== DatabaseDialect.Csv || unsavedCount === 0) return null;

  return (
    <div
      className="border-warning/30 bg-warning/5 flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs"
      data-testid="csv-save-bar"
    >
      <span className="flex items-center gap-2">
        <Badge colorPalette="warning" size="xs" data-testid="csv-unsaved-count">
          {unsavedCount} unsaved change{unsavedCount === 1 ? "" : "s"}
        </Badge>
        <span className="text-muted-foreground">
          Edits live in memory until saved to <span className="font-mono">{table}.csv</span>
        </span>
      </span>
      <Button
        type="button"
        size="xs"
        disabled={saveMutation.isPending}
        data-testid="csv-save-button"
        onClick={() => saveMutation.mutate()}
      >
        <LucideSave className="h-3 w-3" />
        Save to file
      </Button>
    </div>
  );
}
