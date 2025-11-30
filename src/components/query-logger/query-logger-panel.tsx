import { useQueryLogger } from "#src/components/query-logger/use-query-logger.ts";
import type {
	QueryLogEntryType,
	QueryLogStatus,
} from "#src/server/query-logger/query-logger.types.ts";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button.tsx";
import { QueryLogEntry } from "./query-log-entry.tsx";
import { QueryLoggerDetailDialog } from "./query-logger-detail-dialog.tsx";
import { queryLoggerPanelStyles } from "./query-logger.styles.ts";

interface QueryLoggerPanelProps {
	connectionUrl: string;
}

export const QueryLoggerPanel = ({ connectionUrl }: QueryLoggerPanelProps) => {
	const {
		history,
		isOpen,
		toggleOpen,
		clearHistory,
		filters,
		setFilters,
		isClearing,
	} = useQueryLogger({
		connectionUrl,
	});
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
	const totalCount = history.length;

	const toggleStatusFilter = (status: QueryLogStatus) => {
		setFilters({
			...filters,
			status: filters?.status === status ? undefined : status,
		});
	};

	const isSuccessFiltered =
		filters?.status &&
		(Array.isArray(filters.status)
			? filters.status.includes("success")
			: filters.status === "success");

	const isErrorFiltered =
		filters?.status &&
		(Array.isArray(filters.status)
			? filters.status.includes("error")
			: filters.status === "error");

	return (
		<>
			<div className={queryLoggerPanelStyles({ isOpen })}>
				<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 h-12 shrink-0">
					<button
						onClick={toggleOpen}
						className="flex items-center gap-2 flex-1 text-left font-medium hover:bg-muted transition-colors rounded px-2 py-1"
					>
						<span>Query Logger</span>
						{!isOpen && (
							<span className="text-xs text-muted-foreground mr-auto flex gap-2 mx-2">
								<span className="inline-flex items-center gap-1">
									<div className="h-2 w-2 rounded-full bg-green-500" />
									{successCount}
								</span>
								<span className="inline-flex items-center gap-1 text-red-600">
									<div className="h-2 w-2 rounded-full bg-red-500" />
									{errorCount}
								</span>
								{/* <span className="inline-flex items-center gap-1 text-yellow-600">
									<div className="h-2 w-2 rounded-full bg-yellow-500" />
									{pendingCount}
								</span> */}
							</span>
						)}
						{isOpen && (
							<div className="flex items-center gap-1">
								<Button
									size="sm"
									variant="ghost"
									onClick={() => toggleStatusFilter("success")}
									title="Filter by success"
									className={`transition-all rounded-md px-2 py-1.5 flex items-center gap-1.5 ${
										isSuccessFiltered
											? "bg-green-500/20 text-green-700 hover:bg-green-500/30"
											: "text-muted-foreground hover:text-foreground hover:bg-muted/50"
									}`}
								>
									<div className="h-2.5 w-2.5 rounded-full bg-green-500" />
									<span className="text-xs font-medium">{successCount}</span>
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => toggleStatusFilter("error")}
									title="Filter by error"
									className={`transition-all rounded-md px-2 py-1.5 flex items-center gap-1.5 ${
										isErrorFiltered
											? "bg-red-500/20 text-red-700 hover:bg-red-500/30"
											: "text-muted-foreground hover:text-foreground hover:bg-muted/50"
									}`}
								>
									<div className="h-2.5 w-2.5 rounded-full bg-red-500" />
									<span className="text-xs font-medium">{errorCount}</span>
								</Button>
							</div>
						)}
					</button>
					<Button
						size="sm"
						variant="ghost"
						onClick={clearHistory}
						disabled={isClearing}
						title="Clear history"
						className="text-muted-foreground hover:text-foreground ml-auto"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
					{isOpen ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronUp className="h-4 w-4" />
					)}
				</div>

				{isOpen && (
					<div className="flex-1 overflow-y-auto min-h-0">
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
