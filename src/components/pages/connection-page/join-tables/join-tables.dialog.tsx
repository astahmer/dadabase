import { createListCollection, useFilter } from "@ark-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "#src/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#src/components/ui/dialog.tsx";
import { Stack } from "#src/components/ui/layout.tsx";
import {
	ListboxMenuFilterInput,
	ListboxMenuItem,
	ListboxMenuList,
	ListboxRoot,
} from "#src/components/ui/listbox-menu.tsx";
import { Spinner } from "#src/components/ui/spinner.tsx";
import { buildJoinSqlPreview } from "#src/lib/build-join-sql-preview.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/introspection/start-fns/get-table-relationships.start.ts";
import { TableName } from "../table-name.tsx";
import type {
	JoinableTableOption,
	JoinTablesConfig,
} from "./join-tables.types";
import { JoinedTableRow } from "./joined-table-row.tsx";
import { useJoinTablesState } from "./use-join-tables-state.ts";
import { useJoinedTables } from "./use-joined-tables.ts";

interface JoinTablesDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	url: string;
	schema: string;
	table: string;
	onApply: (config: JoinTablesConfig) => void;
	initialConfig?: JoinTablesConfig;
}

export const JoinTablesDialog = ({
	isOpen,
	onOpenChange,
	url,
	schema,
	table,
	onApply,
	initialConfig,
}: JoinTablesDialogProps) => {
	const joinState = useJoinTablesState(initialConfig);

	const relationshipsQuery = useQuery(
		getTableRelationshipsQueryOptions({
			url,
			schema,
			table,
		}),
	);

	const columnQueries = useJoinedTables({
		url: url,
		joins: joinState.config.joins,
	});

	// Build list of joinable tables from relationships
	const joinableTables = useMemo<JoinableTableOption[]>(() => {
		if (!relationshipsQuery.data) return [];

		return relationshipsQuery.data.map((rel) => ({
			table:
				rel.type === "outgoing" ? rel.referencedTable : rel.referencingTable,
			schema:
				rel.type === "outgoing" ? rel.referencedSchema : rel.referencingSchema,
			referencingColumn:
				rel.type === "outgoing" ? rel.referencingColumn : rel.referencedColumn,
			referencedColumn:
				rel.type === "outgoing" ? rel.referencedColumn : rel.referencingColumn,
			direction: rel.type,
		}));
	}, [relationshipsQuery.data]);

	const selectedTableIds = joinState.config.joins.map(
		(j) => `${j.schema}.${j.table}`,
	);

	const unselectedTables = joinableTables.filter(
		(t) => !selectedTableIds.includes(`${t.schema}.${t.table}`),
	);

	const filters = useFilter({ sensitivity: "base" });
	const [searchInput, setSearchInput] = useState("");
	const tableCollection = createListCollection({
		items: unselectedTables.map((join) => ({
			label: `${join.schema}.${join.table}`,
			value: `${join.schema}:${join.table}:${join.referencingColumn}:${join.referencedColumn}:${join.direction}`,
			join: join,
		})),
	});

	const handleApply = () => {
		onApply(joinState.config);
		onOpenChange(false);
	};

	const handleCancel = () => {
		joinState.clear();
		onApply({ joins: [] });
		onOpenChange(false);
	};

	const isLoadingRelationships = relationshipsQuery.isLoading;

	const schemaListQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: url }),
		retry: 3,
	});
	const schemaList = schemaListQuery.data || [];

	const tablesListQuery = useQuery({
		...listAvailableTablesQueryOptions({ url: url }),
		retry: 3,
	});
	const tableList = tablesListQuery.data || [];

	const schemaWithTables = schemaList.filter((schema) =>
		tableList.some((t) => t.schema === schema),
	);
	const hasMultipleSchemas = schemaWithTables.length > 1;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(details) => onOpenChange(details.open)}
			lazyMount
		>
			<DialogContent
				className="min-h-[420px] max-h-80vh flex flex-col"
				size="4xl"
			>
				<DialogHeader>
					<DialogTitle>Join Tables</DialogTitle>
					<DialogDescription>
						Configure joins for{" "}
						<span className="font-mono font-medium">
							<TableName
								schema={schema}
								table={table}
								hasMultipleSchemas={hasMultipleSchemas}
							/>
						</span>
					</DialogDescription>
				</DialogHeader>

				<Stack gap="4" className="flex-1 overflow-y-auto py-4">
					{/* Joinable table selector */}
					{isLoadingRelationships ? (
						<div className="flex items-center justify-center py-4">
							<Spinner className="h-5 w-5" />
						</div>
					) : unselectedTables.length === 0 ? (
						<div className="text-sm text-muted-foreground p-3 border border-dashed rounded">
							No relationships found for this table
						</div>
					) : (
						<div className="space-y-2">
							{/* TODO show relationship name like in bottom panel */}
							<div className="text-sm font-medium">Add Table to Join</div>
							<ListboxRoot collection={tableCollection} selectionMode="none">
								<ListboxMenuFilterInput
									placeholder="Search tables..."
									onChange={(e) => {
										setSearchInput(e.target.value);
									}}
								/>
								<ListboxMenuList className="max-h-32">
									{unselectedTables
										.filter((join) => filters.contains(join.table, searchInput))
										.map((join) => (
											<ListboxMenuItem
												key={`${join.schema}:${join.table}:${join.referencingColumn}:${join.referencedColumn}:${join.direction}`}
												item={`${join.schema}:${join.table}:${join.referencingColumn}:${join.referencedColumn}:${join.direction}`}
												onClick={() => {
													joinState.add({
														schema: join.schema,
														table: join.table,
														type: "left",
														columns: "all",
														joinCondition: {
															mode: "standard",
															referencingColumn: join.referencingColumn,
															referencedColumn: join.referencedColumn,
														},
													});
												}}
											>
												<div className="flex items-center gap-2">
													<span className="truncate">
														<TableName
															schema={join.schema}
															table={join.table}
															hasMultipleSchemas={hasMultipleSchemas}
														/>
													</span>
													<span className="ml-auto text-xs text-muted-foreground italic">
														{join.direction === "outgoing"
															? "Outgoing: Foreign key"
															: "Incoming: Referenced by"}
													</span>
												</div>
											</ListboxMenuItem>
										))}
								</ListboxMenuList>
							</ListboxRoot>
						</div>
					)}{" "}
					{/* Joined tables list */}
					{joinState.config.joins.length > 0 && (
						<Stack gap="3">
							<div className="text-sm font-medium">
								Selected Joins ({joinState.config.joins.length})
							</div>
							{joinState.config.joins.map((join, index) => {
								const columnsQuery = columnQueries[index];
								const columns = columnsQuery.data || [];

								return (
									<JoinedTableRow
										key={`${join.schema}.${join.table}`}
										joined={join}
										availableColumns={columns}
										parentSchema={schema}
										parentTable={table}
										onUpdateType={(type) =>
											joinState.update(join.table, join.schema, { type })
										}
										onUpdateColumns={(cols) =>
											joinState.update(join.table, join.schema, {
												columns: cols,
											})
										}
										onUpdateFilters={(filters) =>
											joinState.update(join.table, join.schema, {
												filters,
											})
										}
										onUpdateJoinConditionMode={(mode) =>
											joinState.updateJoinConditionMode(
												join.table,
												join.schema,
												mode,
											)
										}
										onUpdateCustomJoinConditions={(conditions) =>
											joinState.updateCustomJoinConditions(
												join.table,
												join.schema,
												conditions,
											)
										}
										onUpdateJoinCondition={(updates) =>
											joinState.update(join.table, join.schema, updates)
										}
										onRemove={() => joinState.remove(join.table, join.schema)}
									/>
								);
							})}
						</Stack>
					)}
					{/* SQL preview */}
					{joinState.config.joins.length > 0 && (
						<div className="space-y-2">
							<div className="text-sm font-medium">Generated SQL:</div>
							<div className="p-3 bg-slate-900 rounded text-xs font-mono text-slate-100 overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
								{buildJoinSqlPreview(
									schema,
									table,
									joinState.config.joins,
									"postgres",
								)}
							</div>
						</div>
					)}
					{/* Result preview */}
					{joinState.config.joins.length > 0 && (
						<div className="p-3 bg-muted rounded text-xs space-y-2">
							<div className="font-medium text-muted-foreground">
								Result columns:
							</div>
							<div className="space-y-1 max-h-24 overflow-y-auto">
								{/* Original table columns */}
								<div>
									<span className="text-muted-foreground">
										•{" "}
										<TableName
											schema={schema}
											table={table}
											hasMultipleSchemas={hasMultipleSchemas}
										/>
										.*
									</span>
								</div>
								{/* Joined table columns */}
								{joinState.config.joins.map((join) => (
									<div key={`${join.schema}.${join.table}`}>
										<span className="text-muted-foreground">
											•{" "}
											<TableName
												schema={join.schema}
												table={join.table}
												hasMultipleSchemas={hasMultipleSchemas}
											/>
											{join.columns === "all"
												? ".*"
												: ` (${join.columns.length} cols)`}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</Stack>

				<DialogFooter className="shrink-0">
					<div className="flex gap-2 justify-end pt-4">
						<Button variant="outline" onClick={handleCancel}>
							Clear joins
						</Button>
						<Button
							onClick={handleApply}
							disabled={!joinState.config.joins.length}
						>
							Apply joins
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
