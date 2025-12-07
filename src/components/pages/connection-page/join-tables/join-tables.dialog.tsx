import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "#src/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#src/components/ui/dialog.tsx";
import { Stack } from "#src/components/ui/layout.tsx";
import { Spinner } from "#src/components/ui/spinner.tsx";
import { getTableColumnsQueryOptions } from "#src/server/introspection/start-fns/get-table-columns.start.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/introspection/start-fns/get-table-relationships.start.ts";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";
import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import { JoinedTableRow } from "./joined-table-row.tsx";
import { JoinableTableSelector } from "./joinable-table-selector.tsx";
import { useJoinTablesState } from "./use-join-tables-state.ts";
import type {
	JoinableTableOption,
	JoinedTable,
	JoinTablesConfig,
} from "./join-tables.types";

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
	const { joinConfig, addJoin, removeJoin, updateJoin, clearJoins } =
		useJoinTablesState(initialConfig);

	// Fetch relationships for the current table
	const relationshipsQuery = useQuery(
		getTableRelationshipsQueryOptions({
			url,
			schema,
			table,
		}),
	);

	// Fetch columns for each joined table
	const joinedTableColumnsQueries = useMemo(() => {
		return joinConfig.joins.map((join) =>
			getTableColumnsQueryOptions({
				url,
				schema: join.schema,
				table: join.table,
			}),
		);
	}, [joinConfig.joins, url]);

	const columnQueries = joinedTableColumnsQueries.map((opts) => useQuery(opts));

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

	const selectedTableIds = joinConfig.joins.map(
		(j) => `${j.schema}.${j.table}`,
	);

	const handleAddJoin = (option: JoinableTableOption) => {
		const join: JoinedTable = {
			table: option.table,
			schema: option.schema,
			type: "left",
			columns: "all",
			referencingColumn: option.referencingColumn,
			referencedColumn: option.referencedColumn,
		};
		addJoin(join);
	};

	const handleApply = () => {
		onApply(joinConfig);
		onOpenChange(false);
	};

	const handleCancel = () => {
		clearJoins();
		onOpenChange(false);
	};

	const isLoadingRelationships = relationshipsQuery.isLoading;
	const isLoadingColumns = columnQueries.some((q) => q.isLoading);

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(details) => onOpenChange(details.open)}
		>
			<DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Join Tables</DialogTitle>
					<DialogDescription>
						Configure joins for{" "}
						<span className="font-mono font-medium">
							{schema}.{table}
						</span>
					</DialogDescription>
				</DialogHeader>

				<Stack gap="4" className="py-4">
					{/* Joinable table selector */}
					{isLoadingRelationships ? (
						<div className="flex items-center justify-center py-4">
							<Spinner className="h-5 w-5" />
						</div>
					) : joinableTables.length === 0 ? (
						<div className="text-sm text-muted-foreground p-3 border border-dashed rounded">
							No relationships found for this table
						</div>
					) : (
						<JoinableTableSelector
							availableTables={joinableTables}
							selectedTableIds={selectedTableIds}
							onSelect={handleAddJoin}
						/>
					)}

					{/* Joined tables list */}
					{joinConfig.joins.length > 0 && (
						<Stack gap="3">
							<div className="text-sm font-medium">
								Selected Joins ({joinConfig.joins.length})
							</div>
							{joinConfig.joins.map((join, index) => {
								const columnsQuery = columnQueries[index];
								const columns = columnsQuery.data || [];

								return (
									<JoinedTableRow
										key={`${join.schema}.${join.table}`}
										joined={join}
										availableColumns={columns}
										onUpdateType={(type) =>
											updateJoin(join.table, join.schema, { type })
										}
										onUpdateColumns={(cols) =>
											updateJoin(join.table, join.schema, { columns: cols })
										}
										onRemove={() => removeJoin(join.table, join.schema)}
									/>
								);
							})}
						</Stack>
					)}

					{/* Result preview */}
					{joinConfig.joins.length > 0 && (
						<div className="p-3 bg-muted rounded text-xs space-y-2">
							<div className="font-medium text-muted-foreground">
								Result columns:
							</div>
							<div className="space-y-1 max-h-24 overflow-y-auto">
								{/* Original table columns */}
								<div>
									<span className="text-muted-foreground">
										• {schema}.{table}.*
									</span>
								</div>
								{/* Joined table columns */}
								{joinConfig.joins.map((join) => (
									<div key={`${join.schema}.${join.table}`}>
										<span className="text-muted-foreground">
											• {join.schema}.{join.table}
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

				{/* Dialog actions */}
				<div className="flex gap-2 justify-end pt-4">
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
					<Button onClick={handleApply} disabled={!joinConfig.joins.length}>
						Apply Joins
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
