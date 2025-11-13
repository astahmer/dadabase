import { useState } from "react";
import {
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Trash2,
	Download,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { TableRelationship } from "#src/server/pg/fns/get-table-relationships.kysely.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/pg/start-fns/get-table-relationships.start.ts";
import { queryRelationshipSubrowDataQueryOptions } from "#src/server/pg/start-fns/get-relationship-subrow-data.start";
import { getRelationshipCardinalityQueryOptions } from "#src/server/pg/start-fns/get-relationship-cardinality.start.ts";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";
import { HStack } from "./ui/layout.tsx";

interface RelationshipsPanelProps {
	connectionUrl: string;
	schema: string;
	table: string;
	selectedRowId: string | null;
	rowData: Record<string, unknown> | null;
	isPanelExpanded: boolean;
	onPanelHidden: () => void;
	onPanelExpanded: () => void;
	selectedRowCount?: number;
	onDelete?: () => void;
	onExport?: () => void;
	isActionLoading?: boolean;
}

export const RelationshipsPanel = ({
	connectionUrl,
	schema,
	table,
	selectedRowId,
	rowData,
	isPanelExpanded,
	onPanelHidden,
	onPanelExpanded,
	selectedRowCount = 1,
	onDelete,
	onExport,
	isActionLoading = false,
}: RelationshipsPanelProps) => {
	const [expandedRelationships, setExpandedRelationships] = useState<
		Set<string>
	>(new Set());

	// Fetch relationships for this table
	const relationshipsQuery = useQuery(
		getTableRelationshipsQueryOptions({
			url: connectionUrl,
			schema,
			table,
		}),
	);

	if (!selectedRowId || !rowData) {
		return null;
	}

	const relationships = relationshipsQuery.data ?? [];
	const outgoingRels = relationships.filter((r) => r.type === "outgoing");
	const incomingRels = relationships.filter((r) => r.type === "incoming");

	const toggleExpanded = (constraintName: string) => {
		setExpandedRelationships((prev) => {
			const next = new Set(prev);
			if (next.has(constraintName)) {
				next.delete(constraintName);
			} else {
				next.add(constraintName);
			}
			return next;
		});
	};

	if (!isPanelExpanded) {
		const allRelationshipTables = relationships
			.map((r) =>
				r.type === "outgoing" ? r.referencedTable : r.referencingTable,
			)
			.filter((table, idx, arr) => arr.indexOf(table) === idx); // Deduplicate

		return (
			<div className="border-t bg-muted/40 h-10 flex items-center px-3 shrink-0 min-h-10 gap-2 overflow-x-auto">
				<button
					onClick={() => {
						onPanelExpanded();
					}}
					className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
					title="Expand relationships panel"
				>
					<ChevronUp className="h-3 w-3" />
					<span className="font-medium">Relations:</span>
				</button>

				{allRelationshipTables.length > 0 ? (
					<div className="flex items-center gap-1 flex-1 min-w-0">
						{allRelationshipTables.slice(0, 4).map((relTable) => (
							<button
								key={relTable}
								onClick={() => {
									// TODO also expand the relation in the panel
									onPanelExpanded();
								}}
								className="px-2 py-0.5 text-xs bg-background border border-border/50 rounded hover:bg-accent/50 hover:border-border transition-colors whitespace-nowrap shrink-0"
								title={`Click to expand and view ${relTable}`}
							>
								{relTable}
							</button>
						))}
						{allRelationshipTables.length > 4 && (
							<button
								onClick={() => {
									// TODO also expand the relation in the panel
									onPanelExpanded();
								}}
								className="px-2 py-0.5 text-xs bg-background border border-border/50 rounded hover:bg-accent/50 hover:border-border transition-colors whitespace-nowrap shrink-0"
							>
								{allRelationshipTables.length - 4} more
							</button>
						)}
					</div>
				) : (
					<span className="text-xs text-muted-foreground italic">
						No relationships
					</span>
				)}

				{/* Bulk Actions */}
				{/* TODO */}
				{selectedRowCount > 0 && false && (
					<div className="ml-auto flex items-center gap-1 shrink-0">
						{onExport && (
							<Button
								variant="outline"
								size="sm"
								onClick={onExport}
								disabled={isActionLoading}
								className="h-6 px-2 text-xs"
								title="Export selected rows"
							>
								<Download className="h-3 w-3 mr-1" />
								Export
							</Button>
						)}
						{onDelete && (
							<Button
								variant="destructive"
								size="sm"
								onClick={onDelete}
								disabled={isActionLoading}
								className="h-6 px-2 text-xs"
								title="Delete selected rows"
							>
								<Trash2 className="h-3 w-3 mr-1" />
								Delete
							</Button>
						)}
						<button
							onClick={() => {
								onPanelExpanded();
							}}
							className="p-1 hover:bg-accent/50 rounded transition-colors shrink-0"
							title="Expand relationships panel"
						>
							<ChevronUp className="h-4 w-4" />
						</button>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="border-t bg-card flex flex-col h-full overflow-hidden">
			<div className="px-4 py-3 border-b flex items-center justify-between shrink-0 gap-2">
				<div className="flex items-center gap-2 min-w-0 flex-1">
					<span className="text-sm text-foreground font-medium whitespace-nowrap">
						{schema}.{table}
					</span>
					<span className="text-xs text-muted-foreground">=</span>
					<span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
						{selectedRowId}
					</span>
				</div>

				{/* Bulk Actions in Expanded State */}
				{/* TODO */}
				{selectedRowCount > 0 && false && (
					<div className="flex items-center gap-1 shrink-0">
						{onExport && (
							<Button
								variant="outline"
								size="sm"
								onClick={onExport}
								disabled={isActionLoading}
								className="h-7 px-2 text-xs"
								title="Export selected rows"
							>
								<Download className="h-3 w-3 mr-1" />
								Export
							</Button>
						)}
						{onDelete && (
							<Button
								variant="destructive"
								size="sm"
								onClick={onDelete}
								disabled={isActionLoading}
								className="h-7 px-2 text-xs"
								title="Delete selected rows"
							>
								<Trash2 className="h-3 w-3 mr-1" />
								Delete
							</Button>
						)}
					</div>
				)}

				<button
					onClick={() => {
						onPanelHidden();
					}}
					className="p-1 hover:bg-accent/50 rounded transition-colors shrink-0"
					title="Collapse relationships panel"
				>
					<ChevronDown className="h-4 w-4" />
				</button>
			</div>

			{relationshipsQuery.isLoading ? (
				<div className="flex items-center justify-center py-8 flex-1">
					<Spinner />
				</div>
			) : relationships.length === 0 ? (
				<div className="py-8 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center">
					No relationships found for this row
				</div>
			) : (
				<div className="p-4 space-y-4 flex-1 overflow-y-auto">
					{/* Outgoing Relationships */}
					{outgoingRels.length > 0 && (
						<div>
							<h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
								References (Outgoing)
							</h3>
							<div className="space-y-2">
								{outgoingRels.map((rel) => (
									<RelationshipSection
										key={rel.constraintName}
										relationship={rel}
										rowData={rowData}
										isExpanded={expandedRelationships.has(rel.constraintName)}
										onToggle={() => toggleExpanded(rel.constraintName)}
										connectionUrl={connectionUrl}
									/>
								))}
							</div>
						</div>
					)}

					{/* Incoming Relationships */}
					{incomingRels.length > 0 && (
						<div>
							<h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
								Referenced By (Incoming)
							</h3>
							<div className="space-y-2">
								{incomingRels.map((rel) => (
									<RelationshipSection
										key={rel.constraintName}
										relationship={rel}
										rowData={rowData}
										isExpanded={expandedRelationships.has(rel.constraintName)}
										onToggle={() => toggleExpanded(rel.constraintName)}
										connectionUrl={connectionUrl}
									/>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

interface RelationshipSectionProps {
	relationship: TableRelationship;
	rowData: Record<string, unknown>;
	isExpanded: boolean;
	onToggle: () => void;
	connectionUrl: string;
}

const RelationshipSection = ({
	relationship,
	rowData,
	isExpanded,
	onToggle,
	connectionUrl,
}: RelationshipSectionProps) => {
	// For outgoing relationships, get the FK value from the row
	const fkValue =
		relationship.type === "outgoing"
			? rowData[relationship.referencingColumn]
			: null;

	// For incoming relationships, we need the PK value from the current row
	const pkValue =
		relationship.type === "incoming"
			? rowData[relationship.referencedColumn]
			: null;

	// Fetch related rows when expanded
	const relatedRowsQuery = useQuery(
		queryRelationshipSubrowDataQueryOptions({
			url: connectionUrl,
			schema:
				relationship.type === "outgoing"
					? relationship.referencedSchema
					: relationship.referencingSchema,
			table:
				relationship.type === "outgoing"
					? relationship.referencedTable
					: relationship.referencingTable,
			filterColumn:
				relationship.type === "outgoing"
					? relationship.referencedColumn
					: relationship.referencingColumn,
			filterValue: relationship.type === "outgoing" ? fkValue : pkValue,
			limit: 25,
		}),
	);

	// Fetch cardinality detection
	const cardinalityQuery = useQuery(
		getRelationshipCardinalityQueryOptions({
			url: connectionUrl,
			schema:
				relationship.type === "outgoing"
					? relationship.referencingSchema
					: relationship.referencingSchema,
			table:
				relationship.type === "outgoing"
					? relationship.referencingTable
					: relationship.referencingTable,
			columns: [
				relationship.type === "outgoing"
					? relationship.referencingColumn
					: relationship.referencingColumn,
			],
		}),
	);

	const relatedRows = (relatedRowsQuery.data?.rows ?? []) as Array<
		Record<string, unknown>
	>;
	const hasValue = relationship.type === "outgoing" ? fkValue : pkValue;
	const hasRelatedRows = hasValue && relatedRows.length > 0;

	return (
		<div>
			{/* Header Button */}
			<button
				onClick={onToggle}
				className="w-full flex items-center gap-2 px-3 py-2 rounded border border-border/50 hover:bg-accent/50 transition-colors text-left text-sm"
			>
				{isExpanded ? (
					<ChevronDown className="h-4 w-4 shrink-0" />
				) : (
					<ChevronRight className="h-4 w-4 shrink-0" />
				)}

				<HStack className="flex-1 min-w-0 text-xs font-medium" align="center">
					<span>
						{relationship.referencingTable}
						<span className="text-xs text-muted-foreground">
							.{`${relationship.referencingColumn}`}
						</span>
					</span>

					<ChevronRight className="h-3 w-3 shrink-0 opacity-50" />

					<span>
						{relationship.referencedTable}
						<span className="text-xs text-muted-foreground">
							.{`${relationship.referencedColumn}`}
						</span>
					</span>

					{cardinalityQuery.data && (
						<span className="ml-2 text-xs bg-blue-500/20 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
							{cardinalityQuery.data.cardinality === "one-to-one"
								? "1:1"
								: cardinalityQuery.data.cardinality === "one-to-many"
									? "1:N"
									: cardinalityQuery.data.cardinality === "many-to-one"
										? "N:1"
										: "M:N"}
						</span>
					)}
				</HStack>

				<div className="flex items-center gap-2 shrink-0">
					{isExpanded && relatedRowsQuery.isPending && <Spinner size="sm" />}
					{hasRelatedRows ? (
						<span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
							{String(relatedRows.length)}
						</span>
					) : null}
					<span className="text-xs text-muted-foreground">
						{relationship.type === "outgoing" ? (fkValue ? "→" : "N/A") : "←"}
					</span>
				</div>
			</button>

			{/* Expanded Content */}
			{isExpanded && hasRelatedRows ? (
				<div className="mt-2 ml-4 p-2 bg-muted/30 rounded border border-border/30">
					{relatedRowsQuery.isPending ? (
						<div className="flex items-center justify-center py-4">
							<Spinner size="sm" />
						</div>
					) : relatedRowsQuery.isError ? (
						<div className="text-xs text-destructive p-2">
							Error loading related rows
						</div>
					) : (
						<div className="text-xs space-y-1 max-h-48 overflow-y-auto">
							{relatedRows.slice(0, 10).map((row, idx) => (
								<div
									key={idx}
									className="p-2 bg-background rounded border border-border/50 hover:bg-accent/30 cursor-pointer transition-colors"
									title={JSON.stringify(row, null, 2)}
								>
									<div className="font-mono text-xs truncate">
										{String(Object.values(row)?.[0] ?? "—")}
									</div>
									{Object.values(row).length > 1 && (
										<div className="text-muted-foreground truncate">
											{String(Object.values(row)?.[1] ?? "")}
										</div>
									)}
								</div>
							))}
							{relatedRows.length > 10 && (
								<div className="text-center text-muted-foreground py-2">
									+{relatedRows.length - 10} more
								</div>
							)}
						</div>
					)}
				</div>
			) : null}

			{isExpanded && !hasRelatedRows && !relatedRowsQuery.isPending ? (
				<div className="mt-2 ml-4 p-2 bg-muted/30 rounded border border-border/30 text-xs text-muted-foreground text-center">
					No related rows
				</div>
			) : null}
		</div>
	);
};
