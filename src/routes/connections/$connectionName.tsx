import { createFileRoute } from "@tanstack/react-router";
import { ConnectionPage } from "#src/components/pages/connection.page";
import { Schema } from "effect";
import { FilterOperator, LogicalOperator } from "#src/lib/query-filter";

// Filter condition schema matching FilterConditionExpression from query-filter.ts
const filterConditionExpressionSchema = Schema.Struct({
	column: Schema.String,
	operator: FilterOperator,
	value: Schema.Union(
		Schema.String,
		Schema.Number,
		Schema.Array(Schema.String),
	).pipe(Schema.optional),
});

// Filter config schema matching WhereClauseParams from query-filter.ts
const whereClauseParamsSchema = Schema.Struct({
	conditions: Schema.Array(filterConditionExpressionSchema),
	logicalOperator: LogicalOperator,
});

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
	filters: whereClauseParamsSchema.pipe(Schema.optional), // Zipson-compressed filter config
});

export const Route = createFileRoute("/connections/$connectionName")({
	validateSearch: searchSchema.pipe(Schema.standardSchemaV1),
	component: RouteComponent,
});

function RouteComponent() {
	const { connectionName } = Route.useParams();
	return <ConnectionPage connectionName={connectionName} />;
}
