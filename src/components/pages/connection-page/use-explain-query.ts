import { useMutation } from "@tanstack/react-query";
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
    dialect === DatabaseDialect.LibSQL ||
    // DuckDB supports EXPLAIN ANALYZE; its {explain_key, explain_value} result
    // shape is normalized server-side in explain-query.start.ts.
    dialect === DatabaseDialect.DuckDB ||
    // CSV connections run on the same embedded engine.
    dialect === DatabaseDialect.Csv
  );
}

/**
 * Hook to manage EXPLAIN query execution for PostgreSQL and SQLite/LibSQL.
 */
export function useExplainQuery({ connectionUrl, sql, dialect }: UseExplainQueryOptions) {
  const [showExplainPanel, setShowExplainPanel] = useState(false);

  const explainQuery = useMutation({
    mutationFn: async (querySql: string | undefined) => {
      if (!isExplainSupported(dialect)) {
        return "Error: Query explain is not supported for this dialect";
      }

      if (!querySql) {
        return "Error: No SQL query to explain";
      }

      try {
        setShowExplainPanel(true);
        const result = await explainQueryServerFn({
          data: {
            url: connectionUrl,
            sql: querySql,
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

  const explain = (statementSql?: string) => {
    setShowExplainPanel(true);
    explainQuery.mutate(statementSql ?? sql);
  };

  return {
    explainQuery,
    explain,
    showExplainPanel,
    setShowExplainPanel,
    isExplainDisabled: !isExplainSupported(dialect),
  };
}
