import { CheckboxLabel } from "@ark-ui/react";
import { createListCollection } from "@ark-ui/react/combobox";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Copy, Download, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "#src/components/ui/menu.tsx";
import { getTablesStructuresQueryOptions } from "#src/server/introspection/start-fns/get-tables-structures.start.ts";

import type { DataTableSize } from "../../data-table/data-table.styles.ts";

import { Button } from "../../ui/button";
import { Checkbox, CheckboxControl } from "../../ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "../../ui/combobox.tsx";
import { HStack, Stack } from "../../ui/layout.tsx";
import { Spinner } from "../../ui/spinner.tsx";
import { Tooltip } from "../../ui/tooltip.tsx";
import { VirtualizerArea } from "../../ui/virtualizer-area.tsx";
import { addTabStateAfterCurrent, createTabState, scrollToTab } from "./create-tab-state.ts";
import { StructureTable } from "./structure-table.tsx";
import { getDefaultStructureFilters } from "./use-structure-filter-state.ts";

interface MultiTableStructureViewerProps {
  activeConnectionUrl: string;
  connectionName: string;
  schema: string;
  tableSize: DataTableSize;
}

export const MultiTableStructureViewer = (props: MultiTableStructureViewerProps) => {
  const { activeConnectionUrl, connectionName, schema, tableSize } = props;
  const navigate = useNavigate();
  const filters = getDefaultStructureFilters();

  // Fetch all table structures
  const tablesStructuresQuery = useQuery({
    ...getTablesStructuresQueryOptions({
      url: activeConnectionUrl,
      schema,
    }),
    retry: 2,
  });

  const tableStructures = tablesStructuresQuery.data || [];
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Create combobox collection from table names
  const tableCollection = useMemo(() => {
    return createListCollection({
      items: tableStructures
        .filter((t) => t.table.includes(searchFilter))
        .map((t) => ({
          label: t.table,
          value: t.table,
        })),
    });
  }, [tableStructures, searchFilter]);

  // Filter tables by search and selection
  const filteredTables = useMemo(() => {
    let tables = tableStructures;

    // Apply search filter
    if (searchFilter) {
      const lower = searchFilter.toLowerCase();
      tables = tables.filter((t) => t.table.toLowerCase().includes(lower));
    }

    // Apply selected-only filter
    if (showSelectedOnly && selectedTables.length > 0) {
      tables = tables.filter((t) => selectedTables.includes(t.table));
    }

    return tables;
  }, [tableStructures, searchFilter, showSelectedOnly, selectedTables]);

  const getTablesToExport = () => {
    return selectedTables.length > 0
      ? filteredTables.filter((t) => selectedTables.includes(t.table))
      : filteredTables;
  };
  const exportScope =
    selectedTables.length > 0
      ? `${selectedTables.length} selected table${selectedTables.length === 1 ? "" : "s"}`
      : `${filteredTables.length} visible table${filteredTables.length === 1 ? "" : "s"}`;

  // Measure actual DOM heights for accurate virtualization
  const measureElement = (element: HTMLElement) => {
    return element?.getBoundingClientRect().height ?? 300;
  };

  const handleExportJSON = () => {
    const tablesToExport = getTablesToExport();
    const data = {
      schema,
      exportedAt: new Date().toISOString(),
      tables: tablesToExport.map((table) => ({
        name: table.table,
        columns: table.columns,
      })),
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema}-structure-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    const tablesToExport = getTablesToExport();
    const data = {
      schema,
      exportedAt: new Date().toISOString(),
      tables: tablesToExport.map((table) => ({
        name: table.table,
        columns: table.columns,
      })),
    };

    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json);
  };

  const handleExportCSV = () => {
    const tablesToExport = getTablesToExport();
    const rows: string[] = [];
    rows.push("Table,Column Name,Data Type,Nullable,Primary Key,Unique,Default Value,Foreign Key");

    for (const table of tablesToExport) {
      for (const col of table.columns) {
        const fkRef = col.foreignKey
          ? `${col.foreignKey.referencedSchema}.${col.foreignKey.referencedTable}.${col.foreignKey.referencedColumn}`
          : "";
        const row = [
          `"${table.table}"`,
          `"${col.name}"`,
          `"${col.dataType}"`,
          col.nullable ? "Yes" : "No",
          col.primaryKey ? "Yes" : "No",
          col.unique ? "Yes" : "No",
          `"${col.defaultValue ?? ""}"`,
          `"${fkRef}"`,
        ];
        rows.push(row.join(","));
      }
    }

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema}-structure-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyCSV = () => {
    const tablesToExport = getTablesToExport();
    const rows: string[] = [];
    rows.push("Table,Column Name,Data Type,Nullable,Primary Key,Unique,Default Value,Foreign Key");

    for (const table of tablesToExport) {
      for (const col of table.columns) {
        const fkRef = col.foreignKey
          ? `${col.foreignKey.referencedSchema}.${col.foreignKey.referencedTable}.${col.foreignKey.referencedColumn}`
          : "";
        const row = [
          `"${table.table}"`,
          `"${col.name}"`,
          `"${col.dataType}"`,
          col.nullable ? "Yes" : "No",
          col.primaryKey ? "Yes" : "No",
          col.unique ? "Yes" : "No",
          `"${col.defaultValue ?? ""}"`,
          `"${fkRef}"`,
        ];
        rows.push(row.join(","));
      }
    }

    const csv = rows.join("\n");
    navigator.clipboard.writeText(csv);
  };

  const copySingleTableName = (tableName: string) => {
    navigator.clipboard.writeText(tableName);
  };

  const copySingleTableJSON = (tableStructure: (typeof tableStructures)[0]) => {
    const data = {
      table: tableStructure.table,
      schema,
      columns: tableStructure.columns,
    };

    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json);
  };

  const copySingleTableCSV = (tableStructure: (typeof tableStructures)[0]) => {
    const rows: string[] = [];
    rows.push("Column Name,Data Type,Nullable,Primary Key,Unique,Default Value,Foreign Key");

    for (const col of tableStructure.columns) {
      const fkRef = col.foreignKey
        ? `${col.foreignKey.referencedSchema}.${col.foreignKey.referencedTable}.${col.foreignKey.referencedColumn}`
        : "";
      const row = [
        `"${col.name}"`,
        `"${col.dataType}"`,
        col.nullable ? "Yes" : "No",
        col.primaryKey ? "Yes" : "No",
        col.unique ? "Yes" : "No",
        `"${col.defaultValue ?? ""}"`,
        `"${fkRef}"`,
      ];
      rows.push(row.join(","));
    }

    const csv = rows.join("\n");
    navigator.clipboard.writeText(csv);
  };

  const viewTableRows = (tableName: string) => {
    const newTabState = createTabState(schema, tableName);
    navigate({
      to: "/connections/$connectionName",
      params: { connectionName },
      search: (prev) => ({
        ...prev,
        ...addTabStateAfterCurrent({ ...prev, tabs: prev.tabs ?? [] }, newTabState),
        activeTabId: newTabState.tabId,
        schemaExplorerOpen: false,
      }),
    }).then(() => scrollToTab(newTabState.tabId));
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Header with search and filters */}
      <HStack className="items-end gap-2">
        <div className="flex-1">
          <Combobox
            collection={tableCollection}
            value={selectedTables}
            onValueChange={(details) => setSelectedTables(details.value)}
            onInputValueChange={(details) => setSearchFilter(details.inputValue)}
            multiple
            closeOnSelect={false}
            openOnClick
            allowCustomValue
          >
            <ComboboxControl size="sm">
              <ComboboxInput placeholder="Filter tables..." aria-label="Filter tables" />
              <ComboboxTrigger />
            </ComboboxControl>
            <ComboboxContent>
              <ComboboxList>
                {tableCollection.items.map((item) => (
                  <ComboboxItem key={item.value} item={item} className="flex items-center gap-2">
                    <Checkbox checked={selectedTables.includes(item.value)} readOnly />
                    <span>{item.label}</span>
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        {/* Selection menu */}
        {filteredTables.length > 0 && selectedTables.length > 0 && (
          <Menu>
            <MenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                {selectedTables.length} selected
              </Button>
            </MenuTrigger>
            <MenuContent className="z-100">
              <MenuItem
                onClick={() => setSelectedTables(filteredTables.map((t) => t.table))}
                value="select-all"
              >
                Select all ({filteredTables.length})
              </MenuItem>
              <MenuItem onClick={() => setSelectedTables([])} value="deselect-all">
                Clear selection
              </MenuItem>
            </MenuContent>
          </Menu>
        )}

        {/* Show selected only toggle */}
        {selectedTables.length > 0 && (
          <Button
            variant={showSelectedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowSelectedOnly(!showSelectedOnly)}
            className="h-8"
          >
            {showSelectedOnly ? `Showing ${selectedTables.length} selected` : "Show selected only"}
          </Button>
        )}

        {/* <StructureFilterControls /> */}

        {/* Export menu */}
        <Menu>
          <MenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <Download className="h-4 w-4" />
              Export visible
            </Button>
          </MenuTrigger>
          <MenuContent className="z-100">
            <MenuItem onClick={handleCopyJSON} value="copy-json">
              <Copy className="mr-2 h-4 w-4" />
              Copy {exportScope} as JSON
            </MenuItem>
            <MenuItem onClick={handleCopyCSV} value="copy-csv">
              <Copy className="mr-2 h-4 w-4" />
              Copy {exportScope} as CSV
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={handleExportJSON} value="export-json">
              <Download className="mr-2 h-4 w-4" />
              Download {exportScope} as JSON
            </MenuItem>
            <MenuItem onClick={handleExportCSV} value="export-csv">
              <Download className="mr-2 h-4 w-4" />
              Download {exportScope} as CSV
            </MenuItem>
          </MenuContent>
        </Menu>
      </HStack>

      {/* Tables list */}
      {tablesStructuresQuery.isLoading ? (
        <Stack className="flex flex-1 items-center justify-center">
          <Spinner />
          <span className="text-muted-foreground text-sm">Loading table structures...</span>
        </Stack>
      ) : tablesStructuresQuery.isError ? (
        <div className="text-destructive bg-destructive/10 rounded p-4 text-sm">
          Failed to load table structures. Please try again.
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          {searchFilter ? "No tables match your search" : "No tables found in this schema"}
        </div>
      ) : (
        <VirtualizerArea
          count={filteredTables.length}
          className="border-border flex-1 overflow-auto rounded-md border"
          virtualizerOptions={{
            estimateSize: () => 300, // Initial estimate, will be replaced by measured heights
            measureElement: measureElement,
            overscan: 3,
          }}
        >
          {({ virtualItems, totalSize, paddingTop, paddingBottom }) => (
            <div style={{ height: `${totalSize}px` }} className="relative">
              {/* Padding for virtualizer */}
              {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}

              {virtualItems.map((virtualItem) => {
                const tableStructure = filteredTables[virtualItem.index];
                if (!tableStructure) return null;

                const isSelected = selectedTables.includes(tableStructure.table);

                return (
                  <div
                    key={virtualItem.key}
                    className="p-4"
                    data-virtualizer-index={virtualItem.index}
                  >
                    <div
                      className={`rounded-lg border p-4 transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const newSelected = checked.checked
                              ? [...selectedTables, tableStructure.table]
                              : selectedTables.filter((t) => t !== tableStructure.table);
                            setSelectedTables(newSelected);
                          }}
                          className="mt-1"
                        >
                          <HStack align="center">
                            <CheckboxControl />
                            <CheckboxLabel>
                              <HStack align="center">
                                <h3 className="text-sm font-semibold select-text">
                                  {tableStructure.table}
                                </h3>
                                <span className="text-muted-foreground text-xs">
                                  ({tableStructure.columns.length} columns)
                                </span>
                              </HStack>
                            </CheckboxLabel>
                          </HStack>
                        </Checkbox>
                        <div className="flex gap-2">
                          <Tooltip content="Open table rows">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => viewTableRows(tableStructure.table)}
                              aria-label={`Open ${tableStructure.table} rows`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                          <Menu>
                            <MenuTrigger asChild>
                              <Tooltip content="Copy table structure">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  aria-label={`Copy ${tableStructure.table} structure`}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </Tooltip>
                            </MenuTrigger>
                            <MenuContent className="z-100">
                              <MenuItem
                                onClick={() => copySingleTableName(tableStructure.table)}
                                value="copy-name"
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy table name
                              </MenuItem>
                              <MenuSeparator />
                              <MenuItem
                                onClick={() => copySingleTableJSON(tableStructure)}
                                value="copy-json"
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy structure as JSON
                              </MenuItem>
                              <MenuItem
                                onClick={() => copySingleTableCSV(tableStructure)}
                                value="copy-csv"
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy structure as CSV
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        </div>
                      </div>
                      <div className="hidden overflow-auto md:block">
                        <StructureTable
                          columnMetadata={tableStructure.columns}
                          isLoading={false}
                          tableSize={tableSize}
                          filters={filters}
                        />
                      </div>
                      <div className="space-y-2 md:hidden">
                        {tableStructure.columns.map((column) => (
                          <div
                            key={column.name}
                            className="border-border/70 bg-muted/20 rounded-md border p-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-xs font-medium">
                                  {column.name}
                                </p>
                                <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                                  {column.dataType}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap justify-end gap-1 text-[10px]">
                                {column.primaryKey ? (
                                  <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5">
                                    PK
                                  </span>
                                ) : null}
                                {column.unique ? (
                                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                                    Unique
                                  </span>
                                ) : null}
                                {column.nullable ? (
                                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                                    Nullable
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="text-muted-foreground mt-2 grid gap-1 text-[11px]">
                              {column.foreignKey ? (
                                <span className="truncate">
                                  References {column.foreignKey.referencedTable}.
                                  {column.foreignKey.referencedColumn}
                                </span>
                              ) : null}
                              {column.defaultValue ? (
                                <span className="truncate">Default: {column.defaultValue}</span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Padding for virtualizer */}
              {paddingBottom > 0 && <div style={{ height: `${paddingBottom}px` }} />}
            </div>
          )}
        </VirtualizerArea>
      )}

      {/* Summary with selection info */}
      {!tablesStructuresQuery.isLoading && (
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>
            Showing {filteredTables.length} of {tableStructures.length} table
            {tableStructures.length !== 1 ? "s" : ""}
            {selectedTables.length > 0 && ` (${selectedTables.length} selected)`}
          </span>
          {selectedTables.length > 0 && (
            <button
              onClick={() => setSelectedTables([])}
              className="text-muted-foreground hover:text-foreground text-xs underline"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
};
