import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Suspense } from "react";
import { ConnectionPage } from "#src/components/pages/connection.page.tsx";
import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import { QueryFilter } from "#src/components/query-builder/query-filter.ts";
import { FullCenter } from "../../components/ui/layout.tsx";
import { Spinner } from "../../components/ui/spinner.tsx";

const tableSize = Schema.Literal(
	"excel",
	"minimal",
	"compact",
	"cozy",
	"comfortable",
);

const StructureFiltersSchema = Schema.Struct({
	search: Schema.String.pipe(Schema.optionalWith({ default: () => "" })),
	nullable: Schema.Boolean.pipe(Schema.optionalWith({ default: () => false })),
	primaryKey: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	unique: Schema.Boolean.pipe(Schema.optionalWith({ default: () => false })),
	foreignKey: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	hasDefaults: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
});

const StandardJoinConditionSchema = Schema.Struct({
	mode: Schema.Literal("standard"),
	referencingColumn: Schema.String,
	referencedColumn: Schema.String,
}).pipe(Schema.mutable);

const CustomJoinConditionSchema = Schema.Struct({
	mode: Schema.Literal("custom"),
	referencingColumn: Schema.String.pipe(Schema.optional),
	referencedColumn: Schema.String.pipe(Schema.optional),
	conditions: Schema.Array(Schema.String).pipe(Schema.mutable),
});

const JoinConditionSchema = Schema.Union(
	StandardJoinConditionSchema,
	CustomJoinConditionSchema,
);

const JoinedTableSchema = Schema.Struct({
	table: Schema.String,
	schema: Schema.String,
	type: Schema.Literal("left", "inner"),
	columns: Schema.Union(
		Schema.Literal("all"),
		Schema.Array(Schema.String).pipe(Schema.mutable),
	),
	joinCondition: JoinConditionSchema,
	filters: QueryFilter.pipe(Schema.optional),
});
type JoinedTableType = typeof JoinedTableSchema.Type;
const _lint = {} as JoinedTableType satisfies JoinedTable;
_lint;

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
	joins: Schema.Array(JoinedTableSchema).pipe(Schema.optional),
	prefixWithTable: Schema.Boolean.pipe(Schema.optional),
});

const searchSchema = Schema.Struct({
	dbName: Schema.String.pipe(Schema.optional),
	activeTabId: Schema.String.pipe(Schema.optional), // Explicit active tab ID
	tabs: TabStateSchema.pipe(Schema.Array, Schema.optional), // Array of tab states, zipson-compressed
	tableFilter: Schema.String.pipe(Schema.optional),
	structureFilters: StructureFiltersSchema.pipe(Schema.optional), // Structure view filters
	quickReferencesOpen: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	quickReferencesColumnName: Schema.String.pipe(Schema.optional),
	quickReferencesCellValue: Schema.Union(Schema.String, Schema.Number).pipe(
		Schema.optional,
	),
	sidebarSize: Schema.Number.pipe(Schema.optional),
	rowJsonViewerOpen: Schema.Boolean.pipe(
		Schema.optionalWith({ default: () => false }),
	),
	// Primary key value to identify which row to display
	rowJsonViewerRowId: Schema.Union(Schema.String, Schema.Number).pipe(
		Schema.optional,
	),
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
