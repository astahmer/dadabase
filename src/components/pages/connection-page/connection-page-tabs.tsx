import type { FileRoutesByTo } from "#src/routeTree.gen.ts";

import { toaster } from "#src/components/ui/toaster.tsx";
import { type DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import { encodeToBinary } from "#src/router.encode.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { getTableColumnsQueryOptions } from "#src/server/introspection/start-fns/get-table-columns.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  stringifySearchWith,
  useLocation,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { stringify } from "zipson";

import {
  addTabStateAfterCurrent,
  createTabState,
  scrollToTab,
  updateTabState,
} from "./create-tab-state.ts";
import { TableTabsBar } from "./table-tabs-bar.tsx";

interface ConnectionPageTabsProps {
  activeConnectionUrl: string;
  dialect: DatabaseDialect;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export const ConnectionPageTabs = (props: ConnectionPageTabsProps) => {
  const { activeConnectionUrl, dialect } = props;

  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const location = useLocation();
  const router = useRouter();

  const tabs = useSearch({
    from: "/connections/$connectionName",
    select: (s) => s.tabs ?? [],
  });
  const activeTabId = useSearch({
    from: "/connections/$connectionName",
    select: (s) => s.activeTabId ?? null,
  });

  const schemaListQuery = useQuery({
    ...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
    retry: 3,
  });
  const schemaList = schemaListQuery.data || [];

  const tablesListQuery = useQuery({
    ...listAvailableTablesQueryOptions({ url: activeConnectionUrl }),
    retry: 3,
  });
  const tableList = tablesListQuery.data || [];

  const schemaWithTables = schemaList.filter((schema) =>
    tableList.some((t) => t.schema === schema),
  );

  const prefetchTableData = (schema: string, table: string) => {
    queryClient.prefetchQuery({
      ...queryTableDataQueryOptions({
        url: activeConnectionUrl,
        schema,
        table,
        limit: 50,
        offset: 0,
        orderBy: undefined,
        orderDirection: undefined,
        filters: { conditions: [], logicalOperator: "and" },
      }),
    });
  };

  const prefetchTableColumns = (schema: string, table: string) => {
    queryClient.prefetchQuery({
      ...getTableColumnsQueryOptions({
        url: activeConnectionUrl,
        schema,
        table,
      }),
    });
  };

  const handleDuplicateTab = (tabId: string) => {
    const tab = tabs.find((t) => t.tabId === tabId);
    if (!tab) return;

    const newTabId = `duplicate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const duplicatedTab = { ...tab, tabId: newTabId };

    navigate({
      search: (prev) => ({
        ...prev,
        ...addTabStateAfterCurrent(prev, duplicatedTab),
      }),
    }).then(() => scrollToTab(duplicatedTab.tabId));
  };

  const handleDeleteTabsOnLeft = (tabId: string) => {
    const tabIndex = tabs.findIndex((t) => t.tabId === tabId);
    if (tabIndex <= 0) return;

    navigate({
      search: (prev) => {
        const updatedTabs = (prev.tabs ?? []).slice(tabIndex);
        let newActiveTabId = prev.activeTabId;

        if (!updatedTabs.find((t) => t.tabId === newActiveTabId)) {
          newActiveTabId = updatedTabs[0]?.tabId;
        }

        const newActiveTab = updatedTabs.find((t) => t.tabId === newActiveTabId);

        const baseState = {
          ...prev,
          tabs: updatedTabs,
          activeTabId: newActiveTabId,
        };

        if (newActiveTab && newActiveTab.schema && newActiveTab.table) {
          return {
            ...baseState,
            ...newActiveTab,
          };
        }

        return {
          ...baseState,
          table: undefined,
          schema: undefined,
          relationshipRowId: undefined,
        };
      },
    });
  };

  const handleDeleteTabsOnRight = (tabId: string) => {
    const tabIndex = tabs.findIndex((t) => t.tabId === tabId);
    if (tabIndex === -1 || tabIndex === tabs.length - 1) return;

    navigate({
      search: (prev) => {
        const updatedTabs = (prev.tabs ?? []).slice(0, tabIndex + 1);
        const newActiveTabId = prev.activeTabId;

        return {
          ...prev,
          tabs: updatedTabs,
          activeTabId: newActiveTabId,
        };
      },
    });
  };

  const handleDeleteOtherTabs = (tabId: string) => {
    const tab = tabs.find((t) => t.tabId === tabId);
    if (!tab) return;

    navigate({
      search: (prev) => {
        const baseState = {
          ...prev,
          tabs: [tab],
          activeTabId: tab.tabId,
        };

        if (tab.schema && tab.table) {
          return {
            ...baseState,
            ...tab,
          };
        }

        return {
          ...baseState,
          table: undefined,
          schema: undefined,
          relationshipRowId: undefined,
        };
      },
    });
  };

  const onCloseAllTabs = () => {
    navigate({
      search: (prev) => ({
        ...prev,
        tabs: [],
        activeTabId: undefined,
      }),
    });
  };

  const handleCopyTabUrl = (tabId: string) => {
    const tab = tabs.find((t) => t.tabId === tabId);
    if (!tab) return;

    // Build URL with only this tab and global search params
    const singleTabState = {
      tabId: tab.tabId,
      schema: tab.schema,
      table: tab.table,
      tabName: tab.tabName,
      orderBy: tab.orderBy,
      orderDirection: tab.orderDirection,
      limit: tab.limit,
      offset: tab.offset,
      viewMode: tab.viewMode,
      tableSize: tab.tableSize,
      hiddenColumnList: tab.hiddenColumnList,
      filters: tab.filters,
      filtersOpened: tab.filtersOpened,
      columnPinning: tab.columnPinning,
      columnOrder: tab.columnOrder,
      fkValue: tab.fkValue,
      relationshipRowId: tab.relationshipRowId,
      columnVisibilityMode: tab.columnVisibilityMode,
      sqlPreviewSize: tab.sqlPreviewSize,
      sqlEditorMode: tab.sqlEditorMode,
      customSql: tab.customSql,
    };

    const currentSearch = (router.state.matches.find(
      (m) => m.routeId === "/connections/$connectionName",
    )?.search ?? {}) as FileRoutesByTo["/connections/$connectionName"]["types"]["searchSchema"];
    const searchState: FileRoutesByTo["/connections/$connectionName"]["types"]["searchSchema"] = {
      ...currentSearch,
      tabs: [singleTabState],
      activeTabId: tab.tabId,
    };

    // Use the same encoding as the router
    const encodedSearch = stringifySearchWith((search) => encodeToBinary(stringify(search)));
    const baseUrl = `${window.location.origin}${location.pathname}`;
    const url = `${baseUrl}?${encodedSearch(searchState)}`;

    navigator.clipboard.writeText(url).then(() => {
      toaster.create({ title: "Tab URL copied to clipboard" });
    });
  };

  const handleRenameTab = (tabId: string, newName: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...updateTabState(prev, { tabName: newName }, tabId),
      }),
    });
  };

  return (
    <TableTabsBar
      tabs={tabs}
      activeTabId={activeTabId}
      hasMultipleSchemas={schemaWithTables.length > 1}
      onToggleSidebar={props.onToggleSidebar}
      isSidebarCollapsed={props.isSidebarCollapsed}
      onTabHover={(tab) => {
        if (tab.schema && tab.table) {
          prefetchTableData(tab.schema, tab.table);
          prefetchTableColumns(tab.schema, tab.table);
        }
      }}
      onTabChange={(tabId) => {
        const tab = tabs.find((t) => t.tabId === tabId);
        if (tab) {
          if (!tab.schema || !tab.table) {
            navigate({
              search: (prev) => ({
                ...prev,
                table: undefined,
                schema: undefined,
                activeTabId: tabId,
                relationshipRowId: undefined,
              }),
            });
          } else {
            navigate({
              search: (prev) => ({
                ...prev,
                ...tab,
                activeTabId: tabId,
              }),
            });
          }
        }
      }}
      onTabClose={(tabId) => {
        navigate({
          search: (prev) => {
            const updatedTabs = (prev.tabs ?? []).filter((t) => t.tabId !== tabId);
            let newActiveTabId = prev.activeTabId;

            if (prev.activeTabId === tabId) {
              if (updatedTabs.length > 0) {
                newActiveTabId = updatedTabs[updatedTabs.length - 1].tabId;
              } else {
                newActiveTabId = undefined;
              }
            }

            const baseState = {
              ...prev,
              tabs: updatedTabs,
              activeTabId: newActiveTabId,
            };

            if (updatedTabs.length === 0) {
              return {
                ...baseState,
                table: undefined,
                schema: undefined,
                relationshipRowId: undefined,
              };
            }

            const newActiveTab = updatedTabs.find((t) => t.tabId === newActiveTabId);
            if (newActiveTab) {
              if (!newActiveTab.schema || !newActiveTab.table) {
                return {
                  ...baseState,
                  table: undefined,
                  schema: undefined,
                  relationshipRowId: undefined,
                };
              }
              return {
                ...baseState,
                ...newActiveTab,
              };
            }

            return baseState;
          },
        });
      }}
      onDuplicateTab={handleDuplicateTab}
      onCloseTabsOnLeft={handleDeleteTabsOnLeft}
      onCloseTabsOnRight={handleDeleteTabsOnRight}
      onCloseOtherTabs={handleDeleteOtherTabs}
      onCloseAllTabs={onCloseAllTabs}
      onCopyTabUrl={handleCopyTabUrl}
      onRenameTab={handleRenameTab}
      onAddTab={() => {
        const currentTab = tabs.find((t) => t.tabId === activeTabId);
        const tabId = `empty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const defaultSchema = getDialectDefaultSchema(dialect);
        const schema =
          currentTab?.schema || schemaList.includes(defaultSchema)
            ? defaultSchema
            : schemaList[0] || defaultSchema;
        const emptyTabState = {
          ...createTabState(schema, ""),
          tabId,
          table: "",
        };
        navigate({
          search: (prev) => ({
            ...prev,
            ...emptyTabState,
            tabs: [...(prev.tabs ?? []), emptyTabState],
            activeTabId: tabId,
            relationshipRowId: undefined,
          }),
        }).then(() => scrollToTab(tabId));
      }}
    />
  );
};
