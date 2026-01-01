import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useState, useMemo } from "react";
import { DataTable } from "#src/components/data-table/data-table.tsx";
import { ScrollToColumnButton } from "#src/components/data-table/scroll-to-column.button.tsx";
import { ErrorBoundaryCard } from "#src/components/shared/error-boundary-card.tsx";
import { Button } from "#src/components/ui/button.tsx";
import { Stack } from "#src/components/ui/layout.tsx";
import { Spinner } from "#src/components/ui/spinner.tsx";
import { toaster } from "#src/components/ui/toaster.tsx";
import { fromPixelToPercentage } from "#src/lib/calculate-percentage-from-pixels.ts";
import { formatSQL } from "#src/lib/format-sql.ts";
import { cn, tryFn } from "#src/lib/utils.ts";
import {
	executeAndStoreCustomSqlServerFn,
	customSqlExecutionQueryOptions,
} from "#src/server/custom-sql/start-fns/execute-custom-sql.start.ts";
import {
	getDestructiveQuerySummary,
	isDestructiveQuery,
} from "#src/server/introspection/detect-destructive-sql.ts";
import { Splitter } from "@ark-ui/react";
import {
	createColumnHelper,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { updateTabState, useActiveTabState } from "./create-tab-state.ts";
import { DestructiveQueryConfirmDialog } from "./destructive-query-confirm.dialog.tsx";
import { ExplainOutputDrawer } from "./explain-output-drawer.tsx";
import { SqlQueryPreview } from "./sql-query-preview.tsx";
import { ConnectionPageStatusBar } from "./connection-page-status-bar.tsx";
import type { DbConnection } from "../connection.types.ts";
import { ColumnHeaderContextProvider } from "#src/components/data-table/column-header-context.tsx";
import { useExplainQuery } from "./use-explain-query.ts";
import { useTablesColumnsForIntellisense } from "./use-tables-columns-intellisense.ts";
import { DatabaseDialect } from "#src/db/dialect.ts";

interface CustomSqlTabContentProps {
	connection: DbConnection;
	activeConnectionUrl: string;
	/** The base SQL from the table query (for showing in preview mode) */
	baseSql: string;
}

/**
 * Shape of the mutation result when executing custom SQL
 */
type CustomSqlMutationResult = {
	customSqlId: string;
	rows: Record<string, unknown>[];
	columns: string[];
	rowCount: number;
	rowsAffected: number | undefined;
	timeTaken: number;
	ranAt: number;
};

const panels = {
	sqlPreview: "sql-preview",
	rowsContent: "rows-content",
};

/**
 * Dedicated component for handling custom SQL execution mode
 * Uses append-only log approach with customSqlId for state management
 */
export function CustomSqlTabContent({
	connection,
	activeConnectionUrl,
	baseSql,
}: CustomSqlTabContentProps) {
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const search = useActiveTabState((tab) => ({
		tabId: tab.tabId,
		schema: tab.schema,
		table: tab.table,
		customSql: tab.customSql,
		customSqlId: tab.customSqlId,
		sqlEditorMode: tab.sqlEditorMode,
		sqlPreviewSize: tab.sqlPreviewSize,
		tableSize: tab.tableSize,
	}));

	const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(
		null,
	);
	const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
	const [showDestructiveConfirm, setShowDestructiveConfirm] = useState(false);
	const [pendingQueryExecution, setPendingQueryExecution] = useState<
		(() => void) | null
	>(null);

	// Fetch available tables/columns for intellisense
	const { tables, columns } = useTablesColumnsForIntellisense({
		connectionUrl: activeConnectionUrl,
		schema: search.schema,
	});

	// Query for previously executed custom SQL (when customSqlId is set)
	const customSqlExecutionQuery = useQuery(
		customSqlExecutionQueryOptions(search.customSqlId),
	);

	// Mutation for executing new custom SQL
	const executeCustomSqlMutation = useMutation({
		mutationFn: executeAndStoreCustomSqlServerFn,
		onSuccess: (data) => {
			// After successful execution, update the URL to use the new customSqlId
			// and clear the customSql (since it's now stored in the database)
			const result = data as CustomSqlMutationResult | undefined;
			if (result?.customSqlId) {
				navigate({
					search: (prev) =>
						updateTabState(prev, {
							customSqlId: result.customSqlId,
							customSql: undefined,
						}),
				});
			}
		},
	});

	// Determine current state
	const hasStoredExecution = !!search.customSqlId;
	const hasPendingCustomSql = !!search.customSql?.trim();

	// Get the SQL to display in editor
	const displaySql =
		search.customSql ?? customSqlExecutionQuery.data?.sql ?? baseSql;

	// Get mutation result with proper type
	const mutationResult = executeCustomSqlMutation.data as
		| CustomSqlMutationResult
		| undefined;
	const hasMutationResult = !!mutationResult?.rows;

	// Get execution result (either from mutation or from stored execution)
	const executionResult: {
		rows: Record<string, unknown>[];
		columns: string[];
		rowCount: number;
		rowsAffected: number | undefined;
		timeTaken: number;
		ranAt: number;
	} | null =
		hasMutationResult && mutationResult
			? {
					rows: mutationResult.rows,
					columns: mutationResult.columns,
					rowCount: mutationResult.rowCount,
					rowsAffected: mutationResult.rowsAffected,
					timeTaken: mutationResult.timeTaken,
					ranAt: mutationResult.ranAt,
				}
			: customSqlExecutionQuery.data
				? {
						rows: [] as Record<string, unknown>[], // We don't store rows in the database, only metadata
						columns: (customSqlExecutionQuery.data.columns ?? []) as string[],
						rowCount: customSqlExecutionQuery.data.rowsReturned ?? 0,
						rowsAffected:
							customSqlExecutionQuery.data.rowsAffected ?? undefined,
						timeTaken: customSqlExecutionQuery.data.timeTaken ?? 0,
						ranAt: customSqlExecutionQuery.data.startedAt ?? 0,
					}
				: null;

	// Note: For stored executions, we need to re-execute to get the actual rows
	// since we only store metadata, not the actual result data
	const needsReExecution = hasStoredExecution && !hasMutationResult;

	const handleExecute = () => {
		const sqlToRun = search.customSql ?? customSqlExecutionQuery.data?.sql;
		if (!sqlToRun) return;

		// Check for destructive queries
		if (isDestructiveQuery(sqlToRun)) {
			setPendingQueryExecution(() => () => {
				executeCustomSqlMutation.mutate({
					data: {
						url: activeConnectionUrl,
						sql: sqlToRun,
						schemaName: search.schema,
						tableName: search.table,
					},
				});
				setShowDestructiveConfirm(false);
				setPendingQueryExecution(null);
			});
			setShowDestructiveConfirm(true);
			return;
		}

		executeCustomSqlMutation.mutate({
			data: {
				url: activeConnectionUrl,
				sql: sqlToRun,
				schemaName: search.schema,
				tableName: search.table,
			},
		});
	};

	const handleReExecuteStored = () => {
		const sql = customSqlExecutionQuery.data?.sql;
		if (!sql) return;

		executeCustomSqlMutation.mutate({
			data: {
				url: activeConnectionUrl,
				sql,
				schemaName: search.schema,
				tableName: search.table,
			},
		});
	};

	const onEditorValueChange = useDebouncedCallback(
		(value: string) => {
			return navigate({
				search: (prev) =>
					updateTabState(prev, {
						customSql: value,
						// When editing, we're creating a new query, so clear the stored ID
						customSqlId: undefined,
					}),
			});
		},
		{ wait: 500 },
	);

	// Explain query functionality
	const {
		explainQuery,
		showExplainPanel,
		setShowExplainPanel,
		isExplainDisabled,
	} = useExplainQuery({
		connectionUrl: activeConnectionUrl,
		sql: displaySql,
		dialect: connection.dialect,
	});

	// Build TanStack Table for custom SQL results
	const resultRows =
		hasMutationResult && mutationResult ? mutationResult.rows : [];
	const resultColumns =
		hasMutationResult && mutationResult ? mutationResult.columns : [];

	const columnHelper = createColumnHelper<Record<string, unknown>>();
	const tableColumns = useMemo(() => {
		return resultColumns.map((col: string) =>
			columnHelper.accessor(col, {
				id: col,
				header: col,
				cell: (info) => {
					const value = info.getValue();
					if (value === null)
						return <span className="text-muted-foreground italic">NULL</span>;
					if (typeof value === "object") return JSON.stringify(value);
					return String(value);
				},
			}),
		);
	}, [resultColumns, columnHelper]);

	const table = useReactTable({
		data: resultRows as Record<string, unknown>[],
		columns: tableColumns,
		getCoreRowModel: getCoreRowModel(),
	});

	// Determine what to render in the content area
	const renderContent = () => {
		// Loading state
		if (
			executeCustomSqlMutation.isPending ||
			customSqlExecutionQuery.isLoading
		) {
			return (
				<Stack className="flex-1 flex items-center justify-center">
					<Spinner />
					<span className="text-muted-foreground">
						{executeCustomSqlMutation.isPending
							? "Executing custom SQL..."
							: "Loading execution result..."}
					</span>
				</Stack>
			);
		}

		// Error state
		if (executeCustomSqlMutation.isError) {
			return (
				<div className="flex-1 flex items-center justify-center p-4">
					<Stack className="max-w-2xl w-full">
						<ErrorBoundaryCard
							error={executeCustomSqlMutation.error}
							title="Error executing custom SQL"
							onRetry={handleExecute}
						/>
					</Stack>
				</div>
			);
		}

		// Rows affected (non-SELECT query)
		if (
			hasMutationResult &&
			mutationResult &&
			mutationResult.rowsAffected !== undefined
		) {
			return (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<p className="text-lg font-semibold text-foreground mb-2">
							Query executed successfully
						</p>
						<p className="text-base text-muted-foreground">
							{mutationResult.rowsAffected === 1
								? `${mutationResult.rowsAffected} row affected`
								: `${mutationResult.rowsAffected} rows affected`}
						</p>
					</div>
				</div>
			);
		}

		// Stored execution without fresh data - prompt to re-execute
		if (needsReExecution && customSqlExecutionQuery.data) {
			const storedResult = customSqlExecutionQuery.data;
			return (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center space-y-4">
						<div>
							<p className="text-lg font-semibold text-foreground mb-2">
								Previous execution
							</p>
							<p className="text-sm text-muted-foreground mb-1">
								Ran at {new Date(storedResult.startedAt).toLocaleString()}
							</p>
							<p className="text-sm text-muted-foreground">
								{storedResult.rowsReturned} row
								{storedResult.rowsReturned !== 1 ? "s" : ""} returned
								{storedResult.timeTaken && ` in ${storedResult.timeTaken}ms`}
							</p>
						</div>
						<Button onClick={handleReExecuteStored} className="gap-2">
							<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
							Re-execute to see results
						</Button>
					</div>
				</div>
			);
		}

		// Pending custom SQL (not yet executed)
		if (hasPendingCustomSql && !hasMutationResult) {
			return (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<p className="text-lg font-semibold text-foreground mb-2">
							Custom SQL ready
						</p>
						<p className="text-sm text-muted-foreground mb-4">
							Click Execute or press Ctrl+Enter in the editor to run
						</p>
						<Button onClick={handleExecute} className="gap-2">
							<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
							Execute Query
						</Button>
					</div>
				</div>
			);
		}

		// Results table
		if (resultRows.length > 0) {
			return (
				<ColumnHeaderContextProvider>
					<DataTable
						enableRowVirtualization
						enableColumnOrdering
						table={table}
						getTableContainer={setTableContainer}
						isLoading={false}
						size={search.tableSize}
					/>
					<ScrollToColumnButton
						table={table}
						containerRef={{ current: tableContainer }}
					/>
				</ColumnHeaderContextProvider>
			);
		}

		// Empty result
		if (hasMutationResult && resultRows.length === 0) {
			return (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<p className="text-lg font-semibold text-foreground mb-2">
							Query executed successfully
						</p>
						<p className="text-sm text-muted-foreground">No rows returned</p>
					</div>
				</div>
			);
		}

		// Default: show prompt to write SQL
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center">
					<p className="text-lg font-semibold text-foreground mb-2">
						Write your SQL query
					</p>
					<p className="text-sm text-muted-foreground">
						Use the editor above to write and execute custom SQL
					</p>
				</div>
			</div>
		);
	};

	return (
		<>
			<div className="flex-1 overflow-hidden flex flex-col h-full">
				<Splitter.Root
					key={search.tabId}
					orientation="vertical"
					className="flex-1 flex flex-col h-full overflow-hidden"
					defaultSize={[
						search.sqlPreviewSize ?? fromPixelToPercentage(200, "vertical"),
						search.sqlPreviewSize
							? 100 - search.sqlPreviewSize
							: fromPixelToPercentage(656, "vertical"),
					]}
					panels={[
						{
							id: panels.sqlPreview,
							collapsible: true,
							minSize: fromPixelToPercentage(220, "vertical"),
						},
						{ id: panels.rowsContent, collapsible: false },
					]}
					onResizeEnd={(details) => {
						void navigate({
							search: (prev) =>
								updateTabState(prev, {
									sqlPreviewSize: details.size[0],
								}),
						});
					}}
					onExpand={(details) => {
						if (details.panelId === panels.sqlPreview) {
							void navigate({
								search: (prev) =>
									updateTabState(prev, {
										sqlPreviewSize: details.size,
									}),
							});
						}
					}}
					onCollapse={(details) => {
						if (details.panelId === panels.sqlPreview) {
							void navigate({
								search: (prev) =>
									updateTabState(prev, {
										sqlPreviewSize: details.size,
									}),
							});
						}
					}}
				>
					{/* SQL Editor */}
					<Splitter.Panel id={panels.sqlPreview} className="overflow-hidden">
						<Splitter.Context>
							{(ctx) => (
								<SqlQueryPreview
									tables={tables}
									columns={columns}
									sql={displaySql}
									isCollapsed={Boolean(
										tryFn(() => ctx.isPanelCollapsed(panels.sqlPreview)),
									)}
									onToggleCollapsed={() =>
										tryFn(() => ctx.isPanelCollapsed(panels.sqlPreview))
											? ctx.expandPanel(panels.sqlPreview)
											: ctx.collapsePanel(panels.sqlPreview)
									}
									editorMode={search.sqlEditorMode ?? "editor"}
									onEditorModeChange={(mode) =>
										navigate({
											search: (prev) =>
												updateTabState(prev, {
													sqlEditorMode: mode,
												}),
										})
									}
									customSql={search.customSql}
									onEditorChange={(value) => onEditorValueChange(value)}
									onResetCustomSql={() =>
										navigate({
											search: (prev) =>
												updateTabState(prev, {
													customSql: undefined,
													customSqlId: undefined,
												}),
										})
									}
									onRun={handleExecute}
									onExplain={explainQuery.refetch}
									disableExplain={isExplainDisabled}
									onFormat={() => {
										const sqlToFormat = search.customSql ?? displaySql;
										if (!sqlToFormat) {
											alert("No SQL query to format");
											return;
										}

										try {
											const formatted = formatSQL(sqlToFormat, {
												language:
													connection.dialect === DatabaseDialect.Postgres
														? "postgresql"
														: "sqlite",
												onError: (error) => {
													toaster.create({
														title: "Failed to format SQL",
														description: error.message,
													});
												},
											});
											navigate({
												search: (prev) =>
													updateTabState(prev, {
														customSql: formatted,
														sqlEditorMode: "editor",
													}),
											});
										} catch (error) {
											const message =
												error instanceof Error
													? error.message
													: "Failed to format SQL";
											alert(`Error formatting SQL: ${message}`);
										}
									}}
									onToggleFullscreen={() =>
										setIsEditorFullscreen(!isEditorFullscreen)
									}
									isFullscreen={isEditorFullscreen}
									className="text-sm h-full"
								/>
							)}
						</Splitter.Context>
					</Splitter.Panel>

					<Splitter.Context>
						{(ctx) => (
							<Splitter.ResizeTrigger
								id={`${panels.sqlPreview}:${panels.rowsContent}`}
								className={cn(
									tryFn(() => ctx.isPanelCollapsed(panels.sqlPreview))
										? "h-2"
										: "h-1.5",
									"bg-border hover:bg-primary/50 cursor-row-resize transition-colors",
								)}
								title="Drag to resize"
								onDoubleClick={() =>
									ctx.isPanelExpanded(panels.sqlPreview)
										? ctx.collapsePanel(panels.sqlPreview)
										: ctx.expandPanel(panels.sqlPreview)
								}
							/>
						)}
					</Splitter.Context>

					<Splitter.Panel
						id={panels.rowsContent}
						className="overflow-hidden flex flex-col"
					>
						{renderContent()}

						{/* Status Bar */}
						<div className="shrink-0 border-t">
							<ConnectionPageStatusBar
								table={table}
								hasUuid={false}
								isLoading={executeCustomSqlMutation.isPending}
								refetch={handleExecute}
								timeTaken={executionResult?.timeTaken ?? 0}
								ranAt={executionResult?.ranAt ?? 0}
								totalRowCount={executionResult?.rowCount ?? 0}
								rowsColumnsCount={resultColumns.length}
								isCustomSql
							/>
						</div>
					</Splitter.Panel>
				</Splitter.Root>
			</div>

			{/* Explain Output Drawer */}
			<ExplainOutputDrawer
				showExplainPanel={showExplainPanel}
				setShowExplainPanel={setShowExplainPanel}
				output={explainQuery.data ?? null}
			/>

			{/* Destructive Query Confirmation */}
			<DestructiveQueryConfirmDialog
				isOpen={showDestructiveConfirm}
				onConfirm={() => {
					pendingQueryExecution?.();
				}}
				onCancel={() => {
					setShowDestructiveConfirm(false);
					setPendingQueryExecution(null);
				}}
				queryType={getDestructiveQuerySummary(
					search.customSql || displaySql || "",
				)}
				isLoading={executeCustomSqlMutation.isPending}
			/>
		</>
	);
}
