import { DatabaseDialect } from "#src/db/dialect.ts";
import { explainQueryServerFn } from "#src/server/introspection/start-fns/explain-query.start.ts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface UseExplainQueryOptions {
  connectionUrl: string;
  sql: string | undefined;
  dialect: DatabaseDialect;
}

/**
 * Hook to manage EXPLAIN query execution for PostgreSQL databases
 * Returns the query object and panel state management
 */
export function useExplainQuery({ connectionUrl, sql, dialect }: UseExplainQueryOptions) {
  const [showExplainPanel, setShowExplainPanel] = useState(false);

  const explainQuery = useQuery({
    enabled: false,
    queryKey: ["remote", "explain", sql],
    queryFn: async () => {
      if (dialect !== DatabaseDialect.Postgres) {
        alert("Query explain is only supported for PostgreSQL databases");
        return;
      }

      if (!sql) {
        alert("No SQL query to explain");
        return;
      }

      try {
        setShowExplainPanel(true);
        const result = await explainQueryServerFn({
          data: {
            url: connectionUrl,
            sql,
          },
        });

        if (result) {
          return result.plan;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to explain query";
        return `Error: ${message}`;
      }
    },
  });

  return {
    explainQuery,
    showExplainPanel,
    setShowExplainPanel,
    isExplainDisabled: dialect !== DatabaseDialect.Postgres,
  };
}
