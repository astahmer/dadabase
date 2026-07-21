import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Suspense } from "react";

import { parseHiddenColumnString } from "#src/components/pages/connection-page/hidden-column-list.ts";
import { ConnectionPage } from "#src/components/pages/connection.page.tsx";
import { QueryFilter } from "#src/components/query-builder/query-filter.ts";
import { JoinedTableSchema } from "#src/server/introspection/start-fns/query-table-data.start.ts";

import { FullCenter } from "../../components/ui/layout.tsx";
import { Spinner } from "../../components/ui/spinner.tsx";

const tableSize = Schema.Literal("excel", "minimal", "compact", "cozy", "comfortable");

const StructureFiltersSchema = Schema.Struct({
  search: Schema.String.pipe(Schema.optionalWith({ default: () => "" })),
  nullable: Schema.Boolean.pipe(Schema.optionalWith({ default: () => false })),
  primaryKey: Schema.Boolean.pipe(Schema.optional),
  unique: Schema.Boolean.pipe(Schema.optionalWith({ default: () => false })),
  foreignKey: Schema.Boolean.pipe(Schema.optional),
  hasDefaults: Schema.Boolean.pipe(Schema.optional),
});

const HiddenColumnRefSchema = Schema.Struct({
  table: Schema.String,
  column: Schema.String,
});

/** Accepts legacy bare/`table.column` strings from old URLs and normalizes to `{ table, column }`. */
const LegacyHiddenColumnStringSchema = Schema.transform(Schema.String, HiddenColumnRefSchema, {
  strict: true,
  decode: (value) => parseHiddenColumnString(value),
  encode: (ref) => (ref.table ? `${ref.table}.${ref.column}` : ref.column),
});

const HiddenColumnListItemSchema = Schema.Union(
  HiddenColumnRefSchema,
  LegacyHiddenColumnStringSchema,
);

const TabStateSchema = Schema.Struct({
  tabId: Schema.String, // Explicit unique identifier for the tab
  schema: Schema.String.pipe(Schema.optionalWith({ default: () => "public" })),
  table: Schema.String,
  tabName: Schema.String.pipe(Schema.optional), // User-defined tab name
  orderBy: Schema.String.pipe(Schema.optional),
  orderDirection: Schema.Literal("asc", "desc").pipe(Schema.optional),
  nullsOrder: Schema.Literal("first", "last").pipe(Schema.optional),
  limit: Schema.Number.pipe(Schema.optionalWith({ default: () => 50 })),
  offset: Schema.Number.pipe(Schema.optionalWith({ default: () => 0 })),
  viewMode: Schema.Literal("rows", "structure", "er").pipe(
    Schema.optionalWith({ default: () => "rows" }),
  ),
  tableSize: tableSize.pipe(Schema.optionalWith({ default: () => "cozy" })),
  hiddenColumnList: HiddenColumnListItemSchema.pipe(Schema.Array, Schema.optional),
  columnAliases: Schema.Record({ key: Schema.String, value: Schema.String }).pipe(Schema.optional),
  columnVisibilityMode: Schema.Literal("client", "server").pipe(
    Schema.optionalWith({ default: () => "client" }),
  ),
  filters: QueryFilter.pipe(Schema.optional),
  filtersOpened: Schema.Boolean.pipe(Schema.optional),
  groupBy: Schema.String.pipe(Schema.Array, Schema.optional),
  having: QueryFilter.pipe(Schema.optional),
  columnPinning: Schema.Struct({
    left: Schema.String.pipe(Schema.Array, Schema.optional),
    right: Schema.String.pipe(Schema.Array, Schema.optional),
  }).pipe(Schema.optional), // Zipson-compressed column pinning config
  columnOrder: Schema.String.pipe(Schema.Array, Schema.optional), // JSON-stringified column order array
  fkValue: Schema.String.pipe(Schema.optional), // FK value used when navigating to this tab
  relationshipRowId: Schema.String.pipe(Schema.optional), // Row ID for expanded relationships panel
  joins: Schema.Array(JoinedTableSchema).pipe(Schema.optional),
  prefixWithTable: Schema.Boolean.pipe(Schema.optional),
  sqlPreviewSize: Schema.Number.pipe(Schema.optional), // SQL preview collapsed state
  sqlEditorMode: Schema.Literal("preview", "editor").pipe(Schema.optional), // SQL editor tab mode
  customSql: Schema.String.pipe(Schema.optional), // Custom SQL query being edited (before execution)
  customSqlId: Schema.String.pipe(Schema.optional), // ID of executed custom SQL (replaces customSql after execution)
  editorDetached: Schema.Boolean.pipe(Schema.optional), // Keep editor draft when generated SQL changes
  initialTabMode: Schema.Literal("table", "sql").pipe(Schema.optional), // Initial mode for empty tabs
  clientFilter: Schema.String.pipe(Schema.optional), // Client-side JS filter expression (draft input)
  clientFilterApproved: Schema.String.pipe(Schema.optional), // Approved client-side JS filter expression (active)
});

const searchSchema = Schema.Struct({
  dbName: Schema.String.pipe(Schema.optional),
  schema: Schema.String.pipe(Schema.optional), // Global schema selection (fallback when no tabs)
  activeTabId: Schema.String.pipe(Schema.optional), // Explicit active tab ID
  tabs: TabStateSchema.pipe(Schema.Array, Schema.optional), // Array of tab states, zipson-compressed
  tableFilter: Schema.String.pipe(Schema.optional),
  structureFilters: StructureFiltersSchema.pipe(Schema.optional), // Structure view filters
  schemaExplorerOpen: Schema.Boolean.pipe(Schema.optional), // Schema explorer view
  schemaExplorerSchema: Schema.String.pipe(Schema.optional), // Which schema to view in explorer
  quickReferencesOpen: Schema.Boolean.pipe(Schema.optional),
  quickReferencesColumnName: Schema.String.pipe(Schema.optional),
  quickReferencesCellValue: Schema.Union(Schema.String, Schema.Number).pipe(Schema.optional),
  sidebarSize: Schema.Number.pipe(Schema.optional),
  queryLoggerSize: Schema.Number.pipe(Schema.optional), // Query logger panel height as percentage
  zenMode: Schema.Boolean.pipe(Schema.optional), // Collapse filters / header / compact status bar
  rowJsonViewerOpen: Schema.Boolean.pipe(Schema.optional),
  // Primary key value to identify which row to display
  rowJsonViewerRowId: Schema.Union(Schema.String, Schema.Number).pipe(Schema.optional),
  // Array of primary key values for bulk JSON viewer
  rowJsonViewerRowIds: Schema.Union(Schema.String, Schema.Number).pipe(
    Schema.Array,
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
