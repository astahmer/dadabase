import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, X, Maximize2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createListCollection } from "@ark-ui/react";
import type { TableRelationship } from "#src/server/pg/fns/get-table-relationships.kysely.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/pg/start-fns/get-table-relationships.start.ts";
import { queryRelationshipSubrowDataQueryOptions } from "#src/server/pg/start-fns/get-relationship-subrow-data.start";
import { getRelationshipCardinalityQueryOptions } from "#src/server/pg/start-fns/get-relationship-cardinality.start.ts";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import * as ArkSelect from "./ui/select";
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
	const [selectedRelationships, setSelectedRelationships] = useState<
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

	// Set default selected relationships (first of each type)
	if (selectedRelationships.size === 0 && relationships.length > 0) {
		const firstOutgoing = relationships.find((r) => r.type === "outgoing");
		const firstIncoming = relationships.find((r) => r.type === "incoming");
		const defaults = new Set<string>();
		if (firstOutgoing) defaults.add(firstOutgoing.constraintName);
		if (firstIncoming) defaults.add(firstIncoming.constraintName);
		if (defaults.size === 0 && relationships.length > 0) {
			defaults.add(relationships[0].constraintName);
		}
		setSelectedRelationships(defaults);
	}

	// Separate relationships by type
	const outgoingRels = relationships.filter((r) => r.type === "outgoing");
	const incomingRels = relationships.filter((r) => r.type === "incoming");

	// Create grouped collection for dropdown
	const relationshipCollection = useMemo(() => {
		const items: Array<{ label: string; value: string; group?: string }> = [];

		// Add outgoing relationships
		outgoingRels.forEach((rel) => {
			items.push({
				label: `${rel.referencingTable}.${rel.referencingColumn} › ${rel.referencedTable}.${rel.referencedColumn}`,
				value: rel.constraintName,
				group: "References (Outgoing)",
			});
		});

		// Add incoming relationships
		incomingRels.forEach((rel) => {
			items.push({
				label: `${rel.referencingTable}.${rel.referencingColumn} › ${rel.referencedTable}.${rel.referencedColumn}`,
				value: rel.constraintName,
				group: "Referenced By (Incoming)",
			});
		});

		return createListCollection({ items });
	}, [outgoingRels, incomingRels]);

	const selectedRels = relationships.filter((r) =>
		selectedRelationships.has(r.constraintName),
	);

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
						<span>Click to show relations for:</span>
						<span className="font-medium ml-1">
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
			{/* Header */}
			<div className="px-4 py-3 border-b flex items-center justify-between shrink-0 gap-3">
				<button
					onClick={onCollapse}
					className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
					title="Collapse relationships panel"
				>
					<ChevronDown className="h-3 w-3 shrink-0" />
					<span className="truncate">
						<span>Click to hide relations for:</span>
						<span className="font-medium ml-1">
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

			{/* Content */}
			{relationshipsQuery.isLoading ? (
				<div className="flex items-center justify-center py-8 flex-1">
					<Spinner />
				</div>
			) : relationships.length === 0 ? (
				<div className="py-8 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center">
					No relationships found
				</div>
			) : (
				<div className="flex flex-col h-full overflow-hidden">
					{/* Selector Bar */}
					<div className="px-4 py-3 border-b shrink-0">
						<div className="flex items-center gap-2">
							<label className="text-xs font-medium text-muted-foreground">
								Relationship showns:
							</label>
							<ArkSelect.Select
								collection={relationshipCollection}
								value={Array.from(selectedRelationships)}
								onValueChange={(details) => {
									if (details.value) {
										setSelectedRelationships(
											new Set(details.value.map((v) => String(v))),
										);
									}
								}}
								positioning={{ sameWidth: true }}
								multiple
							>
								<ArkSelect.SelectControl size="sm">
									<ArkSelect.SelectTrigger>
										<ArkSelect.SelectValueText placeholder="Select relationships..." />
										<ArkSelect.SelectIndicator />
									</ArkSelect.SelectTrigger>
								</ArkSelect.SelectControl>
								<ArkSelect.SelectContent>
									<ArkSelect.SelectList>
										{/* References (Outgoing) Group */}
										{outgoingRels.length > 0 && (
											<ArkSelect.SelectItemGroup>
												<ArkSelect.SelectItemGroupLabel>
													References (Outgoing)
												</ArkSelect.SelectItemGroupLabel>
												{outgoingRels.map((rel) => (
													<ArkSelect.SelectItem
														key={rel.constraintName}
														item={{
															label: `${rel.referencingTable}.${rel.referencingColumn} › ${rel.referencedTable}.${rel.referencedColumn}`,
															value: rel.constraintName,
														}}
													>
														<div className="flex items-center gap-2 text-sm">
															<span>
																{rel.referencingTable}
																<span className="text-muted-foreground text-xs">
																	.{rel.referencingColumn}
																</span>
															</span>
															<span className="text-muted-foreground">›</span>
															<span>
																{rel.referencedTable}
																<span className="text-muted-foreground text-xs">
																	.{rel.referencedColumn}
																</span>
															</span>
														</div>
													</ArkSelect.SelectItem>
												))}
											</ArkSelect.SelectItemGroup>
										)}

										{/* Referenced By (Incoming) Group */}
										{incomingRels.length > 0 && (
											<>
												{outgoingRels.length > 0 && (
													<ArkSelect.SelectSeparator />
												)}
												<ArkSelect.SelectItemGroup>
													<ArkSelect.SelectItemGroupLabel>
														Referenced By (Incoming)
													</ArkSelect.SelectItemGroupLabel>
													{incomingRels.map((rel) => (
														<ArkSelect.SelectItem
															key={rel.constraintName}
															item={{
																label: `${rel.referencingTable}.${rel.referencingColumn} › ${rel.referencedTable}.${rel.referencedColumn}`,
																value: rel.constraintName,
															}}
														>
															<div className="flex items-center gap-2 text-sm">
																<span>
																	{rel.referencingTable}
																	<span className="text-muted-foreground text-xs">
																		.{rel.referencingColumn}
																	</span>
																</span>
																<span className="text-muted-foreground">›</span>
																<span>
																	{rel.referencedTable}
																	<span className="text-muted-foreground text-xs">
																		.{rel.referencedColumn}
																	</span>
																</span>
															</div>
														</ArkSelect.SelectItem>
													))}
												</ArkSelect.SelectItemGroup>
											</>
										)}
									</ArkSelect.SelectList>
								</ArkSelect.SelectContent>
							</ArkSelect.Select>
						</div>
					</div>

					{/* Relationships List */}
					<div className="flex-1 overflow-y-auto divide-y divide-border/50">
						{selectedRels.map((rel) => (
							<RelationshipCard
								key={rel.constraintName}
								relationship={rel}
								rowData={rowData}
								connectionUrl={connectionUrl}
								isPanelExpanded={isPanelExpanded}
								onRemove={() => {
									const next = new Set(selectedRelationships);
									next.delete(rel.constraintName);
									setSelectedRelationships(next);
								}}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

interface RelationshipCardProps {
	relationship: TableRelationship;
	rowData: Record<string, unknown>;
	connectionUrl: string;
	isPanelExpanded: boolean;
	onRemove: () => void;
}

const RelationshipCard = ({
	relationship,
	rowData,
	connectionUrl,
	isPanelExpanded,
	onRemove,
}: RelationshipCardProps) => {
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

	// Fetch related rows
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
			limit: 50,
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
	const hasRelatedRows =
		hasValue !== null && hasValue !== undefined && relatedRows.length > 0;
	const rowCount = relatedRows.length as number;

	return (
		<>
			{/* Info Bar */}
			<div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between shrink-0 text-xs gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<span className="text-muted-foreground truncate">
						{relationship.referencingTable}
						<span className="text-muted-foreground">
							.{relationship.referencingColumn}
						</span>
					</span>
					<span className="text-muted-foreground shrink-0">›</span>
					<span className="font-medium truncate">
						{relationship.referencedTable}
						<span className="text-muted-foreground">
							.{relationship.referencedColumn}
						</span>
					</span>

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

					{hasRelatedRows && (
						<span className="text-muted-foreground shrink-0">
							{rowCount} row{rowCount !== 1 ? "s" : ""}
						</span>
					)}
				</div>

				<div className="flex items-center gap-1 shrink-0">
					{isPanelExpanded && hasRelatedRows && (
						<Button
							size="xs"
							variant="ghost"
							onClick={() => setIsMaximizeSheetOpen(true)}
							title="Expand to full view"
							className="h-6 px-2 gap-1"
						>
							<Maximize2 className="h-3 w-3" />
							<span className="text-xs">Full Screen</span>
						</Button>
					)}
					<Button
						size="xs"
						variant="ghost"
						onClick={onRemove}
						title="Remove from view"
						className="h-6 px-2"
					>
						<X className="h-3 w-3" />
					</Button>
				</div>
			</div>

			{/* Data Table Area */}
			<div className="flex-1 overflow-hidden flex flex-col">
				{relatedRowsQuery.isPending ? (
					<div className="flex items-center justify-center py-8 flex-1">
						<Spinner />
					</div>
				) : relatedRowsQuery.isError ? (
					<div className="p-4 text-sm text-destructive">
						Error loading related rows
					</div>
				) : hasRelatedRows ? (
					<div className="flex-1 overflow-hidden">
						<RelationshipSubrowTable
							relationship={relationship}
							parentRowValue={
								relationship.type === "outgoing" ? fkValue : pkValue
							}
							connection={{ url: connectionUrl }}
						/>
					</div>
				) : (
					<div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
						No related rows
					</div>
				)}
			</div>

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
								.{relationship.referencingColumn}
							</span>
							<span className="text-muted-foreground mx-2">›</span>
							{relationship.referencedTable}
							<span className="text-muted-foreground text-sm ml-2">
								.{relationship.referencedColumn}
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
		</>
	);
};
