import { Copy, FileJson, MoreHorizontal, Trash2, X } from "lucide-react";
import * as ActionBar from "../ui/action-bar";
import { Button } from "../ui/button";
import { HStack } from "../ui/layout";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuItemText,
	MenuTrigger,
} from "../ui/menu";

interface BulkActionBarProps {
	selectedCount: number;
	onDelete?: () => void;
	onExportJson?: () => void;
	onExportCsv?: () => void;
	onCopyJson?: () => void;
	onCopyCsv?: () => void;
	onCopyInsert?: () => void;
	onViewJson?: () => void;
	onLogRows?: () => void;
	onExpandRelationships?: () => void;
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
	onViewJson,
	onLogRows,
	onExpandRelationships,
	isLoading = false,
}: BulkActionBarProps) {
	if (selectedCount === 0) return null;

	return (
		<ActionBar.ActionBarRoot open={selectedCount > 0}>
			<ActionBar.ActionBarPositioner>
				<ActionBar.ActionBarContent className="dark">
					<ActionBar.ActionBarSelectionTrigger disabled>
						{selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
					</ActionBar.ActionBarSelectionTrigger>

					<ActionBar.ActionBarSeparator />

					<HStack>
						<Menu>
							<MenuTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									disabled={isLoading}
									className="border-background/20"
								>
									<Copy className="h-4 w-4 mr-1" />
									Copy
								</Button>
							</MenuTrigger>
							<MenuContent>
								{onCopyJson && (
									<MenuItem value="copy-json" onClick={onCopyJson}>
										<MenuItemText>Copy as JSON</MenuItemText>
									</MenuItem>
								)}
								{onCopyCsv && (
									<MenuItem value="copy-csv" onClick={onCopyCsv}>
										<MenuItemText>Copy as CSV</MenuItemText>
									</MenuItem>
								)}
								{onCopyInsert && (
									<MenuItem value="copy-insert" onClick={onCopyInsert}>
										<MenuItemText>Copy as INSERT</MenuItemText>
									</MenuItem>
								)}
							</MenuContent>
						</Menu>

						<Menu>
							<MenuTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									disabled={isLoading}
									className="border-background/20"
								>
									<FileJson className="h-4 w-4 mr-1" />
									Export
								</Button>
							</MenuTrigger>
							<MenuContent>
								{onExportJson && (
									<MenuItem value="export-json" onClick={onExportJson}>
										<MenuItemText>Export as JSON</MenuItemText>
									</MenuItem>
								)}
								{onExportCsv && (
									<MenuItem value="export-csv" onClick={onExportCsv}>
										<MenuItemText>Export as CSV</MenuItemText>
									</MenuItem>
								)}
							</MenuContent>
						</Menu>

						<Menu>
							<MenuTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									disabled={isLoading}
									className="border-background/20"
								>
									<MoreHorizontal className="h-4 w-4 mr-1" />
									More
								</Button>
							</MenuTrigger>
							<MenuContent>
								{onViewJson && (
									<MenuItem value="view-json" onClick={onViewJson}>
										<MenuItemText>View JSON</MenuItemText>
									</MenuItem>
								)}
								{onLogRows && (
									<MenuItem value="log-rows" onClick={onLogRows}>
										<MenuItemText>Log rows to console</MenuItemText>
									</MenuItem>
								)}
								{onExpandRelationships && (
									<MenuItem
										value="expand-relationships"
										onClick={onExpandRelationships}
									>
										<MenuItemText>Expand relationships</MenuItemText>
									</MenuItem>
								)}
							</MenuContent>
						</Menu>
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
						<Button
							variant="ghost"
							size="sm"
							className="h-6 w-6 p-0 hover:bg-background/20"
						>
							<X className="h-4 w-4" />
						</Button>
					</ActionBar.ActionBarCloseTrigger>
				</ActionBar.ActionBarContent>
			</ActionBar.ActionBarPositioner>
		</ActionBar.ActionBarRoot>
	);
}
