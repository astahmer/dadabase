import { Splitter } from "@ark-ui/react/splitter";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useRef } from "react";
import { RelationshipViewMode } from "#src/components/pages/connection-page/relationships/relationship-view-mode.ts";
import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import { useRelationshipsPanelState } from "#src/components/pages/connection-page/use-relationships-panel-state.ts";
import { useStickyRelationshipTracking as useStickyTracking } from "#src/components/pages/connection-page/use-sticky-relationship-tracking.ts";
import { cn, tryFn } from "#src/lib/utils.ts";
import { getRelationshipsCountsQueryOptions } from "#src/server/introspection/start-fns/get-relationships-counts.start.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/introspection/start-fns/get-table-relationships.start.ts";
import { Button } from "../../../ui/button.tsx";
import { Checkbox, CheckboxControl } from "../../../ui/checkbox.tsx";
import { HStack } from "../../../ui/layout.tsx";
import { Spinner } from "../../../ui/spinner.tsx";
import { RelatedDataSubrowTable } from "./related-data-subrow-table";
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
	const panelState = useRelationshipsPanelState();
	const {
		selectedRelationships,
		displayedRelationships,
		relationshipViewMode,
	} = panelState.state;
	const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const rightPanelRef = useRef<HTMLDivElement | null>(null);

	const relationshipsQuery = useQuery(
		getTableRelationshipsQueryOptions({
			url: connectionUrl,
			schema,
			table,
		}),
	);

	const relationships = relationshipsQuery.data ?? [];

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

	const stickyRelationship = useStickyTracking(
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

	const relsByType = {
		outgoing: validRelationships.filter((r) => r.type === "outgoing"),
		incoming: validRelationships.filter((r) => r.type === "incoming"),
	};

	const relationshipTypeLabels = {
		outgoing: "Outgoing: Foreign keys",
		incoming: "Incoming: Referenced By",
	};

	const handleSelectAllGroup = (type: "outgoing" | "incoming") => {
		const groupRels = relsByType[type];
		const selectableNames = groupRels
			.filter((r) => (Number(counts[r.constraintName]) ?? 0) > 0)
			.map((r) => r.constraintName);
		panelState.selectGroup(selectableNames);
	};

	const handleDeselectAllGroup = (type: "outgoing" | "incoming") => {
		const groupRels = relsByType[type];
		const names = groupRels.map((r) => r.constraintName);
		panelState.deselectGroup(names);
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
		if (rowCount === 0) return;
		if (!selectedRelationships.has(constraintName)) {
			panelState.selectRelationship(constraintName);
		}
	};

	const handleRelationshipCheckChange = (
		constraintName: string,
		checked: boolean,
	) => {
		const rowCount = counts[constraintName] ?? 0;
		if (checked && rowCount === 0) return;
		if (checked) {
			panelState.selectRelationship(constraintName);
		} else {
			panelState.deselectRelationship(constraintName);
		}
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
					{/* Left Sidebar */}
					<Splitter.Panel
						id="sidebar"
						className="border-r bg-muted/30 flex flex-col overflow-hidden ml-2"
					>
						<div className="flex-1 overflow-y-auto">
							{(["outgoing", "incoming"] as const).map((type, idx) => {
								const rels = relsByType[type];
								const typeLabel = relationshipTypeLabels[type];
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
													viewMode={
														relationshipViewMode[rel.constraintName] ??
														RelationshipViewMode.RelatedData
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
													onViewModeChange={(mode) => {
														panelState.setViewMode(rel.constraintName, mode);
													}}
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
								className={cn(
									tryFn(() => ctx.isPanelCollapsed("relationships"))
										? "w-3"
										: "w-1.5",
									"bg-border hover:bg-primary/50 cursor-col-resize transition-colors",
								)}
								title="Drag to resize"
								onDoubleClick={() =>
									ctx.isPanelExpanded("sidebar")
										? ctx.collapsePanel("sidebar")
										: ctx.expandPanel("sidebar")
								}
							/>
						)}
					</Splitter.Context>

					{/* Right Panel */}
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
										? rowData[rel.referencingColumn]
										: rowData[rel.referencedColumn]);

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
													viewMode={
														relationshipViewMode[constraintName] ??
														RelationshipViewMode.RelatedData
													}
													onRemove={() => {
														panelState.hideRelationship(constraintName);
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

interface RelationshipCardProps {
	relationship: TableRelationship;
	rowData: Record<string, unknown>;
	connectionUrl: string;
	isPanelExpanded: boolean;
	withHeader: boolean;
	onRemove: () => void;
	viewMode?: RelationshipViewMode;
}

const RelationshipCard = ({
	relationship,
	rowData,
	connectionUrl,
	isPanelExpanded,
	withHeader,
	onRemove,
	viewMode = RelationshipViewMode.RelatedData,
}: RelationshipCardProps) => {
	const parentRowValue =
		relationship.type === "outgoing"
			? rowData[relationship.referencingColumn]
			: rowData[relationship.referencedColumn];

	if (
		viewMode === RelationshipViewMode.RelatedData &&
		relationship.type === "outgoing"
	) {
		return (
			<div className="flex flex-col h-full overflow-hidden">
				<RelatedDataSubrowTable
					relationship={relationship}
					parentRowValue={String(parentRowValue)}
					connection={{ url: connectionUrl }}
					isPanelExpanded={isPanelExpanded}
					withHeader={withHeader}
					onRemove={onRemove}
				/>
			</div>
		);
	}

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
	viewMode?: RelationshipViewMode;
	onSelect: () => void;
	onCheckChange: (checked: boolean) => void;
	onViewModeChange?: (mode: RelationshipViewMode) => void;
}

const RelationshipListItem = ({
	rel,
	rowCount,
	isCountLoading,
	isSelected,
	isSticky,
	isStickyOther,
	viewMode = RelationshipViewMode.RelatedData,
	onSelect,
	onCheckChange,
	onViewModeChange,
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
		<div className="w-full flex flex-col">
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
			{isSelected && rel.type === "outgoing" && (
				<div className="px-3 py-1 bg-muted/20 border-t flex gap-1 text-xs">
					<button
						onClick={(e) => {
							e.stopPropagation();
							onViewModeChange?.(RelationshipViewMode.RelatedData);
						}}
						className={`flex-1 px-2 py-1 rounded transition-colors ${
							viewMode === RelationshipViewMode.RelatedData
								? "bg-primary text-primary-foreground"
								: "bg-muted hover:bg-muted/80 text-muted-foreground"
						}`}
						title={`Show the record pointed to by the FK (e.g ${rel.referencedTable} with the column ${rel.referencedColumn} matching the value found for the selected ${rel.referencingTable} ${rel.referencingColumn} column)`}
					>
						Related Data
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onViewModeChange?.(RelationshipViewMode.ReverseLookup);
						}}
						className={`flex-1 px-2 py-1 rounded transition-colors ${
							viewMode === RelationshipViewMode.ReverseLookup
								? "bg-primary text-primary-foreground"
								: "bg-muted hover:bg-muted/80 text-muted-foreground"
						}`}
						title={`Show rows with matching FK column value (e.g other ${rel.referencingTable} with the same value on the column ${rel.referencingColumn} as the selected row)`}
					>
						Reverse Lookup
					</button>
				</div>
			)}
		</div>
	);
};
