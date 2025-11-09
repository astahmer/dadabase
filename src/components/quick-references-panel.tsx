import {
	AlertCircle,
	ChevronDown,
	ChevronRight,
	Loader,
	Link as LinkIcon,
	ArrowRight,
	Copy,
	Check,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { findColumnReferencesQueryOptions } from "#src/server/pg/start-fns/find-column-references.start.ts";
import type { ColumnReference } from "#src/server/pg/fns/get-table-foreign-keys.kysely.ts";
import { Button } from "./ui/button.tsx";

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
	onClose?: () => void;
}

export function QuickReferencesPanel({
	schema,
	table,
	column,
	cellValue,
	connectionUrl,
	onNavigate,
	onClose,
}: QuickReferencesPanelProps) {
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(["forward-fk", "reverse-fk"]),
	);
	const [copiedValue, setCopiedValue] = useState(false);

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
	} = useQuery(
		findColumnReferencesQueryOptions({
			url: connectionUrl,
			referencedSchema: referenceTarget.referencedSchema,
			referencedTable: referenceTarget.referencedTable,
			referencedColumn: referenceTarget.referencedColumn,
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

	const handleCopyValue = () => {
		navigator.clipboard.writeText(String(cellValue));
		setCopiedValue(true);
		setTimeout(() => setCopiedValue(false), 2000);
	};

	const forwardFKsExist = column.foreignKey !== undefined;
	const reverseReferencesExist = (reverseReferences?.length ?? 0) > 0;

	// Group reverse references by table for cleaner UI
	const referencesByTable = (reverseReferences ?? []).reduce(
		(acc, ref) => {
			const key = `${ref.schema}.${ref.table}`;
			if (!acc[key]) {
				acc[key] = [];
			}
			acc[key].push(ref);
			return acc;
		},
		{} as Record<string, ColumnReference[]>,
	);

	return (
		<div className="w-full space-y-0">
			{/* Header - Column Info */}
			<div className="sticky top-0 z-10 bg-linear-to-b from-background to-background/95 px-4 py-3 border-b">
				<div className="flex items-start justify-between gap-3 mb-2">
					<div className="flex-1 min-w-0">
						<p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
							Relationships for
						</p>
						<div className="flex items-center gap-2 flex-wrap">
							<code className="text-sm font-mono font-bold bg-muted px-2 py-1 rounded">
								{column.name}
							</code>
							<span className="text-xs text-muted-foreground truncate">
								{cellValue === null
									? "NULL"
									: String(cellValue).slice(0, 150) +
										(String(cellValue).length > 150 ? "..." : "")}
							</span>
						</div>
					</div>
					{onClose && (
						<button
							onClick={onClose}
							className="text-muted-foreground hover:text-foreground transition-colors mt-1"
							aria-label="Close"
						>
							✕
						</button>
					)}
				</div>

				{/* Value Copy */}
				{cellValue !== null && (
					<button
						onClick={handleCopyValue}
						className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
					>
						{copiedValue ? (
							<>
								<Check className="h-3 w-3" />
								Copied
							</>
						) : (
							<>
								<Copy className="h-3 w-3" />
								Copy value
							</>
						)}
					</button>
				)}
			</div>

			{/* Content */}
			<div className="overflow-y-auto">
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
					<div className="border-b">
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
								<span className="font-semibold text-sm">Points To</span>
								<span className="text-xs text-muted-foreground">
									({column.foreignKey?.referencedTable})
								</span>
							</div>
						</button>

						{expandedSections.has("forward-fk") && column.foreignKey && (
							<div className="px-4 py-4 space-y-3 bg-muted/20 border-t">
								<div className="grid grid-cols-2 gap-3 text-sm">
									<div>
										<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
											Table
										</p>
										<code className="block text-sm font-mono bg-background px-2 py-1.5 rounded border">
											{column.foreignKey.referencedTable}
										</code>
									</div>
									<div>
										<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
											Column
										</p>
										<code className="block text-sm font-mono bg-background px-2 py-1.5 rounded border">
											{column.foreignKey.referencedColumn}
										</code>
									</div>
								</div>
								<div>
									<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
										Value
									</p>
									<code className="block text-sm font-mono bg-background px-2 py-1.5 rounded border break-all max-h-16 overflow-y-auto">
										{String(cellValue)}
									</code>
								</div>
								{onNavigate && (
									<Button
										size="sm"
										className="w-full mt-3 h-8"
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
									>
										<ArrowRight className="h-3 w-3 mr-1" />
										Navigate to Row
									</Button>
								)}
							</div>
						)}
					</div>
				)}

				{/* Reverse FK References Section */}
				{cellValue !== null && (
					<div className="border-b">
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
										({reverseReferences?.length ?? 0})
									</span>
								)}
								{isLoadingReferences && (
									<Loader className="h-3 w-3 animate-spin text-muted-foreground" />
								)}
							</div>
						</button>

						{expandedSections.has("reverse-fk") && (
							<div className="px-4 pb-3 bg-muted/30">
								{isLoadingReferences && (
									<div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
										<Loader className="h-4 w-4 animate-spin" />
										Loading tables that reference this...
									</div>
								)}

								{referencesError && (
									<div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg my-2">
										<div className="flex items-start gap-2">
											<AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
											<div className="text-sm text-red-900 dark:text-red-100">
												Failed to load relationships
											</div>
										</div>
									</div>
								)}

								{!isLoadingReferences && !reverseReferencesExist && (
									<div className="text-sm text-muted-foreground py-3">
										No tables reference this value
									</div>
								)}

								{!isLoadingReferences && reverseReferencesExist && (
									<div className="space-y-3 pt-2">
										{Object.entries(referencesByTable).map(
											([tableKey, refs]) => (
												<div key={tableKey} className="space-y-2">
													<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
														{tableKey}
													</div>
													<div className="space-y-1.5 ml-0">
														{refs.map((ref) => (
															<div
																key={`${ref.schema}.${ref.table}.${ref.column}`}
																className="flex items-center justify-between gap-2 px-2 py-1.5 bg-background rounded border border-border hover:border-border hover:bg-background transition-colors"
															>
																<code className="text-xs font-mono">
																	{ref.column}
																</code>
																{onNavigate && (
																	<Button
																		size="sm"
																		variant="ghost"
																		className="h-6 px-2 text-xs"
																		onClick={() =>
																			handleNavigateToReference(ref)
																		}
																	>
																		View
																	</Button>
																)}
															</div>
														))}
													</div>
												</div>
											),
										)}
									</div>
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
			</div>
		</div>
	);
}
