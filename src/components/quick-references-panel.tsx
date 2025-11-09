import {
	AlertCircle,
	ChevronDown,
	ChevronRight,
	Loader,
	Link as LinkIcon,
	Copy,
	Check,
	Search,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { findColumnReferencesQueryOptions } from "#src/server/pg/start-fns/find-column-references.start.ts";
import type { ColumnReference } from "#src/server/pg/fns/get-table-foreign-keys.kysely.ts";

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
	const [filterText, setFilterText] = useState("");

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
					{onClose && (
						<button
							onClick={onClose}
							className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
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
						className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
							<div className="px-0 pb-3 bg-muted/20">
								{isLoadingReferences && (
									<div className="flex items-center gap-2 text-sm text-muted-foreground py-3 px-4">
										<Loader className="h-4 w-4 animate-spin" />
										Loading tables that reference this...
									</div>
								)}

								{referencesError && (
									<div className="m-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
										<div className="flex items-start gap-2">
											<AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
											<div className="text-sm text-red-900 dark:text-red-100">
												Failed to load relationships
											</div>
										</div>
									</div>
								)}

								{!isLoadingReferences && !reverseReferencesExist && (
									<div className="text-sm text-muted-foreground py-3 px-4">
										No tables reference this value
									</div>
								)}

								{!isLoadingReferences && reverseReferencesExist && (
									<>
										<div className="text-xs text-muted-foreground px-4 py-2">
											View rows with{" "}
											<code className="font-mono">{column.name}</code> ={" "}
											<code className="font-mono text-foreground truncate">
												{String(cellValue).slice(0, 150)}
												{String(cellValue).length > 150 ? "..." : ""}
											</code>
										</div>
										<div className="px-4 py-2 border-b">
											<div className="relative">
												<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
												<input
													type="text"
													placeholder="Filter tables..."
													value={filterText}
													onChange={(e) => setFilterText(e.target.value)}
													className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
												/>
											</div>
										</div>
										<div className="space-y-0 px-2">
											{Object.entries(referencesByTable)
												.filter(([tableKey]) =>
													tableKey
														.toLowerCase()
														.includes(filterText.toLowerCase()),
												)
												.map(([tableKey, refs]) => (
													<div key={tableKey} className="space-y-0">
														{refs.map((ref) => (
															<button
																key={`${ref.schema}.${ref.table}.${ref.column}`}
																onClick={() => handleNavigateToReference(ref)}
																className="w-full px-4 py-2 flex items-center justify-between gap-3 hover:bg-muted/70 transition-colors text-left group text-sm border-l-2 border-transparent hover:border-foreground"
															>
																<div className="font-mono text-xs min-w-0 flex-1">
																	<span className="text-muted-foreground">
																		{ref.table}.
																	</span>
																	<span className="font-medium">
																		{ref.column}
																	</span>
																</div>
																<div className="text-xs text-muted-foreground shrink-0 whitespace-nowrap group-hover:text-foreground transition-colors">
																	go →
																</div>
															</button>
														))}
													</div>
												))}
										</div>
									</>
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
