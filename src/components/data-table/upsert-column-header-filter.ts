import type {
  FilterConditionExpression,
  FilterOperatorType,
} from "#src/components/query-builder/query-filter.ts";

export type ColumnHeaderFilterOperator = Extract<FilterOperatorType, "equals" | "contains">;

export interface ColumnHeaderFilterInput {
  column: string;
  operator: ColumnHeaderFilterOperator;
  value: string;
}

/**
 * Add or update a single-column equals/contains filter.
 * Empty value removes any existing equals/contains condition for that column.
 */
export function upsertColumnHeaderFilter(
  conditions: readonly FilterConditionExpression[],
  input: ColumnHeaderFilterInput,
): FilterConditionExpression[] {
  const trimmed = input.value.trim();
  const withoutColumn = conditions.filter(
    (c) =>
      !(
        c.column === input.column &&
        (c.operator === "equals" || c.operator === "contains") &&
        !c.inverted
      ),
  );

  if (!trimmed) {
    return withoutColumn;
  }

  return [
    ...withoutColumn,
    {
      column: input.column,
      operator: input.operator,
      value: trimmed,
    },
  ];
}

/** Active equals/contains filter for a column, if any. */
export function getColumnHeaderFilter(
  conditions: readonly FilterConditionExpression[],
  column: string,
): ColumnHeaderFilterInput | undefined {
  const match = conditions.find(
    (c) =>
      c.column === column &&
      (c.operator === "equals" || c.operator === "contains") &&
      !c.inverted &&
      c.value != null &&
      String(c.value).length > 0,
  );
  if (!match) return undefined;
  return {
    column,
    operator: match.operator as ColumnHeaderFilterOperator,
    value: String(match.value),
  };
}
