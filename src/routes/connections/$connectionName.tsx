import {
	TableSizeSchema,
	TabStateSchema,
} from "#src/components/pages/connection-page/connection-page.tab.schema.ts";
import { ConnectionPage } from "#src/components/pages/connection.page";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Suspense } from "react";
import { FullCenter } from "../../components/ui/layout.tsx";
import { Spinner } from "../../components/ui/spinner.tsx";

const searchSchema = Schema.Struct({
	dbName: Schema.String.pipe(Schema.optional),
	tableSize: TableSizeSchema.pipe(
		Schema.optionalWith({ default: () => "cozy" }),
	),
	tableFilter: Schema.String.pipe(Schema.optional),
	activeTabId: Schema.String.pipe(Schema.optional), // Explicit active tab ID
	quickReferencesOpen: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	quickReferencesColumnName: Schema.String.pipe(Schema.optional),
	quickReferencesCellValue: Schema.String.pipe(Schema.optional),
	tabs: TabStateSchema.pipe(Schema.Array, Schema.optional), // Array of tab states, zipson-compressed
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
