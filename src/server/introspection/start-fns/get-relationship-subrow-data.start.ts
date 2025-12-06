import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
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
	// Handle null/undefined values appropriately by using is_null operator
	const isNullValue =
		filterValue === null || filterValue === undefined || filterValue === "null";

	const filter: QueryFilterType = isNullValue
		? {
				conditions: [
					{
						column: filterColumn,
						operator: "is_null" as const,
					},
				],
				logicalOperator: "and" as const,
			}
		: {
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
