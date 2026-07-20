import { ChevronRight } from "lucide-react";

import type { QueryLogEntryType } from "#src/server/query-logger/query-logger.types.ts";

import { formatRelativeTime } from "#src/lib/format-relative-time.ts";

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
      className="hover:bg-muted/50 group flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors"
    >
      <div className={queryLogEntryStatusStyles({ status: entry.status })} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <QueryLogTypeBadge type={entry.type} size="xs" />
          <p className="flex-1 truncate text-xs font-medium">{entry.sql}</p>
        </div>
        <p className="text-muted-foreground text-xs leading-tight">
          <Tooltip content={exactTime} portalled showArrow={false} openDelay={300} closeDelay={0}>
            <span>{relativeTime}</span>
          </Tooltip>
          {entry.timeTaken !== undefined && ` · ${entry.timeTaken}ms`}
          {entry.status === "pending" && ` · Running...`}
          {entry.rowsReturned !== undefined && ` · ${entry.rowsReturned} rows`}
          {entry.table && ` · ${entry.schema}.${entry.table}`}
        </p>
      </div>

      <ChevronRight className="text-muted-foreground group-hover:text-foreground h-3 w-3 shrink-0 transition-colors" />
    </button>
  );
};
