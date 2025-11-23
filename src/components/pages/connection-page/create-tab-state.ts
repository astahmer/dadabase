import { FileRouteTypes } from "#src/routeTree.gen.ts";

type ConnectionPageSearch =
	FileRouteTypes["fileRoutesByFullPath"]["/connections/$connectionName"]["types"]["searchSchema"];

type TabState = NonNullable<ConnectionPageSearch["tabs"]>[number];

export const createTabState = (
	schema: string,
	table: string,
	options?: {
		filters?: any;
		offset?: number;
		limit?: number;
		filtersOpened?: boolean;
		fkValue?: string;
	},
): TabState => ({
	tabId: `${schema}.${table}:${options?.fkValue ?? ""}`,
	schema,
	table,
	tableFilter: undefined,
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
	updates: Partial<TabState>,
): ConnectionPageSearch => {
	const updatedTabs = (prev.tabs ?? []).map((tab) =>
		tab.tabId === prev.activeTabId ? { ...tab, ...updates } : tab,
	);

	return {
		...prev,
		...updates,
		tabs: updatedTabs,
	} as ConnectionPageSearch;
};
