import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { memo, useEffect, useState } from "react";
import type { TableRelationship } from "#src/types/relationships.ts";
import { queryRelationshipSubrowDataQueryOptions } from "#src/server/pg/start-fns/get-relationship-subrow-data.start";
import { Spinner } from "#src/components/ui/spinner";
import { getErrorMessage } from "#src/lib/get-error-message";

interface RelationshipExplorerRowsProps {
	relationship: TableRelationship;
	row: Record<string, unknown>;
	connectionUrl: string;
	onLoadingChange?: (loading: boolean) => void;
}

/**
 * Renders the related rows for a relationship in the explorer.
 * Lazy-loads data and shows a compact list or table view.
 */
export const RelationshipExplorerRows = memo(function RelationshipExplorerRows({
	relationship,
	row,
	connectionUrl,
	onLoadingChange,
}: RelationshipExplorerRowsProps) {
	const {
		referencingSchema,
		referencingTable,
		referencingColumn,
		referencedColumn,
	} = relationship;

	// Get the filter value based on relationship type
	const filterValue =
		relationship.type === "outgoing"
			? row[referencingColumn]
			: row[referencedColumn];

	// Fetch related rows
	const rowsQuery = useQuery({
		...queryRelationshipSubrowDataQueryOptions({
			url: connectionUrl,
			schema: referencingSchema,
			table: referencingTable,
			filterColumn: referencingColumn,
			filterValue: String(filterValue),
			limit: 100,
			offset: 0,
		}),
		placeholderData: keepPreviousData,
	});

	// Notify parent of loading state
	useEffect(() => {
		onLoadingChange?.(rowsQuery.isLoading);
	}, [rowsQuery.isLoading, onLoadingChange]);

	if (rowsQuery.isLoading) {
		return (
			<div className="flex items-center gap-2 py-1">
				<Spinner className="h-3 w-3" />
				<span className="text-xs text-muted-foreground">Loading...</span>
			</div>
		);
	}

	if (rowsQuery.isError) {
		return (
			<div className="text-xs text-destructive bg-destructive/5 px-2 py-1 rounded">
				{getErrorMessage(rowsQuery.error)}
			</div>
		);
	}

	const rows = rowsQuery.data?.rows ?? [];
	const rowCount = rowsQuery.data?.rowCount ?? 0;

	if (rows.length === 0) {
		return (
			<span className="text-xs text-muted-foreground italic">
				(no related data)
			</span>
		);
	}

	// Display first few rows in a compact format
	return (
		<div className="space-y-0.5">
			{rows.slice(0, 5).map((rowData, index) => (
				<div
					key={index}
					className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded truncate hover:bg-muted/40 transition-colors"
					title={JSON.stringify(rowData)}
				>
					<CompactRowPreview rowData={rowData} />
				</div>
			))}
			{rowCount > 5 && (
				<div className="text-xs text-muted-foreground italic px-2 py-1">
					{rowCount - 5} more row{rowCount - 5 !== 1 ? "s" : ""}...
				</div>
			)}
		</div>
	);
});

interface CompactRowPreviewProps {
	rowData: Record<string, unknown>;
}

const CompactRowPreview = memo(function CompactRowPreview({
	rowData,
}: CompactRowPreviewProps) {
	// Show first 2-3 column values as a preview
	const entries = Object.entries(rowData).slice(0, 3);

	return (
		<>
			{entries.map(([key, value], idx) => (
				<span key={key}>
					{idx > 0 && <span className="mx-1">·</span>}
					<span className="font-medium">{key}</span>
					<span className="mx-0.5">:</span>
					<span className="text-foreground">
						{typeof value === "string"
							? `"${value.substring(0, 20)}${value.length > 20 ? "…" : ""}"`
							: value === null
								? "null"
								: String(value).substring(0, 20)}
					</span>
				</span>
			))}
		</>
	);
});
