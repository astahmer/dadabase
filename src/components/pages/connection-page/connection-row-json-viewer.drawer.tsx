import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../../ui/sheet.tsx";
import { JsonViewerModal } from "../../ui/json-viewer.tsx";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { useTableColumnMetadata } from "#src/hooks/use-table-column-metadata";
import { useMemo } from "react";
import type { DbConnection } from "../connection.types.ts";
import { replaceDatabaseInConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { formatTableValue } from "./format-table-value.ts";

export const ConnectionRowJsonViewerDrawer = ({
	connection,
}: {
	connection: DbConnection;
}) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const search = useSearch({
		from: "/connections/$connectionName",
		select: (s) => ({
			dbName: s.dbName,
			schema: s.schema,
			table: s.table,
			rowJsonViewerOpen: s.rowJsonViewerOpen,
			rowJsonViewerRowId: s.rowJsonViewerRowId,
			limit: s.limit,
			offset: s.offset,
			orderBy: s.orderBy,
			orderDirection: s.orderDirection,
			filters: s.filters,
		}),
	});

	const connectionUrl = connection.url || "";
	const activeConnectionUrl = search.dbName
		? replaceDatabaseInConnectionUrl(connectionUrl, search.dbName)
		: connectionUrl;

	const rowJsonSheetOpen = search.rowJsonViewerOpen ?? false;

	const { columnMetadata } = useTableColumnMetadata({
		url: activeConnectionUrl,
		schema: search.schema || "",
		table: search.table || "",
	});

	const primaryKeyColumn = columnMetadata.find((col) => col.primaryKey);

	const rowsQuery = useQuery({
		...queryTableDataQueryOptions({
			url: activeConnectionUrl,
			schema: search.schema || "",
			table: search.table || "",
			limit: search.limit,
			offset: search.offset,
			orderBy: search.orderBy,
			orderDirection: search.orderDirection,
			filters: search.filters ?? {
				conditions: [],
				logicalOperator: "and",
			},
		}),
		enabled: !!search.schema && !!search.table,
	});

	// Reconstruct row data from URL rowId by looking it up in current table data
	const rowJsonData = useMemo(() => {
		if (!search.rowJsonViewerRowId || !primaryKeyColumn || !rowsQuery.data) {
			return null;
		}
		const rows = rowsQuery.data.rows || [];
		const row = rows.find(
			(r) => String(r[primaryKeyColumn.name]) === search.rowJsonViewerRowId,
		);
		return row ? formatTableValue(row) : null;
	}, [search.rowJsonViewerRowId, primaryKeyColumn, rowsQuery.data]);

	if (!rowJsonSheetOpen) {
		return null;
	}

	return (
		<Sheet
			open={true}
			onOpenChange={(details) => {
				if (!details.open) {
					navigate({
						search: (prev) => ({
							...prev,
							rowJsonViewerRowId: undefined,
							rowJsonViewerOpen: false,
						}),
					});
				}
			}}
		>
			<SheetContent className="z-50 w-full sm:max-w-[800px] p-0 flex flex-col">
				<SheetHeader>
					<SheetTitle>Row Data</SheetTitle>
					<SheetDescription>Expanded JSON viewer</SheetDescription>
				</SheetHeader>
				<div className="p-4 flex-1 overflow-auto">
					{rowJsonData ? (
						<JsonViewerModal data={rowJsonData} className="h-full" />
					) : !search.rowJsonViewerRowId ? (
						<div className="text-sm text-muted-foreground">No data</div>
					) : (
						// Loading skeleton
						<div className="w-full h-full flex flex-col gap-3">
							{/* Header skeleton */}
							<div className="space-y-2">
								<div className="h-4 w-32 bg-muted/60 rounded animate-pulse" />
								<div className="h-3 w-48 bg-muted/60 rounded animate-pulse" />
							</div>
							{/* Content skeleton - nested object structure */}
							<div className="space-y-3">
								{[1, 2, 3, 4, 5].map((i) => (
									<div
										key={i}
										className="space-y-2 pl-4 border-l border-muted/40"
									>
										<div className="h-3 w-24 bg-muted/60 rounded animate-pulse" />
										<div className="h-3 w-40 bg-muted/60 rounded animate-pulse" />
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
};
