const DEFAULT_SAFE_LIMIT = 100;

const hasExplicitLimit = (sql: string): boolean =>
  /\bLIMIT\s+(\d+|ALL)\b/i.test(sql) || /\bFETCH\s+(FIRST|NEXT)\s+\d+/i.test(sql);

const userAskedForUnlimited = (sql: string): boolean =>
  /\bLIMIT\s+ALL\b/i.test(sql) || /\/\*\s*no[- ]?limit\s*\*\//i.test(sql);

const looksLikeSelect = (sql: string): boolean => {
  const trimmed = sql.trim().replace(/^\(+/, "");
  return /^(WITH|SELECT)\b/i.test(trimmed);
};

/**
 * Appends `LIMIT 100` to SELECT/WITH queries that lack an explicit LIMIT,
 * unless the SQL already opts out (`LIMIT ALL` or a `no-limit` marker comment).
 * Prevents accidental full-table scans from freezing the UI.
 */
export const ensureSafeSelectLimit = (sql: string, limit: number = DEFAULT_SAFE_LIMIT): string => {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (!trimmed) return sql;
  if (!looksLikeSelect(trimmed)) return sql;
  if (hasExplicitLimit(trimmed) || userAskedForUnlimited(trimmed)) return sql;

  return `${trimmed}\nLIMIT ${limit}`;
};

export const SAFE_SELECT_LIMIT_DEFAULT = DEFAULT_SAFE_LIMIT;
