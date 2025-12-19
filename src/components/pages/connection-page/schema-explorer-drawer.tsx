import { getDialectDefaultSchema } from "#src/db/dialect.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../../ui/sheet.tsx";
import type { DbConnection } from "../connection.types";
import { useActiveTabState } from "./create-tab-state.ts";
import { MultiTableStructureViewer } from "./multi-table-structure-viewer.tsx";

interface SchemaExplorerDrawerProps {
	connection: DbConnection;
}

export const SchemaExplorerDrawer = ({
	connection,
}: SchemaExplorerDrawerProps) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const search = useSearch({ from: "/connections/$connectionName" });
	const schemaExplorerOpen = search.schemaExplorerOpen ?? false;
	const schemaExplorerSchema = search.schemaExplorerSchema;

	const activeTabSchema = useActiveTabState((tab) => tab.schema);

	// Get available schemas
	const activeConnectionUrl = connection.url;

	const schemasQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
		retry: 2,
	});

	const schemas = schemasQuery.data || [];

	// Determine which schema to show
	const displaySchema =
		schemaExplorerSchema ||
		activeTabSchema ||
		(schemas.length === 1 ? schemas[0] : undefined) ||
		getDialectDefaultSchema(connection.dialect);

	return (
		<Sheet
			open={schemaExplorerOpen}
			onOpenChange={(details) => {
				if (!details.open) {
					navigate({
						search: (prev) => ({
							...prev,
							schemaExplorerOpen: false,
						}),
					});
				}
			}}
		>
			<SheetContent className="z-50 w-[800px] max-w-none! flex flex-col p-0 gap-0">
				<SheetHeader className="border-b">
					<div className="pr-6 flex items-start justify-between gap-4">
						<div>
							<SheetTitle>Schema Explorer</SheetTitle>
							<SheetDescription className="text-xs mt-1">
								View and export table structures for all tables in a schema
							</SheetDescription>
						</div>
						{/* Schema selector - inline and compact */}
						{schemas.length > 1 && displaySchema && (
							<select
								value={displaySchema}
								onChange={(e) => {
									navigate({
										search: (prev) => ({
											...prev,
											schemaExplorerSchema: e.target.value,
										}),
									});
								}}
								className="px-2 py-1 mr-3 rounded text-sm border border-border bg-background h-8"
							>
								{schemas.map((schema) => (
									<option key={schema} value={schema}>
										{schema}
									</option>
								))}
							</select>
						)}
					</div>
				</SheetHeader>

				{/* Content */}
				<div className="flex-1 overflow-auto">
					{displaySchema ? (
						<MultiTableStructureViewer
							activeConnectionUrl={activeConnectionUrl}
							schema={displaySchema}
							tableSize="compact"
						/>
					) : (
						<div className="flex items-center justify-center h-full text-muted-foreground">
							No schemas available
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
};
