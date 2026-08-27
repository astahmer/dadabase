import { BarChart3, LineChart, Table2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../ui/button.tsx";

type ResultRow = Record<string, unknown>;
type ChartKind = "bar" | "line";

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
};

const displayValue = (value: unknown) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export const ResultVisualization = (props: { rows: ResultRow[]; columns: string[] }) => {
  const { rows, columns } = props;
  const numericColumns = useMemo(
    () =>
      columns.filter((column) => rows.some((row) => asNumber(row[column]) !== null)).slice(0, 20),
    [columns, rows],
  );
  const [xColumn, setXColumn] = useState(columns[0] ?? "");
  const [yColumn, setYColumn] = useState(numericColumns[0] ?? "");
  const [chartKind, setChartKind] = useState<ChartKind>("bar");

  const effectiveXColumn = columns.includes(xColumn) ? xColumn : (columns[0] ?? "");
  const effectiveYColumn = numericColumns.includes(yColumn) ? yColumn : (numericColumns[0] ?? "");
  const points = useMemo(() => {
    const groups = new Map<string, number>();
    for (const row of rows.slice(0, 100)) {
      const key = displayValue(row[effectiveXColumn]);
      const value = effectiveYColumn ? asNumber(row[effectiveYColumn]) : 1;
      if (value !== null) groups.set(key, (groups.get(key) ?? 0) + value);
    }
    return Array.from(groups, ([label, value]) => ({ label, value })).slice(0, 24);
  }, [effectiveXColumn, effectiveYColumn, rows]);

  const maxValue = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  const minValue = Math.min(...points.map((point) => point.value), 0);
  const valueRange = Math.max(maxValue - Math.min(minValue, 0), 1);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-auto p-4"
      data-testid="result-visualization"
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Group by</span>
          <select
            className="border-input bg-background h-8 min-w-36 rounded-md border px-2 text-sm"
            value={effectiveXColumn}
            onChange={(event) => setXColumn(event.target.value)}
          >
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Measure</span>
          <select
            className="border-input bg-background h-8 min-w-36 rounded-md border px-2 text-sm"
            value={effectiveYColumn}
            onChange={(event) => setYColumn(event.target.value)}
            disabled={numericColumns.length === 0}
          >
            {numericColumns.length === 0 ? <option value="">Count rows</option> : null}
            {numericColumns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1" aria-label="Visualization type">
          <Button
            size="sm"
            variant={chartKind === "bar" ? "default" : "outline"}
            aria-label="Bar chart"
            onClick={() => setChartKind("bar")}
          >
            <BarChart3 className="size-3.5" /> Bar
          </Button>
          <Button
            size="sm"
            variant={chartKind === "line" ? "default" : "outline"}
            aria-label="Line chart"
            onClick={() => setChartKind("line")}
          >
            <LineChart className="size-3.5" /> Line
          </Button>
        </div>
      </div>
      {points.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          No numeric values available for this result.
        </div>
      ) : (
        <div className="bg-muted/20 min-h-64 rounded-lg border p-4">
          <svg
            viewBox="0 0 900 360"
            className="h-full min-h-64 w-full"
            role="img"
            aria-label={`${chartKind} chart of ${effectiveYColumn || "row count"} grouped by ${effectiveXColumn}`}
          >
            <line x1="52" y1="20" x2="52" y2="315" className="stroke-border" />
            <line x1="52" y1="315" x2="880" y2="315" className="stroke-border" />
            {chartKind === "line" ? (
              <polyline
                fill="none"
                className="stroke-primary"
                strokeWidth="3"
                points={points
                  .map((point, index) => {
                    const x = 64 + (index * 800) / Math.max(points.length - 1, 1);
                    const y = 300 - ((point.value - Math.min(minValue, 0)) / valueRange) * 270;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
            ) : null}
            {points.map((point, index) => {
              const x = 64 + (index * 800) / Math.max(points.length, 1);
              const height = ((point.value - Math.min(minValue, 0)) / valueRange) * 270;
              const y = 300 - height;
              const lineX = 64 + (index * 800) / Math.max(points.length - 1, 1);
              return (
                <g key={`${point.label}-${index}`}>
                  {chartKind === "bar" ? (
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(8, 760 / Math.max(points.length, 1))}
                      height={Math.max(1, height)}
                      rx="3"
                      className="fill-primary/80"
                    />
                  ) : (
                    <circle cx={lineX} cy={y} r="5" className="fill-primary" />
                  )}
                  <title>{`${point.label}: ${point.value}`}</title>
                  <text
                    x={chartKind === "bar" ? x + 4 : lineX}
                    y="338"
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {point.label.length > 14 ? `${point.label.slice(0, 13)}…` : point.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
        <Table2 className="size-3.5" />
        Showing the first {Math.min(rows.length, 100)} rows, grouped into {points.length} points.
      </div>
    </div>
  );
};
