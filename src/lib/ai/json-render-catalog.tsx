import { defineCatalog } from "@json-render/core";
import { createRenderer } from "@json-render/react";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

import type { AiStatsPanelData } from "./ai-stats.ts";

const datumSchema = z.object({
  label: z.string(),
  value: z.number(),
});

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

/** json-render Renderer for AI stats/charts. */
export const AiStatsJsonRenderer = createRenderer(aiStatsCatalog, {
  StatsPanel: ({ element }) => <StatsPanelView props={element.props} />,
});
