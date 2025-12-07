import { useSearch } from "@tanstack/react-router";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
import { FileRouteTypes } from "#src/routeTree.gen.ts";

type ConnectionPage =
	FileRouteTypes["fileRoutesByFullPath"]["/connections/$connectionName"];
type ConnectionPageSearch = ConnectionPage["types"]["searchSchema"];

type TabState = NonNullable<ConnectionPageSearch["tabs"]>[number];

export const createTabState = (
	schema: string,
	table: string,
	options?: {
		filters?: QueryFilterType;
		offset?: number;
		limit?: number;
		filtersOpened?: boolean;
		fkValue?: string;
	},
): TabState => ({
	tabId: `${schema}.${table}:${options?.fkValue ?? ""}`,
	schema,
	table,
	orderBy: undefined,
	orderDirection: undefined,
	relationshipRowId: undefined,
	limit: options?.limit ?? 50,
	offset: options?.offset ?? 0,
	viewMode: "rows" as const,
	tableSize: "cozy" as const,
	hiddenColumnList: undefined,
	filters: options?.filters,
	filtersOpened: options?.filtersOpened ?? false,
	fkValue: options?.fkValue,
});

export const updateTabState = (
	prev: ConnectionPageSearch,
	updates: Partial<TabState> | ((prev: TabState) => Partial<TabState>),
): ConnectionPageSearch => {
	const updatedTabList = (prev.tabs ?? []).map((tab) => {
		if (tab.tabId === prev.activeTabId) {
			return {
				...tab,
				...(typeof updates === "function" ? updates(tab) : updates),
			};
		}

		return tab;
	});
	const updatedTab = updatedTabList.find(
		(tab) => tab.tabId === prev.activeTabId,
	);

	return {
		...prev,
		...updatedTab,
		tabs: updatedTabList,
	} as ConnectionPageSearch;
};

export const addTabStateAfterCurrent = (
	prev: ConnectionPageSearch,
	newTab: TabState,
) => {
	const currentTabIndex = (prev.tabs ?? []).findIndex(
		(t) => t.tabId === prev.activeTabId,
	);
	let tabs = prev.tabs ?? [];
	if (currentTabIndex !== -1) {
		tabs = [
			...tabs.slice(0, currentTabIndex + 1),
			newTab,
			...tabs.slice(currentTabIndex + 1),
		];
	}

	return {
		...prev,
		...newTab,
		tabs: tabs,
		activeTabId: newTab.tabId,
	};
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
			if (!activeTab) return select(createTabState("public", ""), search);

			return select(activeTab, search);
		},
	});

	return search as T;
};
