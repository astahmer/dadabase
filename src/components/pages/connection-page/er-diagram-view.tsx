import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "#src/components/ui/button.tsx";
import { Input } from "#src/components/ui/input.tsx";
import { Spinner } from "#src/components/ui/spinner.tsx";
import {
  buildErDiagramLayout,
  ER_NODE_HEADER_HEIGHT,
  ER_NODE_ROW_HEIGHT,
} from "#src/lib/er-diagram/index.ts";
import { getAllTablesColumnsQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-columns.start.ts";
import { getAllTablesForeignKeysQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-foreign-keys.start.ts";

const MAX_COLUMNS_PER_NODE = 8;

export interface ErDiagramViewProps {
  connectionUrl: string;
  schema: string;
  onOpenTable: (table: string) => void;
}

export function ErDiagramView(props: ErDiagramViewProps) {
  const { connectionUrl, schema, onOpenTable } = props;
  const [tableSearch, setTableSearch] = useState("");
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const tablesQuery = useQuery({
    ...getAllTablesColumnsQueryOptions({ url: connectionUrl, schema }),
    enabled: Boolean(connectionUrl && schema),
  });
  const fksQuery = useQuery({
    ...getAllTablesForeignKeysQueryOptions({ url: connectionUrl, schema }),
    enabled: Boolean(connectionUrl && schema),
  });

  const diagram = useMemo(() => {
    const normalizedSearch = tableSearch.trim().toLocaleLowerCase();
    const tables = (tablesQuery.data ?? []).filter((table) =>
      table.table.toLocaleLowerCase().includes(normalizedSearch),
    );
    const tableNames = new Set(tables.map((table) => table.table));
    const edges = (fksQuery.data ?? []).filter(
      (edge) => tableNames.has(edge.fromTable) && tableNames.has(edge.toTable),
    );
    return {
      edges,
      layout: buildErDiagramLayout({
        tables: tables.map((table) => ({
          id: table.table,
          columnCount: Math.min(table.columns.length, MAX_COLUMNS_PER_NODE),
        })),
        edges: edges.map((edge) => ({ fromId: edge.fromTable, toId: edge.toTable })),
      }),
      tableByName: new Map(tables.map((table) => [table.table, table])),
    };
  }, [fksQuery.data, tableSearch, tablesQuery.data]);

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

  const { edges, layout, tableByName } = diagram;
  const width = Math.max(800, ...layout.nodes.map((node) => node.x + node.w + 40));
  const height = Math.max(400, ...layout.nodes.map((node) => node.y + node.h + 40));
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));

  return (
    <div className="flex h-full min-h-0 w-full flex-col" data-testid="er-diagram-view">
      <div className="bg-card flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3">
        <div>
          <p className="text-foreground text-sm font-semibold">Schema map</p>
          <p className="text-muted-foreground text-xs">
            {layout.nodes.length} tables · {edges.length} relationships · select a table to inspect
            it
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="Find a table"
              aria-label="Find a table in the schema diagram"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Reset schema diagram view"
            title="Reset diagram view"
            onClick={() => canvasRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" })}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {layout.nodes.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          No tables match “{tableSearch}”.
        </div>
      ) : (
        <div ref={canvasRef} className="min-h-0 flex-1 overflow-auto p-4">
          <svg
            width={width}
            height={height}
            className="bg-muted/20 min-w-full rounded-lg"
            role="img"
            aria-label={`Schema diagram with ${layout.nodes.length} tables and ${edges.length} relationships`}
          >
            <defs>
              <marker
                id="er-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" className="fill-primary" />
              </marker>
            </defs>
            {edges.map((edge, index) => {
              const from = nodeById.get(edge.fromTable);
              const to = nodeById.get(edge.toTable);
              const fromTable = tableByName.get(edge.fromTable);
              const toTable = tableByName.get(edge.toTable);
              if (!from || !to || !fromTable || !toTable) return null;

              const fromColumnIndex = fromTable.columns.findIndex(
                (column) => column.name === edge.fromColumns[0],
              );
              const toColumnIndex = toTable.columns.findIndex(
                (column) => column.name === edge.toColumns[0],
              );
              const fromY =
                from.y +
                ER_NODE_HEADER_HEIGHT +
                Math.min(Math.max(fromColumnIndex, 0), MAX_COLUMNS_PER_NODE - 1) *
                  ER_NODE_ROW_HEIGHT +
                ER_NODE_ROW_HEIGHT / 2;
              const toY =
                to.y +
                ER_NODE_HEADER_HEIGHT +
                Math.min(Math.max(toColumnIndex, 0), MAX_COLUMNS_PER_NODE - 1) *
                  ER_NODE_ROW_HEIGHT +
                ER_NODE_ROW_HEIGHT / 2;
              const label = `${edge.fromColumns.join(", ")} → ${edge.toColumns.join(", ")}`;

              return (
                <g key={`${edge.fromTable}-${edge.toTable}-${edge.constraintName}-${index}`}>
                  <line
                    x1={from.x}
                    y1={fromY}
                    x2={to.x + to.w}
                    y2={toY}
                    className="stroke-primary"
                    strokeOpacity={0.7}
                    strokeWidth={1.75}
                    markerEnd="url(#er-arrow)"
                  >
                    <title>{`${edge.fromTable}.${label} ${edge.toTable}`}</title>
                  </line>
                  <text
                    x={(from.x + to.x + to.w) / 2}
                    y={(fromY + toY) / 2 - 5}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {layout.nodes.map((node) => {
              const table = tableByName.get(node.id);
              if (!table) return null;
              const visibleColumns = table.columns.slice(0, MAX_COLUMNS_PER_NODE);
              return (
                <g
                  key={node.id}
                  data-testid={`er-table-${node.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open table ${node.id} with ${table.columns.length} columns`}
                  className="cursor-pointer outline-none"
                  onClick={() => onOpenTable(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenTable(node.id);
                    }
                  }}
                >
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.w}
                    height={node.h}
                    rx={8}
                    className="fill-card stroke-border hover:stroke-primary"
                    strokeWidth={1.5}
                  />
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.w}
                    height={ER_NODE_HEADER_HEIGHT}
                    rx={8}
                    className="fill-muted"
                  />
                  <rect
                    x={node.x}
                    y={node.y + ER_NODE_HEADER_HEIGHT - 8}
                    width={node.w}
                    height={8}
                    className="fill-muted"
                  />
                  <text
                    x={node.x + 12}
                    y={node.y + 22}
                    className="fill-foreground text-sm font-semibold"
                  >
                    {node.id}
                  </text>
                  {visibleColumns.map((column, columnIndex) => {
                    const y =
                      node.y + ER_NODE_HEADER_HEIGHT + columnIndex * ER_NODE_ROW_HEIGHT + 16;
                    const marker = `${column.primaryKey ? "PK " : ""}${column.isForeignKey ? "FK " : ""}`;
                    return (
                      <g key={column.name} data-testid={`er-column-${node.id}-${column.name}`}>
                        {columnIndex > 0 ? (
                          <line
                            x1={node.x + 8}
                            y1={node.y + ER_NODE_HEADER_HEIGHT + columnIndex * ER_NODE_ROW_HEIGHT}
                            x2={node.x + node.w - 8}
                            y2={node.y + ER_NODE_HEADER_HEIGHT + columnIndex * ER_NODE_ROW_HEIGHT}
                            className="stroke-border"
                          />
                        ) : null}
                        <text x={node.x + 12} y={y} className="fill-foreground text-[11px]">
                          {marker}
                          {column.name}
                        </text>
                        <text
                          x={node.x + node.w - 12}
                          y={y}
                          textAnchor="end"
                          className="fill-muted-foreground text-[10px]"
                        >
                          {column.dataType.slice(0, 18)}
                        </text>
                      </g>
                    );
                  })}
                  {table.columns.length > MAX_COLUMNS_PER_NODE ? (
                    <text
                      x={node.x + 12}
                      y={node.y + node.h - 8}
                      className="fill-muted-foreground text-[10px]"
                    >
                      +{table.columns.length - MAX_COLUMNS_PER_NODE} more columns
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
