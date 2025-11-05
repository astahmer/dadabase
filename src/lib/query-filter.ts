import { z } from "zod";

/**
 * Operators supported for filtering
 */
export const FilterOperator = z.enum([
	"equals",
	"not_equals",
	"contains",
	"not_contains",
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
]);

export type FilterOperator = z.infer<typeof FilterOperator>;

/**
 * A single filter condition
 */
export const FilterCondition = z.object({
	id: z.string(),
	column: z.string(),
	operator: FilterOperator,
	value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
	// Not serializable, but used for UI state
	isOpen: z.boolean().optional(),
});

export type FilterCondition = z.infer<typeof FilterCondition>;

/**
 * Logical operator for combining conditions
 */
export const LogicalOperator = z.enum(["and", "or"]);
export type LogicalOperator = z.infer<typeof LogicalOperator>;

/**
 * Query filter configuration
 */
export const QueryFilter = z.object({
	conditions: z.array(FilterCondition),
	logicalOperator: LogicalOperator.default("and"),
});

export type QueryFilter = z.infer<typeof QueryFilter>;

/**
 * Convert a filter condition to SQL WHERE clause
 * This generates parameterized queries
 */
export interface WhereClauseParams {
	whereClause: string;
	params: Record<string, any>;
}

export const conditionToWhereClause = (
	condition: FilterCondition,
	paramIndex: number,
): { clause: string; params: Record<string, any>; nextIndex: number } => {
	const paramName = `$${paramIndex}`;
	const column = `"${condition.column}"`;
	let nextIndex = paramIndex + 1;

	switch (condition.operator) {
		case "equals":
			return {
				clause: `${column} = ${paramName}`,
				params: { [paramName]: condition.value },
				nextIndex,
			};
		case "not_equals":
			return {
				clause: `${column} != ${paramName}`,
				params: { [paramName]: condition.value },
				nextIndex,
			};
		case "contains":
			return {
				clause: `${column} LIKE ${paramName}`,
				params: { [paramName]: `%${condition.value}%` },
				nextIndex,
			};
		case "not_contains":
			return {
				clause: `${column} NOT LIKE ${paramName}`,
				params: { [paramName]: `%${condition.value}%` },
				nextIndex,
			};
		case "starts_with":
			return {
				clause: `${column} LIKE ${paramName}`,
				params: { [paramName]: `${condition.value}%` },
				nextIndex,
			};
		case "ends_with":
			return {
				clause: `${column} LIKE ${paramName}`,
				params: { [paramName]: `%${condition.value}` },
				nextIndex,
			};
		case "greater_than":
			return {
				clause: `${column} > ${paramName}`,
				params: { [paramName]: condition.value },
				nextIndex,
			};
		case "greater_than_or_equal":
			return {
				clause: `${column} >= ${paramName}`,
				params: { [paramName]: condition.value },
				nextIndex,
			};
		case "less_than":
			return {
				clause: `${column} < ${paramName}`,
				params: { [paramName]: condition.value },
				nextIndex,
			};
		case "less_than_or_equal":
			return {
				clause: `${column} <= ${paramName}`,
				params: { [paramName]: condition.value },
				nextIndex,
			};
		case "is_null":
			return {
				clause: `${column} IS NULL`,
				params: {},
				nextIndex,
			};
		case "is_not_null":
			return {
				clause: `${column} IS NOT NULL`,
				params: {},
				nextIndex,
			};
		case "in": {
			const values = Array.isArray(condition.value)
				? condition.value
				: [condition.value];
			const placeholders = values
				.map((_, i) => `$${paramIndex + i}`)
				.join(", ");
			const inParams: Record<string, any> = {};
			values.forEach((val, i) => {
				inParams[`$${paramIndex + i}`] = val;
			});
			return {
				clause: `${column} IN (${placeholders})`,
				params: inParams,
				nextIndex: paramIndex + values.length,
			};
		}
		case "not_in": {
			const values = Array.isArray(condition.value)
				? condition.value
				: [condition.value];
			const placeholders = values
				.map((_, i) => `$${paramIndex + i}`)
				.join(", ");
			const inParams: Record<string, any> = {};
			values.forEach((val, i) => {
				inParams[`$${paramIndex + i}`] = val;
			});
			return {
				clause: `${column} NOT IN (${placeholders})`,
				params: inParams,
				nextIndex: paramIndex + values.length,
			};
		}
		default:
			const _exhaustive: never = condition.operator;
			return _exhaustive;
	}
};

/**
 * Convert filter conditions to a WHERE clause string and params
 */
export const filterToWhereClause = (
	filter: QueryFilter,
): WhereClauseParams | null => {
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

	const allParams: Record<string, any> = {};
	let paramIndex = 1;
	const clauses: string[] = [];

	for (const condition of validConditions) {
		const { clause, params, nextIndex } = conditionToWhereClause(
			condition,
			paramIndex,
		);
		clauses.push(clause);
		Object.assign(allParams, params);
		paramIndex = nextIndex;
	}

	const whereClause = clauses.join(` ${filter.logicalOperator.toUpperCase()} `);

	return {
		whereClause,
		params: allParams,
	};
};

/**
 * Operators that don't require a value
 */
export const nullOperators: FilterOperator[] = ["is_null", "is_not_null"];

/**
 * Operators that support array values (in, not_in)
 */
export const arrayOperators: FilterOperator[] = ["in", "not_in"];

/**
 * Get operator display name
 */
export const getOperatorLabel = (operator: FilterOperator): string => {
	const labels: Record<FilterOperator, string> = {
		equals: "Equals",
		not_equals: "Not Equals",
		contains: "Contains",
		not_contains: "Does Not Contain",
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
