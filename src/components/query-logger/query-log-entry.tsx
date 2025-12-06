import { ChevronRight } from "lucide-react";
import { formatRelativeTime } from "#src/lib/format-relative-time.ts";
import type { QueryLogEntryType } from "#src/server/query-logger/query-logger.types.ts";
import { Tooltip } from "../ui/tooltip.tsx";
import { QueryLogTypeBadge } from "./query-log-type-badge.tsx";
import { queryLogEntryStatusStyles } from "./query-logger.styles.ts";

interface QueryLogEntryProps {
	entry: QueryLogEntryType;
	onExpand: (entry: QueryLogEntryType) => void;
}

export const QueryLogEntry = ({ entry, onExpand }: QueryLogEntryProps) => {
	const relativeTime = formatRelativeTime(entry.startTime.getTime());
	const exactTime = new Date(entry.startTime).toLocaleTimeString();

	return (
		<button
			onClick={() => onExpand(entry)}
			className="w-full hover:bg-muted/50 transition-colors py-1.5 px-3 flex items-center gap-2 text-left group"
		>
			<div className={queryLogEntryStatusStyles({ status: entry.status })} />

			<div className="flex-1 min-w-0 flex flex-col gap-0.5">
				<div className="flex items-center gap-2">
					<QueryLogTypeBadge type={entry.type} size="xs" />
					<p className="text-xs font-medium truncate flex-1">{entry.sql}</p>
				</div>
				<p className="text-xs text-muted-foreground leading-tight">
					<Tooltip
						content={exactTime}
						portalled
						showArrow={false}
						openDelay={300}
						closeDelay={0}
					>
						<span>{relativeTime}</span>
					</Tooltip>
					{entry.timeTaken !== undefined && ` · ${entry.timeTaken}ms`}
					{entry.status === "pending" && ` · Running...`}
					{entry.rowsReturned !== undefined && ` · ${entry.rowsReturned} rows`}
					{entry.table && ` · ${entry.schema}.${entry.table}`}
				</p>
			</div>

			<ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
		</button>
	);
};
