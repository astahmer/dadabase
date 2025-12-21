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

export type FilterConditionExpression = Schema.Schema.Type<
	typeof FilterCondition
>;

/**
 * Logical operator for combining conditions
 */
export const LogicalOperator = Schema.Union(
	Schema.Literal("and"),
	Schema.Literal("or"),
);

export type LogicalOperatorType = Schema.Schema.Type<typeof LogicalOperator>;

/**
 * Query filter configuration
 */
export const QueryFilter = Schema.Struct({
	conditions: Schema.Array(FilterCondition).pipe(Schema.mutable),
	logicalOperator: LogicalOperator.pipe(
		Schema.optionalWith({ default: () => "and" }),
	),
});

export interface QueryFilterType
	extends Schema.Schema.Type<typeof QueryFilter> {}

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
			baseClause = `${column} = ${paramName}`;
			params = { [paramName]: condition.value };
			break;
		}
		case "not_equals": {
			baseClause = `${column} != ${paramName}`;
			params = { [paramName]: condition.value };
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
			baseClause = `${column} > ${paramName}`;
			params = { [paramName]: condition.value };
			break;
		}
		case "greater_than_or_equal": {
			baseClause = `${column} >= ${paramName}`;
			params = { [paramName]: condition.value };
			break;
		}
		case "less_than": {
			baseClause = `${column} < ${paramName}`;
			params = { [paramName]: condition.value };
			break;
		}
		case "less_than_or_equal": {
			baseClause = `${column} <= ${paramName}`;
			params = { [paramName]: condition.value };
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
			baseClause = `${column} IN (${placeholders})`;
			params = inParams;
			nextIndex = paramIndex + values.length;
			break;
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
export const filterQueryValidConditions = (
	filter: QueryFilterType,
): QueryFilterType | null => {
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
