import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Suspense } from "react";
import { ConnectionPage } from "#src/components/pages/connection.page";
import { QueryFilter } from "#src/components/query-builder/query-filter.ts";
import { FullCenter } from "../../components/ui/layout.tsx";
import { Spinner } from "../../components/ui/spinner.tsx";

// Schema for individual tab state
const tableSize = Schema.Literal(
	"excel",
	"minimal",
	"compact",
	"cozy",
	"comfortable",
);
const TabStateSchema = Schema.Struct({
	tabId: Schema.String, // Explicit unique identifier for the tab
	schema: Schema.String.pipe(Schema.optionalWith({ default: () => "public" })),
	table: Schema.String,
	orderBy: Schema.String.pipe(Schema.optional),
	orderDirection: Schema.Literal("asc", "desc").pipe(Schema.optional),
	limit: Schema.Number.pipe(Schema.optionalWith({ default: () => 50 })),
	offset: Schema.Number.pipe(Schema.optionalWith({ default: () => 0 })),
	viewMode: Schema.Literal("rows", "structure").pipe(
		Schema.optionalWith({ default: () => "rows" }),
	),
	tableSize: tableSize.pipe(Schema.optionalWith({ default: () => "cozy" })),
	hiddenColumnList: Schema.String.pipe(Schema.Array, Schema.optional),
	filters: QueryFilter.pipe(Schema.optional),
	filtersOpened: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	columnPinning: Schema.Struct({
		left: Schema.String.pipe(Schema.Array, Schema.optional),
		right: Schema.String.pipe(Schema.Array, Schema.optional),
	}).pipe(Schema.optional), // Zipson-compressed column pinning config
	columnOrder: Schema.String.pipe(Schema.Array, Schema.optional), // JSON-stringified column order array
	fkValue: Schema.String.pipe(Schema.optional), // FK value used when navigating to this tab
	relationshipRowId: Schema.String.pipe(Schema.optional), // Row ID for expanded relationships panel
});

const searchSchema = Schema.Struct({
	dbName: Schema.String.pipe(Schema.optional),
	activeTabId: Schema.String.pipe(Schema.optional), // Explicit active tab ID
	tabs: TabStateSchema.pipe(Schema.Array, Schema.optional), // Array of tab states, zipson-compressed
	tableFilter: Schema.String.pipe(Schema.optional),
	quickReferencesOpen: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	quickReferencesColumnName: Schema.String.pipe(Schema.optional),
	quickReferencesCellValue: Schema.Union(Schema.String, Schema.Number).pipe(
		Schema.optional,
	),
	sidebarCollapsed: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	rowJsonViewerOpen: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	rowJsonViewerRowId: Schema.Union(Schema.String, Schema.Number).pipe(
		Schema.optional,
	), // Primary key value to identify which row to display
});

export const Route = createFileRoute("/connections/$connectionName")({
	validateSearch: searchSchema.pipe(Schema.standardSchemaV1),
	component: RouteComponent,
});

function RouteComponent() {
	const { connectionName } = Route.useParams();

	return (
		<Suspense
			fallback={
				<FullCenter>
					<Spinner />
				</FullCenter>
			}
		>
			{<ConnectionPage connectionName={connectionName} />}
		</Suspense>
	);
}
