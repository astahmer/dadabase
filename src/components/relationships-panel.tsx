import { useState, useRef, useEffect } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Splitter } from "@ark-ui/react/splitter";
import { getTableRelationshipsQueryOptions } from "#src/server/pg/start-fns/get-table-relationships.start.ts";
import { getRelationshipsCountsQueryOptions } from "#src/server/pg/start-fns/get-relationships-counts.start.ts";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";
import { RelationshipSubrowTable } from "./relationship-subrow-table";
import { HStack } from "./ui/layout.tsx";
import { Checkbox, CheckboxControl } from "./ui/checkbox";
import type { TableRelationship } from "#src/types/relationships.ts";

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
	const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const rightPanelRef = useRef<HTMLDivElement | null>(null);

	// Fetch relationships for this table
	const relationshipsQuery = useQuery(
		getTableRelationshipsQueryOptions({
			url: connectionUrl,
			schema,
			table,
		}),
	);

	const relationships = relationshipsQuery.data ?? [];

	// Filter out relationships where the FK value is null
	const validRelationships = rowData
		? relationships.filter((rel) => {
				const filterValue =
					rowData[
						rel.type === "incoming"
							? rel.referencedColumn
							: rel.referencingColumn
					];
				const isNullValue =
					filterValue === null ||
					filterValue === undefined ||
					filterValue === "null";
				return !isNullValue;
			})
		: relationships;

	// Fetch all relationship counts in a single batch query
	const countsQuery = useQuery({
		...getRelationshipsCountsQueryOptions({
			url: connectionUrl,
			schema,
			table,
			relationships: validRelationships,
			rowData: rowData ?? {},
		}),
		enabled: validRelationships.length > 0 && Boolean(rowData),
	});

	const counts = countsQuery.data ?? {};

	const stickyRelationship = useStickyRelationshipTracking(
		rightPanelRef,
		cardRefs,
		displayedRelationships,
		validRelationships,
	);

	if (!selectedRowId || !rowData) {
		return null;
	}

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
						<span className="font-medium ml-1">{table}</span>
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

	// Group relationships by type for rendering
	const relsByType = {
		outgoing: validRelationships.filter((r) => r.type === "outgoing"),
		incoming: validRelationships.filter((r) => r.type === "incoming"),
	};

	const handleSelectAllGroup = (type: "outgoing" | "incoming") => {
		const groupRels = relsByType[type];
		const next = new Set(selectedRelationships);
		const displayed = new Set(displayedRelationships);

		groupRels.forEach((rel) => {
			// Only select relationships with rows > 0
			const rowCount = Number(counts[rel.constraintName]) ?? 0;
			if (rowCount > 0) {
				next.add(rel.constraintName);
				displayed.add(rel.constraintName);
			}
		});

		setSelectedRelationships(next);
		setDisplayedRelationships(displayed);
	};

	const handleDeselectAllGroup = (type: "outgoing" | "incoming") => {
		const groupRels = relsByType[type];
		const next = new Set(selectedRelationships);
		const displayed = new Set(displayedRelationships);

		groupRels.forEach((rel) => {
			next.delete(rel.constraintName);
			displayed.delete(rel.constraintName);
		});

		setSelectedRelationships(next);
		setDisplayedRelationships(displayed);
	};

	const isGroupFullySelected = (type: "outgoing" | "incoming") => {
		const groupRels = relsByType[type];
		const selectableRels = groupRels.filter(
			(r) => Number(counts[r.constraintName] ?? 0) > 0,
		);
		return (
			selectableRels.length > 0 &&
			selectableRels.every((r) => selectedRelationships.has(r.constraintName))
		);
	};

	const handleRelationshipClick = (constraintName: string) => {
		const rowCount = counts[constraintName] ?? 0;

		// Don't allow selection if rowCount is 0
		if (rowCount === 0) return;

		if (!selectedRelationships.has(constraintName)) {
			const next = new Set(selectedRelationships);
			next.add(constraintName);
			const displayed = new Set(displayedRelationships);
			displayed.add(constraintName);
			setSelectedRelationships(next);
			setDisplayedRelationships(displayed);
		}
	};

	const handleRelationshipCheckChange = (
		constraintName: string,
		checked: boolean,
	) => {
		const rowCount = counts[constraintName] ?? 0;

		// Don't allow selection if rowCount is 0
		if (checked && rowCount === 0) return;

		const next = new Set(selectedRelationships);
		const displayed = new Set(displayedRelationships);

		if (checked) {
			next.add(constraintName);
			displayed.add(constraintName);
		} else {
			next.delete(constraintName);
			displayed.delete(constraintName);
		}

		setSelectedRelationships(next);
		setDisplayedRelationships(displayed);
	};

	return (
		<div className="border-t bg-card flex flex-col h-full overflow-hidden">
			{/* Header */}
			<div className="px-4 py-3 border-b flex items-center justify-between shrink-0 gap-3">
				<div className="flex items-center gap-2 min-w-0 flex-1">
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
				</div>

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
			) : validRelationships.length === 0 ? (
				<div className="py-8 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center">
					No relationships found
				</div>
			) : (
				<Splitter.Root
					orientation="horizontal"
					defaultSize={[30, 70]}
					panels={[
						{
							id: "sidebar",
							collapsible: true,
							collapsedSize: 0,
							minSize: 10,
						},
						{
							id: "content",
							collapsible: false,
							minSize: 50,
						},
					]}
					className="h-full flex overflow-hidden"
				>
					{/* Left Sidebar - Relationship List */}
					<Splitter.Panel
						id="sidebar"
						className="border-r bg-muted/30 flex flex-col overflow-hidden ml-2"
					>
						{/* Relationships List */}
						<div className="flex-1 overflow-y-auto">
							{(["outgoing", "incoming"] as const).map((type, idx) => {
								const rels = relsByType[type];
								const typeLabel =
									type === "outgoing" ? "References" : "Referenced By";
								const isFocused = type === "outgoing";
								const isFullySelected = isGroupFullySelected(type);

								return rels.length > 0 ? (
									<div key={type}>
										{idx > 0 && <div className="border-t my-1" />}
										<div
											className="px-3 py-2 text-xs font-semibold text-muted-foreground sticky top-0 bg-muted flex items-center justify-between gap-2"
											onClick={() => {
												if (isFullySelected) {
													handleDeselectAllGroup(type);
												} else {
													handleSelectAllGroup(type);
												}
											}}
										>
											<span>
												{typeLabel} (
												{
													rels.filter((r) =>
														selectedRelationships.has(r.constraintName),
													).length
												}
												/{rels.length})
											</span>
											<Checkbox
												checked={isFullySelected}
												onCheckedChange={() => {
													if (isFullySelected) {
														handleDeselectAllGroup(type);
													} else {
														handleSelectAllGroup(type);
													}
												}}
												onClick={(e) => e.stopPropagation()}
												title={
													isFullySelected
														? `Deselect all ${typeLabel.toLowerCase()}`
														: `Select all ${typeLabel.toLowerCase()}`
												}
											>
												<CheckboxControl />
											</Checkbox>
										</div>
										<div className="space-y-0">
											{rels.map((rel) => (
												<RelationshipListItem
													key={rel.constraintName}
													rel={rel}
													rowCount={Number(counts[rel.constraintName]) ?? 0}
													isCountLoading={countsQuery.isLoading}
													isSelected={selectedRelationships.has(
														rel.constraintName,
													)}
													isSticky={
														stickyRelationship === rel.constraintName &&
														isFocused
													}
													isStickyOther={
														stickyRelationship === rel.constraintName &&
														!isFocused
													}
													onSelect={() =>
														handleRelationshipClick(rel.constraintName)
													}
													onCheckChange={(checked) =>
														handleRelationshipCheckChange(
															rel.constraintName,
															checked,
														)
													}
												/>
											))}
										</div>
									</div>
								) : null;
							})}
						</div>
					</Splitter.Panel>

					<Splitter.Context>
						{(ctx) => (
							<Splitter.ResizeTrigger
								id="sidebar:content"
								className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors"
								title="Drag to resize column, double click to collapse/expand"
								onDoubleClick={() =>
									ctx.isPanelExpanded("sidebar")
										? ctx.collapsePanel("sidebar")
										: ctx.expandPanel("sidebar")
								}
							/>
						)}
					</Splitter.Context>

					{/* Right Panel - Data Display */}
					<Splitter.Panel
						id="content"
						className="flex flex-col overflow-hidden"
						ref={rightPanelRef}
					>
						{stickyRelationship &&
							displayedRelationships.size > 1 &&
							(() => {
								const rel = validRelationships.find(
									(r) => r.constraintName === stickyRelationship,
								);
								const parentRowValue =
									rel &&
									(rel.type === "outgoing"
										? // For outgoing relationships, get the FK value from the row
											rowData[rel.referencingColumn]
										: // For incoming relationships, we need the PK value from the current row
											rowData[rel.referencedColumn]);

								return rel ? (
									<div className="sticky top-0 bg-card border-b px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
										<span>
											<span className="font-medium text-foreground">
												{rel.referencingTable}.{rel.referencingColumn}
											</span>
											<span className="mx-1">›</span>
											<span>
												{rel.referencedTable}.{rel.referencedColumn}
											</span>
											{rel.type === "outgoing" && (
												<>
													<span className="text-muted-foreground shrink-0 mx-1">
														=
													</span>
													<span className="text-foreground font-medium truncate">
														{parentRowValue as string}
													</span>
												</>
											)}
										</span>
									</div>
								) : null;
							})()}
						{displayedRelationships.size > 0 ? (
							<div className="flex-1 overflow-y-auto space-y-4 p-4">
								{validRelationships
									.filter((r) => displayedRelationships.has(r.constraintName))
									.sort((a, b) => {
										// Outgoing (References) first, then incoming (Referenced By)
										if (a.type === "outgoing" && b.type === "incoming")
											return -1;
										if (a.type === "incoming" && b.type === "outgoing")
											return 1;
										return 0;
									})
									.map((rel) => {
										const constraintName = rel.constraintName;
										return (
											<div
												key={constraintName}
												data-constraint={constraintName}
												ref={(el) => {
													if (el) {
														cardRefs.current[constraintName] = el;
													}
												}}
												className="border rounded-md overflow-hidden bg-card transition-colors"
											>
												<RelationshipCard
													relationship={rel}
													rowData={rowData}
													connectionUrl={connectionUrl}
													isPanelExpanded={isPanelExpanded}
													withHeader={true}
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
					</Splitter.Panel>
				</Splitter.Root>
			)}
		</div>
	);
};

function useStickyRelationshipTracking(
	containerRef: React.RefObject<HTMLDivElement | null>,
	cardRefs: React.RefObject<Record<string, HTMLDivElement | null>>,
	displayedRelationships: Set<string>,
	relationships: TableRelationship[],
) {
	const [stickyRelationship, setStickyRelationship] = useState<string | null>(
		null,
	);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const sortedRels = relationships
			.filter((r) => displayedRelationships.has(r.constraintName))
			.sort((a, b) => {
				if (a.type === "outgoing" && b.type === "incoming") return -1;
				if (a.type === "incoming" && b.type === "outgoing") return 1;
				return 0;
			});

		const visibleCards = new Map<string, number>();

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const constraintName = entry.target.getAttribute("data-constraint");
					if (!constraintName) return;

					if (entry.isIntersecting) {
						visibleCards.set(
							constraintName,
							entry.boundingClientRect.top -
								container.getBoundingClientRect().top,
						);
					} else {
						visibleCards.delete(constraintName);
					}
				});

				let topmostCard: string | null = null;
				let smallestTop = Infinity;

				for (const [name, top] of visibleCards) {
					if (top <= smallestTop) {
						smallestTop = top;
						topmostCard = name;
					}
				}

				if (!topmostCard && sortedRels.length > 0) {
					topmostCard = sortedRels[0].constraintName;
				}

				if (topmostCard) {
					setStickyRelationship(topmostCard);
				}
			},
			{
				root: container,
				threshold: 0,
			},
		);

		Object.entries(cardRefs.current).forEach(([constraintName, el]) => {
			if (el && displayedRelationships.has(constraintName)) {
				observer.observe(el);
			}
		});

		return () => observer.disconnect();
	}, [displayedRelationships, relationships, containerRef, cardRefs]);

	return stickyRelationship;
}

interface RelationshipCardProps {
	relationship: TableRelationship;
	rowData: Record<string, unknown>;
	connectionUrl: string;
	isPanelExpanded: boolean;
	withHeader: boolean;
	onRemove: () => void;
}

const RelationshipCard = ({
	relationship,
	rowData,
	connectionUrl,
	isPanelExpanded,
	withHeader,
	onRemove,
}: RelationshipCardProps) => {
	const parentRowValue =
		relationship.type === "outgoing"
			? // For outgoing relationships, get the FK value from the row
				rowData[relationship.referencingColumn]
			: // For incoming relationships, we need the PK value from the current row
				rowData[relationship.referencedColumn];

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<RelationshipSubrowTable
				relationship={relationship}
				parentRowValue={String(parentRowValue)}
				connection={{ url: connectionUrl }}
				isPanelExpanded={isPanelExpanded}
				withHeader={withHeader}
				onRemove={onRemove}
			/>
		</div>
	);
};

interface RelationshipListItemProps {
	rel: TableRelationship;
	rowCount: number;
	isCountLoading: boolean;
	isSelected: boolean;
	isSticky: boolean;
	isStickyOther: boolean;
	onSelect: () => void;
	onCheckChange: (checked: boolean) => void;
}

const RelationshipListItem = ({
	rel,
	rowCount,
	isCountLoading,
	isSelected,
	isSticky,
	isStickyOther,
	onSelect,
	onCheckChange,
}: RelationshipListItemProps) => {
	const firstLabel =
		rel.type === "outgoing"
			? `${rel.referencingTable}.${rel.referencingColumn}`
			: `${rel.referencingTable}.${rel.referencingColumn}`;
	const secondLabel =
		rel.type === "outgoing"
			? `› ${rel.referencedTable}.${rel.referencedColumn}`
			: `› ${rel.referencedTable}.${rel.referencedColumn}`;
	const isDisabled = !isCountLoading && rowCount === 0;

	if (isDisabled) {
		return (
			<div
				className={`w-full px-3 py-2 text-left text-xs opacity-40 cursor-not-allowed ${
					isSticky
						? "bg-accent border-l border-muted"
						: isStickyOther
							? "bg-accent border-l-2 border-primary"
							: ""
				}`}
			>
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-start gap-1 flex-1 min-w-0">
						<span className="text-muted-foreground inline-block w-12 text-left shrink-0">
							{isCountLoading ? (
								<span className="text-xs">…</span>
							) : (
								<span>{rowCount}</span>
							)}
						</span>
						<HStack
							className="flex-1 min-w-0"
							title={`${firstLabel} ${secondLabel}`}
						>
							<div className="font-medium truncate">{firstLabel}</div>
							<div className="text-muted-foreground truncate text-xs">
								{secondLabel}
							</div>
						</HStack>
					</div>
					<Checkbox
						checked={false}
						disabled={true}
						onClick={(e) => e.stopPropagation()}
					>
						<CheckboxControl />
					</Checkbox>
				</div>
			</div>
		);
	}

	return (
		<button
			onClick={onSelect}
			className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-accent ${
				isSticky
					? "bg-accent border-l border-muted"
					: isStickyOther
						? "bg-accent border-l-2 border-primary"
						: ""
			}`}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-start gap-1 flex-1 min-w-0">
					<span className="text-muted-foreground inline-block w-12 text-left shrink-0">
						{isCountLoading ? (
							<span className="text-xs">…</span>
						) : (
							<span>{rowCount}</span>
						)}
					</span>
					<HStack
						className="flex-1 min-w-0"
						title={`${firstLabel} ${secondLabel}`}
					>
						<div className="font-medium truncate">{firstLabel}</div>
						<div className="text-muted-foreground truncate text-xs">
							{secondLabel}
						</div>
					</HStack>
				</div>
				<Checkbox
					checked={isSelected}
					onCheckedChange={(details) => {
						onCheckChange(details.checked === true);
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<CheckboxControl />
				</Checkbox>
			</div>
		</button>
	);
};
