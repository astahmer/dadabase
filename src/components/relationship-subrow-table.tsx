import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { getErrorMessage } from "../lib/get-error-message";
import type { TableRelationship } from "../server/pg/fns/get-table-relationships.kysely";
import { queryRelationshipSubrowDataQueryOptions } from "../server/pg/start-fns/get-relationship-subrow-data.start";
import { getRelationshipCardinalityQueryOptions } from "../server/pg/start-fns/get-relationship-cardinality.start.ts";
import { DataTable } from "./data-table";
import { useDataTable } from "./use-data-table";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

interface RelationshipSubrowTableProps {
	relationship: TableRelationship;
	parentRowValue: unknown;
	connection: { url: string };
	isPanelExpanded?: boolean;
	onRemove?: () => void;
}

/**
 * Renders a nested DataTable in a subrow containing related records
 * Queries the referencing table filtered by parent row's primary key
 */
export const RelationshipSubrowTable = ({
	relationship,
	parentRowValue,
	connection,
	isPanelExpanded = false,
	onRemove,
}: RelationshipSubrowTableProps) => {
	const [isMaximizeSheetOpen, setIsMaximizeSheetOpen] = useState(false);
	const {
		referencingSchema,
		referencingTable,
		referencingColumn,
		referencedSchema,
		referencedTable,
		referencedColumn,
	} = relationship;

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

	// Fetch cardinality detection
	const cardinalityQuery = useQuery(
		getRelationshipCardinalityQueryOptions({
			url: connection.url,
			schema: referencingSchema,
			table: referencingTable,
			columns: [referencingColumn],
			isIncomingRelationship:
				(relationship as TableRelationship).type === "incoming",
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

	const rowCount = rowsQuery.data?.rows?.length ?? 0;
	const hasData = rowCount > 0;

	if (rowsQuery.isLoading) {
		return (
			<div className="flex items-center justify-center p-8 gap-2">
				<Spinner />
				<span className="text-sm text-muted-foreground">
					Loading {referencingSchema}.{referencingTable}...
				</span>
			</div>
		);
	}

	if (rowsQuery.isError) {
		return (
			<div className="p-4 bg-destructive/5 rounded border border-destructive/20">
				<p className="text-sm text-destructive">
					Failed to load {referencingSchema}.{referencingTable}
				</p>
				<p className="text-xs text-muted-foreground mt-1">
					{getErrorMessage(rowsQuery.error)}
				</p>
			</div>
		);
	}

	return (
		<>
			{/* Info Bar */}
			<div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between shrink-0 text-xs gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<span className="text-muted-foreground truncate">
						{referencingTable}
						<span className="text-muted-foreground">.{referencingColumn}</span>
					</span>
					<span className="text-muted-foreground shrink-0">›</span>
					<span className="font-medium truncate">
						{referencedTable}
						<span className="text-muted-foreground">.{referencedColumn}</span>
					</span>

					{cardinalityQuery.data && (
						<span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded shrink-0">
							{cardinalityQuery.data.cardinality === "one-to-one"
								? "1:1"
								: cardinalityQuery.data.cardinality === "one-to-many"
									? "1:N"
									: cardinalityQuery.data.cardinality === "many-to-one"
										? "N:1"
										: "M:N"}
						</span>
					)}

					{hasData && (
						<span className="text-muted-foreground shrink-0">
							{rowCount} row{rowCount !== 1 ? "s" : ""}
						</span>
					)}
				</div>

				<div className="flex items-center gap-1 shrink-0">
					{isPanelExpanded && hasData && (
						<Button
							size="xs"
							variant="ghost"
							onClick={() => setIsMaximizeSheetOpen(true)}
							title="Expand to full view"
							className="h-6 px-2 gap-1"
						>
							<Maximize2 className="h-3 w-3" />
							<span className="text-xs">Maximize</span>
						</Button>
					)}
					{onRemove && (
						<Button
							size="xs"
							variant="ghost"
							onClick={onRemove}
							title="Remove from view"
							className="h-6 px-2"
						>
							<X className="h-3 w-3" />
						</Button>
					)}
				</div>
			</div>

			{/* Data Table - Only render when there's data */}
			{hasData && (
				<div className="flex-1 overflow-hidden">
					<DataTable
						table={table}
						size="compact"
						striped
						stickyHeader={true}
						isLoading={rowsQuery.isLoading}
						hasError={rowsQuery.isError}
					/>
				</div>
			)}

			{/* Maximize Sheet */}
			<Sheet
				open={isMaximizeSheetOpen}
				onOpenChange={(details) => setIsMaximizeSheetOpen(details.open)}
			>
				<SheetContent
					side="bottom"
					className="h-[90vh] flex flex-col"
					positionerProps={{ className: "relative z-1" }}
				>
					<SheetHeader>
						<SheetTitle className="text-base">
							{referencingSchema}.{referencingTable}
							<span className="text-muted-foreground text-sm ml-2">
								.{referencingColumn}
							</span>
							<span className="text-muted-foreground mx-2">›</span>
							{referencedSchema}.{referencedTable}
							<span className="text-muted-foreground text-sm ml-2">
								.{referencedColumn}
							</span>
						</SheetTitle>
					</SheetHeader>
					<div className="flex-1 overflow-hidden z-1">
						<DataTable
							table={table}
							size="compact"
							striped
							stickyHeader={true}
							isLoading={rowsQuery.isLoading}
							hasError={rowsQuery.isError}
						/>
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
};
