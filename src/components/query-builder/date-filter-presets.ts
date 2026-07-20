import type { FilterOperatorType } from "#src/components/query-builder/query-filter.ts";

export type DateFilterPresetId =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year";

/**
 * Preset result suitable for a single filter condition (`between` or comparison ops).
 * Values are local-calendar ISO date strings (`YYYY-MM-DD`).
 */
export type DateFilterPresetResult = {
  operator: Extract<
    FilterOperatorType,
    "between" | "greater_than_or_equal" | "less_than_or_equal" | "equals"
  >;
  value: string | [string, string];
};

export const DATE_FILTER_PRESETS: ReadonlyArray<{
  id: DateFilterPresetId;
  label: string;
}> = [
  { id: "today", label: "Today" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_year", label: "This year" },
  { id: "last_year", label: "Last year" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local-calendar ISO date (`YYYY-MM-DD`). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const next = startOfLocalDay(d);
  next.setDate(next.getDate() + days);
  return next;
}

function between(from: Date, to: Date): DateFilterPresetResult {
  return { operator: "between", value: [toIsoDate(from), toIsoDate(to)] };
}

/**
 * Resolve a date-range preset relative to `now` (injectable for tests).
 * Rolling windows are inclusive of today; month/year cover full calendar periods.
 */
export function getDateFilterPreset(
  id: DateFilterPresetId,
  now: Date = new Date(),
): DateFilterPresetResult {
  const today = startOfLocalDay(now);

  switch (id) {
    case "today":
      return between(today, today);
    case "last_7_days":
      // Inclusive: today and the 6 preceding days → 7 calendar days
      return between(addDays(today, -6), today);
    case "last_30_days":
      return between(addDays(today, -29), today);
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return between(start, end);
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return between(start, end);
    }
    case "this_year": {
      const y = today.getFullYear();
      return between(new Date(y, 0, 1), new Date(y, 11, 31));
    }
    case "last_year": {
      const y = today.getFullYear() - 1;
      return between(new Date(y, 0, 1), new Date(y, 11, 31));
    }
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
