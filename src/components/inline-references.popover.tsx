import {
	AlertCircle,
	ChevronRight,
	Loader,
	Link as LinkIcon,
	ArrowRight,
	X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { findColumnReferencesWithCountsQueryOptions } from "#src/server/pg/start-fns/find-column-references.start.ts";
import type { ColumnReference } from "#src/server/pg/fns/get-table-foreign-keys.kysely.ts";
import type { ForeignKeyInfo } from "./cell-context-menu.tsx";
import { Stack } from "./ui/layout.tsx";

interface InlineReferencesPopoverProps {
	schema: string;
	table: string;
	columnName: string;
	columnDataType: string;
	reference?: {
		referencedSchema: string;
		referencedTable: string;
		referencedColumn: string;
	};
	cellValue: unknown;
	connectionUrl: string;
	onNavigateToFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
	onNavigateToReference?: (ref: ColumnReference, cellValue: unknown) => void;
	onExpandToSheet?: () => void;
	onClose?: () => void;
}

export function InlineReferencesPopover({
	schema,
	table,
	columnName,
	reference,
	cellValue,
	connectionUrl,
	onNavigateToFK,
	onNavigateToReference,
	onExpandToSheet,
	onClose,
}: InlineReferencesPopoverProps) {
	// Determine the reference target
	const referenceTarget = reference
		? {
				referencedSchema: reference.referencedSchema,
				referencedTable: reference.referencedTable,
				referencedColumn: reference.referencedColumn,
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
			<div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
				<div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
					<LinkIcon className="h-3 w-3" />
					<span>Relationships</span>
				</div>
				{onClose && (
					<button
						onClick={onClose}
						className="p-1 hover:bg-muted/70 rounded transition-colors text-muted-foreground"
						aria-label="Close"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				)}
			</div>

			{/* Subheader with cell value */}
			<div className="px-3 py-1.5 text-xs text-muted-foreground truncate border-b border-border/50">
				<code className="font-mono text-foreground">{columnName}</code> ={" "}
				{String(cellValue).slice(0, 150)}
				{String(cellValue).length > 150 ? "..." : ""}
			</div>

			{/* Content */}
			<Stack className="max-h-72 w-full overflow-y-auto space-y-3 p-3">
				{/* Forward FK */}
				{reference && (
					<div>
						<div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
							<ChevronRight className="h-3 w-3" />
							From source table
						</div>
						<button
							onClick={() => {
								if (onNavigateToFK && reference && cellValue !== null) {
									onNavigateToFK(
										{
											referencedSchema: reference.referencedSchema,
											referencedTable: reference.referencedTable,
											referencedColumn: reference.referencedColumn,
											constraintName: "", // Empty for FK navigation
										},
										cellValue,
									);
								}
							}}
							className="w-full px-2 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-muted/70 rounded transition-colors text-left font-mono"
						>
							<span>
								<span className="text-muted-foreground">
									{reference.referencedTable}.
								</span>
								<span className="font-medium">
									{reference.referencedColumn}
								</span>
							</span>
							<ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
						</button>
					</div>
				)}{" "}
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
				{!isLoading && !reference && reverseReferences.length === 0 && (
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
