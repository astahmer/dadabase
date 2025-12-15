import { Button } from "#src/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#src/components/ui/dialog.tsx";
import { HStack, Stack } from "#src/components/ui/layout.tsx";
import {
	ListboxMenuFilterInput,
	ListboxMenuItem,
	ListboxMenuList,
	ListboxRoot,
} from "#src/components/ui/listbox-menu.tsx";
import { Spinner } from "#src/components/ui/spinner.tsx";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { buildJoinSqlPreview } from "#src/server/introspection/join-builder.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/introspection/start-fns/get-table-relationships.start.ts";
import { createListCollection, useFilter } from "@ark-ui/react";
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { TableName } from "../table-name.tsx";
import type { JoinTablesConfig } from "./join-tables.types";
import { SortableJoinedTableRow } from "./sortable-joined-table-row.tsx";
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

export const JoinTablesDialog = (props: JoinTablesDialogProps) => {
	return (
		<Dialog
			open={props.isOpen}
			onOpenChange={(details) => props.onOpenChange(details.open)}
			lazyMount
		>
			<DialogContent
				className="min-h-[420px] max-h-80vh flex flex-col"
				size="4xl"
			>
				{props.isOpen && <JoinTablesDialogContent {...props} />}
			</DialogContent>
		</Dialog>
	);
};

const JoinTablesDialogContent = (
	props: Omit<JoinTablesDialogProps, "isOpen">,
) => {
	const { onOpenChange, url, schema, table, onApply, initialConfig } = props;
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

	// Build list of joinable tables from relationships - keep the full relationship data
	const joinableTables = useMemo(() => {
		if (!relationshipsQuery.data) return [];
		return relationshipsQuery.data;
	}, [relationshipsQuery.data]);

	const selectedTableIds = joinState.config.joins.map(
		(j) => `${j.schema}.${j.table}`,
	);

	const unselectedRelationships = joinableTables.filter((rel) => {
		const targetTable =
			rel.type === "outgoing" ? rel.referencedTable : rel.referencingTable;
		const targetSchema =
			rel.type === "outgoing" ? rel.referencedSchema : rel.referencingSchema;
		return !selectedTableIds.includes(`${targetSchema}.${targetTable}`);
	});

	const filters = useFilter({ sensitivity: "base" });
	const [searchInput, setSearchInput] = useState("");

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const oldIndex = joinState.config.joins.findIndex(
				(j) => `${j.schema}.${j.table}` === active.id,
			);
			const newIndex = joinState.config.joins.findIndex(
				(j) => `${j.schema}.${j.table}` === over.id,
			);
			if (oldIndex !== -1 && newIndex !== -1) {
				joinState.reorder(oldIndex, newIndex);
			}
		}
	};

	const tableCollection = createListCollection({
		items: unselectedRelationships.map((rel) => ({
			label: `${rel.type === "outgoing" ? rel.referencedSchema : rel.referencingSchema}.${rel.type === "outgoing" ? rel.referencedTable : rel.referencingTable}`,
			value: rel.constraintName,
			rel: rel,
			type: rel.type,
		})),
		groupBy: (item) => item.type,
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
		<>
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
				) : unselectedRelationships.length === 0 ? (
					<div className="text-sm text-muted-foreground p-3 border border-dashed rounded">
						No relationships found for this table
					</div>
				) : (
					<div className="space-y-2">
						<div className="text-sm font-medium">Add Table to Join</div>
						<ListboxRoot collection={tableCollection} selectionMode="none">
							<ListboxMenuFilterInput
								placeholder="Search tables..."
								onChange={(e) => {
									setSearchInput(e.target.value);
								}}
							/>
							<ListboxMenuList className="max-h-40">
								{tableCollection.group().map(([type, group]) => {
									const filteredGroup = group.filter((item) =>
										filters.contains(item.value, searchInput),
									);

									if (filteredGroup.length === 0) return null;

									const typeLabel =
										type === "outgoing"
											? `Outgoing: Foreign keys (${filteredGroup.length})`
											: `Incoming: Referenced by (${filteredGroup.length})`;

									return (
										<div key={type}>
											<div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
												{typeLabel}
											</div>
											{filteredGroup.map((item) => {
												const rel = item.rel;
												const targetTable =
													rel.type === "outgoing"
														? rel.referencedTable
														: rel.referencingTable;
												const targetSchema =
													rel.type === "outgoing"
														? rel.referencedSchema
														: rel.referencingSchema;
												const firstLabel =
													rel.type === "outgoing"
														? `${rel.referencingTable}.${rel.referencingColumn}`
														: `${rel.referencingTable}.${rel.referencingColumn}`;
												const secondLabel =
													rel.type === "outgoing"
														? `${rel.referencedTable}.${rel.referencedColumn}`
														: `${rel.referencedTable}.${rel.referencedColumn}`;

												return (
													<ListboxMenuItem
														key={`${rel.constraintName}.${rel.referencingColumn}.${rel.referencedColumn}.${rel.referencingTable}.${rel.referencedTable}.${rel.type}`}
														item={rel.constraintName}
														onClick={() => {
															const referencingCol =
																rel.type === "outgoing"
																	? rel.referencingColumn
																	: rel.referencedColumn;
															const referencedCol =
																rel.type === "outgoing"
																	? rel.referencedColumn
																	: rel.referencingColumn;

															joinState.add({
																schema: targetSchema,
																table: targetTable,
																type: "left",
																columns: "all",
																joinCondition: {
																	mode: "standard",
																	referencingColumn: referencingCol,
																	referencedColumn: referencedCol,
																},
															});
														}}
													>
														<HStack
															className="flex-1 min-w-0"
															align="center"
															title={`${firstLabel} › ${secondLabel}`}
														>
															<div className="font-medium truncate">
																{firstLabel}
															</div>
															<div className="text-muted-foreground shrink-0">
																›
															</div>
															<div className="text-muted-foreground truncate text-xs">
																{secondLabel}
															</div>
														</HStack>
													</ListboxMenuItem>
												);
											})}
										</div>
									);
								})}
							</ListboxMenuList>
						</ListboxRoot>
					</div>
				)}{" "}
				{/* Joined tables list */}
				{joinState.config.joins.length > 0 && (
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<Stack gap="3">
							<div className="text-sm font-medium">
								Selected Joins ({joinState.config.joins.length})
							</div>
							<SortableContext
								items={joinState.config.joins.map(
									(j) => `${j.schema}.${j.table}`,
								)}
								strategy={verticalListSortingStrategy}
							>
								{joinState.config.joins.map((join, index) => {
									const columnsQuery = columnQueries[index];
									const columns = columnsQuery.data || [];

									if (columnsQuery.isLoading) {
										return (
											<Stack key={index}>
												<Spinner className="h-4 w-4" />
											</Stack>
										);
									}

									return (
										<SortableJoinedTableRow
											key={`${join.schema}.${join.table}.${join.type}.${index}`}
											joined={join}
											availableColumns={columns}
											parentSchema={schema}
											parentTable={table}
											index={index}
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
							</SortableContext>
						</Stack>
					</DndContext>
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
								DatabaseDialect.Postgres, // TODO
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
		</>
	);
};
