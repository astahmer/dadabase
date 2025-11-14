import { useState } from "react";
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
	const [activeRelationship, setActiveRelationship] = useState<string | null>(
		null,
	);

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
		let firstToShow: string | null = null;

		if (firstOutgoing) {
			defaults.add(firstOutgoing.constraintName);
			if (!firstToShow) firstToShow = firstOutgoing.constraintName;
		}
		if (firstIncoming) {
			defaults.add(firstIncoming.constraintName);
			if (!firstToShow) firstToShow = firstIncoming.constraintName;
		}
		if (defaults.size === 0 && relationships.length > 0) {
			defaults.add(relationships[0].constraintName);
			firstToShow = relationships[0].constraintName;
		}

		setSelectedRelationships(defaults);
		setActiveRelationship(firstToShow);
	}

	// Set active to first if no active set
	if (!activeRelationship && selectedRelationships.size > 0) {
		const firstSelected = Array.from(selectedRelationships)[0];
		setActiveRelationship(firstSelected);
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
					<div className="w-72 border-r bg-muted/30 flex flex-col shrink-0 overflow-hidden">
						{/* Relationships List */}
						<div className="flex-1 overflow-y-auto">
							{/* References (Outgoing) */}
							{outgoingRels.length > 0 && (
								<div>
									<div className="px-3 py-2 text-xs font-semibold text-muted-foreground sticky top-0 bg-muted/50">
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
												onClick={() =>
													setActiveRelationship(rel.constraintName)
												}
												className={`w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors ${
													activeRelationship === rel.constraintName
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
																if (!activeRelationship) {
																	setActiveRelationship(rel.constraintName);
																}
															} else {
																next.delete(rel.constraintName);
																if (activeRelationship === rel.constraintName) {
																	// Switch to another selected rel or first if none selected
																	const remaining = Array.from(next);
																	setActiveRelationship(remaining[0] ?? null);
																}
															}
															setSelectedRelationships(next);
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
									<div className="px-3 py-2 text-xs font-semibold text-muted-foreground sticky top-0 bg-muted/50">
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
												onClick={() =>
													setActiveRelationship(rel.constraintName)
												}
												className={`w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors ${
													activeRelationship === rel.constraintName
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
																if (!activeRelationship) {
																	setActiveRelationship(rel.constraintName);
																}
															} else {
																next.delete(rel.constraintName);
																if (activeRelationship === rel.constraintName) {
																	// Switch to another selected rel or first if none selected
																	const remaining = Array.from(next);
																	setActiveRelationship(remaining[0] ?? null);
																}
															}
															setSelectedRelationships(next);
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

					{/* Right Panel - Data Display */}
					{activeRelationship &&
					selectedRelationships.has(activeRelationship) ? (
						<RelationshipCard
							relationship={
								relationships.find(
									(r) => r.constraintName === activeRelationship,
								)!
							}
							rowData={rowData}
							connectionUrl={connectionUrl}
							isPanelExpanded={isPanelExpanded}
							onRemove={() => {
								const next = new Set(selectedRelationships);
								next.delete(activeRelationship);
								setSelectedRelationships(next);
								// Switch to another selected rel or clear active
								const remaining = Array.from(next);
								setActiveRelationship(remaining[0] ?? null);
							}}
						/>
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
