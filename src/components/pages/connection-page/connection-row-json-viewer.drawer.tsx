import { RelationshipExplorer } from "#src/components/pages/connection-page/relationships/relationship-explorer.tsx";
import { useTableColumnMetadata } from "#src/components/pages/connection-page/use-table-column-metadata.ts";
import { HStack, Stack } from "#src/components/ui/layout.tsx";
import { useJsEvalFilter } from "#src/hooks/use-js-eval-filter.ts";
import { replaceDatabaseInConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import type { DbConnection } from "../connection.types.ts";

import { Input } from "../../ui/input.tsx";
import { JsonViewer } from "../../ui/json-viewer.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet.tsx";
import { useActiveTabState } from "./create-tab-state.ts";
import { formatTableValue } from "./format-table-value.ts";

export const ConnectionRowJsonViewerDrawer = ({ connection }: { connection: DbConnection }) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const search = useActiveTabState((tab, s) => ({
    dbName: s.dbName,
    schema: tab.schema,
    table: tab.table,
    limit: tab.limit,
    offset: tab.offset,
    orderBy: tab.orderBy,
    orderDirection: tab.orderDirection,
    filters: tab.filters,
    rowJsonViewerOpen: s.rowJsonViewerOpen,
    rowJsonViewerRowId: s.rowJsonViewerRowId,
    rowJsonViewerRowIds: s.rowJsonViewerRowIds,
  }));

  const connectionUrl = connection.url || "";
  const activeConnectionUrl = search.dbName
    ? replaceDatabaseInConnectionUrl(connectionUrl, search.dbName)
    : connectionUrl;

  const rowJsonSheetOpen = search.rowJsonViewerOpen ?? false;

  const { columnMetadata } = useTableColumnMetadata({
    url: activeConnectionUrl,
    schema: search.schema || "",
    table: search.table || "",
  });

  const primaryKeyColumn = columnMetadata.find((col) => col.primaryKey);

  const rowsQuery = useQuery({
    ...queryTableDataQueryOptions({
      url: activeConnectionUrl,
      schema: search.schema || "",
      table: search.table || "",
      limit: search.limit,
      offset: search.offset,
      orderBy: search.orderBy,
      orderDirection: search.orderDirection,
      filters: search.filters ?? {
        conditions: [],
        logicalOperator: "and",
      },
    }),
    enabled: !!search.schema && !!search.table,
  });

  // Get row IDs - either from bulk selection (rowJsonViewerRowIds) or single row (rowJsonViewerRowId)
  const rowIds =
    search.rowJsonViewerRowIds ?? (search.rowJsonViewerRowId ? [search.rowJsonViewerRowId] : []);
  const isMultiSelect = (search.rowJsonViewerRowIds?.length ?? 0) > 1;

  // Reconstruct row data from URL rowId(s) by looking them up in current table data
  const rowJsonData = useMemo(() => {
    if (!rowIds.length || !primaryKeyColumn || !rowsQuery.data) {
      return null;
    }
    const rows = rowsQuery.data.rows || [];
    const matchedRows = rows.filter((r) => rowIds.includes(String(r[primaryKeyColumn.name])));
    if (matchedRows.length === 0) return null;

    // Return array for multi-select, single object for single select
    const formattedRows = matchedRows.map((row) => formatTableValue(row));
    return isMultiSelect ? formattedRows : formattedRows[0];
  }, [rowIds, primaryKeyColumn, rowsQuery.data, isMultiSelect]);

  const [jsFilter, setJsFilter] = useState("");

  const jsFilterResult = useJsEvalFilter(jsFilter, {
    paramName: isMultiSelect ? "rows" : "row",
    sampleData: rowJsonData,
  });

  const filteredData = useMemo(() => {
    if (!rowJsonData || !jsFilter.trim() || !jsFilterResult.fn) {
      return rowJsonData;
    }
    try {
      const result = jsFilterResult.fn(rowJsonData);
      return result !== undefined ? result : rowJsonData;
    } catch {
      return rowJsonData;
    }
  }, [rowJsonData, jsFilter, jsFilterResult.fn]);

  if (!rowJsonSheetOpen) {
    return null;
  }

  const useRelationshipExplorer =
    search.schema &&
    search.table &&
    connectionUrl &&
    typeof rowJsonData === "object" &&
    rowJsonData !== null;

  return (
    <Sheet
      open={true}
      onOpenChange={(details) => {
        if (!details.open) {
          navigate({
            search: (prev) => ({
              ...prev,
              rowJsonViewerRowId: undefined,
              rowJsonViewerRowIds: undefined,
              rowJsonViewerOpen: false,
            }),
          });
        }
      }}
    >
      <SheetContent className="z-50 flex w-full flex-col p-0 sm:max-w-[800px]">
        <SheetHeader>
          <SheetTitle>{isMultiSelect ? `${rowIds.length} Rows` : "Row Data"}</SheetTitle>
          <SheetDescription>
            {isMultiSelect ? "Bulk JSON viewer" : "Expanded JSON viewer"}
          </SheetDescription>
          <Input
            placeholder={
              isMultiSelect
                ? "rows[0].id === 1 || rows[1].id === 2 || rows.filter(r => r.isAdmin)"
                : "row.nested.prop.name.includes('test')"
            }
            value={jsFilter}
            onChange={(e) => setJsFilter(e.target.value)}
            className="mt-2 font-mono text-sm"
          />
          {jsFilterResult.error && (
            <p className="mt-1 text-xs text-red-500">{jsFilterResult.error}</p>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-auto p-4">
          {rowJsonData ? (
            useRelationshipExplorer ? (
              Array.isArray(filteredData) ? (
                <div className="flex h-full flex-col gap-4 overflow-auto">
                  {filteredData.map((row, idx) => (
                    <div key={idx} className="rounded-md border p-2">
                      <div className="mb-2 text-sm font-medium">#{idx + 1}</div>
                      {row && typeof row === "object" ? (
                        <RelationshipExplorer
                          row={row as Record<string, unknown>}
                          schema={search.schema!}
                          table={search.table!}
                          connectionUrl={activeConnectionUrl}
                          className="h-full"
                          maxDepth={5}
                          showRelationships={true}
                        />
                      ) : (
                        <JsonViewer data={row} defaultExpanded={false} maxDepth={3} />
                      )}
                    </div>
                  ))}
                </div>
              ) : filteredData && typeof filteredData === "object" ? (
                <RelationshipExplorer
                  row={filteredData as Record<string, unknown>}
                  schema={search.schema!}
                  table={search.table!}
                  connectionUrl={activeConnectionUrl}
                  className="h-full"
                  maxDepth={5}
                  showRelationships={true}
                />
              ) : (
                <JsonViewer data={filteredData} defaultExpanded={false} maxDepth={3} />
              )
            ) : isMultiSelect ? (
              <Stack>
                {Array.isArray(filteredData) ? (
                  filteredData.map((row, filteredIndex) => {
                    const rowIndex =
                      row &&
                      typeof row === "object" &&
                      primaryKeyColumn?.name &&
                      rowIds.indexOf(String(row[primaryKeyColumn.name]));
                    return (
                      <HStack key={filteredIndex}>
                        <span className="mb-2 text-sm font-medium">
                          #{rowIndex === -1 ? filteredIndex + 1 : rowIndex + 1}
                        </span>
                        <JsonViewer data={row} defaultExpanded={false} maxDepth={3} />
                      </HStack>
                    );
                  })
                ) : (
                  <JsonViewer data={filteredData} defaultExpanded={false} maxDepth={3} />
                )}
              </Stack>
            ) : (
              <JsonViewer
                data={filteredData}
                defaultExpanded={true}
                maxDepth={5}
                className="h-full"
              />
            )
          ) : !rowIds.length ? (
            <div className="text-muted-foreground text-sm">No data</div>
          ) : (
            // Loading skeleton
            <div className="flex h-full w-full flex-col gap-3">
              {/* Header skeleton */}
              <div className="space-y-2">
                <div className="bg-muted/60 h-4 w-32 animate-pulse rounded" />
                <div className="bg-muted/60 h-3 w-48 animate-pulse rounded" />
              </div>
              {/* Content skeleton - nested object structure */}
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="border-muted/40 space-y-2 border-l pl-4">
                    <div className="bg-muted/60 h-3 w-24 animate-pulse rounded" />
                    <div className="bg-muted/60 h-3 w-40 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
