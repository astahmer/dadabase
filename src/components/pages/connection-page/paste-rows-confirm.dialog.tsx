import { Button } from "#src/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#src/components/ui/dialog.tsx";

export interface PasteRowsConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: string;
  rowCount: number;
  onConfirm: () => void;
  isPending?: boolean;
}

export function PasteRowsConfirmDialog(props: PasteRowsConfirmDialogProps) {
  const { open, onOpenChange, table, rowCount, onConfirm, isPending } = props;

  return (
    <Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <DialogContent data-testid="paste-rows-confirm">
        <DialogHeader>
          <DialogTitle>Paste {rowCount} row(s)?</DialogTitle>
          <DialogDescription>
            Insert clipboard rows into <span className="font-mono">{table}</span> in one
            transaction. A failure rolls back the whole paste.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            data-testid="paste-rows-confirm-run"
            disabled={isPending || rowCount === 0}
            onClick={onConfirm}
          >
            {isPending ? "Pasting…" : "Paste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
