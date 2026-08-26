import { useNavigate, useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircleQuestion, Plus, Table2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { TableWithColumnsMetadata } from "#src/server/introspection/introspection.ts";

import { getDialectDefaultSchema } from "#src/db/dialect.ts";
import { getStoredPageLimit } from "#src/lib/default-page-limit.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";

import type { DbConnection } from "../connection.types";

import { Button } from "../../ui/button";
import { createTabState, updateTabState, useActiveTabState } from "./create-tab-state.ts";
import { getRecentTables, recordRecentTable, type RecentTable } from "./recent-tables.ts";

interface EmptyTabState {
  activeConnectionUrl: string;
  connection: DbConnection;
  tables: Array<{ schema: string; name: string }>;
  columns: Array<TableWithColumnsMetadata>;
}

export const EmptyTabState = (props: EmptyTabState) => {
  const { activeConnectionUrl, connection } = props;

  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const mode = useActiveTabState((s) => s.initialTabMode ?? "table");
  const selectedSchema = useActiveTabState((s) => s.schema);

  // Defer interactive UI until after hydration — clicking these buttons on the
  // SSR-rendered markup would hit elements whose handlers aren't attached yet.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  if (!isMounted) {
    return null;
  }

  // The sidebar is the single authoritative table navigator; this surface is a
  // launcher (recents + quick actions), so no second table list lives here.
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col gap-4 py-2">
      {/* Mode Tabs */}
      <div className="flex gap-2 border-b">
        <Button
          variant={mode === "table" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            navigate({
              search: (prev) => {
                // If we're in fallback state (no real tab), create a new one
                if (!prev.tabs?.length) {
                  const schema = selectedSchema || getDialectDefaultSchema(connection.dialect);
                  const newTab = createTabState(schema, "");

                  return {
                    ...prev,
                    ...newTab,
                    tabs: [...(prev.tabs ?? []), newTab],
                    activeTabId: newTab.tabId,
                    initialTabMode: "table",
                  };
                }

                return updateTabState(prev, { initialTabMode: "table" });
              },
            });
          }}
          className="data-active:border-primary rounded-none border-b-2 border-transparent px-4 py-2"
          data-active={mode === "table"}
        >
          Browse Tables
        </Button>
        <Button
          variant={mode === "sql" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            navigate({
              search: (prev) => {
                // If we're in fallback state (no real tab), create a new one
                if (!prev.tabs?.length) {
                  const schema = selectedSchema || getDialectDefaultSchema(connection.dialect);
                  const newTab = createTabState(schema, "", {
                    initialTabMode: "sql",
                  });

                  return {
                    ...prev,
                    ...newTab,
                    tabs: [...(prev.tabs ?? []), newTab],
                    activeTabId: newTab.tabId,
                  };
                }

                return updateTabState(prev, { initialTabMode: "sql" });
              },
            });
          }}
          className="data-active:border-primary rounded-none border-b-2 border-transparent px-4 py-2"
          data-active={mode === "sql"}
        >
          Custom SQL
        </Button>
      </div>

      {/* Launcher */}
      {mode === "table" && (
        <EmptyTabLauncher
          connection={props.connection}
          activeConnectionUrl={activeConnectionUrl}
          selectedSchema={selectedSchema}
        />
      )}
    </div>
  );
};

/** Pick a table straight into a browse tab (shared by recents + future launchers). */
const useOpenTable = (activeConnectionUrl: string, connection: DbConnection) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const queryClient = useQueryClient();
  const selectedSchema = useActiveTabState((s) => s.schema);
  const { connectionName } = useConnectionNameParam();

  return (tableName: string) => {
    const schema = selectedSchema || getDialectDefaultSchema(connection.dialect);
    recordRecentTable(connectionName, schema, tableName);

    queryClient.prefetchQuery({
      ...queryTableDataQueryOptions({
        url: activeConnectionUrl,
        schema,
        table: tableName,
        limit: getStoredPageLimit(),
        offset: 0,
        orderBy: undefined,
        orderDirection: undefined,
        filters: {
          conditions: [],
          logicalOperator: "and",
        },
      }),
    });

    navigate({
      search: (prev) => {
        const currentTab = (prev.tabs ?? []).find((t) => t.tabId === prev.activeTabId);
        const isCurrentTabEmpty = !currentTab?.table;
        const newTab = createTabState(schema, tableName);

        // Replace the empty tab
        if (isCurrentTabEmpty && currentTab) {
          return {
            ...prev,
            ...updateTabState(prev, {
              ...newTab,
              tabId: currentTab.tabId,
              initialTabMode: undefined,
            }),
            schema,
            table: tableName,
            offset: 0,
          };
        }

        // Add a new tab otherwise
        return {
          ...prev,
          ...newTab,
          tabs: [...(prev.tabs ?? []), newTab],
          activeTabId: newTab.tabId,
        };
      },
    });
  };
};

// Tiny helper so hooks above can read the route param without prop drilling.
const useConnectionNameParam = () =>
  useParams({ from: "/connections/$connectionName" }) as { connectionName: string };

const EmptyTabLauncher = (props: {
  connection: DbConnection;
  activeConnectionUrl: string;
  selectedSchema: string;
}) => {
  const { connectionName } = useConnectionNameParam();
  const [recents, setRecents] = useState<Array<RecentTable>>(() =>
    getRecentTables(connectionName),
  );

  // Re-read when the launcher mounts for a different connection.
  useEffect(() => {
    setRecents(getRecentTables(connectionName));
  }, [connectionName]);

  const openTable = useOpenTable(props.activeConnectionUrl, props.connection);
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const openSqlTab = () => {
    navigate({
      search: (prev) => {
        const schema =
          props.selectedSchema || getDialectDefaultSchema(props.connection.dialect);
        const newTab = createTabState(schema, "", { initialTabMode: "sql" });
        const currentTab = (prev.tabs ?? []).find((t) => t.tabId === prev.activeTabId);

        if (currentTab && !currentTab.table) {
          return {
            ...prev,
            ...updateTabState(prev, {
              ...newTab,
              tabId: currentTab.tabId,
              initialTabMode: "sql",
            }),
          };
        }

        return {
          ...prev,
          ...newTab,
          tabs: [...(prev.tabs ?? []), newTab],
          activeTabId: newTab.tabId,
        };
      },
    });
  };

  return (
    <div className="flex flex-col gap-5 py-6">
      <div>
        <h2 className="text-foreground mb-1 text-xl font-semibold">What would you like to do?</h2>
        <p className="text-muted-foreground text-sm">
          Pick a table from the sidebar to browse it — or start from one of these.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          className="h-auto items-start justify-start gap-3 p-4 text-left"
          onClick={openSqlTab}
          data-testid="launcher-new-sql"
        >
          <Plus className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="block font-medium">New SQL query</span>
            <span className="text-muted-foreground block text-xs">
              Open the custom SQL workspace
            </span>
          </span>
        </Button>
        <Button
          variant="outline"
          className="h-auto items-start justify-start gap-3 p-4 text-left"
          onClick={() =>
            navigate({ to: "/connections/$connectionName/ai", params: { connectionName } })
          }
          data-testid="launcher-ask-ai"
        >
          <MessageCircleQuestion className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="block font-medium">Ask AI</span>
            <span className="text-muted-foreground block text-xs">
              Query your data in plain language
            </span>
          </span>
        </Button>
      </div>

      {recents.length > 0 && (
        <div>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Recent tables
          </h3>
          <div className="flex flex-wrap gap-2">
            {recents.map((entry) => (
              <Button
                key={`${entry.schema}.${entry.table}`}
                variant="outline"
                size="sm"
                onClick={() => openTable(entry.table)}
                data-testid={`launcher-recent-${entry.table}`}
              >
                <Table2 className="h-3.5 w-3.5" />
                {entry.schema !== props.selectedSchema ? (
                  <span className="text-muted-foreground">{entry.schema}.</span>
                ) : null}
                {entry.table}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
