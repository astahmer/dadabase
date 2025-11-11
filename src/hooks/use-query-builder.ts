import type {
	FilterConditionExpression,
	LogicalOperator,
	QueryFilterType,
} from "#src/lib/query-filter";
import { filterQueryValidConditions } from "#src/lib/query-filter";

export const useQueryBuilder = (
	filter: QueryFilterType,
	setFilter: (filter: QueryFilterType) => void,
) => {
	const addCondition = () => {
		const newCondition: FilterConditionExpression = {
			column: "",
			operator: "equals",
		};
		setFilter({
			...filter,
			conditions: [...filter.conditions, newCondition],
		});
	};

	const updateCondition = (
		id: string,
		updates: Partial<FilterConditionExpression>,
	) => {
		setFilter({
			...filter,
			conditions: filter.conditions.map((c, index) =>
				String(index) === id ? { ...c, ...updates } : c,
			),
		});
	};

	const updateManyConditions = (updates: FilterConditionExpression[]) => {
		setFilter({
			...filter,
			conditions: updates,
		});
	};

	const removeCondition = (id: string) => {
		setFilter({
			...filter,
			conditions: filter.conditions.filter((_c, index) => String(index) !== id),
		});
	};

	const setLogicalOperator = (operator: LogicalOperator) => {
		setFilter({
			...filter,
			logicalOperator: operator,
		});
	};

	const clearConditions = () => {
		setFilter({
			conditions: [],
			logicalOperator: "and",
		});
	};

	const getWhereClause = () => {
		return filterQueryValidConditions(filter);
	};

	const hasActiveFilters = filter.conditions.length > 0;

	return {
		filter,
		addCondition,
		updateCondition,
		updateManyConditions,
		removeCondition,
		setLogicalOperator,
		clearConditions,
		getWhereClause,
		hasActiveFilters,
	};
};

export type QueryFilterBuilderReturn = ReturnType<typeof useQueryBuilder>;
