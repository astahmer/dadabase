import type { FilterOperatorType } from "#src/components/query-builder/query-filter.ts";

import { allOperators } from "#src/components/query-builder/query-filter.ts";
import {
  isBooleanDataType,
  isDateTimeDataType,
  isJsonDataType,
  isNumericDataType,
} from "#src/lib/data-type-utils.ts";

const TEXT_OPS: FilterOperatorType[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_null",
  "is_not_null",
  "in",
  "not_in",
];

const NUMERIC_OPS: FilterOperatorType[] = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "between",
  "is_null",
  "is_not_null",
  "in",
  "not_in",
];

const DATETIME_OPS: FilterOperatorType[] = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "between",
  "is_null",
  "is_not_null",
];

const BOOLEAN_OPS: FilterOperatorType[] = ["equals", "not_equals", "is_null", "is_not_null"];

const JSON_OPS: FilterOperatorType[] = [
  "equals",
  "not_equals",
  "contains",
  "is_null",
  "is_not_null",
];

/**
 * Operators that make sense for a given SQL data type.
 * Falls back to all operators when the type is unknown / text-like.
 */
export const getOperatorsForDataType = (
  dataType: string | undefined | null,
): FilterOperatorType[] => {
  if (!dataType) return [...allOperators];

  if (isBooleanDataType(dataType)) return [...BOOLEAN_OPS];
  if (isNumericDataType(dataType)) return [...NUMERIC_OPS];
  if (isDateTimeDataType(dataType)) return [...DATETIME_OPS];
  if (isJsonDataType(dataType)) return [...JSON_OPS];

  // text / uuid / enum / unknown → text-ish ops (no numeric comparisons by default)
  const normalized = dataType.toLowerCase().trim();
  if (
    normalized.includes("char") ||
    normalized.includes("text") ||
    normalized.includes("uuid") ||
    normalized.includes("citext") ||
    normalized.includes("enum")
  ) {
    return [...TEXT_OPS];
  }

  return [...allOperators];
};
