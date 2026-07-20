import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "#src/components/ui/badge.tsx";
import { Button } from "#src/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#src/components/ui/dialog.tsx";
import { toaster } from "#src/components/ui/toaster.tsx";
import { coerceColumnValue } from "#src/lib/data-type-utils.ts";
import { formatDbError } from "#src/lib/format-db-error.ts";
import { invalidateRowsQueries, rowMutationMeta } from "#src/lib/invalidate-rows-queries.ts";
import { updateRowServerFn } from "#src/server/introspection/start-fns/update-row.start.ts";

import {
  buildPendingUpdateSql,
  clearPendingCellEdits,
  getPendingCellEditCount,
  type PendingCellEdit,
} from "./pending-cell-edits.ts";

interface PendingCellEditsBarProps {
  connectionUrl: string;
  edits: PendingCellEdit[];
  onChange: (edits: PendingCellEdit[]) => void;
}

/**
 * Pending badge + Commit (review UPDATE SQL) / Cancel for buffered cell edits.
 */
export function PendingCellEditsBar({ connectionUrl, edits, onChange }: PendingCellEditsBarProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const queryClient = useQueryClient();
  const count = getPendingCellEditCount(edits);

  const commitMutation = useMutation({
    meta: rowMutationMeta,
    mutationFn: async () => {
      // Group by row so we send one UPDATE per primary key
      const byRow = new Map<string, PendingCellEdit[]>();
      for (const edit of edits) {
        const key = JSON.stringify(edit.primaryKey);
        const list = byRow.get(key) ?? [];
        list.push(edit);
        byRow.set(key, list);
      }

      for (const rowEdits of byRow.values()) {
        const first = rowEdits[0];
        const values: Record<string, unknown> = {};
        for (const e of rowEdits) {
          values[e.column] = coerceColumnValue(e.dataType, e.nextValue);
        }
        await updateRowServerFn({
          data: {
            url: connectionUrl,
            schema: first.schema,
            table: first.table,
            primaryKey: first.primaryKey as Record<
              string,
              string | number | boolean | null | undefined
            >,
            values: values as Record<string, string | number | boolean | null | undefined>,
          },
        });
      }
      return edits.length;
    },
    onSuccess: (n) => {
      onChange(clearPendingCellEdits());
      setReviewOpen(false);
      invalidateRowsQueries(queryClient);
      toaster.create({
        title: "Changes committed",
        description: `Saved ${n} cell edit${n === 1 ? "" : "s"}`,
        type: "success",
      });
    },
    onError: (error) => {
      toaster.create({
        title: "Could not commit edits",
        description: formatDbError(error),
        type: "error",
      });
    },
  });

  if (count === 0) return null;

  const sql = buildPendingUpdateSql(edits);

  return (
    <>
      <div
        className="bg-muted/40 flex items-center gap-2 border-b px-3 py-1.5 text-xs"
        data-testid="pending-cell-edits-bar"
      >
        <Badge colorPalette="warning" size="xs" data-testid="pending-cell-edits-count">
          {count} pending
        </Badge>
        <Button size="xs" variant="outline" onClick={() => setReviewOpen(true)}>
          Commit…
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onChange(clearPendingCellEdits())}
          disabled={commitMutation.isPending}
        >
          Cancel
        </Button>
      </div>

      <Dialog open={reviewOpen} onOpenChange={({ open }) => setReviewOpen(open)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Review pending updates</DialogTitle>
            <DialogDescription>
              {count} cell change{count === 1 ? "" : "s"} will be saved with the SQL below.
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
            {sql}
          </pre>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReviewOpen(false)}>
              Back
            </Button>
            <Button
              size="sm"
              disabled={commitMutation.isPending}
              onClick={() => commitMutation.mutate()}
            >
              {commitMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
