import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { MessageCircleQuestion, Plus, Search, Table2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { TableWithColumnsMetadata } from "#src/server/introspection/introspection.ts";

import { getDialectDefaultSchema } from "#src/db/dialect.ts";
import { getStoredPageLimit } from "#src/lib/default-page-limit.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";

import type { DbConnection } from "../connection.types";

import { ErrorBoundaryCard } from "../../shared/error-boundary-card.tsx";
import { Button } from "../../ui/button";
import { VirtualizerArea } from "../../ui/virtualizer-area.tsx";
import {
  aiTabSearchUpdate,
  createTabState,
  updateTabState,
  useActiveTabState,
} from "./create-tab-state.ts";
import { getRecentTables, recordRecentTable, type RecentTable } from "./recent-tables.ts";

interface EmptyTabState {
  activeConnectionUrl: string;
  connection: DbConnection;
  tables: Array<{ schema: string; name: string }>;
  columns: Array<TableWithColumnsMetadata>;
  tablesUnavailable?: boolean;
}

/** Substring filter over schema+name, case-insensitive; exported for tests. */
export const filterTablesByQuery = (
  tables: Array<{ schema?: string | null; name: string }>,
  query: string,
) => {
  const q = query.trim().toLowerCase();
  if (!q) return tables;
  return tables.filter(
    (table) =>
      table.name.toLowerCase().includes(q) || (table.schema ?? "").toLowerCase().includes(q),
  );
};

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

      {/* Primary surface: searchable table listbox */}
      {mode === "table" && (
        <TableSearchListbox
          connection={connection}
          activeConnectionUrl={activeConnectionUrl}
          selectedSchema={selectedSchema}
          tablesUnavailable={props.tablesUnavailable}
        />
      )}

      {/* Secondary: quick actions + recents */}
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

const useOpenTable = (activeConnectionUrl: string, connection: DbConnection) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const queryClient = useQueryClient();
  const selectedSchema = useActiveTabState((s) => s.schema);
  const { connectionName } = useConnectionNameParam();

  return (tableName: string, tableSchema?: string) => {
    const schema = tableSchema || selectedSchema || getDialectDefaultSchema(connection.dialect);
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

/** Primary new-tab surface: searchable, keyboard-navigable table listbox. */
const TableSearchListbox = (props: {
  connection: DbConnection;
  activeConnectionUrl: string;
  selectedSchema: string;
  tablesUnavailable?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [filterText, setFilterText] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  // The fallback empty state may have no active tab yet, so its schema is "" —
  // fall back to the dialect default so the table query always runs.
  const effectiveSchema = props.selectedSchema || getDialectDefaultSchema(props.connection.dialect);

  // Autofocus once the hydrated UI mounts (component renders null until then).
  // Retry briefly: other surfaces (sidebar, palette restore) can steal focus late.
  useEffect(() => {
    inputRef.current?.focus();
    const retries = [60, 180, 400].map((delay) =>
      setTimeout(() => {
        const el = inputRef.current;
        if (el && document.activeElement !== el && document.activeElement === document.body) {
          el.focus();
        }
      }, delay),
    );
    return () => retries.forEach(clearTimeout);
  }, []);

  const tablesListQuery = useQuery({
    ...listAvailableTablesQueryOptions({
      url: props.activeConnectionUrl,
      schema: effectiveSchema,
    }),
    enabled: !props.tablesUnavailable,
    retry: 3,
  });
  const tableList = tablesListQuery.data ?? [];

  const filteredTables = useMemo(
    () => filterTablesByQuery(tableList, filterText),
    [tableList, filterText],
  );

  // Keep the highlight inside bounds as the filter shrinks/grows the list.
  useEffect(() => {
    setHighlightIndex((index) => Math.min(index, Math.max(filteredTables.length - 1, 0)));
  }, [filteredTables.length]);

  const openTable = useOpenTable(props.activeConnectionUrl, props.connection);
  void effectiveSchema;

  const scrollToHighlighted = (index: number) => {
    const container = listRef.current?.querySelector("[data-virtual-root]");
    container
      ?.querySelector(`[data-option-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  const moveHighlight = (delta: number) => {
    setHighlightIndex((index) => {
      const next = Math.min(Math.max(index + delta, 0), Math.max(filteredTables.length - 1, 0));
      requestAnimationFrame(() => scrollToHighlighted(next));
      return next;
    });
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveHighlight(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveHighlight(-1);
        break;
      case "Home":
        event.preventDefault();
        setHighlightIndex(0);
        requestAnimationFrame(() => scrollToHighlighted(0));
        break;
      case "End":
        event.preventDefault();
        setHighlightIndex(Math.max(filteredTables.length - 1, 0));
        requestAnimationFrame(() => scrollToHighlighted(Math.max(filteredTables.length - 1, 0)));
        break;
      case "Enter": {
        event.preventDefault();
        const table = filteredTables[highlightIndex];
        if (table) openTable(table.name, table.schema ?? undefined);
        break;
      }
      case "Escape":
        if (filterText) {
          event.preventDefault();
          setFilterText("");
        } else {
          inputRef.current?.blur();
        }
        break;
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-foreground mb-1 text-xl font-semibold">Select a table</h2>
        <p className="text-muted-foreground text-sm">Choose a table to view and explore its data</p>
      </div>

      <div className="relative mt-3">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          ref={inputRef}
          value={filterText}
          autoFocus
          placeholder="Search tables..."
          onChange={(e) => setFilterText(e.target.value)}
          onKeyDown={onInputKeyDown}
          data-testid="empty-tab-search-input"
          aria-label="Search tables"
          role="combobox"
          aria-expanded={!tablesListQuery.isLoading}
          aria-controls="empty-tab-list"
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-lg border py-2.5 pr-4 pl-10 shadow-sm transition-all focus-visible:border-transparent focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      {props.tablesUnavailable ? (
        <div
          className="text-muted-foreground py-8 text-center text-sm"
          data-testid="empty-tab-tables-unavailable"
        >
          Tables are unavailable until this connection is reachable.
        </div>
      ) : tablesListQuery.isError ? (
        <ErrorBoundaryCard
          error={tablesListQuery.error}
          title="Could not load tables"
          onRetry={() => tablesListQuery.refetch()}
          className="mt-3"
        />
      ) : tablesListQuery.isLoading ? (
        <div className="text-muted-foreground py-8 text-center text-sm">Loading tables...</div>
      ) : filteredTables.length === 0 ? (
        <div className="border-muted-foreground/30 bg-muted/20 mt-3 rounded-lg border border-dashed p-6 text-center">
          <span className="text-muted-foreground text-sm">
            {tableList.length === 0 ? "No tables available" : `No tables match "${filterText}"`}
          </span>
          {filterText ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 ml-2"
              onClick={() => setFilterText("")}
            >
              Clear search
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          ref={listRef}
          className="border-input bg-card mt-3 flex max-h-[420px] flex-col overflow-hidden rounded-lg border shadow-sm"
        >
          <VirtualizerArea count={filteredTables.length}>
            {({ virtualItems, totalSize, paddingTop, paddingBottom }) => (
              <div data-virtual-root>
                <div
                  id="empty-tab-list"
                  role="listbox"
                  aria-label="Tables"
                  style={{ height: `${totalSize}px` }}
                  className="relative"
                >
                  {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}
                  {virtualItems.map((virtualItem) => {
                    const table = filteredTables[virtualItem.index];
                    if (!table) return null;
                    const isHighlighted = virtualItem.index === highlightIndex;
                    const isLast = virtualItem.index === filteredTables.length - 1;
                    const showSchemaPrefix = table.schema !== effectiveSchema;

                    return (
                      <div
                        key={`${table.schema}.${table.name}`}
                        role="option"
                        aria-selected={isHighlighted}
                        data-option-index={virtualItem.index}
                        data-testid={`empty-tab-option-${table.name}`}
                        tabIndex={-1}
                        onMouseMove={() => setHighlightIndex(virtualItem.index)}
                        onClick={() => openTable(table.name, table.schema ?? undefined)}
                        className={`hover:bg-accent hover:text-accent-foreground cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                          isHighlighted ? "bg-accent text-accent-foreground" : ""
                        } ${!isLast ? "border-border/50 border-b" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <Table2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium">{table.name}</span>
                          {showSchemaPrefix ? (
                            <span className="text-muted-foreground text-xs">{table.schema}</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {paddingBottom > 0 && <div style={{ height: `${paddingBottom}px` }} />}
                </div>
                <div className="bg-muted/50 border-border/50 text-muted-foreground border-t px-4 py-2 text-xs">
                  {filteredTables.length} table{filteredTables.length !== 1 ? "s" : ""} available
                </div>
              </div>
            )}
          </VirtualizerArea>
        </div>
      )}
    </div>
  );
};

const EmptyTabLauncher = (props: {
  connection: DbConnection;
  activeConnectionUrl: string;
  selectedSchema: string;
}) => {
  const { connectionName } = useConnectionNameParam();
  const [recents, setRecents] = useState<Array<RecentTable>>(() => getRecentTables(connectionName));

  useEffect(() => {
    setRecents(getRecentTables(connectionName));
  }, [connectionName]);

  const openTable = useOpenTable(props.activeConnectionUrl, props.connection);
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const openSqlTab = () => {
    navigate({
      search: (prev) => {
        const schema = props.selectedSchema || getDialectDefaultSchema(props.connection.dialect);
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
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Quick actions
        </h3>
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
            onClick={() => navigate({ search: (prev) => aiTabSearchUpdate(prev) })}
            data-testid="launcher-ask-ai"
          >
            <MessageCircleQuestion className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="block font-medium">New AI chat</span>
              <span className="text-muted-foreground block text-xs">
                Query your data in plain language
              </span>
            </span>
          </Button>
        </div>
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
