import { Popover } from "@ark-ui/react/popover";
import { ChevronsUpDown, Copy, Download, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

import type { StructureFilters } from "./use-structure-filter-state.ts";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { HStack } from "../../ui/layout.tsx";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../../ui/menu.tsx";
import { hasActiveStructureFilters, useStructureFilters } from "./use-structure-filter-state.ts";

const filterOptions: Array<{
  key: keyof Omit<StructureFilters, "search">;
  label: string;
}> = [
  { key: "nullable", label: "Nullable" },
  { key: "primaryKey", label: "Primary Key" },
  { key: "unique", label: "Unique" },
  { key: "foreignKey", label: "Foreign Key" },
  { key: "hasDefaults", label: "Has Defaults" },
];

interface StructureFilterControlsProps {
  columnMetadata?: Array<TableColumnMetadata>;
  schema?: string;
  table?: string;
  onCreateTable?: () => void;
  onAddColumn?: () => void;
  onDropTable?: () => void;
  onImportData?: () => void;
  onSchemaDiff?: () => void;
  onCreateIndex?: () => void;
  isReadOnly?: boolean;
}

/**
 * Structure filter controls with search input and dropdown for filter options
 */
export const StructureFilterControls = (props: StructureFilterControlsProps = {}) => {
  const { filters, updateFilters, clearFilters } = useStructureFilters();
  const {
    columnMetadata,
    schema,
    table,
    onCreateTable,
    onAddColumn,
    onDropTable,
    onImportData,
    onSchemaDiff,
    onCreateIndex,
    isReadOnly = false,
  } = props;
  const hasFilters = hasActiveStructureFilters(filters);
  const [open, setOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounce search input to avoid excessive re-renders
  useEffect(() => {
    debounceTimerRef.current = setTimeout(() => {
      updateFilters({ search: debouncedSearch });
    }, 300);

    return () => {
      if (debounceTimerRef.current !== undefined) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [debouncedSearch, updateFilters]);

  const activeCount = filterOptions.reduce((count, opt) => {
    return count + (filters[opt.key] ? 1 : 0);
  }, 0);

  const handleExportJSON = () => {
    const data = {
      schema,
      table,
      exportedAt: new Date().toISOString(),
      columns: columnMetadata || [],
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema}-${table}-structure-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    const data = {
      schema,
      table,
      exportedAt: new Date().toISOString(),
      columns: columnMetadata || [],
    };

    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json);
  };

  const handleExportCSV = () => {
    const rows: string[] = [];
    rows.push("Column Name,Data Type,Nullable,Primary Key,Unique,Default Value,Foreign Key");

    for (const col of columnMetadata || []) {
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
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema}-${table}-structure-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyCSV = () => {
    const rows: string[] = [];
    rows.push("Column Name,Data Type,Nullable,Primary Key,Unique,Default Value,Foreign Key");

    for (const col of columnMetadata || []) {
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

  return (
    <HStack className="ml-auto gap-2">
      {(onCreateTable || onAddColumn || onCreateIndex || onDropTable || onImportData) && (
        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={isReadOnly}
              title={isReadOnly ? "This connection is read-only" : "Change this table's schema"}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              Schema actions
            </Button>
          </MenuTrigger>
          <MenuContent className="z-100 min-w-48">
            {onCreateTable && (
              <MenuItem
                value="schema-create-table"
                onClick={onCreateTable}
                data-testid="schema-create-table"
              >
                <Plus className="h-3.5 w-3.5" />
                Create table
              </MenuItem>
            )}
            {onAddColumn && table && (
              <MenuItem
                value="schema-add-column"
                onClick={onAddColumn}
                data-testid="schema-add-column"
              >
                <Plus className="h-3.5 w-3.5" />
                Add column
              </MenuItem>
            )}
            {onCreateIndex && table && (
              <MenuItem
                value="schema-create-index"
                onClick={onCreateIndex}
                data-testid="schema-create-index"
              >
                <Plus className="h-3.5 w-3.5" />
                Create index
              </MenuItem>
            )}
            {onImportData && table && (
              <MenuItem value="import-data" onClick={onImportData} data-testid="import-data">
                Import rows
              </MenuItem>
            )}
            {onDropTable && table && (
              <>
                <MenuSeparator />
                <MenuItem
                  value="schema-drop-table"
                  onClick={onDropTable}
                  data-testid="schema-drop-table"
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Drop table…
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>
      )}
      {onSchemaDiff && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={onSchemaDiff}
          data-testid="schema-diff"
        >
          Diff
        </Button>
      )}

      {/* Search Input */}
      <Input
        placeholder="Search columns, types..."
        value={debouncedSearch}
        onChange={(e) => setDebouncedSearch(e.target.value)}
        className="h-8 w-48 text-sm"
      />

      {/* Filters Dropdown */}
      <Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
        <Popover.Trigger asChild>
          <Button variant="outline" size="sm" className="h-8 justify-between gap-1 px-2">
            <span className="text-foreground text-xs font-medium">
              Filters {activeCount > 0 ? `(${activeCount})` : ""}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content className="bg-card border-border z-50 min-w-56 rounded-md border shadow-lg">
            <div className="space-y-1 p-2">
              {filterOptions.map((option) => (
                <label
                  key={option.key}
                  className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters[option.key]}
                    onChange={(e) =>
                      updateFilters({
                        [option.key]: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <span className="flex-1">{option.label}</span>
                </label>
              ))}
            </div>
            {hasFilters && (
              <div className="border-border border-t px-2 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearFilters();
                    setOpen(false);
                  }}
                  className="text-muted-foreground hover:text-foreground h-7 w-full gap-2 text-xs"
                >
                  <X className="h-3 w-3" />
                  Clear All
                </Button>
              </div>
            )}
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>

      {/* Export Menu */}
      {schema && table && (
        <Menu>
          <MenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </MenuTrigger>
          <MenuContent className="z-100">
            <MenuItem onClick={handleCopyJSON} value="copy-json">
              <Copy className="mr-2 h-4 w-4" />
              Copy as JSON
            </MenuItem>
            <MenuItem onClick={handleCopyCSV} value="copy-csv">
              <Copy className="mr-2 h-4 w-4" />
              Copy as CSV
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={handleExportJSON} value="export-json">
              <Download className="mr-2 h-4 w-4" />
              Download as JSON
            </MenuItem>
            <MenuItem onClick={handleExportCSV} value="export-csv">
              <Download className="mr-2 h-4 w-4" />
              Download as CSV
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
    </HStack>
  );
};
