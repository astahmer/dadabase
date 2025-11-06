import { ConnectionPage } from "#src/components/pages/connection.page";
import { QueryFilter } from "#src/lib/query-filter";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

const searchSchema = Schema.Struct({
	dbName: Schema.String.pipe(Schema.optional),
	schema: Schema.String.pipe(Schema.optionalWith({ default: () => "public" })),
	table: Schema.String.pipe(Schema.optional),
	orderBy: Schema.String.pipe(Schema.optional),
	orderDirection: Schema.Literal("asc", "desc").pipe(Schema.optional),
	limit: Schema.Number.pipe(Schema.optional),
	offset: Schema.Number.pipe(Schema.optional),
	viewMode: Schema.Literal("rows", "structure").pipe(Schema.optional),
	columnVisibility: Schema.String.pipe(Schema.optional),
	filters: QueryFilter.pipe(Schema.optional), // Zipson-compressed filter config
});

export const Route = createFileRoute("/connections/$connectionName")({
	validateSearch: searchSchema.pipe(Schema.standardSchemaV1),
	component: RouteComponent,
});

function RouteComponent() {
	const { connectionName } = Route.useParams();
	return <ConnectionPage connectionName={connectionName} />;
}
