import { useQuery } from "@tanstack/react-query";
import { Download, List, RotateCcw, Search, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ErrorBoundaryCard } from "#src/components/shared/error-boundary-card.tsx";
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
  const [zoom, setZoom] = useState(1);
  const [highlightedTable, setHighlightedTable] = useState<string | null>(null);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const didFitRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const diagramRef = useRef<SVGSVGElement | null>(null);

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
          columnCount: Math.min(
            table.columns.length,
            showAllColumns ? Number.MAX_SAFE_INTEGER : MAX_COLUMNS_PER_NODE,
          ),
        })),
        edges: edges.map((edge) => ({ fromId: edge.fromTable, toId: edge.toTable })),
      }),
      tableByName: new Map(tables.map((table) => [table.table, table])),
    };
  }, [fksQuery.data, showAllColumns, tableSearch, tablesQuery.data]);

  const { edges, layout, tableByName } = diagram;
  const width = Math.max(800, ...layout.nodes.map((node) => node.x + node.w + 40));
  const height = Math.max(400, ...layout.nodes.map((node) => node.y + node.h + 40));
  const nodeById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes],
  );
  const matchingTables = useMemo(
    () =>
      layout.nodes
        .filter((node) =>
          node.id.toLocaleLowerCase().includes(tableSearch.trim().toLocaleLowerCase()),
        )
        .slice(0, 8)
        .map((node) => ({
          id: node.id,
          columnCount: Math.round((node.h - ER_NODE_HEADER_HEIGHT) / ER_NODE_ROW_HEIGHT),
        })),
    [layout.nodes, tableSearch],
  );

  // Audit W4: fit-to-view is the default — first non-empty layout fits the
  // diagram to the canvas instead of starting at 100% zoom.
  const fitZoom = useMemo(() => {
    if (layout.nodes.length === 0) return null;
    return Math.min(
      1,
      Math.max(
        0.2,
        (canvasRef.current?.clientWidth ?? 800) / (width + 32),
        (canvasRef.current?.clientHeight ?? 400) / (height + 32),
      ),
    );
  }, [height, layout.nodes.length, width]);

  useEffect(() => {
    if (fitZoom === null || didFitRef.current) return;
    didFitRef.current = true;
    setZoom(fitZoom);
    canvasRef.current?.scrollTo({ left: 0, top: 0 });
  }, [fitZoom]);

  useEffect(() => {
    didFitRef.current = false;
  }, [showAllColumns]);

  const jumpToTable = (table: string) => {
    const node = nodeById.get(table);
    const canvas = canvasRef.current;
    if (!node || !canvas) return;
    setHighlightedTable(table);
    window.setTimeout(() => setHighlightedTable(null), 2000);
    canvas.scrollTo({
      left: Math.max(0, node.x * zoom - canvas.clientWidth / 2 + node.w),
      top: Math.max(0, node.y * zoom - canvas.clientHeight / 2 + node.h / 2),
      behavior: "smooth",
    });
  };

  if (tablesQuery.isLoading || fksQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="er-diagram-loading">
        <Spinner />
      </div>
    );
  }
  if (tablesQuery.isError || fksQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center p-4" data-testid="er-diagram-error">
        <ErrorBoundaryCard
          error={tablesQuery.error ?? fksQuery.error}
          title="Could not load schema map"
          onRetry={() => {
            void tablesQuery.refetch();
            void fksQuery.refetch();
          }}
          className="w-full max-w-md"
        />
      </div>
    );
  }

  const resetView = () => {
    setZoom(1);
    canvasRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  };

  const fitView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setZoom(
      Math.min(
        1,
        Math.max(0.35, canvas.clientWidth / (width + 32), canvas.clientHeight / (height + 32)),
      ),
    );
    canvas.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  };

  const exportDiagram = () => {
    const svg = diagramRef.current;
    if (!svg) return;

    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${schema}-schema-map.svg`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col" data-testid="er-diagram-view">
      <div className="bg-card flex shrink-0 flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
        <div>
          <p className="text-foreground text-sm font-semibold">Schema map</p>
          <p className="text-muted-foreground text-xs">
            {schema} · {layout.nodes.length} tables · {edges.length} relationships · open a table to
            inspect it
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56 max-w-full">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="Find a table"
              aria-label="Find a table in the schema diagram"
              className="h-8 pl-8 text-xs"
            />
            {/* Searchable table index (audit W4): jump straight to a node. */}
            {tableSearch.trim() !== "" && matchingTables.length > 0 ? (
              <div
                className="bg-card absolute top-full left-0 z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border shadow-lg"
                data-testid="er-table-index"
              >
                {matchingTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    className="hover:bg-muted flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs"
                    onClick={() => {
                      jumpToTable(table.id);
                      setTableSearch("");
                    }}
                  >
                    <span className="truncate font-medium">{table.id}</span>
                    <span className="text-muted-foreground shrink-0">{table.columnCount} cols</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Reset schema diagram view"
            title="Reset diagram view"
            onClick={resetView}
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Zoom out schema diagram"
            title="Zoom out"
            disabled={zoom <= 0.35}
            onClick={() => setZoom((current) => Math.max(0.35, current - 0.15))}
          >
            <ZoomOut className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Zoom in schema diagram"
            title="Zoom in"
            disabled={zoom >= 1.5}
            onClick={() => setZoom((current) => Math.min(1.5, current + 0.15))}
          >
            <ZoomIn className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Fit schema diagram"
            title="Fit diagram"
            onClick={fitView}
          >
            Fit
          </Button>
          <Button
            size="sm"
            variant={showAllColumns ? "default" : "ghost"}
            aria-label={showAllColumns ? "Show compact table columns" : "Show all table columns"}
            title={showAllColumns ? "Show first 8 columns" : "Show all columns"}
            onClick={() => setShowAllColumns((current) => !current)}
          >
            <List className="size-3.5" />
            {showAllColumns ? "Compact" : "All columns"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Export schema diagram as SVG"
            title="Export SVG"
            onClick={exportDiagram}
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      </div>

      {layout.nodes.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          No tables match “{tableSearch}”.
        </div>
      ) : (
        <div
          ref={canvasRef}
          className="relative min-h-0 flex-1 overflow-auto p-4"
          onScroll={(event) =>
            setScroll({ left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop })
          }
          onMouseEnter={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setViewport({ width: rect.width, height: rect.height });
          }}
        >
          <svg
            ref={diagramRef}
            width={width * zoom}
            height={height * zoom}
            viewBox={`0 0 ${width} ${height}`}
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
                Math.min(
                  Math.max(fromColumnIndex, 0),
                  (showAllColumns ? Number.MAX_SAFE_INTEGER : MAX_COLUMNS_PER_NODE) - 1,
                ) *
                  ER_NODE_ROW_HEIGHT +
                ER_NODE_ROW_HEIGHT / 2;
              const toY =
                to.y +
                ER_NODE_HEADER_HEIGHT +
                Math.min(
                  Math.max(toColumnIndex, 0),
                  (showAllColumns ? Number.MAX_SAFE_INTEGER : MAX_COLUMNS_PER_NODE) - 1,
                ) *
                  ER_NODE_ROW_HEIGHT +
                ER_NODE_ROW_HEIGHT / 2;
              const label = `${edge.fromColumns.join(", ")} → ${edge.toColumns.join(", ")}`;

              return (
                <g key={`${edge.fromTable}-${edge.toTable}-${edge.constraintName}-${index}`}>
                  {/* Contrast-safe edge: light halo under the colored line. */}
                  <line
                    x1={from.x}
                    y1={fromY}
                    x2={to.x + to.w}
                    y2={toY}
                    className="stroke-background"
                    strokeWidth={4}
                  />
                  <line
                    x1={from.x}
                    y1={fromY}
                    x2={to.x + to.w}
                    y2={toY}
                    className="stroke-primary"
                    strokeOpacity={0.9}
                    strokeWidth={2}
                    markerEnd="url(#er-arrow)"
                  >
                    <title>{`${edge.fromTable}.${label} ${edge.toTable}`}</title>
                  </line>
                </g>
              );
            })}

            {layout.nodes.map((node) => {
              const table = tableByName.get(node.id);
              if (!table) return null;
              const visibleColumns = showAllColumns
                ? table.columns
                : table.columns.slice(0, MAX_COLUMNS_PER_NODE);
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
                    className={
                      highlightedTable === node.id
                        ? "fill-card stroke-warning animate-pulse"
                        : "fill-card stroke-border hover:stroke-primary"
                    }
                    strokeWidth={highlightedTable === node.id ? 2.5 : 1.5}
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
                        <text x={node.x + 12} y={y} className="fill-foreground text-xs font-medium">
                          {marker}
                          {column.name}
                        </text>
                        <text
                          x={node.x + node.w - 12}
                          y={y}
                          textAnchor="end"
                          className="fill-muted-foreground text-xs"
                        >
                          {column.dataType.slice(0, 18)}
                        </text>
                      </g>
                    );
                  })}
                  {!showAllColumns && table.columns.length > MAX_COLUMNS_PER_NODE ? (
                    <text
                      x={node.x + 12}
                      y={node.y + node.h - 8}
                      className="fill-muted-foreground text-xs"
                    >
                      +{table.columns.length - MAX_COLUMNS_PER_NODE} more columns
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {/* Minimap (audit W4): scaled overview + viewport rectangle. */}
          {layout.nodes.length > 0 && width > 0 && height > 0 ? (
            <div
              className="bg-card/90 border-border absolute right-4 bottom-4 rounded-md border p-1 shadow-md"
              data-testid="er-minimap"
            >
              <svg
                width={160}
                height={Math.max(60, Math.min(120, (160 * height) / width))}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Diagram minimap"
                className="block cursor-pointer"
                onClick={(event) => {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = ((event.clientX - rect.left) / rect.width) * width;
                  const y = ((event.clientY - rect.top) / rect.height) * height;
                  canvas.scrollTo({
                    left: x * zoom - canvas.clientWidth / 2,
                    top: y * zoom - canvas.clientHeight / 2,
                    behavior: "smooth",
                  });
                }}
              >
                {layout.nodes.map((node) => (
                  <rect
                    key={node.id}
                    x={node.x}
                    y={node.y}
                    width={node.w}
                    height={node.h}
                    rx={6}
                    className="fill-muted-foreground/40 stroke-border"
                    strokeWidth={2}
                  />
                ))}
                <rect
                  x={scroll.left / zoom}
                  y={scroll.top / zoom}
                  width={viewport.width / zoom || 0}
                  height={viewport.height / zoom || 0}
                  className="fill-primary/15 stroke-primary"
                  strokeWidth={3}
                />
              </svg>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
