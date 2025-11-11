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
) => ({
	tabId: `${schema}.${table}:${options?.fkValue ?? ""}`,
	schema,
	table,
	tableFilter: undefined,
	orderBy: undefined,
	orderDirection: undefined,
	limit: options?.limit ?? 50,
	offset: options?.offset ?? 0,
	viewMode: "rows" as const,
	tableSize: "cozy" as const,
	hiddenColumnList: undefined,
	filters: options?.filters,
	filtersOpened: options?.filtersOpened ?? false,
	fkValue: options?.fkValue,
});
