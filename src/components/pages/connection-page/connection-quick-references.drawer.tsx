import { useTableColumnMetadata } from "#src/hooks/use-table-column-metadata";
import { replaceDatabaseInConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { QuickReferencesPanel } from "../../quick-references-panel.tsx";
import { Sheet, SheetContent } from "../../ui/sheet.tsx";
import type { DbConnection } from "../connection.types.ts";
import { createTabState } from "./create-tab-state.ts";

export const ConnectionQuickReferencesDrawer = ({
	connection,
}: {
	connection: DbConnection;
}) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const search = useSearch({
		from: "/connections/$connectionName",
		select: (s) => ({
			dbName: s.dbName,
			quickReferencesOpen: s.quickReferencesOpen,
			quickReferencesColumnName: s.quickReferencesColumnName,
			quickReferencesCellValue: s.quickReferencesCellValue,
			activeTabId: s.activeTabId,
			tabs: s.tabs ?? [],
		}),
	});

	// Get table state from active tab
	const activeTab = search.tabs.find((tab) => tab.tabId === search.activeTabId);
	const schema = activeTab?.schema || "";
	const table = activeTab?.table || "";

	const connectionUrl = connection.url || "";
	const activeConnectionUrl = search.dbName
		? replaceDatabaseInConnectionUrl(connectionUrl, search.dbName)
		: connectionUrl;

	const { columnMetadata } = useTableColumnMetadata({
		url: activeConnectionUrl,
		schema: schema,
		table: table,
	});

	const quickReferencesOpen = search.quickReferencesOpen ?? false;
	const quickReferencesColumnName = search.quickReferencesColumnName;
	const quickReferencesCellValue = search.quickReferencesCellValue;

	if (!quickReferencesOpen) {
		return null;
	}

	const column = columnMetadata.find(
		(c) => c.name === quickReferencesColumnName,
	);

	return (
		<Sheet
			open={true}
			onOpenChange={(details) => {
				if (!details.open) {
					navigate({
						search: (prev) => ({
							...prev,
							quickReferencesOpen: false,
							quickReferencesColumnName: undefined,
							quickReferencesCellValue: undefined,
						}),
					});
				}
			}}
		>
			<SheetContent className="z-50 w-full sm:max-w-[500px] p-0 flex flex-col">
				{quickReferencesColumnName &&
				quickReferencesCellValue &&
				schema &&
				table &&
				columnMetadata.length > 0 ? (
					column ? (
						<QuickReferencesPanel
							key={`${schema}.${table}.${quickReferencesColumnName}.${quickReferencesCellValue}`}
							schema={schema}
							table={table}
							column={column}
							cellValue={quickReferencesCellValue}
							connectionUrl={activeConnectionUrl}
							onNavigate={(schema, table, column, value) => {
								navigate({
									search: (prev) => {
										const newTabState = createTabState(schema, table, {
											filters: {
												conditions: [
													{
														column,
														operator: "equals" as const,
														value: String(value),
													},
												],
												logicalOperator: "and" as const,
											},
											filtersOpened: true,
											fkValue: String(value),
											tableSize: prev.tableSize,
										});
										return {
											...prev,
											activeTabId: newTabState.tabId,
											tabs: [...(prev.tabs ?? []), newTabState],
											quickReferencesOpen: false,
											quickReferencesColumnName: undefined,
											quickReferencesCellValue: undefined,
										};
									},
								});
							}}
						/>
					) : null
				) : (
					<div className="w-full h-full flex flex-col">
						{/* Skeleton Header */}
						<div className="bg-linear-to-b from-background to-background/95 px-4 py-3 border-b shrink-0">
							<div className="flex items-start justify-between gap-3 mb-2">
								<div className="flex-1 min-w-0 space-y-2">
									<div className="h-3 w-24 bg-muted/60 rounded animate-pulse" />
									<div className="h-4 w-40 bg-muted/60 rounded animate-pulse" />
									<div className="h-3 w-32 bg-muted/60 rounded animate-pulse mt-2" />
								</div>
							</div>
							<div className="h-3 w-28 bg-muted/60 rounded animate-pulse" />
						</div>
						{/* Skeleton Content */}
						<div className="overflow-y-auto flex-1 p-4 space-y-4">
							{/* Skeleton Button */}
							<div className="h-10 bg-muted/60 rounded animate-pulse" />
							{/* Skeleton List Items */}
							<div className="space-y-2">
								{[1, 2, 3].map((i) => (
									<div
										key={i}
										className="h-8 bg-muted/60 rounded animate-pulse"
									/>
								))}
							</div>
						</div>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
};
