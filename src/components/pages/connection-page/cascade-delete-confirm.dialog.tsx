import type { CascadeDeletePreview } from "#src/lib/cascade-delete-preview.ts";

import { Button } from "#src/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#src/components/ui/dialog.tsx";

export interface CascadeDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: CascadeDeletePreview | null;
  onConfirm: () => void;
  isPending?: boolean;
}

export function CascadeDeleteConfirmDialog(props: CascadeDeleteConfirmDialogProps) {
  const { open, onOpenChange, preview, onConfirm, isPending } = props;
  if (!preview) return null;

  return (
    <Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <DialogContent data-testid="cascade-delete-confirm">
        <DialogHeader>
          <DialogTitle>Delete {preview.selectedCount} row(s)?</DialogTitle>
          <DialogDescription>
            Review foreign-key effects before deleting from{" "}
            <span className="font-mono">{preview.rootTable}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-60 space-y-3 overflow-auto text-sm">
          {preview.blocked ? (
            <div
              className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3"
              data-testid="cascade-delete-blocked"
            >
              Delete is blocked by RESTRICT / NO ACTION on:{" "}
              {preview.blockedBy.map((b) => b.table).join(", ") || "(unknown)"}
            </div>
          ) : null}

          {preview.affected.length === 0 ? (
            <p className="text-muted-foreground">No dependent foreign keys found.</p>
          ) : (
            <ul className="space-y-1 font-mono text-xs" data-testid="cascade-delete-affected">
              {preview.affected.map((item) => (
                <li key={`${item.table}-${item.depth}-${item.action}`}>
                  depth {item.depth}: {item.table} — {item.action} (via {item.viaTable})
                </li>
              ))}
            </ul>
          )}

          {preview.order.length > 1 ? (
            <p className="text-muted-foreground text-xs">
              Suggested order: {preview.order.join(" → ")}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            data-testid="cascade-delete-confirm-run"
            disabled={preview.blocked || isPending}
            onClick={onConfirm}
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
