/**
 * Build ORDER BY clause for SQL queries
 * Handles column name, direction (asc/desc), and NULLS FIRST/LAST
 */
export const buildOrderByClause = (
  orderBy: string | undefined,
  orderDirection: "asc" | "desc" = "asc",
  nullsOrder?: "first" | "last",
): string => {
  if (!orderBy) return "";

  let clause = `ORDER BY ${orderBy} ${orderDirection.toUpperCase()}`;

  if (nullsOrder) {
    clause += ` NULLS ${nullsOrder.toUpperCase()}`;
  }

  return clause;
};

/**
 * Build LIMIT and OFFSET clauses
 */
export const buildLimitClause = (limit?: number, offset?: number): string => {
  const clauses: string[] = [];

  if (limit !== undefined && limit >= 0) {
    clauses.push(`LIMIT ${limit}`);
  }

  if (offset !== undefined && offset > 0) {
    clauses.push(`OFFSET ${offset}`);
  }

  return clauses.join(" ");
};
