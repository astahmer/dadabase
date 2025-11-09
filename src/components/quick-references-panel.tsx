import {
	AlertCircle,
	ChevronDown,
	ChevronRight,
	Loader,
	Link as LinkIcon,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { findColumnReferencesQueryOptions } from "#src/server/pg/start-fns/find-column-references.start.ts";
import type { ColumnReference } from "#src/server/pg/fns/get-table-foreign-keys.kysely.ts";
import { Button } from "./ui/button.tsx";
import { Card } from "./ui/card.tsx";

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

	// Fetch reverse FK references if this column is a PK or has reverse references
	const {
		data: reverseReferences,
		isLoading: isLoadingReferences,
		error: referencesError,
	} = useQuery(
		column.primaryKey || column.unique
			? findColumnReferencesQueryOptions({
					url: connectionUrl,
					referencedSchema: schema,
					referencedTable: table,
					referencedColumn: column.name,
				})
			: { queryKey: [], queryFn: async () => [] },
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
		<div className="w-full max-w-md space-y-4">
			<div className="flex items-center justify-between px-4 py-2 border-b">
				<h3 className="font-semibold text-sm">
					References for{" "}
					<code className="font-mono text-xs bg-muted px-2 py-1 rounded">
						{column.name}
					</code>
				</h3>
				{onClose && (
					<button
						onClick={onClose}
						className="text-muted-foreground hover:text-foreground"
						aria-label="Close"
					>
						✕
					</button>
				)}
			</div>

			{cellValue === null && (
				<div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
					<AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
					<div className="text-sm text-yellow-800 dark:text-yellow-200">
						Cannot show references for NULL values
					</div>
				</div>
			)}

			{/* Forward FK Section */}
			{forwardFKsExist && cellValue !== null && (
				<div className="p-4">
					<button
						onClick={() => toggleSection("forward-fk")}
						className="flex items-center gap-2 w-full font-semibold text-sm hover:opacity-75"
					>
						{expandedSections.has("forward-fk") ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
						<LinkIcon className="h-4 w-4" />
						Forward Reference
					</button>

					{expandedSections.has("forward-fk") && (
						<div className="mt-3 space-y-2 ml-6">
							<div className="text-xs text-muted-foreground">
								This column references another table
							</div>
							<div className="bg-muted p-2 rounded text-sm space-y-1">
								<div>
									<span className="text-muted-foreground">Table:</span>{" "}
									<code className="font-mono">
										{column.foreignKey?.referencedTable}
									</code>
								</div>
								<div>
									<span className="text-muted-foreground">Column:</span>{" "}
									<code className="font-mono">
										{column.foreignKey?.referencedColumn}
									</code>
								</div>
								<div>
									<span className="text-muted-foreground">Value:</span>{" "}
									<code className="font-mono">{String(cellValue)}</code>
								</div>
							</div>
							{onNavigate && (
								<Button
									size="sm"
									variant="outline"
									className="w-full mt-2"
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
									Navigate to Referenced Row
								</Button>
							)}
						</div>
					)}
				</div>
			)}

			{/* Reverse FK References Section */}
			{(isLoadingReferences || reverseReferencesExist) &&
				cellValue !== null && (
					<div className="p-4">
						<button
							onClick={() => toggleSection("reverse-fk")}
							className="flex items-center gap-2 w-full font-semibold text-sm hover:opacity-75"
						>
							{expandedSections.has("reverse-fk") ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
							<LinkIcon className="h-4 w-4" />
							<span>
								Reverse References{" "}
								{reverseReferences && (
									<span className="text-muted-foreground">
										({reverseReferences.length})
									</span>
								)}
							</span>
						</button>

						{expandedSections.has("reverse-fk") && (
							<div className="mt-3 space-y-3 ml-6">
								{isLoadingReferences && (
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Loader className="h-4 w-4 animate-spin" />
										Loading references...
									</div>
								)}

								{referencesError && (
									<div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
										<AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
										<div className="text-sm text-red-800 dark:text-red-200">
											Failed to load references
										</div>
									</div>
								)}

								{reverseReferencesExist && !isLoadingReferences && (
									<div className="text-xs text-muted-foreground">
										{reverseReferences && reverseReferences.length} table
										{reverseReferences && reverseReferences.length !== 1
											? "s"
											: ""}{" "}
										reference this value
									</div>
								)}

								{Object.entries(referencesByTable).map(([tableKey, refs]) => (
									<div key={tableKey} className="space-y-2">
										<div className="text-sm font-medium">{tableKey}</div>
										<div className="space-y-1 ml-3">
											{refs.map((ref) => (
												<div
													key={`${ref.schema}.${ref.table}.${ref.column}`}
													className="flex items-center justify-between gap-2 text-xs bg-muted p-2 rounded"
												>
													<div>
														<code className="font-mono">{ref.column}</code>
													</div>
													{onNavigate && (
														<Button
															size="sm"
															variant="ghost"
															className="h-6 px-2"
															onClick={() => handleNavigateToReference(ref)}
														>
															View
														</Button>
													)}
												</div>
											))}
										</div>
									</div>
								))}

								{!isLoadingReferences && !reverseReferencesExist && (
									<div className="text-sm text-muted-foreground">
										No tables reference this column
									</div>
								)}
							</div>
						)}
					</div>
				)}

			{!forwardFKsExist &&
				!isLoadingReferences &&
				!reverseReferencesExist &&
				cellValue !== null && (
					<div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
						<AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
						<div className="text-sm text-blue-800 dark:text-blue-200">
							This column has no foreign key relationships
						</div>
					</div>
				)}
		</div>
	);
}
