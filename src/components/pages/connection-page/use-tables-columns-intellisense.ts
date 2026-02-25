import { getAllTablesColumnsQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-columns.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { useQuery } from "@tanstack/react-query";

interface UseTablesColumnsForIntellisenseOptions {
  connectionUrl: string;
  schema: string | undefined;
}

/**
 * Hook to fetch tables and columns for SQL editor intellisense
 */
export function useTablesColumnsForIntellisense({
  connectionUrl,
  schema,
}: UseTablesColumnsForIntellisenseOptions) {
  const tablesQuery = useQuery({
    ...listAvailableTablesQueryOptions({
      url: connectionUrl,
      schema,
    }),
    enabled: !!schema,
  });

  const columnsQuery = useQuery({
    ...getAllTablesColumnsQueryOptions({
      url: connectionUrl,
      schema: schema!,
    }),
    enabled: !!schema,
  });

  return {
    tables: tablesQuery.data || [],
    columns: columnsQuery.data ?? [],
    isLoading: tablesQuery.isLoading || columnsQuery.isLoading,
  };
}
