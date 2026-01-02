import { ColumnHeaderContextProvider } from "#src/components/data-table/column-header-context.tsx";
import { DataTable } from "#src/components/data-table/data-table.tsx";
import { ScrollToColumnButton } from "#src/components/data-table/scroll-to-column.button.tsx";
import { ErrorBoundaryCard } from "#src/components/shared/error-boundary-card.tsx";
import { Button } from "#src/components/ui/button.tsx";
import { Stack } from "#src/components/ui/layout.tsx";
import { Spinner } from "#src/components/ui/spinner.tsx";
import { toaster } from "#src/components/ui/toaster.tsx";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { fromPixelToPercentage } from "#src/lib/calculate-percentage-from-pixels.ts";
import { formatSQL } from "#src/lib/format-sql.ts";
import { cn, tryFn } from "#src/lib/utils.ts";
import { queryClient } from "#src/query-client.ts";
import type { CustomSqlExecutionResult } from "#src/server/custom-sql/fns/get-custom-sql-execution.ts";
import {
	customSqlExecutionQueryOptions,
	executeAndStoreCustomSqlServerFn,
} from "#src/server/custom-sql/start-fns/execute-custom-sql.start.ts";
import {
	getDestructiveQuerySummary,
	isDestructiveQuery,
} from "#src/server/introspection/detect-destructive-sql.ts";
import { Splitter } from "@ark-ui/react";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	createColumnHelper,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { DbConnection } from "../connection.types.ts";
import { ConnectionPageStatusBar } from "./connection-page-status-bar.tsx";
import { updateTabState, useActiveTabState } from "./create-tab-state.ts";
import { DestructiveQueryConfirmDialog } from "./destructive-query-confirm.dialog.tsx";
import { ExplainOutputDrawer } from "./explain-output-drawer.tsx";
import { SqlQueryPreview } from "./sql-query-preview.tsx";
import { useExplainQuery } from "./use-explain-query.ts";
import { useTablesColumnsForIntellisense } from "./use-tables-columns-intellisense.ts";
import { RotateCcw } from "lucide-react";

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

	const { tables, columns } = useTablesColumnsForIntellisense({
		connectionUrl: activeConnectionUrl,
		schema: search.schema,
	});

	const executeCustomSqlMutation = useMutation({
		mutationFn: executeAndStoreCustomSqlServerFn,
		meta: { noInvalidate: true },
		onSuccess: (data) => {
			// After successful execution, update the URL to use the new customSqlId
			// and clear the customSql (since it's now stored in the database)
			if (!data?.customSqlId) return;
			queryClient.invalidateQueries(
				customSqlExecutionQueryOptions(search.customSqlId),
			);
			navigate({
				search: (prev) =>
					updateTabState(prev, {
						customSqlId: data.customSqlId,
						customSql: undefined,
					}),
			});
		},
	});

	// Check if we already have mutation results (fresh execution)
	const mutationResult = executeCustomSqlMutation.data;
	const hasMutationResult = !!mutationResult?.rows;

	// Query for previously executed custom SQL (when customSqlId is set)
	// Disabled if we already have mutation results (fresh execution)
	const customSqlExecutionQuery = useQuery({
		...customSqlExecutionQueryOptions(search.customSqlId),
		enabled:
			!!search.customSqlId &&
			!hasMutationResult &&
			!executeCustomSqlMutation.isPending,
	});

	// Determine current state
	const hasStoredExecution = !!search.customSqlId;
	const hasPendingCustomSql = !!search.customSql?.trim();

	// Get the stored data with proper type
	const storedData = customSqlExecutionQuery.data;

	// Get the SQL to display in editor
	const displaySql = search.customSql ?? storedData?.sql ?? baseSql;

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
			: storedData
				? {
						// Use stored rows if available
						rows: (storedData.resultRows ?? []) as Record<string, unknown>[],
						columns: (storedData.columns ?? []) as string[],
						rowCount: storedData.rowsReturned ?? 0,
						rowsAffected: storedData.rowsAffected ?? undefined,
						timeTaken: storedData.timeTaken ?? 0,
						ranAt: storedData.startedAt ?? 0,
					}
				: null;

	// Check if we have stored rows or need to re-execute
	const hasStoredRows = !!storedData?.resultRows?.length;

	const handleExecute = () => {
		const sqlToRun =
			search.customSql ??
			storedData?.sql ??
			executeCustomSqlMutation.variables?.data.sql;
		if (!sqlToRun) return;

		// If editing from a stored execution, track the parent query
		const previousId = search.customSqlId;

		// Check for destructive queries
		if (isDestructiveQuery(sqlToRun)) {
			setPendingQueryExecution(() => () => {
				executeCustomSqlMutation.mutate({
					data: {
						url: activeConnectionUrl,
						sql: sqlToRun,
						schemaName: search.schema,
						tableName: search.table,
						previousId,
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
				previousId,
			},
		});
	};

	const handleReExecuteStored = () => {
		const sql = storedData?.sql;
		if (!sql) return;

		// Re-executing same query, no previousId needed (it's the same query)
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

	const resultRows = executionResult?.rows ?? [];
	const resultColumns = executionResult?.columns ?? [];

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

		// Stored execution without stored rows (legacy data) - prompt to re-execute
		// This only applies to executions created before we started storing result_rows
		if (
			hasStoredExecution &&
			!hasMutationResult &&
			storedData &&
			!hasStoredRows
		) {
			return (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center space-y-4">
						<div>
							<p className="text-lg font-semibold text-foreground mb-2">
								Previous execution
							</p>
							<p className="text-sm text-muted-foreground mb-1">
								Ran at {new Date(storedData.startedAt).toLocaleString()}{" "}
								{storedData.timeTaken && ` in ${storedData.timeTaken}ms`}
							</p>
							<p className="text-sm text-muted-foreground">
								{storedData.rowsReturned} row
								{storedData.rowsReturned !== 1 ? "s" : ""} returned
							</p>
							<p className="text-sm text-muted-foreground">
								{storedData.rowsAffected} row
								{storedData.rowsAffected !== 1 ? "s" : ""} affected
							</p>
						</div>
						<Button onClick={handleReExecuteStored} className="gap-2">
							<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
							Re-execute
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

		// Empty result (either from mutation or stored execution)
		if (
			(hasMutationResult || hasStoredExecution) &&
			executionResult &&
			resultRows.length === 0
		) {
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
									warning={
										search.customSql && (
											<div className="ml-auto flex items-center justify-between gap-3 px-4">
												<p className="text-xs font-medium text-amber-900">
													📝 Updated SQL since last execution - use Ctrl+Enter
													to run
												</p>
												<Button
													variant="ghost"
													size="xs"
													onClick={() =>
														navigate({
															search: (prev) =>
																updateTabState(prev, {
																	customSql: undefined,
																	customSqlId: undefined,
																}),
														})
													}
													title="Reset to generated query and restore UI controls"
													className="px-2 text-xs gap-1 shrink-0"
												>
													<RotateCcw />
													Reset
												</Button>
											</div>
										)
									}
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
