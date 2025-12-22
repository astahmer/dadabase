import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#src/components/ui/dialog.tsx";
import { Button } from "#src/components/ui/button.tsx";
import { AlertTriangle } from "lucide-react";

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
						<AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
						<DialogTitle>Confirm Destructive Operation</DialogTitle>
					</div>
					<DialogDescription className="mt-2">
						This query will{" "}
						<span className="font-semibold text-foreground">{queryType}</span>.
						This action cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<div className="py-4 px-4 bg-destructive/10 rounded-md border border-destructive/20">
					<p className="text-sm text-destructive font-medium">
						Are you sure you want to proceed?
					</p>
				</div>

				<div className="flex gap-3 justify-end">
					<Button variant="outline" onClick={onCancel} disabled={isLoading}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={onConfirm}
						disabled={isLoading}
						className="gap-2"
					>
						{isLoading ? "Executing..." : "Execute"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
