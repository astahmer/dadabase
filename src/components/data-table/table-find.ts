/**
 * Client-side find/highlight helpers for loaded table rows.
 * Case-insensitive substring match over cell string values.
 */

export function normalizeFindQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Stringify a cell value for matching (null/undefined → empty). */
export function cellValueToSearchText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function cellValueMatchesQuery(value: unknown, query: string): boolean {
  const q = normalizeFindQuery(query);
  if (!q) return false;
  return cellValueToSearchText(value).toLowerCase().includes(q);
}

export function rowMatchesFindQuery(
  row: Record<string, unknown>,
  query: string,
  columnIds?: readonly string[],
): boolean {
  const q = normalizeFindQuery(query);
  if (!q) return false;
  const keys = columnIds ?? Object.keys(row);
  return keys.some((key) => cellValueMatchesQuery(row[key], q));
}

/** Column ids in `row` whose values match the query. */
export function getMatchingColumnIds(
  row: Record<string, unknown>,
  query: string,
  columnIds?: readonly string[],
): string[] {
  const q = normalizeFindQuery(query);
  if (!q) return [];
  const keys = columnIds ?? Object.keys(row);
  return keys.filter((key) => cellValueMatchesQuery(row[key], q));
}

export function filterRowsByFindQuery<T extends Record<string, unknown>>(
  rows: readonly T[],
  query: string,
  columnIds?: readonly string[],
): T[] {
  const q = normalizeFindQuery(query);
  if (!q) return [...rows];
  return rows.filter((row) => rowMatchesFindQuery(row, q, columnIds));
}

/** Stable key for a matching cell: `${rowId}::${columnId}`. */
export function findMatchCellKey(rowId: string, columnId: string): string {
  return `${rowId}::${columnId}`;
}

export function buildFindMatchCellKeys(
  rows: ReadonlyArray<{ id: string; original: Record<string, unknown> }>,
  query: string,
  columnIds?: readonly string[],
): Set<string> {
  const q = normalizeFindQuery(query);
  const keys = new Set<string>();
  if (!q) return keys;
  for (const row of rows) {
    for (const columnId of getMatchingColumnIds(row.original, q, columnIds)) {
      keys.add(findMatchCellKey(row.id, columnId));
    }
  }
  return keys;
}
