import {
	AlertCircle,
	ChevronRight,
	Loader,
	Link as LinkIcon,
	ArrowRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { findColumnReferencesWithCountsQueryOptions } from "#src/server/pg/start-fns/find-column-references.start.ts";
import type { ColumnReference } from "#src/server/pg/fns/get-table-foreign-keys.kysely.ts";
import { Stack } from "./ui/layout.tsx";

export interface InlineRelationshipsPopoverProps {
	schema: string;
	table: string;
	columnName: string;
	columnDataType: string;
	foreignKey?: {
		referencedSchema: string;
		referencedTable: string;
		referencedColumn: string;
	};
	cellValue: unknown;
	connectionUrl: string;
	onNavigateToFK?: (
		fkInfo: {
			referencedSchema: string;
			referencedTable: string;
			referencedColumn: string;
		},
		cellValue: unknown,
	) => void;
	onNavigateToReference?: (ref: ColumnReference, cellValue: unknown) => void;
	onExpandToSheet?: () => void;
}

export function InlineRelationshipsPopover({
	schema,
	table,
	columnName,
	foreignKey,
	cellValue,
	connectionUrl,
	onNavigateToFK,
	onNavigateToReference,
	onExpandToSheet,
}: InlineRelationshipsPopoverProps) {
	// Determine the reference target
	const referenceTarget = foreignKey
		? {
				referencedSchema: foreignKey.referencedSchema,
				referencedTable: foreignKey.referencedTable,
				referencedColumn: foreignKey.referencedColumn,
			}
		: {
				referencedSchema: schema,
				referencedTable: table,
				referencedColumn: columnName,
			};

	// Fetch reverse FK references
	const { data: reverseReferences = [], isLoading } = useQuery(
		findColumnReferencesWithCountsQueryOptions({
			url: connectionUrl,
			referencedSchema: referenceTarget.referencedSchema,
			referencedTable: referenceTarget.referencedTable,
			referencedColumn: referenceTarget.referencedColumn,
			cellValue,
		}),
	);

	if (cellValue === null) {
		return (
			<div className="min-w-80 max-w-2xl p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded">
				<div className="flex items-start gap-2">
					<AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
					<div className="text-xs text-amber-900 dark:text-amber-100">
						Cannot display relationships for NULL values
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-w-80 max-w-2xl bg-background border border-border rounded-lg shadow-lg overflow-hidden">
			{/* Header */}
			<div className="px-3 py-2 border-b border-border bg-muted/30">
				<div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
					<LinkIcon className="h-3 w-3" />
					<span>Relationships</span>
				</div>
				<div className="text-xs text-muted-foreground mt-1 truncate">
					<code className="font-mono text-foreground">{columnName}</code> ={" "}
					{String(cellValue).slice(0, 150)}
					{String(cellValue).length > 150 ? "..." : ""}
				</div>
			</div>

			{/* Content */}
			<Stack className="max-h-72 w-full overflow-y-auto space-y-3 p-3">
				{/* Forward FK */}
				{foreignKey && (
					<div>
						<div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
							<ChevronRight className="h-3 w-3" />
							Points To
						</div>
						<button
							onClick={() => {
								if (onNavigateToFK && foreignKey && cellValue !== null) {
									onNavigateToFK(foreignKey, cellValue);
								}
							}}
							className="w-full px-2 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-muted/70 rounded transition-colors text-left font-mono"
						>
							<span>
								<span className="text-muted-foreground">
									{foreignKey.referencedTable}.
								</span>
								<span className="font-medium">
									{foreignKey.referencedColumn}
								</span>
							</span>
							<ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
						</button>
					</div>
				)}

				{/* Reverse References */}
				{reverseReferences && reverseReferences.length > 0 && (
					<div className="w-full">
						<div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
							<ChevronRight className="h-3 w-3" />
							Referenced By
							{!isLoading && (
								<span className="ml-auto">({reverseReferences.length})</span>
							)}
							{isLoading && (
								<Loader className="h-3 w-3 animate-spin ml-auto text-muted-foreground" />
							)}
						</div>

						{!isLoading && (
							<div className="space-y-1">
								{reverseReferences.map((ref) => (
									<button
										key={`${ref.schema}.${ref.table}.${ref.column}`}
										onClick={() => {
											if (onNavigateToReference) {
												onNavigateToReference(ref, cellValue);
											}
										}}
										className="w-full px-2 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-muted/70 rounded transition-colors text-left font-mono"
									>
										<span>
											<span className="text-muted-foreground">
												{ref.table}.
											</span>
											<span className="font-medium">{ref.column}</span>
										</span>
										<span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
											{ref.matchingRowCount?.toLocaleString() ?? 0}
										</span>
									</button>
								))}
							</div>
						)}
					</div>
				)}

				{/* Loading State */}
				{isLoading && !reverseReferences.length && (
					<div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
						<Loader className="h-3 w-3 animate-spin" />
						<span>Loading relationships...</span>
					</div>
				)}

				{/* No References State */}
				{!isLoading && !foreignKey && reverseReferences.length === 0 && (
					<div className="text-xs text-muted-foreground py-2">
						No relationships found
					</div>
				)}
			</Stack>

			{/* Footer */}
			{onExpandToSheet && (
				<div className="border-t border-border px-3 py-2 bg-muted/20">
					<button
						onClick={onExpandToSheet}
						className="w-full text-xs text-center py-1.5 hover:bg-muted/70 rounded transition-colors font-medium text-foreground"
					>
						Expand panel →
					</button>
				</div>
			)}
		</div>
	);
}
