import type { CellContext } from "@tanstack/react-table";

import { memo } from "react";

import type { ForeignKeyInfo } from "./data-table/cell-context-menu.tsx";

import { InlineReferencesButton } from "./app/inline-references.button.tsx";
import { CellContextMenu } from "./data-table/cell-context-menu.tsx";
import { formatTableValue } from "./pages/connection-page/format-table-value.ts";
import { Badge } from "./ui/badge";
import { JsonCell } from "./ui/json-cell";

export interface MemoizedDataCellProps {
  ctx: CellContext<Record<string, unknown>, unknown>;
  col: {
    name: string;
    accessorKey: string;
    dataType: string;
    primaryKey?: boolean;
    unique?: boolean;
    isForeignKey?: boolean;
    foreignKey?: ForeignKeyInfo;
  };
  schema?: string;
  table?: string;
  activeConnectionUrl: string;
  onFollowFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
  onFindReferences?: (columnName: string, cellValue: unknown) => void;
  onShowQuickReferences?: () => void;
  onPrefetchReferences: () => void;
  onNavigateToFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
  onNavigateToReference?: (
    ref: { schema: string; table: string; column: string },
    cellValue: unknown,
  ) => void;
  onExpandToSheet?: () => void;
  onMenuOpen?: () => void;
}

const CellContent = ({ value }: { value: unknown }) => {
  // Handle boolean values with colored badges
  if (typeof value === "boolean") {
    return (
      <Badge colorPalette={value ? "success" : "error"} size="xs">
        {value ? "true" : "false"}
      </Badge>
    );
  }
  // Handle null/undefined with a neutral badge
  if (value === null || value === undefined) {
    return (
      <Badge colorPalette="muted" size="2xs" variant="subtle">
        {value === null ? "NULL" : "undefined"}
      </Badge>
    );
  }

  if (typeof value === "object" && value !== null && !(value instanceof Date)) {
    return <JsonCell value={value} />;
  }

  return formatTableValue(value) as string;
};

function MemoizedDataCellInner({
  ctx,
  col,
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
}: MemoizedDataCellProps) {
  const CellValue = (
    <CellContextMenu
      cellValue={ctx.row.original[col.accessorKey]}
      columnName={col.name}
      foreignKey={col.foreignKey}
      primaryKey={col.primaryKey}
      onFollowFK={onFollowFK}
      onFindReferences={onFindReferences}
      onShowQuickReferences={onShowQuickReferences}
      onOpen={onMenuOpen}
    >
      <CellContent value={ctx.getValue()} />
    </CellContextMenu>
  );

  return (
    <div className="group flex items-center gap-1 tabular-nums" data-column-content={col.name}>
      {table &&
      schema &&
      ctx.row.original[col.accessorKey] &&
      (col.foreignKey || col.primaryKey) ? (
        <InlineReferencesButton
          schema={schema}
          table={table}
          columnName={col.name}
          columnDataType={col.dataType}
          reference={col.foreignKey}
          cellValue={ctx.row.original[col.accessorKey]}
          connectionUrl={activeConnectionUrl}
          onPrefetchReferences={onPrefetchReferences}
          onNavigateToFK={onNavigateToFK}
          onNavigateToReference={onNavigateToReference}
          onExpandToSheet={onExpandToSheet}
          children={CellValue}
        />
      ) : (
        CellValue
      )}
    </div>
  );
}

export const MemoizedDataCell = memo(MemoizedDataCellInner, (prevProps, nextProps) => {
  // Custom comparison function for memoization
  // Only re-render if the actual cell value, column definition, or essential props change
  return (
    prevProps.ctx.row.id === nextProps.ctx.row.id &&
    prevProps.ctx.row.original[prevProps.col.name] ===
      nextProps.ctx.row.original[nextProps.col.name] &&
    prevProps.col.name === nextProps.col.name &&
    prevProps.col.dataType === nextProps.col.dataType &&
    prevProps.col.primaryKey === nextProps.col.primaryKey &&
    prevProps.col.foreignKey === nextProps.col.foreignKey &&
    prevProps.schema === nextProps.schema &&
    prevProps.table === nextProps.table &&
    prevProps.activeConnectionUrl === nextProps.activeConnectionUrl
  );
});

MemoizedDataCell.displayName = "MemoizedDataCell";
