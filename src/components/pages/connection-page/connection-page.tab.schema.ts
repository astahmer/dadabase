import { QueryFilter } from "#src/lib/query-filter.ts";
import { Schema } from "effect";

// Schema for individual tab state
export const TableSizeSchema = Schema.Literal(
	"excel",
	"minimal",
	"compact",
	"cozy",
	"comfortable",
);
export const TabStateSchema = Schema.Struct({
	tabId: Schema.String, // Explicit unique identifier for the tab
	schema: Schema.String,
	table: Schema.String,
	orderBy: Schema.String.pipe(Schema.optional),
	orderDirection: Schema.Literal("asc", "desc").pipe(Schema.optional),
	limit: Schema.Number.pipe(Schema.optionalWith({ default: () => 50 })),
	offset: Schema.Number.pipe(Schema.optionalWith({ default: () => 0 })),
	viewMode: Schema.Literal("rows", "structure").pipe(
		Schema.optionalWith({ default: () => "rows" }),
	),
	tableSize: TableSizeSchema.pipe(
		Schema.optionalWith({ default: () => "cozy" }),
	),
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
});
