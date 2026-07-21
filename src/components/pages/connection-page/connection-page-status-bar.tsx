import type { Table as TanstackTable } from "@tanstack/react-table";

import { Pagination } from "@ark-ui/react/pagination";
import { useNavigate } from "@tanstack/react-router";
import { DateTime } from "effect";
import { Download, Layers, Maximize2, Minimize2, RefreshCw } from "lucide-react";

import { formatRelativeTime } from "#src/lib/format-relative-time.ts";
import { getDefaultColumnSize } from "#src/lib/get-default-column-size.ts";
import { cn } from "#src/lib/utils.ts";

import type { DataTableSize } from "../../data-table/data-table.styles.ts";

import { Button } from "../../ui/button";
import { HStack } from "../../ui/layout.tsx";
import { Menu, MenuContent, MenuItem, MenuItemText, MenuTrigger } from "../../ui/menu";
import * as ArkSelect from "../../ui/select";
import { Tooltip } from "../../ui/tooltip.tsx";
import { updateTabState, useActiveTabState } from "./create-tab-state.ts";
import { RowsPerPageSelector } from "./rows-per-page.selector.tsx";

const TableSizeCollection = ArkSelect.createListCollection({
  items: [
    { label: "Excel", value: "excel" },
    { label: "Minimal", value: "minimal" },
    { label: "Compact", value: "compact" },
    { label: "Cozy", value: "cozy" },
    {
      label: "Comfortable",
      value: "comfortable",
    },
  ],
});

interface ConnectionPageStatusBarProps {
  table: TanstackTable<any>;
  hasUuid: boolean;
  isLoading: boolean;
  /** Background refetch — keep table visible, show small indicator */
  isFetching?: boolean;
  refetch: () => void;
  timeTaken: number;
  ranAt: number;
  totalRowCount: number;
  rowsColumnsCount: number;
  isCustomSql: boolean;
  schema?: string;
  tableName?: string;
  onExportAll?: (
    format:
      | "json"
      | "csv"
      | "tsv"
      | "sql"
      | "copy-json"
      | "copy-csv"
      | "copy-tsv"
      | "copy-insert",
  ) => void;
  columns?: string[];
  zenMode?: boolean;
  onToggleZenMode?: () => void;
}

export const ConnectionPageStatusBar = (props: ConnectionPageStatusBarProps) => {
  const {
    isLoading,
    isFetching = false,
    refetch,
    isCustomSql,
    zenMode = false,
    onToggleZenMode,
  } = props;

  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const selectedSchema = useActiveTabState((s) => s.schema);
  const selectedTable = useActiveTabState((s) => s.table);
  const tableDisplayName = selectedTable
    ? `${selectedSchema}.${selectedTable}`
    : "No table selected";

  const offset = useActiveTabState((s) => s.offset);
  const limit = useActiveTabState((s) => s.limit);
  const tableSize = useActiveTabState((s) => s.tableSize);
  const prefixWithTable = useActiveTabState((s) => s.prefixWithTable);
  const joins = useActiveTabState((s) => s.joins);

  const zenToggle = onToggleZenMode ? (
    <Tooltip content={zenMode ? "Exit zen mode (⌘.)" : "Zen mode (⌘.)"}>
      <Button
        variant={zenMode ? "default" : "ghost"}
        size="sm"
        onClick={onToggleZenMode}
        className="h-6 px-2"
        aria-label={zenMode ? "Exit zen mode" : "Enter zen mode"}
      >
        {zenMode ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
      </Button>
    </Tooltip>
  ) : null;

  if (zenMode) {
    return (
      <div className="bg-muted/50 text-muted-foreground px-3 py-0.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <HStack className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
            {isLoading ? (
              <span className="text-muted-foreground/50">Loading...</span>
            ) : (
              <>
                <span className="truncate">{tableDisplayName}</span>
                {!isCustomSql && (
                  <span className="shrink-0">
                    {offset}-{Math.min(props.totalRowCount, offset + limit)} / {props.totalRowCount}
                  </span>
                )}
                {isCustomSql && <span className="shrink-0">{props.totalRowCount} rows</span>}
                {props.timeTaken > 0 && (
                  <span className="text-muted-foreground/70 hidden shrink-0 sm:inline">
                    {props.timeTaken}ms
                  </span>
                )}
              </>
            )}
          </HStack>
          <div className="flex shrink-0 items-center gap-1">
            {!isCustomSql && (
              <Pagination.Root
                count={props.totalRowCount}
                pageSize={limit}
                siblingCount={0}
                page={Math.floor(offset / limit) + 1}
                onPageChange={(details) => {
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, {
                        offset: (details.page - 1) * limit,
                      }),
                  });
                }}
              >
                <div className="flex items-center gap-0.5">
                  <Pagination.PrevTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 px-1">
                      ‹
                    </Button>
                  </Pagination.PrevTrigger>
                  <Pagination.NextTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 px-1">
                      ›
                    </Button>
                  </Pagination.NextTrigger>
                </div>
              </Pagination.Root>
            )}
            <Tooltip
              content={`Refresh rows (last ran at ${DateTime.formatIso(DateTime.unsafeMake(props.ranAt))})`}
            >
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-5 px-1.5">
                <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
              </Button>
            </Tooltip>
            {zenToggle}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/50 text-muted-foreground border-t px-4 py-2 text-xs">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        {/* Left side - Table info */}
        <HStack className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
          {isLoading ? (
            <span className="text-muted-foreground/50">Loading...</span>
          ) : isCustomSql ? (
            <span className="truncate">
              {tableDisplayName}
              <span className="text-muted-foreground hidden sm:inline"> • Custom SQL</span>
            </span>
          ) : (
            <>
              <span className="truncate">
                {tableDisplayName}
                <span className="hidden sm:inline"> ({props.rowsColumnsCount} columns)</span>
              </span>
              <span className="shrink-0">
                {offset}-{Math.min(props.totalRowCount, offset + limit)}{" "}
                <span className="hidden md:inline">out of </span>
                <span className="hidden md:inline">{props.totalRowCount}</span>
              </span>
              {isFetching && !isLoading ? (
                <span
                  className="text-muted-foreground/70 shrink-0"
                  data-testid="table-refetch-indicator"
                >
                  Refreshing…
                </span>
              ) : null}
            </>
          )}
        </HStack>
        {/* Middle - Query time info */}
        <span className="text-muted-foreground hidden text-xs lg:inline">
          {props.timeTaken > 0 && (
            <HStack gap="1" align="center">
              {`${props.timeTaken}ms`}
              <span>•</span>
              <Tooltip content={DateTime.formatIso(DateTime.unsafeMake(props.ranAt))}>
                <span>Loaded {formatRelativeTime(props.ranAt)}</span>
              </Tooltip>
            </HStack>
          )}
        </span>
        {/* Right side - Controls */}
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          {/* Hide pagination and sizing controls for non-SELECT custom SQL */}
          {isCustomSql ? (
            <div className="flex items-center gap-1">
              <span className="mx-2 text-xs">{props.totalRowCount} rows</span>
            </div>
          ) : (
            <>
              {/* Pagination Controls */}
              <Pagination.Root
                count={props.totalRowCount}
                pageSize={limit}
                siblingCount={1}
                page={Math.floor(offset / limit) + 1}
                onPageChange={(details) => {
                  navigate({
                    search: (prev) =>
                      updateTabState(prev, {
                        offset: (details.page - 1) * limit,
                      }),
                  });
                }}
              >
                <Pagination.Context>
                  {(pagination) => (
                    <div className="flex items-center gap-1">
                      <Pagination.PrevTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-1">
                          ‹
                        </Button>
                      </Pagination.PrevTrigger>
                      <span className="mx-2 text-xs">
                        {pagination.page} /{" "}
                        {pagination.totalPages === 0 ? "..." : pagination.totalPages}
                      </span>
                      <Pagination.NextTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-1">
                          ›
                        </Button>
                      </Pagination.NextTrigger>
                    </div>
                  )}
                </Pagination.Context>
              </Pagination.Root>

              <div className="text-foreground flex items-center gap-2">
                <label className="font-medium tracking-wide whitespace-nowrap uppercase">
                  Limit:
                </label>
                <RowsPerPageSelector
                  value={limit}
                  onValueChange={(newLimit: number) => {
                    navigate({
                      search: (prev) =>
                        updateTabState(prev, {
                          limit: newLimit,
                          offset: 0,
                        }),
                    });
                  }}
                />
              </div>
              <div className="text-foreground flex items-center gap-2">
                <ArkSelect.Select
                  className="w-28"
                  value={[tableSize]}
                  collection={TableSizeCollection}
                  positioning={{ sameWidth: true }}
                  onValueChange={(details) => {
                    const newSize = (details.value?.[0] || "cozy") as DataTableSize;
                    navigate({
                      search: (prev) =>
                        updateTabState(prev, {
                          tableSize: newSize,
                        }),
                    });

                    const newSizing: Record<string, number> = {};
                    const defaultSize = getDefaultColumnSize({
                      tableSize: newSize,
                      hasUuid: props.hasUuid,
                    });
                    for (const col of props.table.getAllColumns()) {
                      newSizing[col.id] = defaultSize;
                    }

                    props.table.setColumnSizing(newSizing);
                  }}
                >
                  <ArkSelect.SelectControl>
                    <ArkSelect.SelectTrigger>
                      <ArkSelect.SelectValueText />
                      <ArkSelect.SelectIndicator />
                    </ArkSelect.SelectTrigger>
                  </ArkSelect.SelectControl>
                  <ArkSelect.SelectContent>
                    {TableSizeCollection.items.map((item) => (
                      <ArkSelect.SelectItem key={item.value} item={item}>
                        {item.label}
                      </ArkSelect.SelectItem>
                    ))}
                  </ArkSelect.SelectContent>
                </ArkSelect.Select>
              </div>
              {(joins?.length ?? 0) > 0 && (
                <Tooltip
                  content={prefixWithTable ? "Disable table prefix" : "Prefix columns with table"}
                >
                  <Button
                    variant={prefixWithTable ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      navigate({
                        search: (prev) =>
                          updateTabState(prev, (tab) => ({
                            prefixWithTable: !tab.prefixWithTable,
                          })),
                      });
                    }}
                    className="h-6 px-2"
                    title="Prefix column names by table"
                  >
                    <Layers className="h-3.5 w-3.5" />
                  </Button>
                </Tooltip>
              )}
            </>
          )}

          <Tooltip
            content={`Refresh rows (last ran at ${DateTime.formatIso(DateTime.unsafeMake(props.ranAt))})`}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="h-6 px-2"
              data-testid="table-refresh-button"
            >
              <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            </Button>
          </Tooltip>
          {props.totalRowCount > 0 && !isCustomSql && (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2">
                  <Download className="mr-1 h-3 w-3" />
                  <span className="hidden sm:inline">Export All</span>
                  <span className="sm:hidden">Export</span>
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem value="export-json" onClick={() => props.onExportAll?.("json")}>
                  <MenuItemText>Export as JSON</MenuItemText>
                </MenuItem>
                <MenuItem value="export-csv" onClick={() => props.onExportAll?.("csv")}>
                  <MenuItemText>Export as CSV</MenuItemText>
                </MenuItem>
                <MenuItem value="export-tsv" onClick={() => props.onExportAll?.("tsv")}>
                  <MenuItemText>Export as TSV</MenuItemText>
                </MenuItem>
                <MenuItem value="export-sql" onClick={() => props.onExportAll?.("sql")}>
                  <MenuItemText>Export as INSERT (.sql)</MenuItemText>
                </MenuItem>
                <MenuItem value="copy-insert" onClick={() => props.onExportAll?.("copy-insert")}>
                  <MenuItemText>Copy as INSERT</MenuItemText>
                </MenuItem>
                <MenuItem value="copy-json" onClick={() => props.onExportAll?.("copy-json")}>
                  <MenuItemText>Copy as JSON</MenuItemText>
                </MenuItem>
                <MenuItem value="copy-csv" onClick={() => props.onExportAll?.("copy-csv")}>
                  <MenuItemText>Copy as CSV</MenuItemText>
                </MenuItem>
                <MenuItem value="copy-tsv" onClick={() => props.onExportAll?.("copy-tsv")}>
                  <MenuItemText>Copy as TSV</MenuItemText>
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
          {zenToggle}
        </div>
      </div>
    </div>
  );
};
