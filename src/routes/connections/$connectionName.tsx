import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema, SchemaGetter } from "effect";
import { Suspense } from "react";

import { parseHiddenColumnString } from "#src/components/pages/connection-page/hidden-column-list.ts";
import { ConnectionPage } from "#src/components/pages/connection.page.tsx";
import { QueryFilter } from "#src/components/query-builder/query-filter.ts";
import { toValidator } from "#src/db/effect-compat.ts";
import { JoinedTableSchema } from "#src/server/introspection/start-fns/query-table-data.start.ts";

import { FullCenter } from "../../components/ui/layout.tsx";
import { Spinner } from "../../components/ui/spinner.tsx";

const tableSize = Schema.Literals(["excel", "minimal", "compact", "cozy", "comfortable"]);

const StructureFiltersSchema = Schema.Struct({
  search: Schema.String.pipe(Schema.withDecodingDefault(Effect.succeed(""))),
  nullable: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  primaryKey: Schema.Boolean.pipe(Schema.optional),
  unique: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  foreignKey: Schema.Boolean.pipe(Schema.optional),
  hasDefaults: Schema.Boolean.pipe(Schema.optional),
});

const HiddenColumnRefSchema = Schema.Struct({
  table: Schema.String,
  column: Schema.String,
});

/** Accepts legacy bare/`table.column` strings from old URLs and normalizes to `{ table, column }`. */
const LegacyHiddenColumnStringSchema = Schema.String.pipe(
  Schema.decodeTo(HiddenColumnRefSchema, {
    decode: SchemaGetter.transform((value: string) => parseHiddenColumnString(value)),
    encode: SchemaGetter.transform((ref: { table: string; column: string }) =>
      ref.table ? `${ref.table}.${ref.column}` : ref.column,
    ),
  }),
);

const HiddenColumnListItemSchema = Schema.Union([
  HiddenColumnRefSchema,
  LegacyHiddenColumnStringSchema,
]);

const TabStateSchema = Schema.Struct({
  tabId: Schema.String, // Explicit unique identifier for the tab
  schema: Schema.String.pipe(Schema.withDecodingDefault(Effect.succeed("public"))),
  table: Schema.String,
  tabName: Schema.String.pipe(Schema.optional), // User-defined tab name
  orderBy: Schema.String.pipe(Schema.optional),
  orderDirection: Schema.Literals(["asc", "desc"]).pipe(Schema.optional),
  nullsOrder: Schema.Literals(["first", "last"]).pipe(Schema.optional),
  limit: Schema.Number.pipe(Schema.withDecodingDefault(Effect.succeed(50))),
  offset: Schema.Number.pipe(Schema.withDecodingDefault(Effect.succeed(0))),
  viewMode: Schema.Literals(["rows", "structure", "er"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("rows")),
  ),
  tableSize: tableSize.pipe(Schema.withDecodingDefault(Effect.succeed("cozy"))),
  hiddenColumnList: Schema.Array(HiddenColumnListItemSchema).pipe(Schema.optional),
  columnAliases: Schema.Record(Schema.String, Schema.String).pipe(Schema.optional),
  columnVisibilityMode: Schema.Literals(["client", "server"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("client")),
  ),
  filters: QueryFilter.pipe(Schema.optional),
  filtersOpened: Schema.Boolean.pipe(Schema.optional),
  groupBy: Schema.Array(Schema.String).pipe(Schema.optional),
  having: QueryFilter.pipe(Schema.optional),
  columnPinning: Schema.Struct({
    left: Schema.Array(Schema.String).pipe(Schema.optional),
    right: Schema.Array(Schema.String).pipe(Schema.optional),
  }).pipe(Schema.optional), // Zipson-compressed column pinning config
  columnOrder: Schema.Array(Schema.String).pipe(Schema.optional), // JSON-stringified column order array
  fkValue: Schema.String.pipe(Schema.optional), // FK value used when navigating to this tab
  relationshipRowId: Schema.String.pipe(Schema.optional), // Row ID for expanded relationships panel
  joins: Schema.Array(JoinedTableSchema).pipe(Schema.optional),
  prefixWithTable: Schema.Boolean.pipe(Schema.optional),
  sqlPreviewSize: Schema.Number.pipe(Schema.optional), // SQL preview collapsed state
  sqlEditorMode: Schema.Literals(["preview", "editor"]).pipe(Schema.optional), // SQL editor tab mode
  customSql: Schema.String.pipe(Schema.optional), // Custom SQL query being edited (before execution)
  customSqlId: Schema.String.pipe(Schema.optional), // ID of executed custom SQL (replaces customSql after execution)
  // Legacy: ignored. Draft sticky is local editor state now.
  editorDetached: Schema.Boolean.pipe(Schema.optional),
  // "ai" tabs host the embedded assistant; askTable/aiIntent carry its seed.
  initialTabMode: Schema.Literals(["table", "sql", "ai"]).pipe(Schema.optional), // Initial mode for empty tabs
  askTable: Schema.String.pipe(Schema.optional), // AI tab seed: scope schema to this table
  aiIntent: Schema.Literals(["chat", "sql"]).pipe(Schema.optional), // AI tab seed: propose-a-query vs explore
  clientFilter: Schema.String.pipe(Schema.optional), // Client-side JS filter expression (draft input)
  clientFilterApproved: Schema.String.pipe(Schema.optional), // Approved client-side JS filter expression (active)
});

const searchSchema = Schema.Struct({
  dbName: Schema.String.pipe(Schema.optional),
  schema: Schema.String.pipe(Schema.optional), // Global schema selection (fallback when no tabs)
  activeTabId: Schema.String.pipe(Schema.optional), // Explicit active tab ID
  tabs: Schema.Array(TabStateSchema).pipe(
    Schema.withDecodingDefault(
      Effect.succeed([] as ReadonlyArray<Schema.Schema.Type<typeof TabStateSchema>>),
    ),
  ), // Array of tab states, zipson-compressed
  tableFilter: Schema.String.pipe(Schema.optional),
  structureFilters: StructureFiltersSchema.pipe(Schema.optional), // Structure view filters
  schemaExplorerOpen: Schema.Boolean.pipe(Schema.optional), // Schema explorer view
  schemaExplorerSchema: Schema.String.pipe(Schema.optional), // Which schema to view in explorer
  quickReferencesOpen: Schema.Boolean.pipe(Schema.optional),
  quickReferencesColumnName: Schema.String.pipe(Schema.optional),
  quickReferencesCellValue: Schema.Union([Schema.String, Schema.Number]).pipe(Schema.optional),
  sidebarSize: Schema.Number.pipe(Schema.optional),
  queryLoggerSize: Schema.Number.pipe(Schema.optional), // Query logger panel height as percentage
  zenMode: Schema.Boolean.pipe(Schema.optional), // Collapse filters / header / compact status bar
  rowJsonViewerOpen: Schema.Boolean.pipe(Schema.optional),
  // Primary key value to identify which row to display
  rowJsonViewerRowId: Schema.Union([Schema.String, Schema.Number]).pipe(Schema.optional),
  // Array of primary key values for bulk JSON viewer
  rowJsonViewerRowIds: Schema.Union([Schema.String, Schema.Number]).pipe(
    Schema.Array,
    Schema.optional,
  ),
});

export const Route = createFileRoute("/connections/$connectionName")({
  validateSearch: searchSchema.pipe(toValidator),
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
