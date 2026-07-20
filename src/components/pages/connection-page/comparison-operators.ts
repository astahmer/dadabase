/**
 * Comparison operators suggested after a column in WHERE/ON/HAVING.
 * Includes inverted forms (NOT LIKE, NOT IN, NOT BETWEEN) for SQL completion.
 */
export const COMPARISON_OPERATORS = [
  "=",
  "!=",
  "<>",
  "<",
  ">",
  "<=",
  ">=",
  "BETWEEN",
  "NOT BETWEEN",
  "IN",
  "NOT IN",
  "LIKE",
  "NOT LIKE",
  "IS NULL",
  "IS NOT NULL",
] as const;

export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

/** Operators that express negation via a leading NOT keyword */
export const INVERTED_COMPARISON_OPERATORS = COMPARISON_OPERATORS.filter((op) =>
  op.startsWith("NOT "),
);

export const isInvertedComparisonOperator = (operator: string): boolean =>
  INVERTED_COMPARISON_OPERATORS.includes(operator as (typeof INVERTED_COMPARISON_OPERATORS)[number]);
