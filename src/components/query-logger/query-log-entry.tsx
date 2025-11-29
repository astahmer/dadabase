import { ChevronRight } from "lucide-react";
import type { QueryLogEntry } from "#src/lib/query-logger.types.ts";
import {
	queryLogEntryStatusStyles,
	queryLogEntryTypeStyles,
} from "./query-logger.styles.ts";

interface QueryLogEntryProps {
	entry: QueryLogEntry;
	onExpand: (entry: QueryLogEntry) => void;
}

export const QueryLogEntry = ({ entry, onExpand }: QueryLogEntryProps) => {
	return (
		<button
			onClick={() => onExpand(entry)}
			className="w-full border-b hover:bg-muted/50 transition-colors py-2 px-3 flex items-center gap-3 text-left group"
		>
			<div className={queryLogEntryStatusStyles({ status: entry.status })} />

			<div className="flex-1 min-w-0 flex items-center gap-2">
				<span className={queryLogEntryTypeStyles({ type: entry.type })} />

				<div className="flex-1 min-w-0 space-y-0.5">
					<p className="text-sm font-medium truncate">{entry.sql}</p>
					<p className="text-xs text-muted-foreground">
						{entry.timeTaken !== undefined
							? `${entry.timeTaken}ms`
							: entry.status === "pending"
								? "Running..."
								: ""}
						{entry.rowsReturned !== undefined &&
							` · ${entry.rowsReturned} rows`}
						{entry.table && ` · ${entry.schema}.${entry.table}`}
					</p>
				</div>
			</div>

			<ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
		</button>
	);
};
