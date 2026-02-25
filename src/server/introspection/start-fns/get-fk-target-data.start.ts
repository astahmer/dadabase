import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";

import { queryTableDataQueryOptions } from "./query-table-data.start";

/**
 * Query options for fetching the related record from the referenced table (following FK)
 * For outgoing relationships: fetch from referencedTable where referencedColumn = fkValue
 * This shows the "Related Data" - the actual record pointed to by the foreign key
 */
export const queryFkTargetDataQueryOptions = (input: {
  url: string;
  schema: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
  fkValue: unknown;
  limit?: number;
  offset?: number;
}) => {
  const {
    url,
    referencedSchema,
    referencedTable,
    referencedColumn,
    fkValue,
    limit = 50,
    offset = 0,
  } = input;

  // Build a filter for the referenced column
  const isNullValue = fkValue === null || fkValue === undefined || fkValue === "null";

  const filter: QueryFilterType = isNullValue
    ? {
        conditions: [
          {
            column: referencedColumn,
            operator: "is_null" as const,
          },
        ],
        logicalOperator: "and" as const,
      }
    : {
        conditions: [
          {
            column: referencedColumn,
            operator: "equals" as const,
            value: String(fkValue),
          },
        ],
        logicalOperator: "and" as const,
      };

  // Reuse the existing query table data function with the filter
  return queryTableDataQueryOptions({
    url,
    schema: referencedSchema,
    table: referencedTable,
    filters: filter,
    limit,
    offset,
  });
};
