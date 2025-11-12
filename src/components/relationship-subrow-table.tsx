import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { getErrorMessage } from "../lib/get-error-message";
import type { RelationshipMetadata } from "../types/relationships";
import { queryRelationshipSubrowDataQueryOptions } from "../server/pg/start-fns/get-relationship-subrow-data.start";
import { DataTable } from "./data-table";
import { useDataTable } from "./use-data-table";
import { Spinner } from "./ui/spinner";

interface RelationshipSubrowTableProps {
	relationship: RelationshipMetadata;
	parentRowValue: unknown;
	connection: { url: string };
}

/**
 * Renders a nested DataTable in a subrow containing related records
 * Queries the referencing table filtered by parent row's primary key
 */
export const RelationshipSubrowTable = ({
	relationship,
	parentRowValue,
	connection,
}: RelationshipSubrowTableProps) => {
	const { referencingSchema, referencingTable, referencingColumn } =
		relationship;

	// Fetch rows from the referencing table filtered by parent value
	const rowsQuery = useQuery(
		queryRelationshipSubrowDataQueryOptions({
			url: connection.url,
			schema: referencingSchema,
			table: referencingTable,
			filterColumn: referencingColumn,
			filterValue: parentRowValue,
			limit: 50,
		}),
	);

	// Build dynamic columns from the first row's keys
	const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
		const firstRow = rowsQuery.data?.rows?.[0];
		if (!firstRow) return [];

		return Object.keys(firstRow).map((key) => ({
			accessorKey: key,
			header: key,
			cell: (info) => {
				const value = info.getValue();
				return (
					<span className="text-xs font-mono">
						{value === null ? "-" : String(value)}
					</span>
				);
			},
		}));
	}, [rowsQuery.data?.rows]);

	const table = useDataTable({
		data: (rowsQuery.data?.rows ?? []) as Record<string, unknown>[],
		columns,
		initialState: {
			pagination: {
				pageIndex: 0,
				pageSize: 20,
			},
		},
	});

	if (rowsQuery.isLoading) {
		return (
			<div className="flex items-center justify-center p-8 gap-2">
				<Spinner />
				<span className="text-sm text-muted-foreground">
					Loading {relationship.displayLabel}...
				</span>
			</div>
		);
	}

	if (rowsQuery.isError) {
		return (
			<div className="p-4 bg-destructive/5 rounded border border-destructive/20">
				<p className="text-sm text-destructive">
					Failed to load {relationship.displayLabel}
				</p>
				<p className="text-xs text-muted-foreground mt-1">
					{getErrorMessage(rowsQuery.error)}
				</p>
			</div>
		);
	}

	return (
		<div className="bg-muted/20 rounded border border-border/50">
			<div className="px-4 py-2 bg-muted/40 border-b">
				<h4 className="text-sm font-medium text-foreground">
					{relationship.displayLabel} (
					{rowsQuery.data?.rowCount ?? rowsQuery.data?.rows?.length ?? 0} rows)
				</h4>
			</div>
			<div className="overflow-hidden">
				<DataTable
					table={table}
					size="compact"
					striped
					stickyHeader={false}
					isLoading={rowsQuery.isLoading}
					hasError={rowsQuery.isError}
				/>
			</div>
		</div>
	);
};
