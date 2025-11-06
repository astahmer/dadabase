import { ConnectionPage } from "#src/components/pages/connection.page";
import { QueryFilter } from "#src/lib/query-filter";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

const searchSchema = Schema.Struct({
	dbName: Schema.String.pipe(Schema.optional),
	schema: Schema.String.pipe(Schema.optionalWith({ default: () => "public" })),
	table: Schema.String.pipe(Schema.optional),
	orderBy: Schema.String.pipe(Schema.optional),
	orderDirection: Schema.Literal("asc", "desc").pipe(
		Schema.optionalWith({ default: () => "asc" }),
	),
	limit: Schema.Number.pipe(Schema.optionalWith({ default: () => 50 })),
	offset: Schema.Number.pipe(Schema.optionalWith({ default: () => 0 })),
	viewMode: Schema.Literal("rows", "structure").pipe(
		Schema.optionalWith({ default: () => "rows" }),
	),
	columnVisibility: Schema.String.pipe(Schema.optional),
	filters: QueryFilter.pipe(Schema.optional), // Zipson-compressed filter config
	filtersOpened: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
});

export const Route = createFileRoute("/connections/$connectionName")({
	validateSearch: searchSchema.pipe(Schema.standardSchemaV1),
	component: RouteComponent,
});

function RouteComponent() {
	const { connectionName } = Route.useParams();
	return <ConnectionPage connectionName={connectionName} />;
}
