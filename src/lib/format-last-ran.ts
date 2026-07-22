import { DateTime } from "effect";

import { formatRelativeTime } from "./format-relative-time.ts";

/** Epoch / missing timestamps mean the query has never completed. */
export const hasValidRanAt = (ranAt: number | null | undefined): ranAt is number =>
  typeof ranAt === "number" && Number.isFinite(ranAt) && ranAt > 0;

export const formatRanAtIso = (ranAt: number): string | null => {
  if (!hasValidRanAt(ranAt)) return null;
  return DateTime.formatIso(DateTime.unsafeMake(ranAt));
};

export const formatRefreshTooltip = (ranAt: number): string => {
  const iso = formatRanAtIso(ranAt);
  if (!iso) return "Refresh rows (not run yet)";
  return `Refresh rows (last ran at ${iso})`;
};

export const formatLoadedRelativeLabel = (ranAt: number): string | null => {
  if (!hasValidRanAt(ranAt)) return null;
  return `Loaded ${formatRelativeTime(ranAt)}`;
};
