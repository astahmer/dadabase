import { toaster } from "#src/components/ui/toaster.tsx";
import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import type { TableWithColumnsMetadata } from "#src/server/introspection/introspection.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";
import { createListCollection, Listbox } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ErrorBoundaryCard } from "../../shared/error-boundary-card.tsx";
import { Button } from "../../ui/button";
import { VirtualizerArea } from "../../ui/virtualizer-area.tsx";
import type { DbConnection } from "../connection.types";
import {
	createTabState,
	updateTabState,
	useActiveTabState,
} from "./create-tab-state.ts";
import { extractSelectedTables } from "./sql-completion-helper.ts";
import { SqlMonacoEditor } from "./sql-monaco-editor.tsx";
import { parseSqlQuery } from "./sql-query-parser.ts";

interface RowsTableErrorStateProps {
	activeConnectionUrl: string;
	connection: DbConnection;
	tables: Array<{ schema: string; name: string }>;
	columns: Array<TableWithColumnsMetadata>;
}

export const RowsTableErrorState = (props: RowsTableErrorStateProps) => {
	const { activeConnectionUrl, connection } = props;
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
					tables={props.tables}
					columns={props.columns}
				/>
			)}
		</div>
	);
};

interface NoTableSelectedStateProps {
	activeConnectionUrl: string;
	connection: DbConnection;
	tables: Array<{ schema: string; name: string }>;
	columns: Array<TableWithColumnsMetadata>;
}

const NoTableSelectedState = (props: NoTableSelectedStateProps) => {
	const { activeConnectionUrl, connection } = props;
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);
	const [filterText, setFilterText] = useState("");
	const { contains } = useFilter({ sensitivity: "base" });

	const mode = useActiveTabState((s) => s.initialTabMode ?? "table");
	const customSql = useActiveTabState((s) => s.customSql ?? "");
	const selectedSchema = useActiveTabState((s) => s.schema);

	const onCustomSqlChange = useDebouncedCallback(
		(value: string) => {
			// Get available column names from all columns
			const allAvailableColumns = props.columns.flatMap((tc) =>
				tc.columns.map((c) => c.name),
			);

			// Parse the SQL query to extract filters, sorting, pagination
			const parsedState = parseSqlQuery(value, allAvailableColumns);
			const extractedTables = extractSelectedTables(value);
			console.log(parsedState, extractedTables);

			return navigate({
				search: (prev) =>
					updateTabState(prev, {
						customSql: value,
						// Apply parsed state updates
						...parsedState,
					}),
			});
		},
		{ wait: 500 },
	);

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

				// Replace the empty tab
				if (isCurrentTabEmpty && currentTab) {
					return {
						...prev,
						...updateTabState(prev, {
							...newTab,
							tabId: currentTab.tabId,
							initialTabMode: undefined,
						}),
						schema,
						table: tableName,
						offset: 0,
					};
				}

				// Add a new tab otherwise
				return {
					...prev,
					...newTab,
					tabs: [...(prev.tabs ?? []), newTab],
					activeTabId: newTab.tabId,
				};
			},
		});
	};

	const handleCustomSqlSubmit = () => {
		if (!customSql.trim()) return;

		const schema =
			selectedSchema || getDialectDefaultSchema(connection.dialect);
		const extractedTables = extractSelectedTables(customSql);
		const firstTable = extractedTables.at(0);

		if (!firstTable?.table) {
			toaster.create({
				title: "Failed to detect table",
				description: "Could not detect table from your SQL query",
			});
			return;
		}

		// Use the extracted schema if available, otherwise use selected schema
		const effectiveSchema = firstTable.schema || schema;
		const table = firstTable.table;

		navigate({
			search: (prev) => {
				const currentTab = (prev.tabs ?? []).find(
					(t) => t.tabId === prev.activeTabId,
				);
				const isCurrentTabEmpty = !currentTab?.table;

				const newTab = createTabState(effectiveSchema, table, {
					tabName: `${table} (custom)`,
				});

				// Replace the empty tab
				if (isCurrentTabEmpty && currentTab) {
					return {
						...prev,
						...newTab,
						...updateTabState(prev, {
							table,
							customSql,
							sqlEditorMode: "editor",
							initialTabMode: undefined,
							tabName: `${table} (custom)`,
						}),
					};
				}

				// Add a new tab otherwise
				return {
					...prev,
					...newTab,
					tabs: [...(prev.tabs ?? []), newTab],
					activeTabId: newTab.tabId,
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
				{/* Mode Tabs */}
				<div className="flex gap-2 border-b">
					<Button
						variant={mode === "table" ? "default" : "ghost"}
						size="sm"
						onClick={() => {
							navigate({
								search: (prev) => {
									// If we're in fallback state (no real tab), create a new one
									if (!prev.tabs?.length) {
										const schema =
											selectedSchema ||
											getDialectDefaultSchema(connection.dialect);
										const newTab = createTabState(schema, "");

										return {
											...prev,
											...newTab,
											tabs: [...(prev.tabs ?? []), newTab],
											activeTabId: newTab.tabId,
											initialTabMode: "table",
										};
									}

									return updateTabState(prev, { initialTabMode: "table" });
								},
							});
						}}
						className="rounded-none border-b-2 border-transparent data-active:border-primary px-4 py-2"
						data-active={mode === "table"}
					>
						Browse Tables
					</Button>
					<Button
						variant={mode === "sql" ? "default" : "ghost"}
						size="sm"
						onClick={() => {
							navigate({
								search: (prev) => {
									// If we're in fallback state (no real tab), create a new one
									if (!prev.tabs?.length) {
										const schema =
											selectedSchema ||
											getDialectDefaultSchema(connection.dialect);
										const newTab = createTabState(schema, "", {
											initialTabMode: "sql",
										});

										return {
											...prev,
											...newTab,
											tabs: [...(prev.tabs ?? []), newTab],
											activeTabId: newTab.tabId,
										};
									}

									return updateTabState(prev, { initialTabMode: "sql" });
								},
							});
						}}
						className="rounded-none border-b-2 border-transparent data-active:border-primary px-4 py-2"
						data-active={mode === "sql"}
					>
						Custom SQL
					</Button>
				</div>

				{/* Table Selection Mode */}
				{mode === "table" && (
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
										{({
											virtualItems,
											totalSize,
											paddingTop,
											paddingBottom,
										}) => (
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
																	virtualItem.index ===
																	filteredTables.length - 1;

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
				)}

				{/* Custom SQL Mode */}
				{mode === "sql" && (
					<div className="flex flex-col gap-4">
						{/* Header */}
						<div>
							<h2 className="text-xl font-semibold text-foreground mb-1">
								Enter custom SQL
							</h2>
							<p className="text-sm text-muted-foreground">
								Write your own SQL query and execute it
							</p>
						</div>

						{/* SQL Input Area */}
						<div className="flex flex-col gap-2">
							<SqlMonacoEditor
								sql={customSql}
								onChange={onCustomSqlChange}
								className="h-48"
								tables={props.tables}
								columns={props.columns}
								onSubmit={handleCustomSqlSubmit}
								autoFocus
								placeholder="SELECT * FROM table_name;&#10;&#10;Ctrl+Enter to execute"
							/>
						</div>

						{/* Action Buttons */}
						<div className="flex gap-2">
							<Button
								onClick={handleCustomSqlSubmit}
								disabled={!customSql.trim()}
								className="flex items-center gap-2"
								size="sm"
								variant="default"
							>
								<svg
									className="h-4 w-4"
									fill="currentColor"
									viewBox="0 0 24 24"
								>
									<path d="M8 5v14l11-7z" />
								</svg>
								Execute
							</Button>
							<Button
								onClick={() => {
									navigate({
										search: (prev) => updateTabState(prev, { customSql: "" }),
									});
								}}
								disabled={!customSql.trim()}
								variant="outline"
								size="sm"
							>
								Clear
							</Button>
						</div>

						{/* Help Text */}
						<div className="text-xs text-muted-foreground border-t pt-3">
							<p>
								💡 Tip: Press{" "}
								<kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">
									Ctrl+Enter
								</kbd>{" "}
								to execute the query
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
