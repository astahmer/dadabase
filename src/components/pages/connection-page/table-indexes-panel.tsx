import { useQuery } from "@tanstack/react-query";

import { Badge } from "#src/components/ui/badge.tsx";
import { getTableIndexesQueryOptions } from "#src/server/introspection/start-fns/get-table-indexes.start.ts";

import { LoadingSpinner } from "../../shared/loading-spinner.tsx";
import { groupIndexesByName } from "./group-indexes.ts";

interface TableIndexesPanelProps {
  connectionUrl: string;
  schema: string;
  table: string;
}

export function TableIndexesPanel(props: TableIndexesPanelProps) {
  const { connectionUrl, schema, table } = props;

  const indexesQuery = useQuery({
    ...getTableIndexesQueryOptions({
      url: connectionUrl,
      schema,
      table,
    }),
    enabled: Boolean(connectionUrl && schema && table),
  });

  const grouped = groupIndexesByName(indexesQuery.data ?? []);

  return (
    <div className="border-t px-4 py-3" data-testid="table-indexes-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-wide uppercase">Indexes</h3>
        {indexesQuery.isFetching && <LoadingSpinner size="sm" />}
      </div>

      {indexesQuery.isError && <p className="text-destructive text-sm">Failed to load indexes</p>}

      {!indexesQuery.isLoading && grouped.length === 0 && (
        <p className="text-muted-foreground text-sm">No indexes on this table</p>
      )}

      {grouped.length > 0 && (
        <ul className="space-y-2">
          {grouped.map((idx) => (
            <li
              key={idx.name}
              className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="font-mono font-medium">{idx.name}</span>
              <span className="text-muted-foreground font-mono text-xs">
                ({idx.columns.join(", ")})
              </span>
              <span className="ml-auto flex gap-1">
                {idx.isPrimary && (
                  <Badge colorPalette="muted" size="xs">
                    PRIMARY
                  </Badge>
                )}
                {idx.isUnique && !idx.isPrimary && (
                  <Badge colorPalette="muted" size="xs">
                    UNIQUE
                  </Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
