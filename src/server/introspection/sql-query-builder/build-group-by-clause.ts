import type {
  LogicalOperatorType,
  QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";

import {
  isNullSpecialValue,
  isSpecialValue,
  resolveSpecialSqlLiteral,
} from "#src/components/query-builder/query-filter.ts";

import { escapeIdentifier, escapeValue } from "../escape-value.ts";

/**
 * Format a GROUP BY / HAVING left-hand expression.
 * Plain identifiers are quoted; aggregates/expressions (contain `(`) stay raw.
 */
export const formatGroupByExpression = (expr: string): string => {
  const trimmed = expr.trim();
  if (!trimmed) return "";
  if (/[()]/.test(trimmed) || /\s/.test(trimmed)) return trimmed;
  return escapeIdentifier(trimmed);
};

/**
 * Build `GROUP BY col1, col2` clause, or empty string when none.
 */
export const buildGroupByClause = (groupBy?: readonly string[]): string => {
  if (!groupBy?.length) return "";
  const cols = groupBy.map(formatGroupByExpression).filter(Boolean);
  if (cols.length === 0) return "";
  return `GROUP BY ${cols.join(", ")}`;
};

const formatLiteral = (value: unknown): string => {
  if (isSpecialValue(value)) return resolveSpecialSqlLiteral(String(value));
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${escapeValue(value)}'`;
};

const comparison = (col: string, op: string, value: unknown): string => {
  if (isNullSpecialValue(value)) {
    if (op === "=") return `${col} IS NULL`;
    if (op === "!=") return `${col} IS NOT NULL`;
  }
  return `${col} ${op} ${formatLiteral(value)}`;
};

/**
 * Build a single HAVING condition (left side may be aggregate expression).
 */
export const havingConditionToSql = (
  condition: QueryFilterType["conditions"][number],
): string | null => {
  const col = formatGroupByExpression(condition.column);
  if (!col) return null;

  const inverted = condition.inverted ?? false;
  let base: string;

  switch (condition.operator) {
    case "equals":
      base = comparison(col, "=", condition.value);
      break;
    case "not_equals":
      base = comparison(col, "!=", condition.value);
      break;
    case "greater_than":
      base = comparison(col, ">", condition.value);
      break;
    case "greater_than_or_equal":
      base = comparison(col, ">=", condition.value);
      break;
    case "less_than":
      base = comparison(col, "<", condition.value);
      break;
    case "less_than_or_equal":
      base = comparison(col, "<=", condition.value);
      break;
    case "is_null":
      base = `${col} IS NULL`;
      break;
    case "is_not_null":
      base = `${col} IS NOT NULL`;
      break;
    case "between": {
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      const low = values[0];
      const high = values[1];
      if (low === undefined || high === undefined) return null;
      base = `${col} BETWEEN ${formatLiteral(low)} AND ${formatLiteral(high)}`;
      break;
    }
    case "in": {
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      if (!values.length) return null;
      base = `${col} IN (${values.map(formatLiteral).join(", ")})`;
      break;
    }
    case "not_in": {
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      if (!values.length) return null;
      base = `${col} NOT IN (${values.map(formatLiteral).join(", ")})`;
      break;
    }
    default:
      // Text search ops are uncommon in HAVING; skip rather than emit invalid SQL
      return null;
  }

  return inverted ? `NOT (${base})` : base;
};

/**
 * Build `HAVING ...` clause from a QueryFilter, or empty string when none.
 */
export const buildHavingClause = (having?: QueryFilterType): string => {
  if (!having?.conditions.length) return "";

  const parts = having.conditions.map(havingConditionToSql).filter((p): p is string => Boolean(p));

  if (parts.length === 0) return "";

  const joiner = (having.logicalOperator as LogicalOperatorType) === "or" ? " OR " : " AND ";
  return `HAVING ${parts.join(joiner)}`;
};
