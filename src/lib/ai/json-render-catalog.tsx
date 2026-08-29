import type { ReactNode } from "react";

import { defineCatalog } from "@json-render/core";
import { createRenderer } from "@json-render/react";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

import type { AiStatsPanelData } from "./ai-stats.ts";

const datumSchema = z.object({
  label: z.string(),
  value: z.number(),
});
const statsPropsSchema = z.object({
  title: z.string(),
  data: z.array(datumSchema),
});

const resultTableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
});
const resultTableValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const resultTableRowSchema = z.record(z.string(), resultTableValueSchema);

/**
 * Tiny catalog for AI chart/stat generative UI (vercel-labs/json-render).
 */
export const aiStatsCatalog = defineCatalog(schema, {
  components: {
    StatsPanel: {
      props: z.object({
        title: z.string(),
        variant: z.enum(["bar", "stat"]),
        data: z.array(datumSchema),
      }),
      description: "Bar chart or metric grid for query result summaries",
      slots: [],
    },
    MetricGrid: {
      props: statsPropsSchema,
      description: "A compact grid of labeled numeric metrics",
      slots: [],
    },
    BarChart: {
      props: statsPropsSchema,
      description: "A horizontal bar chart for labeled numeric values",
      slots: [],
    },
    ResultTable: {
      props: z.object({
        title: z.string().optional(),
        columns: z.array(resultTableColumnSchema),
        rows: z.array(resultTableRowSchema),
        emptyLabel: z.string().optional(),
      }),
      description: "A compact, readable table for safe query result previews",
      slots: [],
    },
  },
  actions: {},
});

export type AiStatsJsonRenderSpec = {
  root: string;
  elements: Record<
    string,
    {
      type: "StatsPanel";
      props: {
        title: string;
        variant: "bar" | "stat";
        data: Array<{ label: string; value: number }>;
      };
      children: string[];
    }
  >;
};

export type AiResultTableData = {
  title?: string;
  columns: ReadonlyArray<{ key: string; label: string }>;
  rows: ReadonlyArray<Record<string, unknown>>;
  emptyLabel?: string;
};

export type AiResultTableJsonRenderSpec = {
  root: string;
  elements: Record<
    string,
    {
      type: "ResultTable";
      props: {
        title?: string;
        columns: Array<{ key: string; label: string }>;
        rows: Array<Record<string, string | number | boolean | null>>;
        emptyLabel?: string;
      };
      children: string[];
    }
  >;
};

const renderableCellValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/** Convert trusted, app-owned result data into a constrained table spec. */
export const aiResultTableToJsonRenderSpec = (
  data: AiResultTableData,
): AiResultTableJsonRenderSpec => ({
  root: "root",
  elements: {
    root: {
      type: "ResultTable",
      props: {
        ...(data.title === undefined ? {} : { title: data.title }),
        columns: data.columns.map((column) => ({ key: column.key, label: column.label })),
        rows: data.rows.map((row) =>
          Object.fromEntries(
            data.columns.map((column) => [column.key, renderableCellValue(row[column.key])]),
          ),
        ),
        ...(data.emptyLabel === undefined ? {} : { emptyLabel: data.emptyLabel }),
      },
      children: [],
    },
  },
});

/** Convert our AI stats DTO into a json-render Spec. */
export const aiStatsToJsonRenderSpec = (data: AiStatsPanelData): AiStatsJsonRenderSpec => ({
  root: "root",
  elements: {
    root: {
      type: "StatsPanel",
      props: {
        title: data.title,
        variant: data.type,
        data: data.data,
      },
      children: [],
    },
  },
});

const formatNumber = (value: number): string => {
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const StatsPanelView = ({
  props,
}: {
  props: {
    title: string;
    variant: "bar" | "stat";
    data: Array<{ label: string; value: number }>;
  };
}) => {
  if (props.variant === "stat") {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">{props.title}</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {props.data.map((datum) => (
            <div key={datum.label} className="border-border rounded-md border px-3 py-2">
              <div className="text-muted-foreground text-xs">{datum.label}</div>
              <div className="text-lg font-semibold tabular-nums">{formatNumber(datum.value)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const max = Math.max(1, ...props.data.map((d) => Math.abs(d.value)));

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{props.title}</h4>
      <ul className="space-y-2">
        {props.data.map((datum) => {
          const widthPct = Math.round((Math.abs(datum.value) / max) * 100);
          return (
            <li key={datum.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate">{datum.label}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatNumber(datum.value)}
                </span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-sm">
                <div
                  className="bg-foreground/70 h-full rounded-sm transition-[width]"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const ResultTableView = ({
  props,
}: {
  props: {
    title?: string;
    columns: Array<{ key: string; label: string }>;
    rows: Array<Record<string, string | number | boolean | null>>;
    emptyLabel?: string;
  };
}): ReactNode => (
  <div className="space-y-1.5">
    {props.title !== undefined ? <h4 className="text-sm font-medium">{props.title}</h4> : null}
    {props.rows.length === 0 ? (
      <p className="text-muted-foreground text-xs">{props.emptyLabel ?? "No rows returned."}</p>
    ) : (
      <div className="overflow-x-auto rounded border">
        <table className="w-full min-w-max text-left text-xs">
          <thead className="bg-muted/50">
            <tr>
              {props.columns.map((column) => (
                <th key={column.key} className="px-2 py-1.5 font-medium whitespace-nowrap">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const occurrences = new Map<string, number>();
              return props.rows.slice(0, 8).map((row) => {
                const fingerprint = Object.entries(row)
                  .map(([key, value]) => `${key}:${String(value)}`)
                  .join("|");
                const occurrence = occurrences.get(fingerprint) ?? 0;
                occurrences.set(fingerprint, occurrence + 1);
                return (
                  <tr key={`${fingerprint}-${occurrence}`} className="border-t align-top">
                    {props.columns.map((column) => (
                      <td key={column.key} className="max-w-56 px-2 py-1.5 break-words">
                        {row[column.key] === null ? "—" : String(row[column.key])}
                      </td>
                    ))}
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
        {props.rows.length > 8 ? (
          <p className="text-muted-foreground border-t px-2 py-1.5 text-[11px]">
            Showing 8 of {props.rows.length} sampled rows.
          </p>
        ) : null}
      </div>
    )}
  </div>
);

/** json-render Renderer for AI stats/charts. */
export const AiStatsJsonRenderer = createRenderer(aiStatsCatalog, {
  StatsPanel: ({ element }) => <StatsPanelView props={element.props} />,
  MetricGrid: ({ element }) => <StatsPanelView props={{ ...element.props, variant: "stat" }} />,
  BarChart: ({ element }) => <StatsPanelView props={{ ...element.props, variant: "bar" }} />,
  ResultTable: ({ element }) => <ResultTableView props={element.props} />,
});

/** json-render Renderer for safe, app-owned query result previews. */
export const AiResultTableJsonRenderer = ({ spec }: { spec: AiResultTableJsonRenderSpec }) => (
  <AiStatsJsonRenderer spec={spec} />
);
