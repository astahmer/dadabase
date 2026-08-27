import { MoreHorizontal } from "lucide-react";
import { useMemo } from "react";

import type { ColumnDef } from "#src/lib/tanstack-table.ts";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

import type { DataTableSize } from "../../data-table/data-table.styles.ts";
import type { StructureFilters } from "./use-structure-filter-state.ts";

import { DataTypeBadge } from "../../app/data-type-badge.tsx";
import { PrimaryKeyIcon } from "../../app/primary-key-icon.tsx";
import { UniqueConstraintIcon } from "../../app/unique-constraint-icon.tsx";
import { DataTable } from "../../data-table/data-table.tsx";
import { useDataTable } from "../../data-table/use-data-table.ts";
import { Button } from "../../ui/button.tsx";
import { HStack } from "../../ui/layout.tsx";
import { Menu, MenuContent, MenuItem, MenuItemText, MenuTrigger } from "../../ui/menu.tsx";

interface StructureTableProps {
  columnMetadata: Array<TableColumnMetadata>;
  isLoading: boolean;
  tableSize: DataTableSize;
  filters?: StructureFilters;
  onEditColumn?: (column: TableColumnMetadata) => void;
  onDropColumn?: (column: TableColumnMetadata) => void;
  /** When false, hide Edit column (e.g. SQLite) */
  canAlterColumn?: boolean;
}

const filterColumnMetadata = (
  columns: StructureTableProps["columnMetadata"],
  filters: StructureFilters | undefined,
): StructureTableProps["columnMetadata"] => {
  if (!filters) return columns;

  return columns.filter((col) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        col.name.toLowerCase().includes(searchLower) ||
        col.dataType.toLowerCase().includes(searchLower) ||
        (col.foreignKey &&
          `${col.foreignKey.referencedSchema}.${col.foreignKey.referencedTable}.${col.foreignKey.referencedColumn}`
            .toLowerCase()
            .includes(searchLower));

      if (!matchesSearch) return false;
    }

    if (filters.nullable && !col.nullable) return false;
    if (filters.primaryKey && !col.primaryKey) return false;
    if (filters.unique && !col.unique) return false;
    if (filters.foreignKey && !col.isForeignKey) return false;
    if (filters.hasDefaults && !col.defaultValue) return false;

    return true;
  });
};

export const StructureTable = (props: StructureTableProps) => {
  const { columnMetadata, filters, onEditColumn, onDropColumn, canAlterColumn = true } = props;

  const filteredMetadata = useMemo(
    () => filterColumnMetadata(columnMetadata, filters),
    [columnMetadata, filters],
  );

  const columns = useMemo(() => {
    const base = [...structureColumns];
    if (onEditColumn || onDropColumn) {
      base.push({
        id: "__schema_actions",
        header: "",
        size: 44,
        minSize: 44,
        maxSize: 44,
        enableResizing: false,
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original as TableColumnMetadata;
          return (
            <Menu>
              <MenuTrigger asChild>
                <Button
                  size="xs"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  aria-label={`Column actions for ${row.name}`}
                  data-testid={`schema-column-actions-${row.name}`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                {canAlterColumn && onEditColumn && (
                  <MenuItem
                    value="edit"
                    onClick={() => onEditColumn(row)}
                    data-testid={`schema-column-edit-${row.name}`}
                  >
                    <MenuItemText>Edit column</MenuItemText>
                  </MenuItem>
                )}
                {onDropColumn && (
                  <MenuItem
                    value="drop"
                    onClick={() => onDropColumn(row)}
                    data-testid={`schema-column-drop-${row.name}`}
                  >
                    <MenuItemText>Drop column</MenuItemText>
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          );
        },
      } as ColumnDef<TableColumnMetadata>);
    }
    return base;
  }, [onEditColumn, onDropColumn, canAlterColumn]);

  const structureTable = useDataTable({
    data: filteredMetadata,
    columns,
    getRowId: (row) => row.name,
    manualPagination: true,
  });

  return (
    <DataTable
      table={structureTable}
      isLoading={props.isLoading}
      size={props.tableSize}
      enableColumnOrdering={false}
      enableRowVirtualization
      enableColumnVirtualization
    />
  );
};

const structureColumns: Array<ColumnDef<TableColumnMetadata>> = [
  {
    accessorKey: "name",
    header: "Name",
    enableResizing: true,
  },
  {
    accessorKey: "dataType",
    header: "Data Type",
    size: 120,
    minSize: 80,
    maxSize: 200,
    enableResizing: true,
    cell: (info) => (
      <div className="flex items-center gap-2">
        <DataTypeBadge dataType={info.getValue<string>()} />
        <span className="text-muted-foreground font-mono text-xs">{info.getValue<string>()}</span>
      </div>
    ),
  },
  {
    accessorKey: "nullable",
    header: "Nullable",
    enableResizing: true,
    cell: (info) => <span className="text-xs">{info.getValue<boolean>() ? "Yes" : "No"}</span>,
  },
  {
    accessorKey: "primaryKey",
    header: "Primary Key",
    enableResizing: true,
    cell: (info) => (
      <HStack className="text-xs">
        {info.getValue<boolean>() ? "Yes" : "No"}
        <PrimaryKeyIcon isPrimaryKey={info.getValue<boolean>()} />
      </HStack>
    ),
  },
  {
    accessorKey: "unique",
    header: "Unique",
    enableResizing: true,
    cell: (info) => (
      <HStack className="text-xs">
        {info.getValue<boolean>() ? "Yes" : "No"}
        <UniqueConstraintIcon isUnique={info.getValue<boolean>()} />
      </HStack>
    ),
  },
  {
    id: "foreignKey",
    header: "Foreign Key",
    enableResizing: true,
    cell: (info) => {
      const row = info.row.original;
      if (!row.isForeignKey || !row.foreignKey) {
        return <span className="text-muted-foreground text-xs">—</span>;
      }
      const fk = row.foreignKey;
      return (
        <span className="font-mono text-xs">
          {fk.referencedSchema ? `${fk.referencedSchema}.` : ""}
          {fk.referencedTable}.{fk.referencedColumn}
        </span>
      );
    },
  },
  {
    accessorKey: "defaultValue",
    header: "Default Value",
    enableResizing: true,
    cell: (info) => {
      const value = info.getValue<string | null>();
      return <span className="font-mono text-xs">{value ? value : "—"}</span>;
    },
  },
];
