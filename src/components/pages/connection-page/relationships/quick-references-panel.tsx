import { Clipboard, useFilter, useListCollection } from "@ark-ui/react";
import { useQuery } from "@tanstack/react-query";
import {
	AlertCircle,
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	Link as LinkIcon,
	Loader,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ColumnReference } from "#src/server/introspection/introspection.ts";
import { findColumnReferencesWithCountsQueryOptions } from "#src/server/introspection/start-fns/find-column-references.start.ts";
import { ErrorBoundaryCard } from "../../../shared/error-boundary-card.tsx";
import { HStack, Stack } from "../../../ui/layout.tsx";
import {
	ListboxMenuFilterContainer,
	ListboxMenuFilterInput,
	ListboxMenuItem,
	ListboxMenuList,
	ListboxRoot,
} from "../../../ui/listbox-menu.tsx";
import {
	createListCollection,
	Select,
	SelectContent,
	SelectControl,
	SelectItem,
	SelectList,
	SelectTrigger,
	SelectValueText,
} from "../../../ui/select.tsx";

export interface QuickReferencesPanelProps {
	schema: string;
	table: string;
	column: {
		name: string;
		dataType: string;
		nullable: boolean;
		primaryKey: boolean;
		unique: boolean;
		defaultValue: string | null;
		isForeignKey?: boolean;
		foreignKey?: {
			referencedSchema: string;
			referencedTable: string;
			referencedColumn: string;
		};
	};
	cellValue: unknown;
	connectionUrl: string;
	onNavigate?: (
		schema: string,
		table: string,
		column: string,
		value: unknown,
	) => void;
}

export function QuickReferencesPanel({
	schema,
	table,
	column,
	cellValue,
	connectionUrl,
	onNavigate,
}: QuickReferencesPanelProps) {
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(["forward-fk", "reverse-fk"]),
	);
	const [sortBy, setSortBy] = useState<"name" | "count">("name");

	// Fetch reverse FK references for any column
	// If this column is a FK, get references to the target column
	// Otherwise, get references to this column itself
	const referenceTarget = column.foreignKey
		? {
				referencedSchema: column.foreignKey.referencedSchema,
				referencedTable: column.foreignKey.referencedTable,
				referencedColumn: column.foreignKey.referencedColumn,
			}
		: {
				referencedSchema: schema,
				referencedTable: table,
				referencedColumn: column.name,
			};

	const {
		data: reverseReferences = [],
		isLoading: isLoadingReferences,
		error: referencesError,
		refetch: refetchReferences,
	} = useQuery(
		findColumnReferencesWithCountsQueryOptions({
			url: connectionUrl,
			referencedSchema: referenceTarget.referencedSchema,
			referencedTable: referenceTarget.referencedTable,
			referencedColumn: referenceTarget.referencedColumn,
			cellValue,
		}),
	);

	const toggleSection = (sectionId: string) => {
		const newExpanded = new Set(expandedSections);
		if (newExpanded.has(sectionId)) {
			newExpanded.delete(sectionId);
		} else {
			newExpanded.add(sectionId);
		}
		setExpandedSections(newExpanded);
	};

	const handleNavigateToReference = (ref: ColumnReference) => {
		if (onNavigate && cellValue !== null) {
			onNavigate(ref.schema, ref.table, ref.column, cellValue);
		}
	};

	const forwardFKsExist = column.foreignKey !== undefined;
	const reverseReferencesExist = (reverseReferences?.length ?? 0) > 0;

	// Create list collection items from references
	const referenceItems = useMemo(() => {
		let items = reverseReferences.map((ref) => ({
			label: `${ref.table}.${ref.column}`,
			value: `${ref.schema}.${ref.table}.${ref.column}`,
			ref,
		}));

		// Sort based on sortBy state
		if (sortBy === "count") {
			items.sort(
				(a, b) =>
					(Number(b.ref.matchingRowCount ?? 0) ?? 0) -
					(Number(a.ref.matchingRowCount ?? 0) ?? 0),
			);
		} else {
			// Default sort by name (A-Z ascending)
			items.sort((a, b) => a.label.localeCompare(b.label));
		}

		return items;
	}, [reverseReferences, sortBy]);

	const filters = useFilter({ sensitivity: "base" });
	const refList = useListCollection({
		initialItems: referenceItems,
		filter: filters.contains,
	});

	useEffect(() => {
		refList.set(referenceItems);
	}, [referenceItems]);

	return (
		<div className="w-full space-y-0 h-full flex flex-col overflow-hidden">
			{/* Header - Column Info */}
			<div className="bg-linear-to-b from-background to-background/95 px-4 py-3 border-b shrink-0">
				<div className="flex items-start justify-between gap-3 mb-2">
					<div className="flex-1 min-w-0">
						<p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
							Relationships for
						</p>
						<code className="text-xs font-mono text-muted-foreground font-bold">
							{schema}.{table}.{column.name}
						</code>
						<div className="mt-1 flex items-center gap-2">
							<span className="text-xs text-muted-foreground">
								{cellValue === null
									? "NULL"
									: String(cellValue).slice(0, 100) +
										(String(cellValue).length > 100 ? "..." : "")}
							</span>
						</div>
					</div>
				</div>

				{/* Value Copy */}
				{cellValue !== null && (
					<Clipboard.Root value={String(cellValue)}>
						<Clipboard.Trigger asChild>
							<button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
								<Clipboard.Indicator
									copied={
										<HStack align="center">
											<Check className="h-3 w-3" />
											Copied
										</HStack>
									}
								>
									<HStack align="center">
										<Copy className="h-3 w-3" />
										Copy value
									</HStack>
								</Clipboard.Indicator>
							</button>
						</Clipboard.Trigger>
					</Clipboard.Root>
				)}
			</div>
			{/* Content */}
			<Stack className="overflow-y-auto min-h-0 flex-1">
				{cellValue === null && (
					<div className="m-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
						<div className="flex items-start gap-2">
							<AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
							<div className="text-sm text-amber-900 dark:text-amber-100">
								Cannot display relationships for NULL values
							</div>
						</div>
					</div>
				)}

				{/* Forward FK Section */}
				{cellValue !== null && forwardFKsExist && (
					<div>
						<button
							onClick={() => toggleSection("forward-fk")}
							className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
						>
							<div className="flex items-center gap-2">
								{expandedSections.has("forward-fk") ? (
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								)}
								<LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
								<span className="font-semibold text-sm">From source table</span>
							</div>
						</button>

						{expandedSections.has("forward-fk") && column.foreignKey && (
							<div className="px-0 pb-0 bg-muted/20">
								{onNavigate && (
									<button
										onClick={() => {
											if (column.foreignKey) {
												onNavigate(
													column.foreignKey.referencedSchema,
													column.foreignKey.referencedTable,
													column.foreignKey.referencedColumn,
													cellValue,
												);
											}
										}}
										className="w-full px-4 py-2 flex items-center justify-between gap-3 hover:bg-muted/70 transition-colors text-left group border-l-2 border-transparent hover:border-foreground"
									>
										<div className="font-mono text-xs min-w-0 flex-1">
											<span className="text-muted-foreground">
												{column.foreignKey.referencedTable}.
											</span>
											<span className="font-medium">
												{column.foreignKey.referencedColumn}
											</span>
										</div>
										<div className="text-xs text-muted-foreground shrink-0 whitespace-nowrap group-hover:text-foreground transition-colors">
											go →
										</div>
									</button>
								)}
							</div>
						)}
					</div>
				)}

				{/* Reverse FK References Section */}
				{cellValue !== null && (
					<div>
						<button
							onClick={() => toggleSection("reverse-fk")}
							className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
						>
							<div className="flex items-center gap-2">
								{expandedSections.has("reverse-fk") ? (
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								)}
								<LinkIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
								<span className="font-semibold text-sm">Referenced By</span>
								{!isLoadingReferences && (
									<span className="text-xs text-muted-foreground">
										(
										{reverseReferences
											?.reduce(
												(sum, ref) =>
													Number(ref.matchingRowCount) === -1
														? sum
														: sum + Number(ref.matchingRowCount ?? 0),
												0,
											)
											.toLocaleString() ?? 0}
										)
									</span>
								)}
								{isLoadingReferences && (
									<Loader className="h-3 w-3 animate-spin text-muted-foreground" />
								)}
							</div>
						</button>

						{expandedSections.has("reverse-fk") && (
							<div className="px-0 pb-3 bg-muted/20 flex flex-col min-h-0 flex-1">
								{isLoadingReferences && (
									<div className="flex flex-col items-center justify-center py-12 px-4 gap-4 flex-1">
										<div className="flex items-center gap-2 text-sm text-muted-foreground py-3 px-4">
											<Loader className="h-4 w-4 animate-spin" />
											Loading tables that reference this...
										</div>
									</div>
								)}
								{referencesError && (
									<ErrorBoundaryCard
										error={referencesError}
										title="Failed to load relationships"
										onRetry={() => refetchReferences()}
									/>
								)}{" "}
								{!isLoadingReferences && !reverseReferencesExist && (
									<div className="text-sm text-muted-foreground py-3 px-4">
										No tables reference this value
									</div>
								)}
								{!isLoadingReferences && reverseReferencesExist && (
									<ListboxRoot
										collection={refList.collection}
										className="h-full"
									>
										<div className="space-y-2 px-4 py-2">
											<div className="text-xs text-muted-foreground">
												View rows with{" "}
												<code className="font-mono">{column.name}</code> ={" "}
												<code className="font-mono text-foreground truncate">
													{String(cellValue).slice(0, 150)}
													{String(cellValue).length > 150 ? "..." : ""}
												</code>
											</div>
											<div className="flex gap-2">
												<ListboxMenuFilterContainer className="p-0 flex-1">
													<ListboxMenuFilterInput
														placeholder="Filter tables..."
														className="h-7 text-xs px-2 rounded"
														onChange={(e) => {
															refList.filter(e.target.value);
														}}
													/>
												</ListboxMenuFilterContainer>
												<Select
													value={[sortBy]}
													onValueChange={(details) =>
														setSortBy(details.value[0] as "name" | "count")
													}
													collection={createListCollection({
														items: [
															{ label: "A-Z", value: "name" },
															{ label: "Count", value: "count" },
														],
													})}
												>
													<SelectControl
														className="h-7 text-xs rounded w-24"
														size="sm"
													>
														<SelectTrigger>
															<SelectValueText placeholder="Sort by" />
														</SelectTrigger>
													</SelectControl>
													<SelectContent portalled={false}>
														<SelectList>
															{createListCollection({
																items: [
																	{ label: "A-Z", value: "name" },
																	{ label: "Count", value: "count" },
																],
															}).items.map((item) => (
																<SelectItem key={item.value} item={item}>
																	{item.label}
																</SelectItem>
															))}
														</SelectList>
													</SelectContent>
												</Select>
											</div>
										</div>
										<ListboxMenuList className="overflow-visible px-2">
											{refList.collection.items.length > 0 ? (
												refList.collection.items.map((item) => {
													const ref = item.ref;
													return (
														<ListboxMenuItem
															key={item.value}
															item={item}
															showIndicator={false}
															className="px-2 py-1.5 text-xs font-mono hover:bg-muted/70 border-l-2 border-transparent hover:border-foreground cursor-pointer"
															onClick={() => handleNavigateToReference(ref)}
														>
															<div className="flex items-center justify-between gap-2 w-full">
																<span>
																	<span className="text-muted-foreground">
																		{ref.table}.
																	</span>
																	<span className="font-medium">
																		{ref.column}
																	</span>
																</span>
																{ref.matchingRowCount !== undefined && (
																	<span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
																		({ref.matchingRowCount.toLocaleString()})
																	</span>
																)}
															</div>
														</ListboxMenuItem>
													);
												})
											) : (
												<div className="px-2 py-2 text-xs text-muted-foreground text-center">
													No matching references
												</div>
											)}
											<div className="pb-4" />
										</ListboxMenuList>
									</ListboxRoot>
								)}
							</div>
						)}
					</div>
				)}

				{/* No relationships state */}
				{cellValue !== null &&
					!forwardFKsExist &&
					!isLoadingReferences &&
					!reverseReferencesExist && (
						<div className="m-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
							<div className="flex items-start gap-2">
								<AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
								<div className="text-sm text-blue-900 dark:text-blue-100">
									This column has no foreign key relationships
								</div>
							</div>
						</div>
					)}
			</Stack>
		</div>
	);
}
