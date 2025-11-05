import { createFileRoute } from "@tanstack/react-router";
import { ConnectionPage } from "#src/components/pages/connection.page";
import { Schema } from "effect";

const searchSchema = Schema.Struct({
	dbName: Schema.String.pipe(Schema.optional),
	schema: Schema.String.pipe(Schema.optional),
	table: Schema.String.pipe(Schema.optional),
	sortBy: Schema.String.pipe(Schema.optional),
	sortOrder: Schema.Literal("asc", "desc").pipe(Schema.optional),
	pageSize: Schema.Number.pipe(Schema.optional),
	pageOffset: Schema.Number.pipe(Schema.optional),
	viewMode: Schema.Literal("rows", "structure").pipe(Schema.optional),
	columnVisibility: Schema.String.pipe(Schema.optional),
});

export const Route = createFileRoute("/connections/$connectionName")({
	validateSearch: searchSchema.pipe(Schema.standardSchemaV1),
	component: RouteComponent,
});

function RouteComponent() {
	const { connectionName } = Route.useParams();
	return <ConnectionPage connectionName={connectionName} />;
}
