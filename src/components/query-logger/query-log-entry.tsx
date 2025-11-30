import { ChevronRight } from "lucide-react";
import type { QueryLogEntryType } from "#src/server/query-logger/query-logger.types.ts";
import { Badge } from "../ui/badge.tsx";
import { queryLogEntryStatusStyles } from "./query-logger.styles.ts";
import { formatRelativeTime } from "#src/lib/format-relative-time.ts";

interface QueryLogEntryProps {
	entry: QueryLogEntryType;
	onExpand: (entry: QueryLogEntryType) => void;
}

const queryTypeColorMap: Record<
	string,
	| "default"
	| "secondary"
	| "destructive"
	| "success"
	| "error"
	| "warning"
	| "info"
	| "muted"
> = {
	table: "info",
	schema: "secondary",
	enum: "warning",
	constraint: "destructive",
	total: "muted",
	columns: "default",
};

export const QueryLogEntry = ({ entry, onExpand }: QueryLogEntryProps) => {
	const relativeTime = formatRelativeTime(entry.startTime);
	const exactTime = new Date(entry.startTime).toLocaleTimeString();

	return (
		<button
			onClick={() => onExpand(entry)}
			className="w-full border-b hover:bg-muted/50 transition-colors py-2 px-3 flex items-center gap-3 text-left group"
		>
			<div className={queryLogEntryStatusStyles({ status: entry.status })} />

			<div className="flex-1 min-w-0 flex flex-col gap-2">
				<div className="flex items-center gap-2">
					<Badge colorPalette={queryTypeColorMap[entry.type]} size="xs">
						{entry.type}
					</Badge>
					<p className="text-sm font-medium truncate flex-1">{entry.sql}</p>
				</div>
				<p className="text-xs text-muted-foreground">
					<span title={exactTime}>{relativeTime}</span>
					{entry.timeTaken !== undefined && ` · ${entry.timeTaken}ms`}
					{entry.status === "pending" && ` · Running...`}
					{entry.rowsReturned !== undefined && ` · ${entry.rowsReturned} rows`}
					{entry.table && ` · ${entry.schema}.${entry.table}`}
				</p>
			</div>

			<ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
		</button>
	);
};
