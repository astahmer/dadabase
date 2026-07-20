import { describe, expect, it } from "vitest";

import type { AiStatsPanelData } from "./ai-stats.ts";

import { aiStatsToJsonRenderSpec } from "./json-render-catalog.tsx";

describe("aiStatsToJsonRenderSpec", () => {
  it("maps bar stats into a json-render Spec", () => {
    const data: AiStatsPanelData = {
      type: "bar",
      title: "By status",
      data: [
        { label: "active", value: 3 },
        { label: "done", value: 1 },
      ],
    };

    expect(aiStatsToJsonRenderSpec(data)).toEqual({
      root: "root",
      elements: {
        root: {
          type: "StatsPanel",
          props: {
            title: "By status",
            variant: "bar",
            data: data.data,
          },
          children: [],
        },
      },
    });
  });

  it("maps stat variant", () => {
    const data: AiStatsPanelData = {
      type: "stat",
      title: "Totals",
      data: [{ label: "rows", value: 10 }],
    };
    expect(aiStatsToJsonRenderSpec(data).elements.root.props.variant).toBe("stat");
  });
});
