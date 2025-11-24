import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { getTableColumnsQueryOptions } from "#src/server/pg/start-fns/get-table-columns.start.ts";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { TableTabsBar } from "./table-tabs-bar.tsx";
import {
	createTabState,
	updateTabState,
	useActiveTabState,
} from "./create-tab-state.ts";

interface ConnectionPageTabsProps {
	activeConnectionUrl: string;
}

export const ConnectionPageTabs = (props: ConnectionPageTabsProps) => {
	const { activeConnectionUrl } = props;

	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const tabs = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.tabs ?? [],
	});
	const activeTabId = useSearch({
		from: "/connections/$connectionName",
		select: (s) => s.activeTabId ?? null,
	});

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

	return (
		<TableTabsBar
			tabs={tabs}
			activeTabId={activeTabId}
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
						const updatedTabs = (prev.tabs ?? []).filter(
							(t) => t.tabId !== tabId,
						);
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

						const newActiveTab = updatedTabs.find(
							(t) => t.tabId === newActiveTabId,
						);
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
			onAddTab={() => {
				const tabId = `empty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
				const emptyTabState = {
					tabId,
					schema: "",
					table: "",
					tableFilter: undefined,
					orderBy: undefined,
					orderDirection: undefined,
					limit: 50,
					offset: 0,
					viewMode: "rows" as const,
					tableSize: "cozy" as const,
					hiddenColumnList: undefined,
					filters: undefined,
					filtersOpened: false,
					relationshipRowId: undefined,
				};
				navigate({
					search: (prev) => ({
						...prev,
						tabs: [...(prev.tabs ?? []), emptyTabState],
						activeTabId: tabId,
						table: undefined,
						relationshipRowId: undefined,
					}),
				});
			}}
		/>
	);
};
