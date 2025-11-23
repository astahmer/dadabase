import { sql } from "kysely";
import type {
	FilterConditionExpression,
	LogicalOperator,
} from "#src/lib/query-filter";

/**
 * Build a WHERE clause expression from filter conditions
 * Used by multiple query functions to avoid duplication
 */
export const buildWhereExpression = (
	conditions: FilterConditionExpression[],
	logicalOp: LogicalOperator,
) => {
	if (conditions.length === 0) return undefined;

	// Filter out conditions with undefined or null values (except for is_null/is_not_null operators)
	const validConditions = conditions.filter((condition) => {
		// is_null and is_not_null don't require a value
		if (
			condition.operator === "is_null" ||
			condition.operator === "is_not_null"
		) {
			return true;
		}
		// All other operators require a defined, non-null value
		return condition.value !== undefined && condition.value !== null;
	});

	if (validConditions.length === 0) return undefined;

	const expressions = validConditions.map((condition) => {
		const colRef = sql.ref(condition.column);

		switch (condition.operator) {
			case "equals":
				return sql`${colRef} = ${condition.value}`;
			case "not_equals":
				return sql`${colRef} != ${condition.value}`;
			case "contains":
				return sql`${colRef} ILIKE ${"%" + condition.value + "%"}`;
			case "not_contains":
				return sql`${colRef} NOT ILIKE ${"%" + condition.value + "%"}`;
			case "starts_with":
				return sql`${colRef} ILIKE ${condition.value + "%"}`;
			case "ends_with":
				return sql`${colRef} ILIKE ${"%" + condition.value}`;
			case "greater_than":
				return sql`${colRef} > ${condition.value}`;
			case "greater_than_or_equal":
				return sql`${colRef} >= ${condition.value}`;
			case "less_than":
				return sql`${colRef} < ${condition.value}`;
			case "less_than_or_equal":
				return sql`${colRef} <= ${condition.value}`;
			case "is_null":
				return sql`${colRef} IS NULL`;
			case "is_not_null":
				return sql`${colRef} IS NOT NULL`;
			case "in": {
				const values = Array.isArray(condition.value)
					? condition.value
					: [condition.value];
				return sql`${colRef} = ANY(${values})`;
			}
			case "not_in": {
				const values = Array.isArray(condition.value)
					? condition.value
					: [condition.value];
				return sql`${colRef} != ALL(${values})`;
			}
			default:
				const _exhaustive: never = condition.operator;
				return _exhaustive;
		}
	});

	if (expressions.length === 0) return undefined;
	if (expressions.length === 1) return expressions[0];

	// Combine expressions with AND/OR
	if (logicalOp === "and") {
		return expressions.reduce((acc, expr) => sql`${acc} AND ${expr}`);
	} else {
		return expressions.reduce((acc, expr) => sql`${acc} OR ${expr}`);
	}
};
