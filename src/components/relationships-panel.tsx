import { useState } from "react";
import {
	ChevronDown,
	ChevronRight,
	ChevronUp,
	X,
	Maximize2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { TableRelationship } from "#src/server/pg/fns/get-table-relationships.kysely.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/pg/start-fns/get-table-relationships.start.ts";
import { queryRelationshipSubrowDataQueryOptions } from "#src/server/pg/start-fns/get-relationship-subrow-data.start";
import { getRelationshipCardinalityQueryOptions } from "#src/server/pg/start-fns/get-relationship-cardinality.start.ts";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { RelationshipSubrowTable } from "./relationship-subrow-table";

interface RelationshipsPanelProps {
	connectionUrl: string;
	schema: string;
	table: string;
	selectedRowId: string | null;
	rowData: Record<string, unknown> | null;
	isPanelExpanded: boolean;
	onCollapse: () => void;
	onExpand: () => void;
	onClose: () => void;
}

export const RelationshipsPanel = ({
	connectionUrl,
	schema,
	table,
	selectedRowId,
	rowData,
	isPanelExpanded,
	onCollapse,
	onExpand,
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
		return (
			<div className="border-t bg-muted/40 h-10 flex items-center px-3 shrink-0 min-h-10 gap-3">
				<button
					onClick={onExpand}
					className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
					title="Expand relationships panel"
				>
					<ChevronUp className="h-3 w-3 shrink-0" />
					<span className="truncate">
						<span className="font-medium">
							{schema}.{table}
						</span>
						<span className="text-muted-foreground mx-1">=</span>
						<span className="font-mono text-xs">{selectedRowId}</span>
					</span>
				</button>

				<Button
					onClick={onClose}
					size="xs"
					variant="ghost"
					title="Close relationships panel"
					className="ml-auto shrink-0"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
		);
	}

	return (
		<div className="border-t bg-card flex flex-col h-full overflow-hidden">
			<div className="px-4 py-2 border-b flex items-center justify-between shrink-0 gap-2">
				<button
					onClick={onCollapse}
					className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
					title="Collapse relationships panel"
				>
					<ChevronDown className="h-3 w-3 shrink-0" />
					<span className="truncate">
						<span className="font-medium">
							{schema}.{table}
						</span>
						<span className="text-muted-foreground mx-1">=</span>
						<span className="font-mono text-xs">{selectedRowId}</span>
					</span>
				</button>

				<Button
					onClick={onClose}
					size="xs"
					variant="ghost"
					title="Close relationships panel"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{relationshipsQuery.isLoading ? (
				<div className="flex items-center justify-center py-8 flex-1">
					<Spinner />
				</div>
			) : relationships.length === 0 ? (
				<div className="py-8 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center">
					No relationships found
				</div>
			) : (
				<div className="flex-1 overflow-y-auto divide-y divide-border/50">
					{relationships.map((rel) => (
						<RelationshipSection
							key={rel.constraintName}
							relationship={rel}
							rowData={rowData}
							isExpanded={expandedRelationships.has(rel.constraintName)}
							onToggle={() => toggleExpanded(rel.constraintName)}
							connectionUrl={connectionUrl}
							isPanelExpanded={isPanelExpanded}
						/>
					))}
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
	isPanelExpanded: boolean;
}

const RelationshipSection = ({
	relationship,
	rowData,
	isExpanded,
	onToggle,
	connectionUrl,
	isPanelExpanded,
}: RelationshipSectionProps) => {
	const [isMaximizeSheetOpen, setIsMaximizeSheetOpen] = useState(false);
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
			schema: relationship.referencingSchema,
			table: relationship.referencingTable,
			columns: [relationship.referencingColumn],
			isIncomingRelationship: relationship.type === "incoming",
		}),
	);

	const relatedRows = (relatedRowsQuery.data?.rows ?? []) as Array<
		Record<string, unknown>
	>;
	const hasValue = relationship.type === "outgoing" ? fkValue : pkValue;
	const hasRelatedRows = hasValue && relatedRows.length > 0;

	return (
		<div className="p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
			{/* Header Button */}
			<button
				onClick={onToggle}
				className="w-full flex items-center gap-2 text-left group"
			>
				<div className="flex items-center gap-1 flex-1 min-w-0">
					<ChevronRight
						className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
					/>

					<div className="flex items-center gap-1 min-w-0 flex-1 text-sm">
						<span className="font-medium truncate">
							{relationship.referencingTable}
						</span>
						<span className="text-muted-foreground shrink-0">
							.{relationship.referencingColumn}
						</span>
						<ChevronRight className="h-3 w-3 shrink-0 opacity-30" />
						<span className="font-medium truncate">
							{relationship.referencedTable}
						</span>
						<span className="text-muted-foreground shrink-0">
							.{relationship.referencedColumn}
						</span>
					</div>

					{cardinalityQuery.data && (
						<span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded shrink-0">
							{cardinalityQuery.data.cardinality === "one-to-one"
								? "1:1"
								: cardinalityQuery.data.cardinality === "one-to-many"
									? "1:N"
									: cardinalityQuery.data.cardinality === "many-to-one"
										? "N:1"
										: "M:N"}
						</span>
					)}
				</div>

				<div className="flex items-center gap-1 shrink-0">
					{isExpanded && relatedRowsQuery.isPending && <Spinner size="sm" />}
					{hasRelatedRows ? (
						<span className="text-xs text-muted-foreground">
							{String(relatedRows.length)}
						</span>
					) : null}
				</div>
			</button>

			{/* Expanded Content */}
			{isExpanded && hasRelatedRows ? (
				<div className="mt-3 flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<span className="text-xs text-muted-foreground">
							{relatedRows.length} related
						</span>
						{isPanelExpanded && (
							<Button
								size="xs"
								variant="ghost"
								onClick={() => setIsMaximizeSheetOpen(true)}
								title="Expand to full view"
								className="h-5 px-1"
							>
								<Maximize2 className="h-3 w-3" />
							</Button>
						)}
					</div>
					<div className="border rounded bg-muted/20 overflow-hidden max-h-48 overflow-y-auto">
						{relatedRowsQuery.isPending ? (
							<div className="flex items-center justify-center py-4">
								<Spinner size="sm" />
							</div>
						) : relatedRowsQuery.isError ? (
							<div className="text-xs text-destructive p-3">
								Error loading related rows
							</div>
						) : (
							<RelationshipSubrowTable
								relationship={relationship}
								parentRowValue={
									relationship.type === "outgoing" ? fkValue : pkValue
								}
								connection={{ url: connectionUrl }}
							/>
						)}
					</div>
				</div>
			) : isExpanded && !hasRelatedRows && !relatedRowsQuery.isPending ? (
				<div className="mt-3 p-3 text-xs text-muted-foreground text-center rounded bg-muted/20 border border-border/50">
					No related rows
				</div>
			) : null}

			{/* Maximize Sheet */}
			<Sheet
				open={isMaximizeSheetOpen}
				onOpenChange={(details) => setIsMaximizeSheetOpen(details.open)}
			>
				<SheetContent side="bottom" className="h-[90vh] flex flex-col">
					<SheetHeader>
						<SheetTitle className="text-base">
							{relationship.referencingTable}
							<span className="text-muted-foreground text-sm ml-2">
								→ {relationship.referencedTable}
							</span>
						</SheetTitle>
					</SheetHeader>
					<div className="flex-1 overflow-hidden">
						<RelationshipSubrowTable
							relationship={relationship}
							parentRowValue={
								relationship.type === "outgoing" ? fkValue : pkValue
							}
							connection={{ url: connectionUrl }}
						/>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
};
