import { describe, expect, it } from "vitest";

import type { AiStatsPanelData } from "./ai-stats.ts";

import { aiResultTableToJsonRenderSpec, aiStatsToJsonRenderSpec } from "./json-render-catalog.tsx";

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

  it("maps result rows into a constrained readable table spec", () => {
    const spec = aiResultTableToJsonRenderSpec({
      columns: [{ key: "display_name", label: "Display name" }],
      rows: [{ display_name: "Ada", internal: { shouldNotRenderAsObject: true } }],
    });

    expect(spec.elements.root.props).toEqual({
      columns: [{ key: "display_name", label: "Display name" }],
      rows: [{ display_name: "Ada" }],
    });
  });
});
