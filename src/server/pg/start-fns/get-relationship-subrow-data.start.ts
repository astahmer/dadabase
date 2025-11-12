import type { QueryFilterType } from "#src/lib/query-filter.ts";
import { queryTableDataQueryOptions } from "./query-table-data.start";

/**
 * Query options for fetching related rows from a referencing table
 * Filters by the parent row's primary key value
 */
export const queryRelationshipSubrowDataQueryOptions = (input: {
	url: string;
	schema: string;
	table: string;
	filterColumn: string;
	filterValue: unknown;
	limit?: number;
	offset?: number;
}) => {
	const {
		url,
		schema,
		table,
		filterColumn,
		filterValue,
		limit = 50,
		offset = 0,
	} = input;

	// Build a filter for the relationship column
	const filter: QueryFilterType = {
		conditions: [
			{
				column: filterColumn,
				operator: "equals" as const,
				value: String(filterValue),
			},
		],
		logicalOperator: "and" as const,
	};

	// Reuse the existing query table data function with the filter
	return queryTableDataQueryOptions({
		url,
		schema,
		table,
		filters: filter,
		limit,
		offset,
	});
};
