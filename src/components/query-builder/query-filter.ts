import { Schema } from "effect";
import { nanoid } from "nanoid";

/**
 * Operators supported for filtering
 * Note: Use the inverted flag for logical negation (NOT LIKE, NOT (...))
 * but NOT for operators that are already negations (!=, NOT IN, IS NOT NULL, NOT LIKE)
 */
export const FilterOperator = Schema.Union(
  Schema.Literal("equals"),
  Schema.Literal("not_equals"),
  Schema.Literal("contains"),
  Schema.Literal("not_contains"),
  Schema.Literal("starts_with"),
  Schema.Literal("ends_with"),
  Schema.Literal("greater_than"),
  Schema.Literal("greater_than_or_equal"),
  Schema.Literal("less_than"),
  Schema.Literal("less_than_or_equal"),
  Schema.Literal("is_null"),
  Schema.Literal("is_not_null"),
  Schema.Literal("in"),
  Schema.Literal("not_in"),
);

export type FilterOperatorType = Schema.Schema.Type<typeof FilterOperator>;

/**
 * A single filter condition
 */
export const FilterCondition = Schema.Struct({
  column: Schema.String,
  table: Schema.String.pipe(Schema.optional),
  operator: FilterOperator,
  inverted: Schema.Boolean.pipe(Schema.optional),
  value: Schema.Union(
    Schema.String,
    Schema.Number,
    Schema.Boolean,
    Schema.Null,
    Schema.Array(Schema.String),
  ).pipe(Schema.optional),
});

export type FilterConditionExpression = Schema.Schema.Type<typeof FilterCondition>;

/**
 * Logical operator for combining conditions
 */
export const LogicalOperator = Schema.Union(Schema.Literal("and"), Schema.Literal("or"));

export type LogicalOperatorType = Schema.Schema.Type<typeof LogicalOperator>;

/**
 * Query filter configuration
 */
export const QueryFilter = Schema.Struct({
  conditions: Schema.Array(FilterCondition).pipe(Schema.mutable),
  logicalOperator: LogicalOperator.pipe(Schema.optionalWith({ default: () => "and" })),
});

export interface QueryFilterType extends Schema.Schema.Type<typeof QueryFilter> {}

const comparisonClause = (
  column: string,
  sqlOp: "=" | "!=" | ">" | ">=" | "<" | "<=",
  value: unknown,
  paramName: string,
): { clause: string; params: Record<string, any> } => {
  if (isNullSpecialValue(value)) {
    // `col = NULL` is never true in SQL — use IS NULL / IS NOT NULL instead
    if (sqlOp === "=") return { clause: `${column} IS NULL`, params: {} };
    if (sqlOp === "!=") return { clause: `${column} IS NOT NULL`, params: {} };
  }
  if (isSpecialValue(value)) {
    return { clause: `${column} ${sqlOp} ${resolveSpecialSqlLiteral(value)}`, params: {} };
  }
  return { clause: `${column} ${sqlOp} ${paramName}`, params: { [paramName]: value } };
};

export const conditionToWhereClause = (
  condition: FilterConditionExpression,
  paramIndex: number,
): { clause: string; params: Record<string, any>; nextIndex: number } => {
  const paramName = `$${paramIndex}`;
  const column = `"${condition.column}"`;
  let nextIndex = paramIndex + 1;
  const inverted = condition.inverted ?? false;

  let baseClause: string;
  let params: Record<string, any>;

  switch (condition.operator) {
    case "equals": {
      ({ clause: baseClause, params } = comparisonClause(column, "=", condition.value, paramName));
      break;
    }
    case "not_equals": {
      ({ clause: baseClause, params } = comparisonClause(column, "!=", condition.value, paramName));
      break;
    }
    case "contains": {
      baseClause = `${column} LIKE ${paramName}`;
      params = { [paramName]: `%${condition.value}%` };
      break;
    }
    case "not_contains": {
      baseClause = `${column} NOT LIKE ${paramName}`;
      params = { [paramName]: `%${condition.value}%` };
      break;
    }
    case "starts_with": {
      baseClause = `${column} LIKE ${paramName}`;
      params = { [paramName]: `${condition.value}%` };
      break;
    }
    case "ends_with": {
      baseClause = `${column} LIKE ${paramName}`;
      params = { [paramName]: `%${condition.value}` };
      break;
    }
    case "greater_than": {
      ({ clause: baseClause, params } = comparisonClause(column, ">", condition.value, paramName));
      break;
    }
    case "greater_than_or_equal": {
      ({ clause: baseClause, params } = comparisonClause(column, ">=", condition.value, paramName));
      break;
    }
    case "less_than": {
      ({ clause: baseClause, params } = comparisonClause(column, "<", condition.value, paramName));
      break;
    }
    case "less_than_or_equal": {
      ({ clause: baseClause, params } = comparisonClause(column, "<=", condition.value, paramName));
      break;
    }
    case "is_null": {
      baseClause = `${column} IS NULL`;
      params = {};
      break;
    }
    case "is_not_null": {
      baseClause = `${column} IS NOT NULL`;
      params = {};
      break;
    }
    case "in": {
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(", ");
      const inParams: Record<string, any> = {};
      values.forEach((val, i) => {
        inParams[`$${paramIndex + i}`] = val;
      });
      baseClause = `${column} IN (${placeholders})`;
      params = inParams;
      nextIndex = paramIndex + values.length;
      break;
    }
    case "not_in": {
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(", ");
      const inParams: Record<string, any> = {};
      values.forEach((val, i) => {
        inParams[`$${paramIndex + i}`] = val;
      });
      baseClause = `${column} NOT IN (${placeholders})`;
      params = inParams;
      nextIndex = paramIndex + values.length;
      break;
    }
    default:
      const _exhaustive: never = condition.operator;
      return _exhaustive;
  }

  // Apply inversion with NOT if needed (for operators like NOT LIKE, NOT (...))
  const finalClause = inverted ? `NOT (${baseClause})` : baseClause;

  return {
    clause: finalClause,
    params,
    nextIndex,
  };
};

/**
 * Convert filter conditions to structured format for Kysely
 */
export const filterQueryValidConditions = (filter: QueryFilterType): QueryFilterType | null => {
  // Filter out incomplete conditions (missing column or value where required)
  const validConditions = filter.conditions.filter((condition) => {
    // Column is required
    if (!condition.column || condition.column.trim() === "") {
      return false;
    }
    // Value is required for non-null operators
    if (
      !nullOperators.includes(condition.operator) &&
      (condition.value === undefined ||
        condition.value === null ||
        condition.value === "" ||
        (Array.isArray(condition.value) && condition.value.length === 0))
    ) {
      return false;
    }
    return true;
  });

  if (validConditions.length === 0) {
    return null;
  }

  return {
    conditions: validConditions,
    logicalOperator: filter.logicalOperator,
  };
};

/**
 * Operators that don't require a value
 */
export const nullOperators: FilterOperatorType[] = ["is_null", "is_not_null"];

/**
 * Operators that support array values (in, not_in)
 */
export const arrayOperators: FilterOperatorType[] = ["in", "not_in"];

/**
 * All available operators
 */
export const allOperators: FilterOperatorType[] = [
  "equals",
  "not_equals",
  "contains",
  "starts_with",
  "ends_with",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "is_null",
  "is_not_null",
  "in",
  "not_in",
];

/**
 * Get operator display name
 */
export const getOperatorLabel = (operator: FilterOperatorType): string => {
  const labels: Record<FilterOperatorType, string> = {
    equals: "Equals",
    not_equals: "Not Equals",
    contains: "Contains",
    not_contains: "Not Contains",
    starts_with: "Starts With",
    ends_with: "Ends With",
    greater_than: "Greater Than",
    greater_than_or_equal: "Greater Than or Equal",
    less_than: "Less Than",
    less_than_or_equal: "Less Than or Equal",
    is_null: "Is Null",
    is_not_null: "Is Not Null",
    in: "In",
    not_in: "Not In",
  };
  return labels[operator];
};

/**
 * Special SQL values that should not be parameterized / quoted.
 * `TODAY()` is accepted as an alias for `CURRENT_DATE` (invalid in PG/SQLite as a function).
 */
export const SPECIAL_VALUES = {
  NULL: "null",
  NOW: "NOW()",
  TODAY: "TODAY()",
  CURRENT_DATE: "CURRENT_DATE",
  CURRENT_TIMESTAMP: "CURRENT_TIMESTAMP",
  CURRENT_TIME: "CURRENT_TIME",
} as const;

export type SpecialValueKey = keyof typeof SPECIAL_VALUES;
export type SpecialValue = (typeof SPECIAL_VALUES)[SpecialValueKey];

/**
 * List of special values for UI dropdowns (TODAY() omitted — use CURRENT_DATE)
 */
export const SPECIAL_VALUES_LIST: { label: string; value: SpecialValue }[] = [
  { label: "NULL", value: SPECIAL_VALUES.NULL },
  { label: "NOW()", value: SPECIAL_VALUES.NOW },
  { label: "CURRENT_DATE", value: SPECIAL_VALUES.CURRENT_DATE },
  { label: "CURRENT_TIMESTAMP", value: SPECIAL_VALUES.CURRENT_TIMESTAMP },
  { label: "CURRENT_TIME", value: SPECIAL_VALUES.CURRENT_TIME },
];

/**
 * Check if a value is a special SQL value (case-insensitive)
 */
export const isSpecialValue = (value: unknown): value is SpecialValue => {
  if (typeof value !== "string") return false;
  return Object.values(SPECIAL_VALUES).some((sv) => sv.toLowerCase() === value.toLowerCase());
};

/** True when the filter value represents SQL NULL */
export const isNullSpecialValue = (value: unknown): boolean => {
  return typeof value === "string" && value.toLowerCase() === SPECIAL_VALUES.NULL;
};

/**
 * Normalize a special filter value to a valid unquoted SQL literal.
 * Maps aliases (TODAY → CURRENT_DATE) and canonicalizes casing.
 */
export const resolveSpecialSqlLiteral = (value: string): string => {
  const lower = value.toLowerCase();
  if (lower === SPECIAL_VALUES.NULL) return "NULL";
  if (lower === "today()" || lower === SPECIAL_VALUES.CURRENT_DATE.toLowerCase()) {
    return SPECIAL_VALUES.CURRENT_DATE;
  }
  if (lower === "now()") return SPECIAL_VALUES.NOW;
  if (lower === SPECIAL_VALUES.CURRENT_TIMESTAMP.toLowerCase()) {
    return SPECIAL_VALUES.CURRENT_TIMESTAMP;
  }
  if (lower === SPECIAL_VALUES.CURRENT_TIME.toLowerCase()) {
    return SPECIAL_VALUES.CURRENT_TIME;
  }
  return value;
};

/**
 * Operators that support special values
 */
export const specialValueSupportedOperators: FilterOperatorType[] = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
];

/**
 * Get operator symbol alternatives
 */
export const getOperatorSymbols = (operator: FilterOperatorType): string[] => {
  const symbols: Record<FilterOperatorType, string[]> = {
    equals: ["="],
    not_equals: ["!=", "<>"],
    contains: ["LIKE"],
    not_contains: ["NOT LIKE"],
    starts_with: [],
    ends_with: [],
    greater_than: [">"],
    greater_than_or_equal: [">="],
    less_than: ["<"],
    less_than_or_equal: ["<="],
    is_null: ["IS NULL"],
    is_not_null: ["IS NOT NULL"],
    in: ["IN"],
    not_in: ["NOT IN"],
  };
  return symbols[operator];
};

/**
 * Convert WhereClauseParams (from URL) back to QueryFilter with generated IDs
 * Used when deserializing filters from URL
 */
/**
 * Toggle the inverted flag on a filter condition.
 * Used by the filter UI NOT button and covered by unit tests.
 */
export const toggleConditionInverted = (
  condition: FilterConditionExpression,
): FilterConditionExpression => ({
  ...condition,
  inverted: !condition.inverted,
});

/**
 * Convert WhereClauseParams (from URL) back to QueryFilter with generated IDs
 * Used when deserializing filters from URL
 */
export const whereClauseParamsToQueryFilter = (
  params: QueryFilterType | undefined,
): QueryFilterType | undefined => {
  if (!params) {
    return undefined;
  }

  const conditions: FilterConditionExpression[] = (
    params.conditions as FilterConditionExpression[]
  ).map((expr) => ({
    id: nanoid(),
    column: expr.column,
    operator: expr.operator as FilterOperatorType,
    inverted: expr.inverted,
    value: expr.value,
  }));

  return {
    conditions,
    logicalOperator: params.logicalOperator as LogicalOperatorType,
  };
};

