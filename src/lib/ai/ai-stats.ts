import { z } from "zod";

/**
 * Minimal generative-UI schema for charts/stats (json-render deferred).
 * AI tools / models can return this shape; AiStatsPanel renders it.
 */
export const aiStatDatumSchema = z.object({
  label: z.string(),
  value: z.number(),
});

export const aiStatsPanelSchema = z.object({
  type: z.enum(["bar", "stat"]),
  title: z.string(),
  data: z.array(aiStatDatumSchema),
});

export type AiStatDatum = z.infer<typeof aiStatDatumSchema>;
export type AiStatsPanelData = z.infer<typeof aiStatsPanelSchema>;

/** Parse unknown JSON into AiStatsPanelData; returns null on failure. */
export const parseAiStatsPanelData = (value: unknown): AiStatsPanelData | null => {
  const result = aiStatsPanelSchema.safeParse(value);
  return result.success ? result.data : null;
};

/** Build a bar/stat panel from simple label/value rows (e.g. GROUP BY result). */
export const aiStatsFromRows = (
  title: string,
  rows: readonly { label: string; value: number }[],
  type: "bar" | "stat" = "bar",
): AiStatsPanelData => ({
  type,
  title,
  data: rows.map((r) => ({ label: r.label, value: r.value })),
});
