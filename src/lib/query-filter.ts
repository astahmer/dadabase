import { Schema } from "effect";
import { nanoid } from "nanoid";

/**
 * Operators supported for filtering
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

export type FilterOperator = Schema.Schema.Type<typeof FilterOperator>;

/**
 * A single filter condition
 */
export const FilterCondition = Schema.Struct({
	id: Schema.String,
	column: Schema.String,
	operator: FilterOperator,
	value: Schema.Union(
		Schema.String,
		Schema.Number,
		Schema.Array(Schema.String),
	).pipe(Schema.optional),
	// Not serializable, but used for UI state
	isOpen: Schema.Boolean.pipe(Schema.optional),
});

export type FilterCondition = Schema.Schema.Type<typeof FilterCondition>;

/**
 * Logical operator for combining conditions
 */
export const LogicalOperator = Schema.Union(
	Schema.Literal("and"),
	Schema.Literal("or"),
);

export type LogicalOperator = Schema.Schema.Type<typeof LogicalOperator>;

/**
 * Query filter configuration
 */
export const QueryFilter = Schema.Struct({
	conditions: Schema.Array(FilterCondition),
	logicalOperator: LogicalOperator.pipe(
		Schema.optionalWith({ default: () => "and" }),
	),
});

export type QueryFilter = Schema.Schema.Type<typeof QueryFilter>;

/**
 * Convert a filter condition to SQL WHERE clause
 * Returns just the condition structure for Kysely to build properly
 */
export interface FilterConditionExpression {
	column: string;
	operator: FilterOperator;
	value?: any;
}

export interface WhereClauseParams {
	conditions: readonly FilterConditionExpression[];
	logicalOperator: LogicalOperator;
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
 * Convert filter conditions to structured format for Kysely
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

	// Convert to structured format for Kysely to handle parameterization
	const conditions: FilterConditionExpression[] = validConditions.map(
		(condition) => ({
			column: condition.column,
			operator: condition.operator,
			value: condition.value,
		}),
	);

	return {
		conditions,
		logicalOperator: filter.logicalOperator,
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
 * All available operators
 */
export const allOperators: FilterOperator[] = [
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
];

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

/**
 * Convert WhereClauseParams (from URL) back to QueryFilter with generated IDs
 * Used when deserializing filters from URL
 */
export const whereClauseParamsToQueryFilter = (
	params: WhereClauseParams | undefined,
): QueryFilter | undefined => {
	if (!params) {
		return undefined;
	}

	const conditions: FilterCondition[] = (
		params.conditions as FilterConditionExpression[]
	).map((expr) => ({
		id: nanoid(),
		column: expr.column,
		operator: expr.operator as FilterOperator,
		value: expr.value,
	}));

	return {
		conditions,
		logicalOperator: params.logicalOperator as LogicalOperator,
	};
};
