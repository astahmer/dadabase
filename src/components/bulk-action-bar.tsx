import { Trash2, Copy } from "lucide-react";
import { Button } from "./ui/button";
import { HStack } from "./ui/layout";

interface BulkActionBarProps {
	selectedCount: number;
	onDelete?: () => void;
	onExport?: () => void;
	isLoading?: boolean;
}

export function BulkActionBar({
	selectedCount,
	onDelete,
	onExport,
	isLoading = false,
}: BulkActionBarProps) {
	if (selectedCount === 0) return null;

	return (
		<div className="sticky bottom-0 left-0 right-0 z-10 bg-primary/10 border-t border-primary/20 backdrop-blur-sm">
			<HStack className="px-4 py-3 items-center justify-between">
				<div className="text-sm font-medium text-foreground">
					{selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
				</div>
				<HStack>
					{onExport && (
						<Button
							variant="outline"
							size="sm"
							onClick={onExport}
							disabled={isLoading}
						>
							<Copy className="h-4 w-4 mr-1" />
							Export
						</Button>
					)}
					{onDelete && (
						<Button
							variant="destructive"
							size="sm"
							onClick={onDelete}
							disabled={isLoading}
						>
							<Trash2 className="h-4 w-4 mr-1" />
							Delete
						</Button>
					)}
				</HStack>
			</HStack>
		</div>
	);
}
