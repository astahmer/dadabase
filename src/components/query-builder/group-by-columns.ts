/**
 * Pure helpers for managing GROUP BY column lists in the filters UI.
 */

/** Add a column to GROUP BY if not already present. */
export const addGroupByColumn = (
  groupBy: readonly string[] | undefined,
  column: string,
): string[] => {
  const trimmed = column.trim();
  if (!trimmed) return [...(groupBy ?? [])];
  const current = groupBy ?? [];
  if (current.includes(trimmed)) return [...current];
  return [...current, trimmed];
};

/** Remove a column from GROUP BY. */
export const removeGroupByColumn = (
  groupBy: readonly string[] | undefined,
  column: string,
): string[] => (groupBy ?? []).filter((c) => c !== column);

/** Toggle a column in/out of GROUP BY. */
export const toggleGroupByColumn = (
  groupBy: readonly string[] | undefined,
  column: string,
): string[] => {
  const current = groupBy ?? [];
  if (current.includes(column)) return current.filter((c) => c !== column);
  return addGroupByColumn(current, column);
};

/** Clear all GROUP BY columns. */
export const clearGroupByColumns = (): string[] => [];

/**
 * Common aggregate expressions suggested in HAVING column pickers.
 */
export const HAVING_EXPRESSION_SUGGESTIONS = [
  "COUNT(*)",
  "COUNT(1)",
  "SUM()",
  "AVG()",
  "MIN()",
  "MAX()",
] as const;
