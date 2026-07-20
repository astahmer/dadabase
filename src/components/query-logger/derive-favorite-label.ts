/**
 * Derive a short label for a saved SQL favorite from the query text.
 */
export const deriveFavoriteLabel = (sql: string, maxLen = 48): string => {
  const compact = sql.replace(/\s+/g, " ").trim();
  if (!compact) return "Untitled query";
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen - 1)}…`;
};
