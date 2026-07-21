import { AlertTriangle, ChevronDown, Zap } from "lucide-react";
import { useState } from "react";

import { Tooltip } from "#src/components/ui/tooltip.tsx";
import {
  parsePostgresExplain,
  type PostgresExplainNode,
} from "#src/lib/explain/parse-postgres-explain.ts";
import { cn } from "#src/lib/utils.ts";

// Memoized number formatter to avoid recreating on each render
const numberFormatter = new Intl.NumberFormat();
function formatNumber(num: number): string {
  return numberFormatter.format(num);
}

type ExplainNode = PostgresExplainNode;

/**
 * Get performance tier color based on execution time
 */
function getPerformanceColor(timeMs: number): {
  bg: string;
  text: string;
  badge: string;
} {
  if (timeMs > 10)
    return {
      bg: "bg-red-50",
      text: "text-red-700",
      badge: "bg-red-100 text-red-700",
    };
  if (timeMs > 1)
    return {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      badge: "bg-yellow-100 text-yellow-700",
    };
  if (timeMs > 0.1)
    return {
      bg: "bg-blue-50",
      text: "text-blue-700",
      badge: "bg-blue-100 text-blue-700",
    };
  return {
    bg: "bg-green-50",
    text: "text-green-700",
    badge: "bg-green-100 text-green-700",
  };
}

interface ExplainNodeProps {
  node: ExplainNode;
  maxTime: number;
  isExpensive: boolean;
}

function ExplainNodeRow({ node, maxTime, isExpensive }: ExplainNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const actualTimeMs = node.actualTime;
  const hasValidTime = !isNaN(actualTimeMs);
  const percentOfMax = hasValidTime && maxTime > 0 ? (actualTimeMs / maxTime) * 100 : 0;
  const perf = hasValidTime ? getPerformanceColor(actualTimeMs) : null;

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        className={cn(
          "w-full p-4 text-left transition-all duration-200",
          "hover:bg-gray-50 active:bg-gray-100",
          isExpensive && perf?.bg,
          !hasValidTime && "cursor-default hover:bg-white",
        )}
        onClick={() => hasValidTime && setExpanded(!expanded)}
        disabled={!hasValidTime}
      >
        <div className="flex items-center gap-3">
          {/* Expand/Collapse Icon */}
          <div
            className="flex w-5 shrink-0 items-center justify-center"
            style={{ marginLeft: `${node.level * 0.75}rem` }}
          >
            {hasValidTime ? (
              <button
                className="flex items-center justify-center transition-transform"
                style={{
                  transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
            ) : (
              <div className="h-4 w-4" />
            )}
          </div>

          {/* Warning Icon */}
          {isExpensive && perf && (
            <AlertTriangle
              className="h-4 w-4 shrink-0"
              style={{ color: perf.text.split("-")[1] }}
            />
          )}

          {/* Operation Name */}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-900">{node.name}</div>
          </div>
          {/* Performance Bar */}
          {hasValidTime && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={cn("h-full transition-all duration-300", perf?.badge.split(" ")[0])}
                  style={{ width: `${Math.min(percentOfMax, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Metrics */}
          <div className="flex shrink-0 items-center gap-2">
            {hasValidTime && perf && (
              <Tooltip content={`${actualTimeMs.toFixed(3)}ms execution time`}>
                <div
                  className={cn(
                    "rounded px-2 py-1 text-xs font-semibold whitespace-nowrap",
                    perf.badge,
                  )}
                >
                  <Zap className="mr-0.5 inline h-3 w-3" />
                  {actualTimeMs > 1
                    ? `${actualTimeMs.toFixed(2)}ms`
                    : `${(actualTimeMs * 1000).toFixed(0)}µs`}
                </div>
              </Tooltip>
            )}
            {node.actualRows !== "N/A" && (
              <Tooltip content={`Rows returned`}>
                <div className="rounded bg-gray-100 px-2 py-1 text-xs font-medium whitespace-nowrap text-gray-700">
                  {formatNumber(Number(node.actualRows))} rows
                </div>
              </Tooltip>
            )}
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="animate-in fade-in space-y-4 border-t border-gray-200 bg-gray-50 px-8 py-4">
          {/* Full Operation Name */}
          <div>
            <div className="mb-1 text-xs font-semibold text-gray-600">Operation</div>
            <div className="font-mono text-sm wrap-break-word text-gray-900">{node.name}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {node.cost !== "N/A" && (
              <div>
                <div className="text-xs font-semibold text-gray-600">Estimated Cost</div>
                <div className="font-mono text-sm wrap-break-word text-gray-900">{node.cost}</div>
              </div>
            )}
            {node.rows !== "N/A" && (
              <div>
                <div className="text-xs font-semibold text-gray-600">Estimated Rows</div>
                <div className="font-mono text-sm text-gray-900">{node.rows}</div>
              </div>
            )}
            {node.time !== "N/A" && (
              <div>
                <div className="text-xs font-semibold text-gray-600">Actual Time (ms)</div>
                <div className="font-mono text-sm text-gray-900">{node.time}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ExplainOutputProps {
  output: string;
  viewMode: "smart" | "raw";
  onViewModeChange: (mode: "smart" | "raw") => void;
}

export function ExplainOutput({ output, viewMode }: ExplainOutputProps) {
  const { nodes, totals } = parsePostgresExplain(output);

  const executionTimeMs = parseFloat(totals.executionTime) || 0;
  const maxTime = Math.max(...nodes.map((n) => n.actualTime || 0));

  // Find bottleneck (slowest operation)
  const bottleneck = nodes.reduce((max, node) => {
    const time = node.actualTime || 0;
    const prevTime = max.actualTime || 0;
    return time > prevTime ? node : max;
  }, nodes[0]);

  // Find high-cost operations
  const expensiveOps = nodes.filter((n) => !isNaN(n.actualTime) && n.actualTime > 5);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Performance Summary */}
      {viewMode === "smart" && (
        <div className="border-b border-blue-200 bg-blue-50 px-6 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs font-semibold tracking-wide text-blue-600 uppercase">
                Planning
              </div>
              <div className="mt-1 text-lg font-bold text-blue-900">{totals.planningTime}</div>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-blue-600 uppercase">
                Execution
              </div>
              <div className="mt-1 text-lg font-bold text-blue-900">{totals.executionTime}</div>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-blue-600 uppercase">
                Total
              </div>
              <div className="mt-1 text-lg font-bold text-blue-900">
                {(parseFloat(totals.planningTime) + parseFloat(totals.executionTime)).toFixed(2)}
                ms
              </div>
            </div>
          </div>

          {/* Bottleneck Alert */}
          {expensiveOps.length > 0 && bottleneck && !isNaN(bottleneck.actualTime) && (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-100 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div className="text-sm">
                  <div className="font-semibold text-red-900">Bottleneck Detected</div>
                  <div className="mt-1 text-xs text-red-800">
                    <span className="font-mono">{bottleneck.name}</span> took{" "}
                    <span className="font-bold">{bottleneck.actualTime.toFixed(2)}ms</span> (
                    {((bottleneck.actualTime / executionTimeMs) * 100).toFixed(1)}% of execution
                    time)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === "smart" ? (
          <div className="divide-y divide-gray-200">
            {nodes.length > 0 && (
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
                <div className="text-xs font-semibold text-gray-600 uppercase">
                  {formatNumber(nodes.length)} Operations
                </div>
              </div>
            )}
            {nodes.map((node, idx) => {
              const isExpensive = !isNaN(node.actualTime) && node.actualTime > 5;
              return (
                <ExplainNodeRow key={idx} node={node} maxTime={maxTime} isExpensive={isExpensive} />
              );
            })}
          </div>
        ) : (
          <div className="p-6">
            <pre className="max-h-[60vh] overflow-auto rounded border border-gray-200 bg-gray-50 p-4 font-mono text-xs">
              <code>{output}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
