import { useQuery } from "@tanstack/react-query";
import { getErrorMessage } from "../lib/get-error-message";
import type { RelationshipMetadata } from "../types/relationships";
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
	const rowsQuery = useQuery({
		queryKey: [
			"relationship-subrow-data",
			connection.url,
			referencingSchema,
			referencingTable,
			referencingColumn,
			parentRowValue,
		],
		queryFn: async () => {
			// TODO: Implement API endpoint to fetch relationship rows
			// Query structure: SELECT * FROM {schema}.{table} WHERE {column} = {value} LIMIT 50
			return { rows: [], rowCount: 0 };
		},
	});

	// TODO: Build proper column definitions from metadata
	// For now, return a placeholder
	// In full implementation, this would:
	// 1. Get column metadata for the referencing table
	// 2. Build ColumnDef objects with cell renderers
	// 3. Pass to useDataTable

	const table = useDataTable({
		data: rowsQuery.data?.rows ?? [],
		columns: [],
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
