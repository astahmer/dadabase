import type { CellContext } from "@tanstack/react-table";

import { memo, useState } from "react";

import { DADABASE_ROW_ID } from "#src/server/introspection/fns/row-identity.ts";

import type { ForeignKeyInfo } from "./data-table/cell-context-menu.tsx";

import { InlineReferencesButton } from "./app/inline-references.button.tsx";
import { CellContextMenu } from "./data-table/cell-context-menu.tsx";
import { formatTableValue } from "./pages/connection-page/format-table-value.ts";
import { InlineCellEditor } from "./pages/connection-page/row-editor/inline-cell-editor.tsx";
import { usePendingCellEdits } from "./pages/connection-page/row-editor/pending-cell-edits-context.tsx";
import { Badge } from "./ui/badge";
import { JsonCell } from "./ui/json-cell";

export interface MemoizedDataCellProps {
  ctx: CellContext<Record<string, unknown>, unknown>;
  col: {
    name: string;
    accessorKey: string;
    dataType: string;
    nullable?: boolean;
    primaryKey?: boolean;
    unique?: boolean;
    isForeignKey?: boolean;
    foreignKey?: ForeignKeyInfo;
  };
  schema?: string;
  table?: string;
  activeConnectionUrl: string;
  /** Primary key column names for the current table (empty = inline edit disabled). */
  primaryKeyColumns?: string[];
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
  primaryKeyColumns = [],
  onFollowFK,
  onFindReferences,
  onShowQuickReferences,
  onPrefetchReferences,
  onNavigateToFK,
  onNavigateToReference,
  onExpandToSheet,
  onMenuOpen,
}: MemoizedDataCellProps) {
  const [editing, setEditing] = useState(false);
  const pendingEdits = usePendingCellEdits();

  const primaryKey: Record<string, unknown> = {};
  if (primaryKeyColumns.length > 0) {
    for (const pk of primaryKeyColumns) {
      primaryKey[pk] = ctx.row.original[pk];
    }
  } else if (ctx.row.original[DADABASE_ROW_ID] != null) {
    primaryKey[DADABASE_ROW_ID] = ctx.row.original[DADABASE_ROW_ID];
  }

  const pendingValue =
    Object.keys(primaryKey).length > 0
      ? pendingEdits?.getPendingValue(primaryKey, col.name)
      : undefined;
  const displayValue = pendingValue !== undefined ? pendingValue : ctx.getValue();
  const hasPending = pendingValue !== undefined;

  const canInlineEdit =
    !col.primaryKey &&
    Object.keys(primaryKey).length > 0 &&
    Boolean(schema) &&
    Boolean(table) &&
    !col.dataType.toLowerCase().includes("json");

  if (editing && canInlineEdit && schema && table) {
    return (
      <div className="flex items-center gap-1" data-column-content={col.name}>
        <InlineCellEditor
          connectionUrl={activeConnectionUrl}
          schema={schema}
          table={table}
          columnName={col.name}
          dataType={col.dataType}
          nullable={col.nullable}
          initialValue={
            pendingValue !== undefined ? pendingValue : ctx.row.original[col.accessorKey]
          }
          primaryKey={primaryKey}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </div>
    );
  }

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
      <span className={hasPending ? "rounded bg-amber-500/15 px-0.5" : undefined}>
        <CellContent value={displayValue} />
        {hasPending ? (
          <Badge colorPalette="warning" size="2xs" variant="subtle" className="ml-1">
            pending
          </Badge>
        ) : null}
      </span>
    </CellContextMenu>
  );

  return (
    <div
      className="group flex items-center gap-1 tabular-nums"
      data-column-content={col.name}
      data-testid={`data-cell-${col.name}`}
      onDoubleClick={(e) => {
        if (!canInlineEdit) return;
        e.preventDefault();
        e.stopPropagation();
        setEditing(true);
      }}
      title={canInlineEdit ? "Double-click to edit" : undefined}
    >
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
    prevProps.col.nullable === nextProps.col.nullable &&
    prevProps.col.primaryKey === nextProps.col.primaryKey &&
    prevProps.col.foreignKey === nextProps.col.foreignKey &&
    prevProps.schema === nextProps.schema &&
    prevProps.table === nextProps.table &&
    prevProps.activeConnectionUrl === nextProps.activeConnectionUrl &&
    prevProps.primaryKeyColumns === nextProps.primaryKeyColumns
  );
});

MemoizedDataCell.displayName = "MemoizedDataCell";
