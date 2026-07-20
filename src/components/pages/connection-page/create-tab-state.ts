import { useSearch } from "@tanstack/react-router";

import { getStoredPageLimit } from "#src/lib/default-page-limit.ts";
import { FileRouteTypes } from "#src/routeTree.gen.ts";

type ConnectionPage = FileRouteTypes["fileRoutesByFullPath"]["/connections/$connectionName"];
type ConnectionPageSearch = ConnectionPage["types"]["searchSchema"];

type TabState = NonNullable<ConnectionPageSearch["tabs"]>[number];

export const createTabState = (
  schema: string,
  table: string,
  options?: Partial<TabState>,
): TabState => {
  const tabName = options?.tabName ?? (table ? table : "New Tab");

  return {
    tabId: `${schema}.${table}:${options?.fkValue ?? ""}:${Math.random().toString(36).substr(2, 4)}`,
    schema,
    table,
    tabName: tabName,
    orderBy: options?.orderBy,
    orderDirection: options?.orderDirection,
    nullsOrder: options?.nullsOrder,
    relationshipRowId: options?.relationshipRowId,
    limit: options?.limit ?? getStoredPageLimit(),
    offset: options?.offset ?? 0,
    viewMode: options?.viewMode ?? ("rows" as const),
    tableSize: options?.tableSize ?? ("cozy" as const),
    hiddenColumnList: options?.hiddenColumnList,
    columnAliases: options?.columnAliases,
    columnVisibilityMode: options?.columnVisibilityMode ?? ("client" as const),
    filters: options?.filters,
    filtersOpened: options?.filtersOpened ?? false,
    groupBy: options?.groupBy,
    having: options?.having,
    fkValue: options?.fkValue,
    joins: options?.joins,
    sqlEditorMode: options?.sqlEditorMode ?? ("preview" as const),
    customSql: options?.customSql,
    customSqlId: options?.customSqlId,
    editorDetached: options?.editorDetached,
    initialTabMode: options?.initialTabMode,
    columnOrder: options?.columnOrder,
    columnPinning: options?.columnPinning,
    prefixWithTable: options?.prefixWithTable,
    sqlPreviewSize: options?.sqlPreviewSize ?? 0,
    clientFilter: options?.clientFilter,
    clientFilterApproved: options?.clientFilterApproved,
  };
};

export const updateTabState = (
  prev: ConnectionPageSearch,
  updates: Partial<TabState> | ((prev: TabState) => Partial<TabState>),
  tabId?: string,
): ConnectionPageSearch => {
  const tabIdToUpdate = tabId ?? prev.activeTabId;
  const updatedTabList = (prev.tabs ?? []).map((tab) => {
    if (tab.tabId === tabIdToUpdate) {
      return {
        ...tab,
        ...(typeof updates === "function" ? updates(tab) : updates),
      };
    }

    return tab;
  });
  const updatedTab = updatedTabList.find((tab) => tab.tabId === tabIdToUpdate);

  return {
    ...prev,
    ...updatedTab,
    tabs: updatedTabList,
  } as ConnectionPageSearch;
};

export const addTabStateAfterCurrent = (prev: ConnectionPageSearch, _newTab: TabState) => {
  const newTab = { ..._newTab };
  const currentTabIndex = (prev.tabs ?? []).findIndex((t) => t.tabId === prev.activeTabId);
  let tabs = prev.tabs ?? [];
  // Find all tabs with same schema/table combination
  const sameTabs = tabs.filter((t) => t.tabName === newTab.tabName);

  if (sameTabs.length > 0) {
    // Extract existing suffix numbers
    const suffixNumbers = sameTabs
      .map((t) => {
        const name = t.tabName || "";
        const match = name.match(/#(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);

    // Find next suffix number
    const nextSuffix =
      suffixNumbers.length > 0 ? Math.max(...suffixNumbers) + 1 : sameTabs.length + 1;

    // Only add suffix if not already present and there's more than one tab of same table
    if (nextSuffix > 1) {
      newTab.tabName = `${newTab.tabName} #${nextSuffix}`;
    }
  }

  if (currentTabIndex !== -1) {
    tabs = [...tabs.slice(0, currentTabIndex + 1), newTab, ...tabs.slice(currentTabIndex + 1)];
  } else {
    tabs = [...tabs, newTab];
  }

  return {
    ...prev,
    ...newTab,
    tabs: tabs,
    activeTabId: newTab.tabId,
  };
};

export const scrollToTab = (tabId: string) => {
  const tab = document.querySelector(`[data-table-tab="${tabId}"]`);
  if (tab) {
    tab.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "center",
    });
  }
};

export const getActiveTabState = (search: ConnectionPageSearch) =>
  search.tabs?.find((tab) => tab.tabId === search.activeTabId);

export const useActiveTabState = <T>(
  select: (activeTab: TabState, search: ConnectionPageSearch) => T,
) => {
  // @ts-expect-error
  const search = useSearch({
    from: "/connections/$connectionName",
    select: (search) => {
      const activeTab = getActiveTabState(search);
      if (!activeTab) return select(createTabState(search.schema || "public", ""), search);

      return select(activeTab, search);
    },
  });

  return search as T;
};
