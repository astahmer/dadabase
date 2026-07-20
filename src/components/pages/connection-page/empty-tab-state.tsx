import type { TableWithColumnsMetadata } from "#src/server/introspection/introspection.ts";

import { toaster } from "#src/components/ui/toaster.tsx";
import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import { fromPixelToPercentage } from "#src/lib/calculate-percentage-from-pixels.ts";
import { getStoredPageLimit } from "#src/lib/default-page-limit.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";
import { createListCollection, Listbox } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import type { DbConnection } from "../connection.types";

import { Button } from "../../ui/button";
import { VirtualizerArea } from "../../ui/virtualizer-area.tsx";
import { createTabState, updateTabState, useActiveTabState } from "./create-tab-state.ts";
import { extractSelectedTables } from "./sql-completion-helper.ts";
import { SqlMonacoEditor } from "./sql-monaco-editor.tsx";
import { parseSqlQuery } from "./sql-query-parser.ts";

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

  const tablesListQuery = useQuery({
    ...listAvailableTablesQueryOptions({ url: activeConnectionUrl, schema: selectedSchema }),
    enabled: !!selectedSchema,
    retry: 3,
  });

  if (tablesListQuery.isLoading) {
    return (
      <div className="text-center">
        <span className="text-muted-foreground">Loading tables...</span>
      </div>
    );
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

      {/* Table Selection Mode */}
      {mode === "table" && (
        <TableSelectionTab
          activeConnectionUrl={activeConnectionUrl}
          connection={connection}
          selectedSchema={selectedSchema}
          tables={props.tables}
          columns={props.columns}
        />
      )}

      {/* Custom SQL Mode */}
      {mode === "sql" && (
        <CustomSqlTab
          selectedSchema={selectedSchema}
          connection={connection}
          tables={props.tables}
          columns={props.columns}
        />
      )}
    </div>
  );
};

const TableSelectionTab = (props: {
  activeConnectionUrl: string;
  connection: DbConnection;
  selectedSchema: string;
  tables: Array<{ schema: string; name: string }>;
  columns: Array<TableWithColumnsMetadata>;
}) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const queryClient = useQueryClient();

  const inputRef = useRef<HTMLInputElement>(null);
  const [filterText, setFilterText] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });

  const isNotSqlite = !(
    props.connection.dialect === DatabaseDialect.SQLite ||
    props.connection.dialect === DatabaseDialect.LibSQL
  );

  const tablesListQuery = useQuery({
    ...listAvailableTablesQueryOptions({
      url: props.activeConnectionUrl,
      schema: props.selectedSchema,
    }),
    enabled: !!props.selectedSchema,
    retry: 3,
  });
  const tableList = tablesListQuery.data || [];
  const filteredTables = useMemo(
    () =>
      tableList.filter(
        (table) =>
          (filterText ? contains(table.name, filterText) : true) &&
          (isNotSqlite ? props.selectedSchema === table.schema : true),
      ),
    [tableList, filterText, props.selectedSchema, contains, isNotSqlite],
  );

  const tableCollection = useMemo(
    () =>
      createListCollection({
        items: filteredTables.map((t) => ({
          label: t.name,
          value: t.name,
        })),
      }),
    [filteredTables],
  );

  const handleTableSelect = (tableName: string) => {
    const schema = props.selectedSchema || getDialectDefaultSchema(props.connection.dialect);
    const newTab = createTabState(schema, tableName);

    queryClient.prefetchQuery({
      ...queryTableDataQueryOptions({
        url: props.activeConnectionUrl,
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

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-foreground mb-1 text-xl font-semibold">Select a table</h2>
        <p className="text-muted-foreground text-sm">Choose a table to view and explore its data</p>
      </div>

      <Listbox.Root
        collection={tableCollection}
        onSelect={(details) => {
          handleTableSelect(details.value);
        }}
      >
        {/* Search Input */}
        <div className="relative">
          <svg
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Listbox.Input
            ref={inputRef}
            placeholder="Search tables..."
            value={filterText}
            autoFocus
            onChange={(e) => setFilterText(e.target.value)}
            className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-lg border py-2.5 pr-4 pl-10 shadow-sm transition-all focus-visible:border-transparent focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>

        {/* Tables List */}
        {filteredTables.length === 0 ? (
          <div className="border-muted-foreground/30 bg-muted/20 rounded-lg border border-dashed p-8 text-center">
            <svg
              className="text-muted-foreground/40 mx-auto mb-3 h-10 w-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6m0 0v6m0-6h6m0 0h6M6 12a6 6 0 11-0.001.001A6.002 6.002 0 016 12z"
              />
            </svg>
            <span className="text-muted-foreground text-sm">
              {tableList.length === 0 ? "No tables available" : "No tables match your search"}
            </span>
          </div>
        ) : (
          <div className="border-input bg-card mt-4 flex flex-col overflow-hidden rounded-lg border shadow-sm">
            <VirtualizerArea count={filteredTables.length}>
              {({ virtualItems, totalSize, paddingTop, paddingBottom }) => (
                <>
                  <div style={{ height: `${totalSize}px` }} className="relative">
                    {/* Padding for virtualizer */}
                    {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}

                    <Listbox.Content>
                      <Listbox.ItemGroup>
                        {virtualItems.map((virtualItem) => {
                          const table = filteredTables[virtualItem.index];
                          if (!table) return null;

                          const isLast = virtualItem.index === filteredTables.length - 1;

                          return (
                            <Listbox.Item
                              key={table.name}
                              item={{
                                label: table.name,
                                value: table.name,
                              }}
                              className={`hover:bg-accent hover:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                                !isLast ? "border-border/50 border-b" : ""
                              }`}
                            >
                              <Listbox.ItemText className="flex items-center gap-2">
                                <span className="font-medium">{table.name}</span>
                              </Listbox.ItemText>
                            </Listbox.Item>
                          );
                        })}
                      </Listbox.ItemGroup>
                    </Listbox.Content>

                    {/* Padding for virtualizer */}
                    {paddingBottom > 0 && <div style={{ height: `${paddingBottom}px` }} />}
                  </div>

                  {/* Footer with count */}
                  <div className="bg-muted/50 border-border/50 text-muted-foreground border-t px-4 py-2 text-xs">
                    {filteredTables.length} table
                    {filteredTables.length !== 1 ? "s" : ""} available
                  </div>
                </>
              )}
            </VirtualizerArea>
          </div>
        )}
      </Listbox.Root>
    </div>
  );
};

const CustomSqlTab = (props: {
  selectedSchema: string;
  connection: DbConnection;
  tables: Array<{ schema: string; name: string }>;
  columns: Array<TableWithColumnsMetadata>;
}) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const customSql = useActiveTabState((s) => s.customSql ?? "");
  const onCustomSqlChange = useDebouncedCallback(
    (value: string) => {
      // Get available column names from all columns
      const allAvailableColumns = props.columns.flatMap((tc) => tc.columns.map((c) => c.name));

      // Parse the SQL query to extract filters, sorting, pagination
      const parsedState = parseSqlQuery(value, allAvailableColumns);
      const extractedTables = extractSelectedTables(value);
      console.log(parsedState, extractedTables);

      return navigate({
        search: (prev) =>
          updateTabState(prev, {
            customSql: value,
            // Apply parsed state updates
            ...parsedState,
          }),
      });
    },
    { wait: 500 },
  );

  const handleCustomSqlSubmit = () => {
    if (!customSql.trim()) return;

    const schema = props.selectedSchema || getDialectDefaultSchema(props.connection.dialect);
    const extractedTables = extractSelectedTables(customSql);
    const firstTable = extractedTables.at(0);

    if (!firstTable?.table) {
      toaster.create({
        title: "Failed to detect table",
        description: "Could not detect table from your SQL query",
      });
      return;
    }

    // Use the extracted schema if available, otherwise use selected schema
    const effectiveSchema = firstTable.schema || schema;
    const table = firstTable.table;

    navigate({
      search: (prev) => {
        const currentTab = (prev.tabs ?? []).find((t) => t.tabId === prev.activeTabId);
        const isCurrentTabEmpty = !currentTab?.table;

        const newTab = createTabState(effectiveSchema, table, {
          tabName: `${table} (custom)`,
        });

        // Replace the empty tab
        if (isCurrentTabEmpty && currentTab) {
          return {
            ...prev,
            ...newTab,
            ...updateTabState(prev, {
              table,
              customSql,
              sqlEditorMode: "editor",
              sqlPreviewSize: 100 - fromPixelToPercentage(250, "vertical"),
              initialTabMode: undefined,
              tabName: `${table} (custom)`,
            }),
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

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-foreground mb-1 text-xl font-semibold">Enter custom SQL</h2>
        <p className="text-muted-foreground text-sm">Write your own SQL query and execute it</p>
      </div>

      {/* SQL Input Area */}
      <div className="flex flex-col gap-2">
        <SqlMonacoEditor
          sql={customSql}
          onChange={onCustomSqlChange}
          className="h-48"
          tables={props.tables}
          columns={props.columns}
          onSubmit={handleCustomSqlSubmit}
          autoFocus
          placeholder="SELECT * FROM table_name;&#10;&#10;Ctrl+Enter to execute"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleCustomSqlSubmit}
          disabled={!customSql.trim()}
          className="flex items-center gap-2"
          size="sm"
          variant="default"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Execute
        </Button>
        <Button
          onClick={() => {
            navigate({
              search: (prev) => updateTabState(prev, { customSql: "" }),
            });
          }}
          disabled={!customSql.trim()}
          variant="outline"
          size="sm"
        >
          Clear
        </Button>
      </div>

      {/* Help Text */}
      <div className="text-muted-foreground border-t pt-3 text-xs">
        <p>
          💡 Tip: Press{" "}
          <kbd className="bg-muted border-border rounded border px-1.5 py-0.5 font-mono text-xs">
            Ctrl+Enter
          </kbd>{" "}
          to execute the query
        </p>
      </div>
    </div>
  );
};
