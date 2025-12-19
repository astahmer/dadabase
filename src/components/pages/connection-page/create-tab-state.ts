import { useSearch } from "@tanstack/react-router";
import type { JoinTablesConfig } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
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
		joinConfig?: JoinTablesConfig;
		tabName?: string;
	},
): TabState => {
	const tabName = options?.tabName ?? (table ? table : "New Tab");

	return {
		tabId: `${schema}.${table}:${options?.fkValue ?? ""}:${Math.random().toString(36).substr(2, 4)}`,
		schema,
		table,
		tabName: tabName,
		orderBy: undefined,
		orderDirection: undefined,
		nullsOrder: undefined,
		relationshipRowId: undefined,
		limit: options?.limit ?? 50,
		offset: options?.offset ?? 0,
		viewMode: "rows" as const,
		tableSize: "cozy" as const,
		hiddenColumnList: undefined,
		columnVisibilityMode: "client" as const,
		filters: options?.filters,
		filtersOpened: options?.filtersOpened ?? false,
		fkValue: options?.fkValue,
		joins: options?.joinConfig?.joins,
		sqlPreviewCollapsed: true,
		sqlEditorMode: "preview" as const,
		customSql: undefined,
	};
};

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
	_newTab: TabState,
) => {
	const newTab = { ..._newTab };
	const currentTabIndex = (prev.tabs ?? []).findIndex(
		(t) => t.tabId === prev.activeTabId,
	);
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
			suffixNumbers.length > 0
				? Math.max(...suffixNumbers) + 1
				: sameTabs.length + 1;

		// Only add suffix if not already present and there's more than one tab of same table
		if (nextSuffix > 1) {
			newTab.tabName = `${newTab.tabName} #${nextSuffix}`;
		}
	}

	if (currentTabIndex !== -1) {
		tabs = [
			...tabs.slice(0, currentTabIndex + 1),
			newTab,
			...tabs.slice(currentTabIndex + 1),
		];
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
			if (!activeTab) return select(createTabState("public", ""), search);

			return select(activeTab, search);
		},
	});

	return search as T;
};
