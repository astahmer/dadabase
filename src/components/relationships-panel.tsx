import { useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { TableRelationship } from "#src/server/pg/fns/get-table-relationships.kysely.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/pg/start-fns/get-table-relationships.start.ts";
import { queryRelationshipSubrowDataQueryOptions } from "#src/server/pg/start-fns/get-relationship-subrow-data.start";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";

interface RelationshipsPanelProps {
	connectionUrl: string;
	schema: string;
	table: string;
	selectedRowId: string | null;
	rowData: Record<string, unknown> | null;
	onClose: () => void;
}

export const RelationshipsPanel = ({
	connectionUrl,
	schema,
	table,
	selectedRowId,
	rowData,
	onClose,
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

	const getRowIdentifier = () => {
		const values = Object.values(rowData)
			.slice(0, 2)
			.filter((v) => v !== null && v !== undefined);
		return values.join(" • ");
	};

	return (
		<div className="border-t bg-card">
			<div className="px-4 py-3 border-b flex items-center justify-between">
				<div className="flex items-center gap-2 flex-1">
					<span className="text-sm font-semibold text-foreground">
						RELATIONSHIPS FOR: {getRowIdentifier()}
					</span>
					<span className="text-xs text-muted-foreground">
						({schema}.{table})
					</span>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={onClose}
					className="h-6 w-6 p-0"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{relationshipsQuery.isLoading ? (
				<div className="flex items-center justify-center py-8">
					<Spinner />
				</div>
			) : relationships.length === 0 ? (
				<div className="py-8 text-center text-sm text-muted-foreground">
					No relationships found for this row
				</div>
			) : (
				<div className="p-4 space-y-4 max-h-96 overflow-y-auto">
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

				<div className="flex-1 min-w-0">
					<span className="font-medium text-foreground">
						{relationship.displayLabel}
					</span>
					<span className="text-xs text-muted-foreground ml-1">
						({relationship.referencedTable})
					</span>
				</div>

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
