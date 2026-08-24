import type { Table as TanstackTable } from "@tanstack/react-table";

import { useNavigate } from "@tanstack/react-router";
import {
  Download,
  LayoutGrid,
  Link2,
  Lock,
  LucideListFilter,
  MoreHorizontal,
  Plus,
  Rows,
  Table2,
  X,
} from "lucide-react";
import { type ComponentProps, type ReactNode, useCallback, useEffect, useState } from "react";

import type { QueryFilterBuilderReturn } from "#src/components/query-builder/use-query-builder.ts";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

import { JoinTablesPanel } from "#src/components/pages/connection-page/join-tables/join-tables.dialog.tsx";
import {
  getOperatorLabel,
  filterQueryValidConditions,
  type FilterConditionExpression,
  type QueryFilterType,
  nullOperators,
} from "#src/components/query-builder/query-filter.ts";

import { OrderBySelect } from "../../app/order-by-select.tsx";
import { ColumnVisibilityControls } from "../../data-table/column-visibility.tsx";
import { NaturalLanguageSearch } from "../../query-builder/natural-language-search.tsx";
import { QueryFilterBuilder } from "../../query-builder/query-filter-builder.tsx";
import { Button } from "../../ui/button";
import { HStack } from "../../ui/layout.tsx";
import { Menu, MenuContent, MenuItem, MenuItemText, MenuTrigger } from "../../ui/menu.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../../ui/sheet.tsx";
import { toaster } from "../../ui/toaster.tsx";
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
  filterColumnMetadata?: Array<TableColumnMetadata>;
  filterControls?: ReactNode;
  onAddRow?: () => void;
  onCreateTable?: () => void;
  onAddColumn?: () => void;
  onDropTable?: () => void;
  onImportData?: () => void;
  onExportTable?: (format: "json" | "csv" | "tsv" | "sql") => void;
  onSchemaDiff?: () => void;
  onCreateIndex?: () => void;
  isReadOnly?: boolean;
}

const getFilterValueLabel = (value: FilterConditionExpression["value"]) => {
  if (Array.isArray(value)) return value.join(", ") || "…";
  if (value === null) return "NULL";
  if (value === undefined || value === "") return "…";
  return String(value);
};

const isAppliedFilter = (condition: FilterConditionExpression): boolean => {
  if (!condition.column) return false;
  if (nullOperators.includes(condition.operator)) return true;
  if (Array.isArray(condition.value)) return condition.value.length > 0;
  return condition.value !== undefined && condition.value !== "";
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
    filterColumnMetadata,
    filterControls,
    onAddRow,
    onCreateTable,
    onAddColumn,
    onDropTable,
    onImportData,
    onExportTable,
    onSchemaDiff,
    onCreateIndex,
    isReadOnly = false,
  } = props;
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const [isJoinPanelOpen, setIsJoinPanelOpen] = useState(false);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<QueryFilterType | null>(null);

  const viewMode = useActiveTabState((s) => s.viewMode);
  const filtersOpened = useActiveTabState((s) => s.filtersOpened);
  const filterConditions = useActiveTabState((s) => s.filters?.conditions ?? []);
  const appliedFilterConditions = filterConditions.flatMap((condition, index) =>
    isAppliedFilter(condition) ? [{ condition, index }] : [],
  );
  const groupBy = useActiveTabState((s) => s.groupBy ?? []);
  const groupByCount = groupBy.length;
  const joinConfig = useActiveTabState((s) => ({
    joins: Array.from(s.joins ?? []),
  }));
  const orderBy = useActiveTabState((s) => s.orderBy);
  const orderDirection = useActiveTabState((s) => s.orderDirection);
  const nullsOrder = useActiveTabState((s) => s.nullsOrder);
  const columnVisibilityMode = useActiveTabState((s) => s.columnVisibilityMode);
  const appliedFilterCount = appliedFilterConditions.length + groupByCount;
  const hasAppliedFilters = appliedFilterCount > 0;

  const openFilters = (addCondition = false) => {
    setFilterDraft((current) => {
      const draft = current ?? queryBuilder.filter;
      const conditions =
        draft.conditions.length === 0 || addCondition
          ? [...draft.conditions, { column: "", operator: "equals" as const }]
          : draft.conditions;
      return { ...draft, conditions };
    });
    void navigate({
      search: (prev) =>
        updateTabState(prev, {
          filtersOpened: true,
        }),
    });
  };

  useEffect(() => {
    if (!filtersOpened || filterDraft) return;
    setFilterDraft(
      queryBuilder.filter.conditions.length
        ? queryBuilder.filter
        : { conditions: [{ column: "", operator: "equals" }], logicalOperator: "and" },
    );
  }, [filterDraft, filtersOpened, queryBuilder.filter]);

  const draftFilter = filterDraft ?? queryBuilder.filter;

  const closeFilters = () => {
    setFilterDraft(null);
    void navigate({
      search: (prev) => updateTabState(prev, { filtersOpened: false }),
    });
  };

  const applyFilterDraft = () => {
    const validFilter = filterQueryValidConditions(draftFilter);
    if (draftFilter.conditions.length > 0 && !validFilter) {
      toaster.create({
        title: "Finish the filter first",
        description: "Choose a column and enter a value before applying it.",
        type: "warning",
      });
      return;
    }

    queryBuilder.updateFilter(
      validFilter ?? {
        conditions: [],
        logicalOperator: draftFilter.logicalOperator,
      },
    );
    setFilterDraft(null);
    void navigate({
      search: (prev) =>
        updateTabState(prev, {
          offset: 0,
          filtersOpened: false,
        }),
    });
  };

  const handleNaturalLanguageApply: ComponentProps<
    typeof NaturalLanguageSearch
  >["onApplyFilters"] = (parsed) => {
    const { filters = [], orderBy, limit } = parsed;
    const currentConditions = draftFilter.conditions;
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
        const conditions = currentConditions.filter((current) => {
          return !filters.some(
            (removed) =>
              current.column === removed.field &&
              current.operator === removed.operator &&
              current.value === removed.value,
          );
        });
        setFilterDraft({ ...draftFilter, conditions });
      } else {
        const conditions = [
          ...currentConditions.map((filter) => ({
            column: filter.column,
            operator: filter.operator,
            value: filter.value as string,
          })),
          ...filters.map((filter) => ({
            column: filter.field,
            operator: operatorMap[filter.operator] || "equals",
            value: (Array.isArray(filter.value)
              ? filter.value.map(String)
              : String(filter.value ?? "")) as string | string[],
            ...(filter.inverted ? { inverted: true as const } : {}),
          })),
        ] as Parameters<typeof queryBuilder.updateManyConditions>[0];
        setFilterDraft({ ...draftFilter, conditions });
      }
    }

    if (orderBy) {
      void navigate({
        search: (prev) =>
          updateTabState(prev, {
            orderBy: orderBy.field,
            orderDirection: orderBy.direction,
          }),
      });
    }

    if (limit) {
      void navigate({
        search: (prev) => updateTabState(prev, { limit }),
      });
    }
  };

  const handleJoinConfigChange = useCallback(
    (config: typeof joinConfig) => {
      void navigate({
        search: (prev) =>
          updateTabState(prev, {
            joins: config.joins,
            offset: 0,
          }),
      });
    },
    [navigate],
  );

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
        <div className="hidden min-w-0 items-center gap-1.5 border-r pr-3 text-xs lg:flex">
          <Table2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <span
            className="text-foreground max-w-44 truncate font-medium"
            title={`${schema}.${tableName}`}
          >
            {schema}.{tableName}
          </span>
          <span className="text-muted-foreground">Rows</span>
        </div>
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
          <Tooltip content="Schema map">
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
              aria-label="Schema map"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
        <Tooltip content={isReadOnly ? "Read-only: writes are blocked" : "Writes enabled"}>
          <span
            className={
              isReadOnly
                ? "border-success/40 bg-success/10 text-success inline-flex h-8 items-center rounded border px-2"
                : "border-warning/40 bg-warning/10 text-warning inline-flex h-8 items-center rounded border px-2"
            }
            aria-label={isReadOnly ? "Read-only: writes are blocked" : "Writes enabled"}
          >
            <Lock className="h-3.5 w-3.5" />
          </span>
        </Tooltip>
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
                disabled={isLoading || !tableName || isReadOnly}
                data-testid="import-data"
                className="gap-1.5"
              >
                Import
              </Button>
            )}
            {onExportTable && (
              <Menu>
                <MenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading || !tableName}
                    className="gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export all
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem value="export-csv" onClick={() => onExportTable("csv")}>
                    <MenuItemText>All rows as CSV</MenuItemText>
                  </MenuItem>
                  <MenuItem value="export-json" onClick={() => onExportTable("json")}>
                    <MenuItemText>All rows as JSON</MenuItemText>
                  </MenuItem>
                  <MenuItem value="export-tsv" onClick={() => onExportTable("tsv")}>
                    <MenuItemText>All rows as TSV</MenuItemText>
                  </MenuItem>
                  <MenuItem value="export-sql" onClick={() => onExportTable("sql")}>
                    <MenuItemText>All rows as INSERT statements</MenuItemText>
                  </MenuItem>
                </MenuContent>
              </Menu>
            )}
            {onAddRow && (
              <Tooltip content="Add row">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddRow}
                  disabled={isLoading || isReadOnly}
                  data-testid="add-row-button"
                  aria-label="Add row"
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Add row</span>
                </Button>
              </Tooltip>
            )}
            <Popover
              open={filtersOpened}
              onOpenChange={(details) => {
                if (details.open) {
                  openFilters();
                  return;
                }
                closeFilters();
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant={hasAppliedFilters ? "secondary" : "outline"}
                  size="sm"
                  disabled={isLoading}
                  className={hasAppliedFilters ? "gap-2" : "gap-1.5"}
                >
                  <LucideListFilter className="h-3.5 w-3.5" />
                  Filter
                  {hasAppliedFilters && (
                    <span className="bg-background/70 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold">
                      {appliedFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="z-100 max-h-[min(42rem,calc(100vh-7rem))] w-[min(46rem,calc(100vw-2rem))] overflow-y-auto p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold">Filter rows</h2>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(window.location.href);
                        toaster.create({ title: "View link copied", type: "success" });
                      }}
                      className="text-muted-foreground h-7 px-1.5 text-xs"
                    >
                      Copy view link
                    </Button>
                    {hasAppliedFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFilterDraft({
                            conditions: [],
                            logicalOperator: draftFilter.logicalOperator,
                          });
                        }}
                        className="text-muted-foreground h-7 px-1.5 text-xs"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </div>
                <div className="bg-muted/20 border-b px-4 py-2.5">
                  <NaturalLanguageSearch
                    className="w-full"
                    label="Quick query"
                    placeholder="Try “name contains minecraft” or “sort by created_at desc”"
                    availableColumns={columnList}
                    onApplyFilters={handleNaturalLanguageApply}
                  />
                </div>
                <div className="space-y-4 p-4">
                  <QueryFilterBuilder
                    conditions={draftFilter.conditions}
                    onUpdateCondition={(id, updates) => {
                      setFilterDraft((current) => {
                        const draft = current ?? queryBuilder.filter;
                        return {
                          ...draft,
                          conditions: draft.conditions.map((condition, index) =>
                            String(index) === id ? { ...condition, ...updates } : condition,
                          ),
                        };
                      });
                    }}
                    onRemoveCondition={(id) => {
                      setFilterDraft((current) => {
                        const draft = current ?? queryBuilder.filter;
                        return {
                          ...draft,
                          conditions: draft.conditions.filter(
                            (_condition, index) => String(index) !== id,
                          ),
                        };
                      });
                    }}
                    onLogicalOperatorChange={(logicalOperator) => {
                      setFilterDraft((current) => ({
                        ...(current ?? queryBuilder.filter),
                        logicalOperator,
                      }));
                    }}
                    onAddCondition={() => openFilters(true)}
                    onClearAll={() => {
                      setFilterDraft({
                        conditions: [],
                        logicalOperator: draftFilter.logicalOperator,
                      });
                    }}
                    logicalOperator={draftFilter.logicalOperator}
                    availableColumns={columnList}
                    isLoading={isLoading}
                    label="Where"
                    columnMetadata={filterColumnMetadata ?? columnMetadata}
                    presentation="popover"
                  />
                  {filterControls && <div className="border-t pt-4">{filterControls}</div>}
                  <div className="flex justify-end gap-2 border-t pt-3">
                    <Button variant="ghost" size="sm" onClick={closeFilters}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={applyFilterDraft} data-testid="apply-filters">
                      Apply filters
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {hasAppliedFilters && (
              <div className="hidden min-w-0 items-center gap-1 lg:flex">
                {appliedFilterConditions.slice(0, 2).map(({ condition, index }) => (
                  <div
                    key={`${condition.column}-${condition.operator}-${index}`}
                    className="border-border/80 bg-background flex h-8 max-w-72 items-center overflow-hidden rounded-lg border text-xs shadow-xs"
                    title={`${condition.column} ${getOperatorLabel(condition.operator)} ${getFilterValueLabel(condition.value)}`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={openFilters}
                      className="h-full max-w-64 min-w-0 gap-0 rounded-none p-0 text-xs"
                    >
                      <span className="max-w-28 truncate px-2.5 font-medium">
                        {condition.column}
                      </span>
                      <span className="text-muted-foreground shrink-0 border-x px-2 py-1">
                        {getOperatorLabel(condition.operator)}
                      </span>
                      <span className="text-muted-foreground max-w-28 truncate px-2.5">
                        {getFilterValueLabel(condition.value)}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${condition.column} filter`}
                      onClick={() => queryBuilder.removeCondition(String(index))}
                      className="text-muted-foreground hover:text-foreground h-full w-7 shrink-0 rounded-none border-l p-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {appliedFilterConditions.length > 2 && (
                  <span className="text-muted-foreground px-1 text-xs">
                    +{appliedFilterConditions.length - 2}
                  </span>
                )}
                {groupBy.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openFilters}
                    className="text-muted-foreground h-7 max-w-40 px-2 text-xs"
                    title={`Grouped by ${groupBy.join(", ")}`}
                  >
                    Group: {groupBy[0]}
                    {groupBy.length > 1 ? ` +${groupBy.length - 1}` : ""}
                  </Button>
                )}
                <Tooltip content="Add filter">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      openFilters(true);
                    }}
                    className="h-8 w-8 rounded-full p-0"
                    aria-label="Add filter"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </Tooltip>
              </div>
            )}
            <Tooltip content="Join tables">
              <Button
                variant={joinConfig?.joins?.length ? "default" : "outline"}
                size="sm"
                onClick={() => setIsJoinPanelOpen((open) => !open)}
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
      {viewMode === "rows" && isJoinPanelOpen && (
        <JoinTablesPanel
          key={`${url}-${schema}-${tableName}`}
          url={url}
          schema={schema}
          table={tableName}
          initialConfig={joinConfig}
          onChange={handleJoinConfigChange}
          onClose={() => setIsJoinPanelOpen(false)}
        />
      )}
    </div>
  );
};
