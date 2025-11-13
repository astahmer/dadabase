import { useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { TableRelationship } from "#src/server/pg/fns/get-table-relationships.kysely.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/pg/start-fns/get-table-relationships.start.ts";
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
									<RelationshipButton
										key={rel.constraintName}
										relationship={rel}
										rowData={rowData}
										isExpanded={expandedRelationships.has(rel.constraintName)}
										onToggle={() => toggleExpanded(rel.constraintName)}
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
									<RelationshipButton
										key={rel.constraintName}
										relationship={rel}
										rowData={rowData}
										isExpanded={expandedRelationships.has(rel.constraintName)}
										onToggle={() => toggleExpanded(rel.constraintName)}
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

interface RelationshipButtonProps {
	relationship: TableRelationship;
	rowData: Record<string, unknown>;
	isExpanded: boolean;
	onToggle: () => void;
}

const RelationshipButton = ({
	relationship,
	rowData,
	isExpanded,
	onToggle,
}: RelationshipButtonProps) => {
	// For outgoing relationships, get the FK value from the row
	const fkValue =
		relationship.type === "outgoing"
			? rowData[relationship.referencingColumn]
			: null;

	return (
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

			<span className="text-xs text-muted-foreground shrink-0">
				{relationship.type === "outgoing" ? (fkValue ? "→" : "N/A") : "←"}
			</span>
		</button>
	);
};
