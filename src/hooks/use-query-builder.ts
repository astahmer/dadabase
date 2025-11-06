import { useCallback, useState } from "react";
import type {
	FilterCondition,
	QueryFilter,
	LogicalOperator,
} from "#src/lib/query-filter";
import { filterToWhereClause } from "#src/lib/query-filter";
import { nanoid } from "nanoid";

export const useQueryBuilder = (
	initialFilter?: QueryFilter,
	onFilterChange?: (filter: QueryFilter) => void,
) => {
	const [filter, setFilter] = useState<QueryFilter>(
		initialFilter || {
			conditions: [],
			logicalOperator: "and",
		},
	);

	// Wrapper to notify parent of filter changes
	const updateFilter = useCallback(
		(newFilter: QueryFilter) => {
			setFilter(newFilter);
			onFilterChange?.(newFilter);
		},
		[onFilterChange],
	);

	// Add a new condition
	const addCondition = useCallback(() => {
		const newCondition: FilterCondition = {
			id: nanoid(),
			column: "",
			operator: "equals",
		};
		updateFilter({
			...filter,
			conditions: [...filter.conditions, newCondition],
		});
	}, [filter, updateFilter]);

	// Update a condition
	const updateCondition = useCallback(
		(id: string, updates: Partial<FilterCondition>) => {
			updateFilter({
				...filter,
				conditions: filter.conditions.map((c) =>
					c.id === id ? { ...c, ...updates } : c,
				),
			});
		},
		[filter, updateFilter],
	);

	// Remove a condition
	const removeCondition = useCallback(
		(id: string) => {
			updateFilter({
				...filter,
				conditions: filter.conditions.filter((c) => c.id !== id),
			});
		},
		[filter, updateFilter],
	);

	// Update logical operator
	const setLogicalOperator = useCallback(
		(operator: LogicalOperator) => {
			updateFilter({
				...filter,
				logicalOperator: operator,
			});
		},
		[filter, updateFilter],
	);

	// Clear all conditions
	const clearConditions = useCallback(() => {
		updateFilter({
			conditions: [],
			logicalOperator: "and",
		});
	}, [updateFilter]);

	// Get the WHERE clause SQL
	const getWhereClause = useCallback(() => {
		return filterToWhereClause(filter);
	}, [filter]);

	// Check if any filters are active
	const hasActiveFilters = filter.conditions.length > 0;

	return {
		filter,
		addCondition,
		updateCondition,
		removeCondition,
		setLogicalOperator,
		clearConditions,
		getWhereClause,
		hasActiveFilters,
	};
};
