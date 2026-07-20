import type { AiStatsPanelData } from "#src/lib/ai/ai-stats.ts";

import { cn } from "#src/lib/utils.ts";

interface AiStatsPanelProps {
  data: AiStatsPanelData;
  className?: string;
}

/**
 * Minimal generative-UI renderer for AI chart/stat tool results.
 * Full json-render integration deferred; this covers bar + stat MVP.
 */
export const AiStatsPanel = ({ data, className }: AiStatsPanelProps) => {
  if (data.type === "stat") {
    return (
      <div className={cn("space-y-2", className)}>
        <h4 className="text-sm font-medium">{data.title}</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.data.map((datum) => (
            <div key={datum.label} className="border-border rounded-md border px-3 py-2">
              <div className="text-muted-foreground text-xs">{datum.label}</div>
              <div className="text-lg font-semibold tabular-nums">{formatNumber(datum.value)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const max = Math.max(1, ...data.data.map((d) => Math.abs(d.value)));

  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-medium">{data.title}</h4>
      <ul className="space-y-2">
        {data.data.map((datum) => {
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

const formatNumber = (value: number): string => {
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
