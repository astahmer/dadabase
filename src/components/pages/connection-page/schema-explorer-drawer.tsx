import { getDialectDefaultSchema } from "#src/db/dialect.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import type { DbConnection } from "../connection.types";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet.tsx";
import { useActiveTabState } from "./create-tab-state.ts";
import { MultiTableStructureViewer } from "./multi-table-structure-viewer.tsx";

interface SchemaExplorerDrawerProps {
  connection: DbConnection;
}

export const SchemaExplorerDrawer = ({ connection }: SchemaExplorerDrawerProps) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const search = useSearch({ from: "/connections/$connectionName" });
  const schemaExplorerOpen = search.schemaExplorerOpen ?? false;
  const schemaExplorerSchema = search.schemaExplorerSchema;

  const activeTabSchema = useActiveTabState((tab) => tab.schema);

  // Get available schemas
  const activeConnectionUrl = connection.url;

  const schemasQuery = useQuery({
    ...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
    retry: 2,
  });

  const schemas = schemasQuery.data || [];

  // Determine which schema to show
  const displaySchema =
    schemaExplorerSchema ||
    activeTabSchema ||
    (schemas.length === 1 ? schemas[0] : undefined) ||
    getDialectDefaultSchema(connection.dialect);

  return (
    <Sheet
      open={schemaExplorerOpen}
      onOpenChange={(details) => {
        if (!details.open) {
          navigate({
            search: (prev) => ({
              ...prev,
              schemaExplorerOpen: false,
            }),
          });
        }
      }}
    >
      <SheetContent className="z-50 flex w-[800px] max-w-none! flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <div className="flex items-start justify-between gap-4 pr-6">
            <div>
              <SheetTitle>Schema Explorer</SheetTitle>
              <SheetDescription className="mt-1 text-xs">
                View and export table structures for all tables in a schema
              </SheetDescription>
            </div>
            {/* Schema selector - inline and compact */}
            {schemas.length > 1 && displaySchema && (
              <select
                value={displaySchema}
                onChange={(e) => {
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      schemaExplorerSchema: e.target.value,
                    }),
                  });
                }}
                className="border-border bg-background mr-3 h-8 rounded border px-2 py-1 text-sm"
              >
                {schemas.map((schema) => (
                  <option key={schema} value={schema}>
                    {schema}
                  </option>
                ))}
              </select>
            )}
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {displaySchema ? (
            <MultiTableStructureViewer
              activeConnectionUrl={activeConnectionUrl}
              schema={displaySchema}
              tableSize="compact"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              No schemas available
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
