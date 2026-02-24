import { useTableColumnMetadata } from "#src/components/pages/connection-page/use-table-column-metadata.ts";
import { replaceDatabaseInConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { useNavigate, useSearch } from "@tanstack/react-router";

import type { DbConnection } from "../connection.types.ts";

import { Sheet, SheetContent } from "../../ui/sheet.tsx";
import { createTabState, updateTabState, useActiveTabState } from "./create-tab-state.ts";
import { QuickReferencesPanel } from "./relationships/quick-references-panel.tsx";

export const ConnectionQuickReferencesDrawer = ({ connection }: { connection: DbConnection }) => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const search = useActiveTabState((tab, s) => ({
    dbName: s.dbName,
    schema: tab.schema,
    table: tab.table,
    quickReferencesOpen: s.quickReferencesOpen,
    quickReferencesColumnName: s.quickReferencesColumnName,
    quickReferencesCellValue: s.quickReferencesCellValue,
  }));

  const connectionUrl = connection.url || "";
  const activeConnectionUrl = search.dbName
    ? replaceDatabaseInConnectionUrl(connectionUrl, search.dbName)
    : connectionUrl;

  const { columnMetadata } = useTableColumnMetadata({
    url: activeConnectionUrl,
    schema: search.schema || "",
    table: search.table || "",
  });

  const quickReferencesOpen = search.quickReferencesOpen ?? false;
  const quickReferencesColumnName = search.quickReferencesColumnName;
  const quickReferencesCellValue = search.quickReferencesCellValue;

  if (!quickReferencesOpen) {
    return null;
  }

  const column = columnMetadata.find((c) => c.name === quickReferencesColumnName);

  return (
    <Sheet
      open={true}
      onOpenChange={(details) => {
        if (!details.open) {
          navigate({
            search: (prev) => ({
              ...prev,
              quickReferencesOpen: false,
              quickReferencesColumnName: undefined,
              quickReferencesCellValue: undefined,
            }),
          });
        }
      }}
    >
      <SheetContent className="z-50 flex w-full flex-col p-0 sm:max-w-[500px]">
        {quickReferencesColumnName &&
        quickReferencesCellValue &&
        search.schema &&
        search.table &&
        columnMetadata.length > 0 ? (
          column ? (
            <QuickReferencesPanel
              key={`${search.schema}.${search.table}.${quickReferencesColumnName}.${quickReferencesCellValue}`}
              schema={search.schema}
              table={search.table}
              column={column}
              cellValue={quickReferencesCellValue}
              connectionUrl={activeConnectionUrl}
              onNavigate={(schema, table, column, value) => {
                const newTabState = createTabState(schema, table, {
                  filters: {
                    conditions: [
                      {
                        column,
                        operator: "equals",
                        value: String(value),
                      },
                    ],
                    logicalOperator: "and",
                  },
                  filtersOpened: true,
                  fkValue: String(value),
                });
                navigate({
                  search: (prev) => ({
                    ...prev,
                    ...newTabState,
                    ...updateTabState(prev, newTabState),
                    activeTabId: newTabState.tabId,
                  }),
                });
              }}
            />
          ) : null
        ) : (
          <div className="flex h-full w-full flex-col">
            {/* Skeleton Header */}
            <div className="from-background to-background/95 shrink-0 border-b bg-linear-to-b px-4 py-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="bg-muted/60 h-3 w-24 animate-pulse rounded" />
                  <div className="bg-muted/60 h-4 w-40 animate-pulse rounded" />
                  <div className="bg-muted/60 mt-2 h-3 w-32 animate-pulse rounded" />
                </div>
              </div>
              <div className="bg-muted/60 h-3 w-28 animate-pulse rounded" />
            </div>
            {/* Skeleton Content */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Skeleton Button */}
              <div className="bg-muted/60 h-10 animate-pulse rounded" />
              {/* Skeleton List Items */}
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-muted/60 h-8 animate-pulse rounded" />
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
