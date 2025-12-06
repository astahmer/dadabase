import { createListCollection, Listbox } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import { getDbNameFromConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";
import { ErrorBoundaryCard } from "../../shared/error-boundary-card.tsx";
import { Button } from "../../ui/button";
import { VirtualizerArea } from "../../ui/virtualizer-area.tsx";
import type { DbConnection } from "../connection.types";
import { createTabState, useActiveTabState } from "./create-tab-state.ts";

interface RowsTableErrorStateProps {
	activeConnectionUrl: string;
	connection: DbConnection;
}

export const RowsTableErrorState = ({
	activeConnectionUrl,
	connection,
}: RowsTableErrorStateProps) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const schemaListQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
		enabled: !!activeConnectionUrl,
		retry: 3,
	});
	return (
		<div className="flex-1 flex items-center justify-center">
			{schemaListQuery.isError ? (
				<div className="max-w-2xl w-full mx-4">
					<div className="flex flex-col gap-3">
						<ErrorBoundaryCard
							error={schemaListQuery.error}
							title="Failed to connect to database"
							onRetry={() => schemaListQuery.refetch()}
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								navigate({ to: "/" });
							}}
						>
							Back to Connections
						</Button>
					</div>
				</div>
			) : (
				<NoTableSelectedState
					activeConnectionUrl={activeConnectionUrl}
					connection={connection}
				/>
			)}
		</div>
	);
};

interface NoTableSelectedStateProps {
	activeConnectionUrl: string;
	connection: DbConnection;
}

const NoTableSelectedState = ({
	activeConnectionUrl,
	connection,
}: NoTableSelectedStateProps) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);
	const [filterText, setFilterText] = useState("");
	const { contains } = useFilter({ sensitivity: "base" });

	const selectedSchema = useActiveTabState((s) => s.schema);

	const tablesListQuery = useQuery({
		...listAvailableTablesQueryOptions({ url: activeConnectionUrl }),
		enabled: !!selectedSchema,
		retry: 3,
	});
	const tableList = tablesListQuery.data || [];

	const isNotSqlite = !(
		connection.dialect === DatabaseDialect.SQLite ||
		connection.dialect === DatabaseDialect.LibSQL
	);

	const filteredTables = useMemo(
		() =>
			tableList.filter(
				(table) =>
					(filterText ? contains(table.name, filterText) : true) &&
					(isNotSqlite ? selectedSchema === table.schema : true),
			),
		[tableList, filterText, selectedSchema, contains, isNotSqlite],
	);

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

	const handleTableSelect = (tableName: string) => {
		const schema =
			selectedSchema || getDialectDefaultSchema(connection.dialect);
		const newTab = createTabState(schema, tableName);

		queryClient.prefetchQuery({
			...queryTableDataQueryOptions({
				url: activeConnectionUrl,
				schema,
				table: tableName,
				limit: 50,
				offset: 0,
				orderBy: undefined,
				orderDirection: undefined,
				filters: {
					conditions: [],
					logicalOperator: "and",
				},
			}),
		});

		navigate({
			search: (prev) => {
				const currentTab = (prev.tabs ?? []).find(
					(t) => t.tabId === prev.activeTabId,
				);
				const isCurrentTabEmpty = !currentTab?.table;

				if (isCurrentTabEmpty && currentTab) {
					// Replace the empty tab
					const updatedTabs = (prev.tabs ?? []).map((t) =>
						t.tabId === currentTab.tabId
							? { ...newTab, tabId: currentTab.tabId }
							: t,
					);
					return {
						...prev,
						tabs: updatedTabs,
						schema,
						table: tableName,
						offset: 0,
					};
				}

				// Add a new tab
				return {
					...prev,
					tabs: [...(prev.tabs ?? []), newTab],
					activeTabId: newTab.tabId,
					schema,
					table: tableName,
					offset: 0,
				};
			},
		});
	};

	if (tablesListQuery.isLoading) {
		return (
			<div className="text-center">
				<span className="text-muted-foreground">Loading tables...</span>
			</div>
		);
	}

	return (
		<div className="w-full max-w-2xl">
			<div className="flex flex-col gap-4">
				{/* Header */}
				<div>
					<h2 className="text-xl font-semibold text-foreground mb-1">
						Select a table
					</h2>
					<p className="text-sm text-muted-foreground">
						Choose a table to view and explore its data
					</p>
				</div>

				<Listbox.Root
					collection={tableCollection}
					onSelect={(details) => {
						handleTableSelect(details.value);
					}}
				>
					{/* Search Input */}
					<div className="relative">
						<svg
							className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						<Listbox.Input
							ref={inputRef}
							placeholder="Search tables..."
							value={filterText}
							autoFocus
							onChange={(e) => setFilterText(e.target.value)}
							className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
						/>
					</div>

					{/* Tables List */}
					{filteredTables.length === 0 ? (
						<div className="p-8 text-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
							<svg
								className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
									d="M12 6v6m0 0v6m0-6h6m0 0h6M6 12a6 6 0 11-0.001.001A6.002 6.002 0 016 12z"
								/>
							</svg>
							<span className="text-sm text-muted-foreground">
								{tableList.length === 0
									? "No tables available"
									: "No tables match your search"}
							</span>
						</div>
					) : (
						<div className="rounded-lg border border-input bg-card shadow-sm overflow-hidden flex flex-col mt-4">
							<VirtualizerArea count={filteredTables.length}>
								{({ virtualItems, totalSize, paddingTop, paddingBottom }) => (
									<>
										<div
											style={{ height: `${totalSize}px` }}
											className="relative"
										>
											{/* Padding for virtualizer */}
											{paddingTop > 0 && (
												<div style={{ height: `${paddingTop}px` }} />
											)}

											<Listbox.Content>
												<Listbox.ItemGroup>
													{virtualItems.map((virtualItem) => {
														const table = filteredTables[virtualItem.index];
														if (!table) return null;

														const isLast =
															virtualItem.index === filteredTables.length - 1;

														return (
															<Listbox.Item
																key={table.name}
																item={{
																	label: table.name,
																	value: table.name,
																}}
																className={`px-4 py-2.5 cursor-pointer text-sm transition-colors hover:bg-accent hover:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground ${
																	!isLast ? "border-b border-border/50" : ""
																}`}
															>
																<Listbox.ItemText className="flex items-center gap-2">
																	<span className="font-medium">
																		{table.name}
																	</span>
																</Listbox.ItemText>
															</Listbox.Item>
														);
													})}
												</Listbox.ItemGroup>
											</Listbox.Content>

											{/* Padding for virtualizer */}
											{paddingBottom > 0 && (
												<div style={{ height: `${paddingBottom}px` }} />
											)}
										</div>

										{/* Footer with count */}
										<div className="px-4 py-2 bg-muted/50 border-t border-border/50 text-xs text-muted-foreground">
											{filteredTables.length} table
											{filteredTables.length !== 1 ? "s" : ""} available
										</div>
									</>
								)}
							</VirtualizerArea>
						</div>
					)}
				</Listbox.Root>
			</div>
		</div>
	);
};
