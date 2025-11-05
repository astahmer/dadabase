import { useCallback, useState } from "react";
import type {
	FilterCondition,
	QueryFilter,
	LogicalOperator,
} from "#src/lib/query-filter";
import { filterToWhereClause } from "#src/lib/query-filter";
import { nanoid } from "nanoid";

export const useQueryBuilder = (initialFilter?: QueryFilter) => {
	const [filter, setFilter] = useState<QueryFilter>(
		initialFilter || {
			conditions: [],
			logicalOperator: "and",
		},
	);

	// Add a new condition
	const addCondition = useCallback(() => {
		const newCondition: FilterCondition = {
			id: nanoid(),
			column: "",
			operator: "equals",
		};
		setFilter((prev) => ({
			...prev,
			conditions: [...prev.conditions, newCondition],
		}));
	}, []);

	// Update a condition
	const updateCondition = useCallback(
		(id: string, updates: Partial<FilterCondition>) => {
			setFilter((prev) => ({
				...prev,
				conditions: prev.conditions.map((c) =>
					c.id === id ? { ...c, ...updates } : c,
				),
			}));
		},
		[],
	);

	// Remove a condition
	const removeCondition = useCallback((id: string) => {
		setFilter((prev) => ({
			...prev,
			conditions: prev.conditions.filter((c) => c.id !== id),
		}));
	}, []);

	// Update logical operator
	const setLogicalOperator = useCallback((operator: LogicalOperator) => {
		setFilter((prev) => ({
			...prev,
			logicalOperator: operator,
		}));
	}, []);

	// Clear all conditions
	const clearConditions = useCallback(() => {
		setFilter({
			conditions: [],
			logicalOperator: "and",
		});
	}, []);

	// Get the WHERE clause SQL
	const getWhereClause = useCallback(() => {
		return filterToWhereClause(filter);
	}, [filter]);

	// Check if any filters are active
	const hasActiveFilters = filter.conditions.length > 0;

	return {
		filter,
		setFilter,
		addCondition,
		updateCondition,
		removeCondition,
		setLogicalOperator,
		clearConditions,
		getWhereClause,
		hasActiveFilters,
	};
};
