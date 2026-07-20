import { useQuery } from "@tanstack/react-query";

import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";

import { Spinner } from "#src/components/ui/spinner.tsx";
import { getRelationshipsCountsQueryOptions } from "#src/server/introspection/start-fns/get-relationships-counts.start.ts";

interface RelatedRowExpandPreviewProps {
  relationships: TableRelationship[];
  rowData: Record<string, unknown>;
  connectionUrl: string;
  schema: string;
  table: string;
}

/**
 * Compact inline related-entity snippet for row expand.
 * Shows relationship targets with counts (full tables stay in the bottom panel).
 */
export function RelatedRowExpandPreview({
  relationships,
  rowData,
  connectionUrl,
  schema,
  table,
}: RelatedRowExpandPreviewProps) {
  const validRelationships = relationships.filter((rel) => {
    const filterValue =
      rowData[rel.type === "incoming" ? rel.referencedColumn : rel.referencingColumn];
    return filterValue !== null && filterValue !== undefined && filterValue !== "null";
  });

  const countsQuery = useQuery({
    ...getRelationshipsCountsQueryOptions({
      url: connectionUrl,
      schema,
      table,
      relationships: validRelationships,
      rowData,
    }),
    enabled: validRelationships.length > 0,
  });

  const counts = countsQuery.data ?? {};

  if (validRelationships.length === 0) {
    return (
      <div
        className="text-muted-foreground px-3 py-2 text-xs"
        data-testid="related-row-expand-preview"
      >
        No related rows for this record
      </div>
    );
  }

  return (
    <div
      className="bg-muted/30 flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 text-xs"
      data-testid="related-row-expand-preview"
    >
      <span className="text-muted-foreground font-medium">Related</span>
      {countsQuery.isLoading ? (
        <Spinner className="size-3" />
      ) : (
        validRelationships.map((rel) => {
          const target =
            rel.type === "outgoing"
              ? `${rel.referencedSchema}.${rel.referencedTable}`
              : `${rel.referencingSchema}.${rel.referencingTable}`;
          const count = counts[rel.constraintName] ?? 0;
          return (
            <span key={rel.constraintName} className="font-mono" title={rel.constraintName}>
              {target}
              <span className="text-muted-foreground ml-1">×{count}</span>
            </span>
          );
        })
      )}
    </div>
  );
}
