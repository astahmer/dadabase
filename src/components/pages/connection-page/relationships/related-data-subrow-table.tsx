import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import type { ColumnDef } from "@tanstack/react-table";

import { useRowsColumnsAction } from "#src/components/pages/connection-page/use-rows-columns.actions.ts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Maximize2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { queryFkTargetDataQueryOptions } from "../../../../server/introspection/start-fns/get-fk-target-data.start.ts";
import { DataTable } from "../../../data-table/data-table.tsx";
import { useDataTable } from "../../../data-table/use-data-table.ts";
import { ErrorBoundaryCard } from "../../../shared/error-boundary-card.tsx";
import { Button } from "../../../ui/button.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../../ui/sheet.tsx";
import { Spinner } from "../../../ui/spinner.tsx";
import { useRowsColumns } from "../use-rows-columns.tsx";
import { useTableColumnMetadata } from "../use-table-column-metadata.ts";

interface RelatedDataSubrowTableProps {
  relationship: TableRelationship;
  parentRowValue: string;
  connection: { url: string };
  isPanelExpanded?: boolean;
  withHeader?: boolean;
  onRemove?: () => void;
}

const initialLimit = 50;

/**
 * Renders a nested DataTable in a subrow containing the related record from the FK target table
 * For outgoing relationships: queries the referencedTable filtered by referencedColumn = fkValue
 */
export const RelatedDataSubrowTable = ({
  relationship,
  parentRowValue,
  connection,
  isPanelExpanded = false,
  withHeader = true,
  onRemove,
}: RelatedDataSubrowTableProps) => {
  const [limit, setLimit] = useState(initialLimit);
  const [pageIndex, setPageIndex] = useState(0);
  const [isMaximizeSheetOpen, setIsMaximizeSheetOpen] = useState(false);

  const { referencedSchema, referencedTable, referencedColumn } = relationship;

  // Calculate offset based on page index and limit
  const offset = pageIndex * limit;

  // Fetch rows from the referenced table filtered by the FK value
  const rowsQuery = useQuery({
    ...queryFkTargetDataQueryOptions({
      url: connection.url,
      schema: referencedSchema,
      referencedSchema: referencedSchema,
      referencedTable,
      referencedColumn,
      fkValue: parentRowValue,
      limit,
      offset,
    }),
    placeholderData: keepPreviousData,
  });

  const tableMetadata = useTableColumnMetadata({
    url: connection.url,
    schema: referencedSchema,
    table: referencedTable,
  });

  const rowActions = useRowsColumnsAction({
    columnMetadata: tableMetadata.columnMetadata,
    selectedSchema: referencedSchema,
    selectedTable: referencedTable,
    activeConnectionUrl: connection.url,
  });
  const dataColumns = useRowsColumns({
    columnMetadata: tableMetadata.columnMetadata,
    schema: referencedSchema,
    table: referencedTable,
    activeConnectionUrl: connection.url,
    enableSorting: true,
    onFollowFK: rowActions.onFollowFK,
    onFindReferences: rowActions.onFindReferences,
    onShowQuickReferences: rowActions.onShowQuickReferences,
    onPrefetchReferences: rowActions.onPrefetchReferences,
    onNavigateToFK: rowActions.onNavigateToFK,
    onNavigateToReference: rowActions.onNavigateToReference,
    onExpandToSheet: rowActions.onExpandToSheet,
    onMenuOpen: rowActions.onMenuOpen,
  });

  const tableColumns = useMemo(() => {
    return dataColumns;
  }, [dataColumns]);

  const rows = rowsQuery.data?.rows ?? [];
  const rowCount = rowsQuery.data?.rowCount ?? 0;

  const table = useDataTable({
    data: rows,
    columns: tableColumns as ColumnDef<any>[],
    manualPagination: true,
    state: {
      pagination: {
        pageIndex: pageIndex,
        pageSize: limit,
      },
    },
  });

  const isLoading = rowsQuery.isLoading;

  if (tableMetadata.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (tableMetadata.error) {
    return <ErrorBoundaryCard error={tableMetadata.error} title="Error loading table metadata" />;
  }

  if (rowsQuery.error) {
    return (
      <ErrorBoundaryCard
        error={rowsQuery.error}
        title="Error loading related data"
        onRetry={() => rowsQuery.refetch()}
      />
    );
  }

  return (
    <>
      {/* Info Bar */}
      {withHeader && (
        <div className="bg-muted/20 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 text-xs">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-muted-foreground truncate">
              <span className="text-foreground font-medium">{referencedTable}</span>
              <span className="text-muted-foreground">.{referencedColumn}</span>
            </span>
            <span className="text-muted-foreground shrink-0">=</span>
            <span className="truncate font-medium">{parentRowValue}</span>

            {rowCount > 0 && (
              <span className="text-muted-foreground shrink-0">
                {rowCount} record{rowCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isPanelExpanded && rowCount > 0 && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setIsMaximizeSheetOpen(true)}
                title="Expand to full view"
                className="h-6 gap-1 px-2"
              >
                <Maximize2 className="h-3 w-3" />
                <span className="text-xs">Maximize</span>
              </Button>
            )}
            {onRemove && (
              <Button size="xs" variant="ghost" onClick={onRemove} title="Remove from panel">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Data Display */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-muted-foreground py-4 text-center text-sm">
          No related record found
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <DataTable
            hideColumnPinIconUnlessHovered
            table={table}
            size="compact"
            isLoading={rowsQuery.isLoading}
            hasError={rowsQuery.isError}
          />
        </div>
      )}

      {/* Expanded Sheet View */}
      <Sheet
        open={isMaximizeSheetOpen}
        onOpenChange={(details) => setIsMaximizeSheetOpen(details.open)}
      >
        <SheetContent className="w-full max-w-4xl">
          <SheetHeader>
            <SheetTitle>
              Related Record: {referencedSchema}.{referencedTable}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <DataTable
                hideColumnPinIconUnlessHovered
                table={table}
                size="compact"
                isLoading={rowsQuery.isLoading}
                hasError={rowsQuery.isError}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
