import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { Spinner } from "#src/components/ui/spinner.tsx";
import { buildErDiagramLayout } from "#src/lib/er-diagram/index.ts";
import { getAllTablesColumnsQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-columns.start.ts";
import { getAllTablesForeignKeysQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-foreign-keys.start.ts";

export interface ErDiagramViewProps {
  connectionUrl: string;
  schema: string;
  onOpenTable: (table: string) => void;
}

export function ErDiagramView(props: ErDiagramViewProps) {
  const { connectionUrl, schema, onOpenTable } = props;

  const tablesQuery = useQuery({
    ...getAllTablesColumnsQueryOptions({ url: connectionUrl, schema }),
    enabled: Boolean(connectionUrl && schema),
  });

  const fksQuery = useQuery({
    ...getAllTablesForeignKeysQueryOptions({ url: connectionUrl, schema }),
    enabled: Boolean(connectionUrl && schema),
  });

  const layout = useMemo(() => {
    const tables = tablesQuery.data ?? [];
    const edges = fksQuery.data ?? [];
    return buildErDiagramLayout({
      tables: tables.map((t) => ({
        id: t.table,
        columnCount: t.columns.length,
      })),
      edges: edges.map((e) => ({
        fromId: e.fromTable,
        toId: e.toTable,
      })),
    });
  }, [fksQuery.data, tablesQuery.data]);

  if (tablesQuery.isLoading || fksQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="er-diagram-loading">
        <Spinner />
      </div>
    );
  }

  if (tablesQuery.isError || fksQuery.isError) {
    return (
      <div className="text-destructive p-4 text-sm" data-testid="er-diagram-error">
        Failed to load ER diagram metadata.
      </div>
    );
  }

  const width = Math.max(800, ...layout.nodes.map((n) => n.x + n.w + 40));
  const height = Math.max(400, ...layout.nodes.map((n) => n.y + n.h + 40));
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div className="h-full w-full overflow-auto p-2" data-testid="er-diagram-view">
      <svg width={width} height={height} className="bg-muted/30 min-w-full rounded-md">
        {layout.edges.map((edge, i) => {
          const from = nodeById.get(edge.fromId);
          const to = nodeById.get(edge.toId);
          if (!from || !to) return null;
          const x1 = from.x;
          const y1 = from.y + from.h / 2;
          const x2 = to.x + to.w;
          const y2 = to.y + to.h / 2;
          return (
            <line
              key={`${edge.fromId}-${edge.toId}-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1.5}
              markerEnd="url(#er-arrow)"
            />
          );
        })}
        <defs>
          <marker id="er-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" fillOpacity={0.45} />
          </marker>
        </defs>
        {layout.nodes.map((node) => (
          <g key={node.id} data-testid={`er-table-${node.id}`}>
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx={6}
              className="fill-background stroke-border cursor-pointer"
              strokeWidth={1.5}
              onClick={() => onOpenTable(node.id)}
            />
            <text
              x={node.x + 12}
              y={node.y + 22}
              className="fill-foreground cursor-pointer text-sm font-semibold"
              onClick={() => onOpenTable(node.id)}
            >
              {node.id}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
