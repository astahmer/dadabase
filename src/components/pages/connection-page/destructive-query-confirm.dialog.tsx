import { AlertTriangle } from "lucide-react";

import { Button } from "#src/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#src/components/ui/dialog.tsx";

interface DestructiveQueryConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  queryType: string;
  isLoading?: boolean;
}

export function DestructiveQueryConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  queryType,
  isLoading = false,
}: DestructiveQueryConfirmDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) {
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-destructive h-5 w-5 shrink-0" />
            <DialogTitle>Confirm Destructive Operation</DialogTitle>
          </div>
          <DialogDescription className="mt-2">
            This query will <span className="text-foreground font-semibold">{queryType}</span>. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-destructive/10 border-destructive/20 rounded-md border px-4 py-4">
          <p className="text-destructive text-sm font-medium">Are you sure you want to proceed?</p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading} className="gap-2">
            {isLoading ? "Executing..." : "Execute"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
