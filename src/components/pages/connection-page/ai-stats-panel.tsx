import type { AiStatsPanelData } from "#src/lib/ai/ai-stats.ts";

import { AiStatsJsonRenderer, aiStatsToJsonRenderSpec } from "#src/lib/ai/json-render-catalog.tsx";
import { cn } from "#src/lib/utils.ts";

interface AiStatsPanelProps {
  data: AiStatsPanelData;
  className?: string;
}

/**
 * Generative UI for AI chart/stat results via @json-render/react.
 */
export const AiStatsPanel = ({ data, className }: AiStatsPanelProps) => {
  const spec = aiStatsToJsonRenderSpec(data);
  return (
    <div className={cn(className)} data-testid="ai-stats-json-render">
      <AiStatsJsonRenderer spec={spec} />
    </div>
  );
};
