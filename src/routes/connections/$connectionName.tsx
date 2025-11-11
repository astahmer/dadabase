import { ConnectionPage } from "#src/components/pages/connection.page";
import { QueryFilter } from "#src/lib/query-filter";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Suspense } from "react";
import { Spinner } from "../../components/ui/spinner.tsx";
import { FullCenter } from "../../components/ui/layout.tsx";

// Schema for individual tab state
const tableSize = Schema.Literal(
	"excel",
	"minimal",
	"compact",
	"cozy",
	"comfortable",
);
const tabStateSchema = Schema.Struct({
	tabId: Schema.String, // Explicit unique identifier for the tab
	schema: Schema.String,
	table: Schema.String,
	tableFilter: Schema.String.pipe(Schema.optional),
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
	columnPinning: Schema.String.pipe(Schema.optional), // Zipson-compressed column pinning config
	fkValue: Schema.String.pipe(Schema.optional), // FK value used when navigating to this tab
});

const searchSchema = Schema.Struct({
	dbName: Schema.String.pipe(Schema.optional),
	schema: Schema.String.pipe(Schema.optionalWith({ default: () => "public" })),
	table: Schema.String.pipe(Schema.optional),
	activeTabId: Schema.String.pipe(Schema.optional), // Explicit active tab ID
	tableFilter: Schema.String.pipe(Schema.optional),
	orderBy: Schema.String.pipe(Schema.optional),
	orderDirection: Schema.Literal("asc", "desc").pipe(
		Schema.optionalWith({ default: () => "asc" }),
	),
	limit: Schema.Number.pipe(Schema.optionalWith({ default: () => 50 })),
	offset: Schema.Number.pipe(Schema.optionalWith({ default: () => 0 })),
	viewMode: Schema.Literal("rows", "structure").pipe(
		Schema.optionalWith({ default: () => "rows" }),
	),
	tableSize: tableSize.pipe(Schema.optionalWith({ default: () => "cozy" })),
	hiddenColumnList: Schema.String.pipe(Schema.Array, Schema.optional), // Comma-separated list of hidden column names
	filters: QueryFilter.pipe(Schema.optional), // Zipson-compressed filter config
	filtersOpened: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	columnPinning: Schema.String.pipe(Schema.optional), // Zipson-compressed column pinning config
	quickReferencesOpen: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	quickReferencesColumnName: Schema.String.pipe(Schema.optional),
	quickReferencesCellValue: Schema.String.pipe(Schema.optional),
	tabs: tabStateSchema.pipe(Schema.Array, Schema.optional), // Array of tab states, zipson-compressed
	sidebarCollapsed: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	rowJsonViewerOpen: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	rowJsonViewerRowId: Schema.String.pipe(Schema.optional), // Primary key value to identify which row to display
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
