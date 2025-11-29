import { useState } from "react";
import { Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useQueryLogger } from "#src/hooks/use-query-logger.ts";
import { QueryLogEntry } from "./query-log-entry.tsx";
import { QueryLoggerDetailDialog } from "./query-logger-detail-dialog.tsx";
import { Button } from "../ui/button.tsx";
import { queryLoggerPanelStyles } from "./query-logger.styles.ts";
import type { QueryLogEntry as QueryLogEntryType } from "#src/lib/query-logger.types.ts";

export const QueryLoggerPanel = () => {
	const { history, isOpen, toggleOpen, clearHistory } = useQueryLogger();
	const [selectedEntry, setSelectedEntry] = useState<QueryLogEntryType | null>(
		null,
	);
	const [dialogOpen, setDialogOpen] = useState(false);

	const handleExpand = (entry: QueryLogEntryType) => {
		setSelectedEntry(entry);
		setDialogOpen(true);
	};

	const successCount = history.filter((e) => e.status === "success").length;
	const errorCount = history.filter((e) => e.status === "error").length;
	const pendingCount = history.filter((e) => e.status === "pending").length;

	return (
		<>
			<div className={queryLoggerPanelStyles({ isOpen })}>
				<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 h-12">
					<button
						onClick={toggleOpen}
						className="flex items-center gap-2 flex-1 text-left font-medium hover:bg-muted transition-colors rounded px-2 py-1"
					>
						<span>Query Logger</span>
						{!isOpen && (
							<span className="text-xs text-muted-foreground ml-auto flex gap-1">
								{successCount > 0 && (
									<span className="inline-flex items-center gap-1">
										<div className="h-2 w-2 rounded-full bg-green-500" />
										{successCount}
									</span>
								)}
								{errorCount > 0 && (
									<span className="inline-flex items-center gap-1 text-red-600">
										<div className="h-2 w-2 rounded-full bg-red-500" />
										{errorCount}
									</span>
								)}
								{pendingCount > 0 && (
									<span className="inline-flex items-center gap-1 text-yellow-600">
										<div className="h-2 w-2 rounded-full bg-yellow-500" />
										{pendingCount}
									</span>
								)}
							</span>
						)}
						{isOpen ? (
							<ChevronDown className="h-4 w-4 ml-auto" />
						) : (
							<ChevronUp className="h-4 w-4 ml-auto" />
						)}
					</button>

					{isOpen && (
						<div className="flex items-center gap-1">
							<Button
								size="sm"
								variant="ghost"
								onClick={clearHistory}
								title="Clear history"
								className="text-muted-foreground hover:text-foreground"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					)}
				</div>

				{isOpen && (
					<div className="h-52 overflow-y-auto">
						{history.length === 0 ? (
							<div className="flex items-center justify-center h-52 text-muted-foreground">
								No queries executed yet
							</div>
						) : (
							<div className="divide-y">
								{[...history].reverse().map((entry) => (
									<QueryLogEntry
										key={entry.id}
										entry={entry}
										onExpand={handleExpand}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			<QueryLoggerDetailDialog
				entry={selectedEntry}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</>
	);
};
