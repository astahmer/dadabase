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
	const [selectedRelationship, setSelectedRelationship] = useState<
		string | null
	>(null);
	const [isMaximizeSheetOpen, setIsMaximizeSheetOpen] = useState(false);

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

	// Set default selected relationship
	if (!selectedRelationship && relationships.length > 0) {
		setSelectedRelationship(relationships[0].constraintName);
	}

	const selectedRel = relationships.find(
		(r) => r.constraintName === selectedRelationship,
	);

	// Create collection for dropdown
	const relationshipCollection = useMemo(
		() =>
			createListCollection({
				items: relationships.map((rel) => ({
					label: `${rel.referencingTable}.${rel.referencingColumn} › ${rel.referencedTable}.${rel.referencedColumn}`,
					value: rel.constraintName,
				})),
			}),
		[relationships],
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
								Relationship:
							</label>
							<ArkSelect.Select
								collection={relationshipCollection}
								value={selectedRelationship ? [selectedRelationship] : []}
								onValueChange={(details) => {
									if (details.value && details.value.length > 0) {
										setSelectedRelationship(String(details.value[0]));
									}
								}}
								positioning={{ sameWidth: true }}
							>
								<ArkSelect.SelectControl size="sm">
									<ArkSelect.SelectTrigger>
										<ArkSelect.SelectValueText placeholder="Choose a relationship..." />
										<ArkSelect.SelectIndicator />
									</ArkSelect.SelectTrigger>
								</ArkSelect.SelectControl>
								<ArkSelect.SelectContent>
									<ArkSelect.SelectList>
										{relationshipCollection.items.map((item) => (
											<ArkSelect.SelectItem key={item.value} item={item}>
												<div className="flex items-center gap-2 text-sm">
													{relationships.find(
														(r) => r.constraintName === item.value,
													)?.referencingTable && (
														<>
															<span>
																{
																	relationships.find(
																		(r) => r.constraintName === item.value,
																	)?.referencingTable
																}
																<span className="text-muted-foreground text-xs">
																	.
																	{
																		relationships.find(
																			(r) => r.constraintName === item.value,
																		)?.referencingColumn
																	}
																</span>
															</span>
															<span className="text-muted-foreground">›</span>
															<span>
																{
																	relationships.find(
																		(r) => r.constraintName === item.value,
																	)?.referencedTable
																}
																<span className="text-muted-foreground text-xs">
																	.
																	{
																		relationships.find(
																			(r) => r.constraintName === item.value,
																		)?.referencedColumn
																	}
																</span>
															</span>
														</>
													)}
												</div>
											</ArkSelect.SelectItem>
										))}
									</ArkSelect.SelectList>
								</ArkSelect.SelectContent>
							</ArkSelect.Select>
						</div>
					</div>

					{/* Data Display */}
					{selectedRel ? (
						<RelationshipDisplay
							relationship={selectedRel}
							rowData={rowData}
							connectionUrl={connectionUrl}
							isPanelExpanded={isPanelExpanded}
							onOpenMaximize={() => setIsMaximizeSheetOpen(true)}
							isMaximizeSheetOpen={isMaximizeSheetOpen}
							onCloseMaximize={() => setIsMaximizeSheetOpen(false)}
						/>
					) : null}
				</div>
			)}
		</div>
	);
};

interface RelationshipDisplayProps {
	relationship: TableRelationship;
	rowData: Record<string, unknown>;
	connectionUrl: string;
	isPanelExpanded: boolean;
	onOpenMaximize: () => void;
	isMaximizeSheetOpen: boolean;
	onCloseMaximize: () => void;
}

const RelationshipDisplay = ({
	relationship,
	rowData,
	connectionUrl,
	isPanelExpanded,
	onOpenMaximize,
	isMaximizeSheetOpen,
	onCloseMaximize,
}: RelationshipDisplayProps) => {
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

				{isPanelExpanded && hasRelatedRows && (
					<Button
						size="xs"
						variant="ghost"
						onClick={onOpenMaximize}
						title="Expand to full view"
						className="h-6 px-2 gap-1 shrink-0"
					>
						<Maximize2 className="h-3 w-3" />
						<span className="text-xs">Full Screen</span>
					</Button>
				)}
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
			<Sheet open={isMaximizeSheetOpen} onOpenChange={onCloseMaximize}>
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
