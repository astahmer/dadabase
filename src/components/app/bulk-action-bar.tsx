import { Trash2, Copy, X } from "lucide-react";
import { Button } from "../ui/button";
import { HStack } from "../ui/layout";
import * as ActionBar from "../ui/action-bar";

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
		<ActionBar.ActionBarRoot open={selectedCount > 0}>
			<ActionBar.ActionBarPositioner>
				<ActionBar.ActionBarContent>
					<ActionBar.ActionBarSelectionTrigger disabled>
						{selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
					</ActionBar.ActionBarSelectionTrigger>

					<ActionBar.ActionBarSeparator />

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

					<ActionBar.ActionBarSeparator />

					<ActionBar.ActionBarCloseTrigger asChild>
						<Button variant="ghost" size="sm" className="h-6 w-6 p-0">
							<X className="h-4 w-4" />
						</Button>
					</ActionBar.ActionBarCloseTrigger>
				</ActionBar.ActionBarContent>
			</ActionBar.ActionBarPositioner>
		</ActionBar.ActionBarRoot>
	);
}
