import type { ForeignKeyInfo } from "#src/components/data-table/cell-context-menu.tsx";
import type { ColumnDef } from "@tanstack/react-table";

import { ColumnHeaderWithInfo } from "#src/components/app/column-header-with-info.tsx";
import { ForeignKeyIcon } from "#src/components/app/foreign-key-icon.tsx";
import { PrimaryKeyIcon } from "#src/components/app/primary-key-icon.tsx";
import { UniqueConstraintIcon } from "#src/components/app/unique-constraint-icon.tsx";
import { MemoizedDataCell } from "#src/components/memoized-data-cell.tsx";
import { JsonCell } from "#src/components/ui/json-cell.tsx";
import { getColumnTextAlignment } from "#src/lib/data-type-utils.ts";
import { getJoinColorClassName } from "#src/lib/join-color-palette.ts";
import { findColumnReferencesWithCountsQueryOptions } from "#src/server/introspection/start-fns/find-column-references.start.ts";
import { getAllTablesColumnsQueryOptions } from "#src/server/introspection/start-fns/get-all-tables-columns.start.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { JoinTablesConfig } from "./join-tables/join-tables.types.ts";

import { useActiveTabState } from "./create-tab-state.ts";

interface ColumnMetadata {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string | null;
  isForeignKey?: boolean;
  foreignKey?: {
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
    constraintName: string;
  };
}

export interface UseRowsColumnsOptions {
  columnMetadata: ColumnMetadata[];
  schema: string;
  table: string;
  activeConnectionUrl: string;
  // TODO rename those; hard to know which does what
  onFollowFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
  onFindReferences?: (columnName: string, cellValue: unknown) => void;
  onShowQuickReferences?: (columnName: string, cellValue: unknown) => void;
  onPrefetchReferences?: (columnName: string, cellValue: unknown) => void;
  onNavigateToFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
  onNavigateToReference?: (
    ref: { schema: string; table: string; column: string },
    cellValue: unknown,
  ) => void;
  onExpandToSheet?: (columnName: string, cellValue: unknown) => void;
  onMenuOpen?: (columnName: string, cellValue: unknown) => void;
  enableSorting?: boolean;
  joins?: JoinTablesConfig["joins"];
}

/**
 * Hook to build data columns with proper metadata display and cell rendering
 * Handles JSON columns, memoized data cells, and all navigation callbacks
 */
export const useRowsColumns = ({
  columnMetadata,
  schema,
  table,
  activeConnectionUrl,
  onFollowFK,
  onFindReferences,
  onShowQuickReferences,
  onPrefetchReferences,
  onNavigateToFK,
  onNavigateToReference,
  onExpandToSheet,
  onMenuOpen,
  enableSorting = true,
  joins,
}: UseRowsColumnsOptions): ColumnDef<Record<string, unknown>>[] => {
  const queryClient = useQueryClient();
  const primaryKeyColumns = useMemo(
    () => columnMetadata.filter((col) => col.primaryKey).map((col) => col.name),
    [columnMetadata],
  );

  const allTablesColumnsQuery = useQuery(
    getAllTablesColumnsQueryOptions({
      url: activeConnectionUrl,
      schema: schema || "",
    }),
  );

  const prefixWithTable = useActiveTabState((tab) => tab.prefixWithTable);
  const joinedTablesColumnsMetadata = useMemo(
    () =>
      (joins ?? []).map((join) => {
        const columnList = (allTablesColumnsQuery.data ?? []).flatMap((tableWithCol) =>
          tableWithCol.table === join.table
            ? tableWithCol.columns
                .filter((col) => (join.columns === "all" ? true : join.columns.includes(col.name)))
                .map((col) => ({
                  ...col,
                  table: join.table,
                  accessorKey: `${join.alias || join.table}.${col.name}`,
                  name: prefixWithTable ? `${join.alias || join.table}.${col.name}` : col.name,
                }))
            : [],
        );

        const tableWithCol = (allTablesColumnsQuery.data ?? [])?.find(
          (t) => t.table === join.table,
        );

        return {
          header: `${join.alias || join.table} (${join.columns === "all" && tableWithCol?.columns.length ? tableWithCol?.columns.length : join.columns.length} columns)`,
          columns: columnList,
        };
      }),
    [joins, allTablesColumnsQuery.data, prefixWithTable],
  );
  const displayedColumns = useMemo(
    () =>
      joins?.length
        ? [
            {
              header: `${table} (${columnMetadata.length} columns)`,
              columns: columnMetadata.map((col) => ({
                ...col,
                table: table,
                accessorKey: `${table}.${col.name}`,
                name: prefixWithTable ? `${table}.${col.name}` : col.name,
              })),
            },
          ].concat(joinedTablesColumnsMetadata)
        : [
            {
              header: table,
              columns: columnMetadata.map((col) => ({
                ...col,
                table: table,
                accessorKey: col.name,
              })),
            },
          ],
    [joins, columnMetadata, joinedTablesColumnsMetadata, table, prefixWithTable],
  );

  return useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!displayedColumns.length) return [];

    const renderColumnList = (
      list: Array<ColumnMetadata & { table: string; accessorKey: string }>,
      joinIndex: number | null = null,
    ) =>
      list.map((col) => {
        const isJoinedTable = joinIndex !== null;
        return {
          id: col.accessorKey,
          accessorFn: (row) => row[col.accessorKey] as string,
          header: () => (
            <ColumnHeaderWithInfo
              columnName={col.name}
              dataType={col.dataType}
              showBadge
              isPrimaryKey={col.primaryKey}
              isUnique={col.unique}
              isForeignKey={col.isForeignKey}
              foreignKey={col.foreignKey}
            >
              <PrimaryKeyIcon isPrimaryKey={col.primaryKey} />
              <UniqueConstraintIcon isUnique={col.unique} />
              <ForeignKeyIcon isForeignKey={col.isForeignKey ?? false} />
            </ColumnHeaderWithInfo>
          ),
          meta: {
            textAlign: getColumnTextAlignment(col.dataType),
            className: isJoinedTable ? getJoinColorClassName(joinIndex!) : undefined,
            table: col.table,
          },
          cell: col.dataType.toLowerCase().includes("json")
            ? (ctx) => <JsonCell value={ctx.row.original[col.accessorKey]} />
            : (ctx) => {
                const cellValue = ctx.row.original[col.accessorKey];
                return (
                  <MemoizedDataCell
                    ctx={ctx}
                    col={col}
                    schema={schema}
                    table={table}
                    activeConnectionUrl={activeConnectionUrl}
                    primaryKeyColumns={primaryKeyColumns}
                    onFollowFK={onFollowFK}
                    onFindReferences={onFindReferences}
                    onShowQuickReferences={() => {
                      onShowQuickReferences?.(col.name, cellValue);
                    }}
                    onPrefetchReferences={() => {
                      const referenceTarget = col.foreignKey
                        ? {
                            referencedSchema: col.foreignKey.referencedSchema,
                            referencedTable: col.foreignKey.referencedTable,
                            referencedColumn: col.foreignKey.referencedColumn,
                          }
                        : {
                            referencedSchema: schema,
                            referencedTable: table,
                            referencedColumn: col.name,
                          };

                      queryClient.prefetchQuery(
                        findColumnReferencesWithCountsQueryOptions({
                          url: activeConnectionUrl,
                          referencedSchema: referenceTarget.referencedSchema,
                          referencedTable: referenceTarget.referencedTable,
                          referencedColumn: referenceTarget.referencedColumn,
                          cellValue,
                        }),
                      );
                      onPrefetchReferences?.(col.name, cellValue);
                    }}
                    onNavigateToFK={onNavigateToFK}
                    onNavigateToReference={onNavigateToReference}
                    onExpandToSheet={() => {
                      onExpandToSheet?.(col.name, cellValue);
                    }}
                    onMenuOpen={() => {
                      const referenceTarget = col.foreignKey
                        ? {
                            referencedSchema: col.foreignKey.referencedSchema,
                            referencedTable: col.foreignKey.referencedTable,
                            referencedColumn: col.foreignKey.referencedColumn,
                          }
                        : {
                            referencedSchema: schema,
                            referencedTable: table,
                            referencedColumn: col.name,
                          };

                      queryClient.prefetchQuery(
                        findColumnReferencesWithCountsQueryOptions({
                          url: activeConnectionUrl,
                          referencedSchema: referenceTarget.referencedSchema,
                          referencedTable: referenceTarget.referencedTable,
                          referencedColumn: referenceTarget.referencedColumn,
                          cellValue,
                        }),
                      );
                      onMenuOpen?.(col.name, cellValue);
                    }}
                  />
                );
              },
          enableResizing: true,
          enableSorting,
        } as ColumnDef<any> as any;
      });
    if (displayedColumns.length === 1) {
      return renderColumnList(displayedColumns[0].columns, null);
    }

    return displayedColumns.map((col, index) => ({
      header: col.header,
      columns: renderColumnList(col.columns, index > 0 ? index - 1 : null),
      meta: {
        className: index > 0 ? getJoinColorClassName(index - 1) : undefined,
      },
    }));
  }, [
    displayedColumns,
    schema,
    table,
    activeConnectionUrl,
    enableSorting,
    queryClient,
    onFollowFK,
    onFindReferences,
    onNavigateToReference,
    onNavigateToFK,
    onShowQuickReferences,
    onPrefetchReferences,
    onExpandToSheet,
    onMenuOpen,
    primaryKeyColumns,
  ]);
};
