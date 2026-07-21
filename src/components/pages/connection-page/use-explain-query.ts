import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { explainQueryServerFn } from "#src/server/introspection/start-fns/explain-query.start.ts";

interface UseExplainQueryOptions {
  connectionUrl: string;
  sql: string | undefined;
  dialect: DatabaseDialect;
}

function isExplainSupported(dialect: DatabaseDialect): boolean {
  return (
    dialect === DatabaseDialect.Postgres ||
    dialect === DatabaseDialect.SQLite ||
    dialect === DatabaseDialect.LibSQL
  );
}

/**
 * Hook to manage EXPLAIN query execution for PostgreSQL and SQLite/LibSQL.
 */
export function useExplainQuery({ connectionUrl, sql, dialect }: UseExplainQueryOptions) {
  const [showExplainPanel, setShowExplainPanel] = useState(false);

  const explainQuery = useQuery({
    enabled: false,
    queryKey: ["remote", "explain", dialect, sql],
    queryFn: async () => {
      if (!isExplainSupported(dialect)) {
        return "Error: Query explain is not supported for this dialect";
      }

      if (!sql) {
        return "Error: No SQL query to explain";
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
    isExplainDisabled: !isExplainSupported(dialect),
  };
}
