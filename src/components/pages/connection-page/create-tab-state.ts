import type { TabStateSchema } from "./connection-page.tab.schema.ts";

const createTabId = (input: {
	schema: string;
	table: string;
	fkValue?: string;
}) => `${input.schema}.${input.table}:${input.fkValue ?? ""}`;

export const createTabState = (
	schema: string,
	table: string,
	options?: Partial<typeof TabStateSchema.Type>,
): typeof TabStateSchema.Type => ({
	tabId: createTabId({ schema, table, fkValue: options?.fkValue }),
	schema,
	table,
	orderBy: undefined,
	orderDirection: undefined,
	limit: options?.limit ?? 50,
	offset: options?.offset ?? 0,
	viewMode: "rows" as const,
	tableSize: options?.tableSize ?? ("cozy" as const),
	hiddenColumnList: undefined,
	filters: options?.filters,
	filtersOpened: options?.filtersOpened ?? false,
	fkValue: options?.fkValue,
});
