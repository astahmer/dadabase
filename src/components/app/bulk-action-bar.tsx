import { Copy, FileJson, FileSpreadsheet, Trash2, X } from "lucide-react";
import * as ActionBar from "../ui/action-bar";
import { Button } from "../ui/button";
import { HStack } from "../ui/layout";

interface BulkActionBarProps {
	selectedCount: number;
	onDelete?: () => void;
	onExportJson?: () => void;
	onExportCsv?: () => void;
	onCopyJson?: () => void;
	onCopyCsv?: () => void;
	onCopyInsert?: () => void;
	isLoading?: boolean;
}

export function BulkActionBar({
	selectedCount,
	onDelete,
	onExportJson,
	onExportCsv,
	onCopyJson,
	onCopyCsv,
	onCopyInsert,
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
						{onCopyJson && (
							<Button
								variant="outline"
								size="sm"
								onClick={onCopyJson}
								disabled={isLoading}
							>
								<Copy className="h-4 w-4 mr-1" />
								Copy JSON
							</Button>
						)}
						{onCopyCsv && (
							<Button
								variant="outline"
								size="sm"
								onClick={onCopyCsv}
								disabled={isLoading}
							>
								<Copy className="h-4 w-4 mr-1" />
								Copy CSV
							</Button>
						)}
						{onCopyInsert && (
							<Button
								variant="outline"
								size="sm"
								onClick={onCopyInsert}
								disabled={isLoading}
							>
								<FileSpreadsheet className="h-4 w-4 mr-1" />
								Copy INSERT
							</Button>
						)}
						{onExportJson && (
							<Button
								variant="outline"
								size="sm"
								onClick={onExportJson}
								disabled={isLoading}
							>
								<FileJson className="h-4 w-4 mr-1" />
								Export JSON
							</Button>
						)}
						{onExportCsv && (
							<Button
								variant="outline"
								size="sm"
								onClick={onExportCsv}
								disabled={isLoading}
							>
								<FileSpreadsheet className="h-4 w-4 mr-1" />
								Export CSV
							</Button>
						)}
					</HStack>

					<ActionBar.ActionBarSeparator />

					<HStack>
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
