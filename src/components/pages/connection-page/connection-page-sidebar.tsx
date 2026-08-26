import type { Virtualizer } from "@tanstack/react-virtual";

import { createListCollection, Listbox } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { DatabaseIcon } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "#src/components/ui/button.tsx";
import { Tooltip } from "#src/components/ui/tooltip.tsx";
import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import { getStoredPageLimit } from "#src/lib/default-page-limit.ts";
import { getDbNameFromConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { listAvailableDatabase } from "#src/server/introspection/start-fns/get-available-database-list.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";

import type { DbConnection } from "../connection.types";

import { ErrorBoundaryCard } from "../../shared/error-boundary-card.tsx";
import { LoadingSpinner } from "../../shared/loading-spinner";
import { Stack } from "../../ui/layout.tsx";
import * as ArkSelect from "../../ui/select";
import { VirtualizerArea } from "../../ui/virtualizer-area.tsx";
import { ConnectionSwitcher } from "./connection-switcher";
import {
  addTabStateAfterCurrent,
  createTabState,
  scrollToTab,
  updateTabState,
  useActiveTabState,
} from "./create-tab-state.ts";
import { TableContextMenu } from "./table-context-menu.tsx";
import { recordRecentTable } from "./recent-tables.ts";

interface ConnectionPageSidebarProps {
  connection: DbConnection;
  activeConnectionUrl: string;
  onAddConnection: () => void;
  onOpenAiAssistant?: () => void;
  onOpenHistory?: () => void;
  onOpenFavorites?: () => void;
}

export const ConnectionPageSidebar = (props: ConnectionPageSidebarProps) => {
  const { connection, activeConnectionUrl } = props;

  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const connectionUrl = connection.url;
  const defaultDatabaseName = getDbNameFromConnectionUrl(connectionUrl);

  const databaseListQuery = useQuery({
    ...listAvailableDatabase({ url: connectionUrl }),
    retry: 1,
  });
  const dbList = databaseListQuery.data || [];
  const selectedDbName = useSearch({
    from: "/connections/$connectionName",
    select: (s) => s.dbName ?? (dbList.length === 1 ? dbList.at(0)?.name : undefined),
  });

  const schemaListQuery = useQuery({
    ...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
    retry: 1,
  });
  const schemaList = schemaListQuery.data || [];

  const globalSchema = useSearch({
    from: "/connections/$connectionName",
    select: (s) => s.schema,
  });

  const selectedSchema = useActiveTabState((s) => {
    const defaultSchema = getDialectDefaultSchema(connection.dialect);
    // Return the current schema if it exists, otherwise fall back to defaults
    if (s.schema && schemaList.includes(s.schema)) {
      return s.schema;
    }
    // Fall back to global schema state
    if (globalSchema && schemaList.includes(globalSchema)) {
      return globalSchema;
    }
    if (schemaList.includes(defaultSchema)) {
      return defaultSchema;
    }
    return schemaList.at(0) || defaultSchema;
  });

  const tablesListQuery = useQuery({
    ...listAvailableTablesQueryOptions({ url: activeConnectionUrl, schema: selectedSchema }),
    enabled: !!selectedSchema,
    retry: 1,
  });
  const tableList = tablesListQuery.data || [];

  const { contains } = useFilter({ sensitivity: "base" });

  const tableFilter = useSearch({
    from: "/connections/$connectionName",
    select: (s) => s.tableFilter,
  });
  const selectedTable = useActiveTabState((s) => s.table);

  const isNotSqlite = !(
    connection.dialect === DatabaseDialect.SQLite || connection.dialect === DatabaseDialect.LibSQL
  );

  const filteredTables = useMemo(
    () =>
      tableList.filter(
        (table) =>
          (tableFilter ? contains(table.name, tableFilter) : true) &&
          (isNotSqlite ? selectedSchema === table.schema : true),
      ),
    [tableList, tableFilter, selectedSchema, contains, isNotSqlite],
  );
  const filteredTablesNames = useMemo(() => filteredTables.map((t) => t.name), [filteredTables]);

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

  const schemaCollection = ArkSelect.createListCollection({
    items: (schemaListQuery.data ?? []).map((s) => ({
      label: s,
      value: s,
    })),
  });

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <ConnectionSwitcher
        connection={connection}
        onAddConnection={props.onAddConnection}
        onOpenAiAssistant={props.onOpenAiAssistant}
        onOpenHistory={props.onOpenHistory}
        onOpenFavorites={props.onOpenFavorites}
        onOpenSchemaExplorer={() => {
          navigate({
            to: "/schema/$connectionName",
            params: { connectionName: connection.name },
            search: selectedSchema ? { schema: selectedSchema } : {},
          });
        }}
      />
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-border shrink-0 border-b px-4 py-2">
          <div className="text-foreground truncate text-sm font-medium" title={connection.name}>
            {connection.name}
          </div>
        </div>
        {/* Database Selector */}
        {isNotSqlite && (
          <Stack className="shrink-0 px-4 pt-4" gap="2">
            <label className="text-foreground text-xs font-medium tracking-wide uppercase">
              Database
            </label>
            {databaseListQuery.isError ? (
              <ErrorBoundaryCard
                error={databaseListQuery.error}
                title="Failed to load databases"
                onRetry={() => databaseListQuery.refetch()}
              />
            ) : databaseListQuery.isLoading ? (
              <LoadingSpinner
                label="Loading databases..."
                failureCount={databaseListQuery.failureCount}
                layout="horizontal"
                className="border-input bg-card min-h-9 rounded-md border px-3 py-2"
              />
            ) : (
              <ArkSelect.Select
                className="w-full"
                value={
                  selectedDbName
                    ? [selectedDbName]
                    : defaultDatabaseName
                      ? [defaultDatabaseName]
                      : []
                }
                collection={ArkSelect.createListCollection({
                  items: dbList.map((db) => ({
                    label: db.name,
                    value: db.name,
                  })),
                })}
                positioning={{ sameWidth: true }}
                disabled={databaseListQuery.isLoading}
                onValueChange={(details) => {
                  const newDbName = details.value?.[0];
                  if (newDbName) {
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        dbName: newDbName,
                        schema: undefined,
                        table: undefined,
                        offset: 0,
                        filters: undefined,
                      }),
                    });
                  }
                }}
              >
                <ArkSelect.SelectControl>
                  <ArkSelect.SelectTrigger>
                    <ArkSelect.SelectValueText placeholder="Select database" />
                    <ArkSelect.SelectIndicator />
                  </ArkSelect.SelectTrigger>
                </ArkSelect.SelectControl>
                <ArkSelect.SelectContent>
                  {(databaseListQuery.data || []).map((db) => (
                    <ArkSelect.SelectItem key={db.name} item={{ label: db.name, value: db.name }}>
                      {db.name}
                    </ArkSelect.SelectItem>
                  ))}
                </ArkSelect.SelectContent>
              </ArkSelect.Select>
            )}
          </Stack>
        )}
        {/* Schema Selector */}
        {isNotSqlite && (schemaListQuery.data ?? [])?.length > 1 && (
          <Stack className="shrink-0 px-4 pt-4" gap="2">
            <label className="text-foreground text-xs font-medium tracking-wide uppercase">
              Schema
            </label>
            {schemaListQuery.isError ? (
              <ErrorBoundaryCard
                error={schemaListQuery.error}
                title="Failed to load schemas"
                onRetry={() => schemaListQuery.refetch()}
              />
            ) : schemaListQuery.isLoading ? (
              <LoadingSpinner
                label="Loading schemas..."
                failureCount={schemaListQuery.failureCount}
                layout="horizontal"
                className="border-input bg-card min-h-9 rounded-md border px-3 py-2"
              />
            ) : (
              <ArkSelect.Select
                className="w-full"
                defaultValue={selectedSchema ? [selectedSchema] : []}
                collection={schemaCollection}
                positioning={{ sameWidth: true }}
                disabled={schemaListQuery.isLoading}
                onValueChange={(details) => {
                  const newSchema = details.value?.[0];
                  if (newSchema) {
                    navigate({
                      search: (prev) => {
                        const updated = updateTabState(prev, {
                          schema: newSchema,
                          offset: 0,
                          filters: undefined,
                        });
                        // Also set as global schema state for when no tabs exist
                        return {
                          ...updated,
                          schema: newSchema,
                        };
                      },
                    });
                  }
                }}
              >
                <ArkSelect.SelectControl>
                  <ArkSelect.SelectTrigger>
                    <ArkSelect.SelectValueText placeholder="Select schema" />
                    <ArkSelect.SelectIndicator />
                  </ArkSelect.SelectTrigger>
                </ArkSelect.SelectControl>
                <ArkSelect.SelectContent>
                  {schemaCollection.items.map((item) => (
                    <ArkSelect.SelectItem key={item.value} item={item}>
                      {item.label}
                    </ArkSelect.SelectItem>
                  ))}
                </ArkSelect.SelectContent>
              </ArkSelect.Select>
            )}
          </Stack>
        )}
        {/* Tables List */}
        <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden" data-tables-list>
          <Stack className="h-full flex-1" gap="2">
            <div className="flex items-center justify-between px-4">
              <div className="flex min-w-0 items-center gap-2">
                <label className="text-foreground text-xs font-medium tracking-wide uppercase">
                  Tables
                </label>
                {!tablesListQuery.isLoading && (
                  <span className="text-muted-foreground text-xs">{filteredTables.length}</span>
                )}
              </div>
              <Tooltip content="Schema Explorer">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        schemaExplorerOpen: true,
                      }),
                    });
                  }}
                  className="h-7 w-7 p-0"
                  aria-label="Open Schema Explorer"
                >
                  <DatabaseIcon className="size-3.5" />
                </Button>
              </Tooltip>
            </div>
            {tablesListQuery.isError ? (
              <div className="p-4">
                <ErrorBoundaryCard
                  error={tablesListQuery.error}
                  title="Failed to load tables"
                  onRetry={() => tablesListQuery.refetch()}
                />
              </div>
            ) : tablesListQuery.isLoading ? (
              <LoadingSpinner
                label="Loading tables..."
                failureCount={tablesListQuery.failureCount}
                layout="horizontal"
                className="p-4"
              />
            ) : (
              <Listbox.Root
                collection={tableCollection}
                className="h-full min-h-0"
                onHighlightChange={(details) => {
                  const tableName = details.highlightedValue;
                  if (!tableName) return;
                  const schema = selectedSchema;
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
                }}
                onSelect={(details) => {
                  const tableName = details.value;
                  if (!tableName) return;

                  recordRecentTable(connection.name, selectedSchema, tableName);
                  const newTabState = createTabState(selectedSchema, tableName);
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      ...addTabStateAfterCurrent(prev, newTabState),
                    }),
                  }).then(() => scrollToTab(newTabState.tabId));
                }}
              >
                <div className="flex h-full flex-1 flex-col overflow-hidden">
                  <div className="px-4">
                    <Listbox.Input
                      placeholder="Filter tables..."
                      // No autoFocus here: the new-tab empty state owns initial focus
                      // (its central search input). This filter is one click away.
                      defaultValue={tableFilter}
                      onChange={(e) =>
                        navigate({
                          replace: true,
                          search: (prev) => ({
                            ...prev,
                            tableFilter: e.target.value,
                          }),
                        })
                      }
                      className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-8 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                    />
                  </div>
                  <div className="mt-2 h-full flex-1 overflow-hidden">
                    {filteredTables.length === 0 ? (
                      <div className="p-4 text-center">
                        <span className="text-muted-foreground text-xs">
                          {tableList.length === 0 ? "No tables found" : "No tables match filter"}
                        </span>
                      </div>
                    ) : (
                      <VirtualizerArea
                        count={filteredTables.length}
                        className="mr-4 h-full max-h-full flex-1 overflow-y-auto"
                      >
                        {(virtualCtx) => (
                          <div style={{ height: `${virtualCtx.totalSize}px` }} className="relative">
                            <ScrollToSidebarTable
                              selectedTable={selectedTable}
                              tableList={filteredTablesNames}
                              virtualizer={virtualCtx.virtualizer}
                            />
                            {virtualCtx.paddingTop > 0 && (
                              <div style={{ height: `${virtualCtx.paddingTop}px` }} />
                            )}

                            <Listbox.Content className="block">
                              <Listbox.ItemGroup>
                                {virtualCtx.virtualItems.map((virtualItem) => {
                                  const table = filteredTables[virtualItem.index];
                                  if (!table) return null;

                                  return (
                                    <TableContextMenu
                                      key={table.name}
                                      tableName={table.name}
                                      schema={table.schema || selectedSchema}
                                    >
                                      <Listbox.Item
                                        item={{
                                          label: table.name,
                                          value: table.name,
                                        }}
                                        className={`flex cursor-pointer items-center truncate rounded-md px-3 py-2 text-sm transition-colors ${
                                          selectedTable === table.name
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground data-highlighted:bg-muted"
                                        }`}
                                        title={table.name}
                                        onDoubleClick={() => {
                                          const newTabState = createTabState(
                                            selectedSchema,
                                            table.name,
                                          );
                                          navigate({
                                            search: (prev) => ({
                                              ...prev,
                                              ...addTabStateAfterCurrent(prev, newTabState),
                                            }),
                                          }).then(() => scrollToTab(newTabState.tabId));
                                        }}
                                      >
                                        <Listbox.ItemText className="flex-1 truncate">
                                          {table.name}
                                        </Listbox.ItemText>
                                      </Listbox.Item>
                                    </TableContextMenu>
                                  );
                                })}
                              </Listbox.ItemGroup>
                            </Listbox.Content>

                            {virtualCtx.paddingBottom > 0 && (
                              <div
                                style={{
                                  height: `${virtualCtx.paddingBottom}px`,
                                }}
                              />
                            )}
                          </div>
                        )}
                      </VirtualizerArea>
                    )}
                  </div>
                </div>
              </Listbox.Root>
            )}
          </Stack>
        </div>
      </div>
    </div>
  );
};

const ScrollToSidebarTable = (props: {
  selectedTable: string;
  tableList: string[];
  virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
}) => {
  useEffect(() => {
    if (!props.selectedTable) return;
    const tableIndex = props.tableList.indexOf(props.selectedTable);
    if (tableIndex !== -1) {
      props.virtualizer.scrollToIndex(tableIndex, {
        align: "center",
        // behavior: "smooth",
      });
    }
  }, [props.virtualizer, props.selectedTable, props.tableList]);

  return null;
};
