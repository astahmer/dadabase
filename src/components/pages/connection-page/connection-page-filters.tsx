import type { Table as TanstackTable } from "@tanstack/react-table";

import { useNavigate } from "@tanstack/react-router";
import {
  LayoutGrid,
  Link2,
  LucideChevronDown,
  LucideChevronUp,
  LucideListFilter,
  MoreHorizontal,
  Plus,
  Rows,
} from "lucide-react";
import { useState } from "react";

import type { QueryFilterBuilderReturn } from "#src/components/query-builder/use-query-builder.ts";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

import { JoinTablesDialog } from "#src/components/pages/connection-page/join-tables/join-tables.dialog.tsx";
import {
  getOperatorLabel,
  type FilterConditionExpression,
} from "#src/components/query-builder/query-filter.ts";

import { OrderBySelect } from "../../app/order-by-select.tsx";
import { ColumnVisibilityControls } from "../../data-table/column-visibility.tsx";
import { NaturalLanguageSearch } from "../../query-builder/natural-language-search.tsx";
import { Button } from "../../ui/button";
import { HStack } from "../../ui/layout.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../../ui/sheet.tsx";
import { Tooltip } from "../../ui/tooltip.tsx";
import { updateTabState, useActiveTabState } from "./create-tab-state.ts";
import { StructureFilterControls } from "./structure-table-filters.tsx";

interface ConnectionPageFiltersProps {
  columnList: string[];
  isLoading: boolean;
  table: TanstackTable<any>;
  queryBuilder: QueryFilterBuilderReturn;
  url: string;
  schema: string;
  tableName: string;
  columnMetadata?: Array<TableColumnMetadata>;
  onAddRow?: () => void;
  onCreateTable?: () => void;
  onAddColumn?: () => void;
  onDropTable?: () => void;
  onImportData?: () => void;
  onSchemaDiff?: () => void;
  onCreateIndex?: () => void;
}

const getFilterValueLabel = (value: FilterConditionExpression["value"]) => {
  if (Array.isArray(value)) return value.join(", ") || "…";
  if (value === null || value === undefined || value === "") return "…";
  return String(value);
};

export const ConnectionPageFilters = (props: ConnectionPageFiltersProps) => {
  const {
    columnList,
    isLoading,
    table,
    queryBuilder,
    url,
    schema,
    tableName,
    columnMetadata,
    onAddRow,
    onCreateTable,
    onAddColumn,
    onDropTable,
    onImportData,
    onSchemaDiff,
    onCreateIndex,
  } = props;
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);

  const viewMode = useActiveTabState((s) => s.viewMode);
  const filtersOpened = useActiveTabState((s) => s.filtersOpened);
  const filterConditions = useActiveTabState((s) => s.filters?.conditions ?? []);
  const groupBy = useActiveTabState((s) => s.groupBy ?? []);
  const groupByCount = groupBy.length;
  const joinConfig = useActiveTabState((s) => ({
    joins: Array.from(s.joins ?? []),
  }));
  const orderBy = useActiveTabState((s) => s.orderBy);
  const orderDirection = useActiveTabState((s) => s.orderDirection);
  const nullsOrder = useActiveTabState((s) => s.nullsOrder);
  const columnVisibilityMode = useActiveTabState((s) => s.columnVisibilityMode);

  return (
    <div className="bg-muted/50 relative w-full min-w-0 border-b">
      {isLoading && (
        <div
          className="bg-primary absolute inset-x-0 top-0 h-0.5"
          style={{
            background: "linear-gradient(90deg, transparent, var(--color-primary), transparent)",
            animation: "shimmer 1.5s infinite",
          }}
        />
      )}
      <HStack
        className="w-full min-w-0 flex-wrap items-center gap-2 px-4 py-2 sm:flex-nowrap sm:overflow-x-auto"
        data-testid="connection-page-filters-toolbar"
      >
        <div className="flex shrink-0 gap-2">
          <Tooltip content="View rows">
            <Button
              variant={viewMode === "rows" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                navigate({
                  search: (prev) =>
                    updateTabState(prev, {
                      viewMode: "rows",
                    }),
                })
              }
              data-testid="view-mode-rows"
              aria-label="View rows"
            >
              <Rows className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="View table structure">
            <Button
              variant={viewMode === "structure" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                navigate({
                  search: (prev) =>
                    updateTabState(prev, {
                      viewMode: "structure",
                    }),
                })
              }
              data-testid="view-mode-structure"
              aria-label="View table structure"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="ER diagram">
            <Button
              variant={viewMode === "er" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                navigate({
                  search: (prev) =>
                    updateTabState(prev, {
                      viewMode: "er",
                    }),
                })
              }
              data-testid="view-mode-er"
              aria-label="ER diagram"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
        {viewMode === "structure" && (
          <StructureFilterControls
            columnMetadata={columnMetadata}
            schema={schema}
            table={tableName}
            onCreateTable={onCreateTable}
            onAddColumn={onAddColumn}
            onDropTable={onDropTable}
            onImportData={onImportData}
            onSchemaDiff={onSchemaDiff}
            onCreateIndex={onCreateIndex}
          />
        )}
        {viewMode === "er" && (
          <span className="text-muted-foreground ml-auto text-xs">Click a table to open it</span>
        )}
        {viewMode === "rows" && (
          <>
            <div id="connection-page-filters-top-row" className="contents" />
            {onImportData && (
              <Button
                variant="outline"
                size="sm"
                onClick={onImportData}
                disabled={isLoading || !tableName}
                data-testid="import-data"
                className="gap-1.5"
              >
                Import
              </Button>
            )}
            {onAddRow && (
              <Button
                variant="default"
                size="sm"
                onClick={onAddRow}
                disabled={isLoading}
                data-testid="add-row-button"
                className="gap-1.5"
              >
                <Plus className="h-3 w-3" />
                Add row
              </Button>
            )}
            <Button
              variant={
                (filterConditions.length > 0 || (groupByCount ?? 0) > 0) && !filtersOpened
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => {
                navigate({
                  search: (prev) =>
                    updateTabState(prev, (tab) => ({
                      filtersOpened: !tab.filtersOpened,
                    })),
                });
              }}
              disabled={isLoading}
              className={filterConditions.length > 0 || (groupByCount ?? 0) > 0 ? "gap-2" : ""}
            >
              <LucideListFilter className="h-3 w-3" />
              {filterConditions.length > 0 || (groupByCount ?? 0) > 0
                ? filtersOpened
                  ? "Filters"
                  : "Open filters"
                : "Filters"}
              {(filterConditions.length > 0 || (groupByCount ?? 0) > 0) && (
                <span className="bg-background/20 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold">
                  {filterConditions.length + (groupByCount ?? 0) || 0}
                </span>
              )}
              {filterConditions.length > 0 || (groupByCount ?? 0) > 0 ? (
                filtersOpened ? (
                  <LucideChevronUp className="h-3 w-3" />
                ) : (
                  <LucideChevronDown className="h-3 w-3" />
                )
              ) : null}
            </Button>
            {(filterConditions.length > 0 || groupByCount > 0) && !filtersOpened && (
              <div className="hidden min-w-0 items-center gap-1 lg:flex">
                {filterConditions.slice(0, 2).map((condition, index) => (
                  <Button
                    key={`${condition.column}-${condition.operator}-${index}`}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigate({
                        search: (prev) =>
                          updateTabState(prev, {
                            filtersOpened: true,
                          }),
                      });
                    }}
                    className="h-7 max-w-52 gap-1 px-2 text-xs"
                    title={`${condition.column} ${getOperatorLabel(condition.operator)} ${getFilterValueLabel(condition.value)}`}
                  >
                    <span className="truncate font-medium">
                      {condition.column || "Select column"}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {getOperatorLabel(condition.operator)}
                    </span>
                    <span className="text-muted-foreground truncate">
                      {getFilterValueLabel(condition.value)}
                    </span>
                  </Button>
                ))}
                {filterConditions.length > 2 && (
                  <span className="text-muted-foreground px-1 text-xs">
                    +{filterConditions.length - 2}
                  </span>
                )}
                {groupBy.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigate({
                        search: (prev) =>
                          updateTabState(prev, {
                            filtersOpened: true,
                          }),
                      });
                    }}
                    className="text-muted-foreground h-7 max-w-40 px-2 text-xs"
                    title={`Grouped by ${groupBy.join(", ")}`}
                  >
                    Group: {groupBy[0]}
                    {groupBy.length > 1 ? ` +${groupBy.length - 1}` : ""}
                  </Button>
                )}
              </div>
            )}
            <Tooltip content="Join tables">
              <Button
                variant={joinConfig?.joins?.length ? "default" : "outline"}
                size="sm"
                onClick={() => setIsJoinDialogOpen(true)}
                disabled={isLoading}
                className={joinConfig?.joins?.length ? "gap-2" : ""}
              >
                <Link2 className="h-3 w-3" />
                {joinConfig?.joins?.length ? "Joins" : "Join tables"}
                {joinConfig?.joins?.length ? (
                  <span className="bg-background/20 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold">
                    {joinConfig.joins.length}
                  </span>
                ) : null}
              </Button>
            </Tooltip>
            <JoinTablesDialog
              key={`${url}-${schema}-${tableName}`}
              isOpen={isJoinDialogOpen}
              onOpenChange={setIsJoinDialogOpen}
              url={url}
              schema={schema}
              table={tableName}
              initialConfig={joinConfig}
              onApply={(config) => {
                navigate({
                  search: (prev) =>
                    updateTabState(prev, {
                      joins: config.joins,
                      offset: 0,
                    }),
                });
              }}
            />
            <NaturalLanguageSearch
              className="order-last w-full sm:order-none sm:max-w-sm sm:min-w-[10rem] sm:shrink"
              availableColumns={columnList}
              onApplyFilters={(parsed) => {
                // oxlint-disable-next-line no-shadow
                const { filters = [], orderBy, limit } = parsed;
                console.log("onApplyFilters", filters);
                const operatorMap: Record<string, any> = {
                  eq: "equals",
                  gt: "greater_than",
                  lt: "less_than",
                  gte: "greater_than_or_equal",
                  lte: "less_than_or_equal",
                  contains: "contains",
                  in: "in",
                  not_eq: "not_equals",
                  not_contains: "not_contains",
                  between: "between",
                };

                if (filters.length) {
                  if (parsed.clear) {
                    queryBuilder.updateManyConditions(
                      filterConditions.filter((current) => {
                        return filters.some(
                          (removed) =>
                            current.column === removed.field &&
                            current.operator === removed.operator &&
                            current.value === removed.value,
                        );
                      }),
                    );
                  } else {
                    queryBuilder.updateManyConditions([
                      ...filterConditions.map((f) => ({
                        column: f.column,
                        operator: f.operator,
                        value: f.value as string,
                      })),
                      ...filters.map((f) => ({
                        column: f.field,
                        operator: operatorMap[f.operator] || "equals",
                        value: (Array.isArray(f.value)
                          ? f.value.map(String)
                          : String(f.value ?? "")) as string | string[],
                        ...(f.inverted ? { inverted: true as const } : {}),
                      })),
                    ] as Parameters<typeof queryBuilder.updateManyConditions>[0]);
                  }
                }

                if (orderBy) {
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, {
                        orderBy: orderBy.field,
                        orderDirection: orderBy.direction,
                      }),
                  });
                }

                if (limit) {
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, {
                        limit: limit,
                      }),
                  });
                }
              }}
            />
            <Sheet
              open={isMobileControlsOpen}
              onOpenChange={(details) => setIsMobileControlsOpen(details.open)}
            >
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="sm:hidden"
                  aria-label="Open table controls"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                size="full"
                className="h-auto max-h-[80dvh] w-full max-w-none rounded-t-xl p-4"
              >
                <SheetHeader className="px-0 pt-0">
                  <SheetTitle>Table controls</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 overflow-y-auto pb-2">
                  <section className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Columns
                    </p>
                    <div className="[&_>div]:w-full [&_button]:w-full">
                      <ColumnVisibilityControls
                        table={table}
                        columnList={columnList}
                        minimal={true}
                        visibilityMode={columnVisibilityMode}
                        onVisibilityModeChange={(mode) => {
                          navigate({
                            search: (prev) =>
                              updateTabState(prev, {
                                columnVisibilityMode: mode,
                              }),
                          });
                        }}
                      />
                    </div>
                  </section>
                  <section className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Sort rows
                    </p>
                    <div className="[&_>div]:w-full [&_button]:w-full">
                      <OrderBySelect
                        columnList={columnList}
                        orderBy={orderBy}
                        orderDirection={orderDirection}
                        nullsOrder={nullsOrder}
                        onOrderChange={(nextOrderBy, direction) => {
                          navigate({
                            search: (prev) =>
                              updateTabState(prev, {
                                orderBy: nextOrderBy,
                                orderDirection: direction || "asc",
                                nullsOrder: undefined,
                                offset: 0,
                              }),
                          });
                        }}
                        onNullsOrderChange={(nextNullsOrder) => {
                          navigate({
                            search: (prev) =>
                              updateTabState(prev, {
                                nullsOrder: nextNullsOrder,
                              }),
                          });
                        }}
                        getColumnLabel={(col) => col}
                        minimal
                      />
                    </div>
                  </section>
                </div>
              </SheetContent>
            </Sheet>
            <div
              className="hidden shrink-0 items-center gap-2 sm:flex"
              data-testid="filters-trailing-controls"
            >
              <ColumnVisibilityControls
                table={table}
                columnList={columnList}
                minimal={true}
                visibilityMode={columnVisibilityMode}
                onVisibilityModeChange={(mode) => {
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, {
                        columnVisibilityMode: mode,
                      }),
                  });
                }}
              />
              <OrderBySelect
                columnList={columnList}
                orderBy={orderBy}
                orderDirection={orderDirection}
                nullsOrder={nullsOrder}
                // oxlint-disable-next-line no-shadow
                onOrderChange={(orderBy, direction) => {
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, {
                        orderBy,
                        orderDirection: direction || "asc",
                        nullsOrder: undefined,
                        offset: 0,
                      }),
                  });
                }}
                // oxlint-disable-next-line no-shadow
                onNullsOrderChange={(nullsOrder) => {
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, {
                        nullsOrder,
                      }),
                  });
                }}
                getColumnLabel={(col) => col}
                minimal
              />
            </div>
          </>
        )}
      </HStack>
    </div>
  );
};
