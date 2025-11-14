import { useState, useEffect } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { TableRelationship } from "#src/server/pg/fns/get-table-relationships.kysely.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/pg/start-fns/get-table-relationships.start.ts";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";
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
	const [displayedRelationships, setDisplayedRelationships] = useState<
		Set<string>
	>(new Set());
	const [sidebarWidth, setSidebarWidth] = useState(288); // w-72 = 18rem = 288px
	const [isResizing, setIsResizing] = useState(false);

	// Handle sidebar resize
	useEffect(() => {
		if (!isResizing) return;

		const handleMouseMove = (e: MouseEvent) => {
			const newWidth = Math.max(200, Math.min(e.clientX, 500)); // Min 200px, max 500px
			setSidebarWidth(newWidth);
		};

		const handleMouseUp = () => {
			setIsResizing(false);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isResizing]);

	const handleResizeStart = () => {
		setIsResizing(true);
	};

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
		const displayed = new Set<string>();

		if (firstOutgoing) {
			defaults.add(firstOutgoing.constraintName);
			displayed.add(firstOutgoing.constraintName);
		}
		if (firstIncoming) {
			defaults.add(firstIncoming.constraintName);
			displayed.add(firstIncoming.constraintName);
		}
		if (defaults.size === 0 && relationships.length > 0) {
			defaults.add(relationships[0].constraintName);
			displayed.add(relationships[0].constraintName);
		}

		setSelectedRelationships(defaults);
		setDisplayedRelationships(displayed);
	}

	// Separate relationships by type
	const outgoingRels = relationships.filter((r) => r.type === "outgoing");
	const incomingRels = relationships.filter((r) => r.type === "incoming");

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
				<div className="flex h-full overflow-hidden">
					{/* Left Sidebar - Relationship List */}
					<div
						style={{ width: `${sidebarWidth}px` }}
						className="border-r bg-muted/30 flex flex-col shrink-0 overflow-hidden transition-all duration-100"
					>
						{/* Relationships List */}
						<div className="flex-1 overflow-y-auto">
							{/* References (Outgoing) */}
							{outgoingRels.length > 0 && (
								<div>
									<div className="px-3 py-2 text-xs font-semibold text-muted-foreground sticky top-0 bg-muted z-10">
										References (
										{
											outgoingRels.filter((r) =>
												selectedRelationships.has(r.constraintName),
											).length
										}
										)
									</div>
									<div className="space-y-0">
										{outgoingRels.map((rel) => (
											<button
												key={rel.constraintName}
												onClick={() => {
													// Only select if not already selected
													if (!selectedRelationships.has(rel.constraintName)) {
														const next = new Set(selectedRelationships);
														next.add(rel.constraintName);
														const displayed = new Set(displayedRelationships);
														displayed.add(rel.constraintName);
														setSelectedRelationships(next);
														setDisplayedRelationships(displayed);
													}
												}}
												className={`w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors ${
													displayedRelationships.has(rel.constraintName)
														? "bg-accent border-l-2 border-primary"
														: ""
												}`}
											>
												<div className="flex items-start justify-between gap-2">
													<div className="flex-1 min-w-0">
														<div className="font-medium truncate">
															{rel.referencingTable}.{rel.referencingColumn}
														</div>
														<div className="text-muted-foreground truncate text-xs">
															{rel.referencedTable}.{rel.referencedColumn}
														</div>
													</div>
													<input
														type="checkbox"
														checked={selectedRelationships.has(
															rel.constraintName,
														)}
														onChange={(e) => {
															e.stopPropagation();
															const next = new Set(selectedRelationships);
															if (e.target.checked) {
																next.add(rel.constraintName);
																const displayed = new Set(
																	displayedRelationships,
																);
																displayed.add(rel.constraintName);
																setSelectedRelationships(next);
																setDisplayedRelationships(displayed);
															} else {
																next.delete(rel.constraintName);
																const displayed = new Set(
																	displayedRelationships,
																);
																displayed.delete(rel.constraintName);
																setSelectedRelationships(next);
																setDisplayedRelationships(displayed);
															}
														}}
														className="mt-0.5 shrink-0 cursor-pointer"
													/>
												</div>
											</button>
										))}
									</div>
								</div>
							)}

							{/* Referenced By (Incoming) */}
							{incomingRels.length > 0 && (
								<div>
									{outgoingRels.length > 0 && <div className="border-t my-1" />}
									<div className="px-3 py-2 text-xs font-semibold text-muted-foreground sticky top-0 bg-muted z-10">
										Referenced By (
										{
											incomingRels.filter((r) =>
												selectedRelationships.has(r.constraintName),
											).length
										}
										)
									</div>
									<div className="space-y-0">
										{incomingRels.map((rel) => (
											<button
												key={rel.constraintName}
												onClick={() => {
													// Only select if not already selected
													if (!selectedRelationships.has(rel.constraintName)) {
														const next = new Set(selectedRelationships);
														next.add(rel.constraintName);
														const displayed = new Set(displayedRelationships);
														displayed.add(rel.constraintName);
														setSelectedRelationships(next);
														setDisplayedRelationships(displayed);
													}
												}}
												className={`w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors ${
													displayedRelationships.has(rel.constraintName)
														? "bg-accent border-l-2 border-primary"
														: ""
												}`}
											>
												<div className="flex items-start justify-between gap-2">
													<div className="flex-1 min-w-0">
														<div className="font-medium truncate">
															{rel.referencingSchema}.{rel.referencingTable}.
															{rel.referencingColumn}
														</div>
														<div className="text-muted-foreground truncate text-xs">
															› {rel.referencedSchema}.{rel.referencedTable}.
															{rel.referencedColumn}
														</div>
													</div>
													<input
														type="checkbox"
														checked={selectedRelationships.has(
															rel.constraintName,
														)}
														onChange={(e) => {
															e.stopPropagation();
															const next = new Set(selectedRelationships);
															if (e.target.checked) {
																next.add(rel.constraintName);
																const displayed = new Set(
																	displayedRelationships,
																);
																displayed.add(rel.constraintName);
																setSelectedRelationships(next);
																setDisplayedRelationships(displayed);
															} else {
																next.delete(rel.constraintName);
																const displayed = new Set(
																	displayedRelationships,
																);
																displayed.delete(rel.constraintName);
																setSelectedRelationships(next);
																setDisplayedRelationships(displayed);
															}
														}}
														className="mt-0.5 shrink-0 cursor-pointer"
													/>
												</div>
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Resize Handle */}
					<div
						onMouseDown={handleResizeStart}
						className={`w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors ${
							isResizing ? "bg-primary/50" : ""
						}`}
					/>

					{/* Right Panel - Data Display */}
					{displayedRelationships.size > 0 ? (
						<div className="flex-1 overflow-y-auto space-y-4 p-4">
							{Array.from(displayedRelationships).map((constraintName) => {
								const rel = relationships.find(
									(r) => r.constraintName === constraintName,
								);
								if (!rel) return null;
								return (
									<div
										key={constraintName}
										className="border rounded-lg overflow-hidden bg-card"
									>
										<RelationshipCard
											relationship={rel}
											rowData={rowData}
											connectionUrl={connectionUrl}
											isPanelExpanded={isPanelExpanded}
											onRemove={() => {
												const next = new Set(displayedRelationships);
												next.delete(constraintName);
												setDisplayedRelationships(next);
											}}
										/>
									</div>
								);
							})}
						</div>
					) : (
						<div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
							Select a relationship to view details
						</div>
					)}
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

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<RelationshipSubrowTable
				relationship={relationship}
				parentRowValue={relationship.type === "outgoing" ? fkValue : pkValue}
				connection={{ url: connectionUrl }}
				isPanelExpanded={isPanelExpanded}
				onRemove={onRemove}
			/>
		</div>
	);
};
