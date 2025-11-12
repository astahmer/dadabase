# Relationship Subrows - Implementation Details & Code Examples

## Type Definitions

### Core Types

```typescript
// src/types.ts or src/types/relationships.ts

export interface RelationshipMetadata {
  /** The FK column in the referencing table */
  referencingColumn: string;

  /** The table that has the FK (references this table) */
  referencingTable: string;

  /** Schema of the referencing table */
  referencingSchema: string;

  /** The PK column being referenced */
  referencedColumn: string;

  /** The table being referenced (current table) */
  referencedTable: string;

  /** Schema of the referenced table */
  referencedSchema: string;

  /** Constraint name for uniqueness */
  constraintName: string;

  /** Human-readable label for the relationship */
  displayLabel: string;
}

export interface RelationshipSubrowQuery {
  schema: string;
  table: string;
  column: string;
  parentValue: unknown;
  limit?: number;
  offset?: number;
}

/** Tracks expansion state per row per relationship */
export interface RowRelationshipExpansionState {
  [rowId: string]: Set<string>; // constraintName
}
```

## Hook: useTableRelationships

```typescript
// src/hooks/use-table-relationships.ts

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface UseTableRelationshipsOptions {
  url: string;
  schema: string;
  table: string;
  enabled?: boolean;
}

interface UseTableRelationshipsResult {
  incomingReferences: RelationshipMetadata[];
  outgoingForeignKeys: RelationshipMetadata[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Fetch all relationships for a table
 * - Incoming: tables that reference this table (common use case)
 * - Outgoing: tables this table references (less common)
 */
export const useTableRelationships = ({
  url,
  schema,
  table,
  enabled = true,
}: UseTableRelationshipsOptions): UseTableRelationshipsResult => {
  // Query incoming references (tables that have FK pointing to us)
  const incomingQuery = useQuery({
    queryKey: ["table-relationships", "incoming", url, schema, table],
    queryFn: async () => {
      const response = await fetch("/api/relationships/incoming", {
        method: "POST",
        body: JSON.stringify({ url, schema, table }),
      });
      return response.json() as Promise<RelationshipMetadata[]>;
    },
    enabled: enabled && !!url && !!schema && !!table,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query outgoing foreign keys (tables we reference)
  const outgoingQuery = useQuery({
    queryKey: ["table-relationships", "outgoing", url, schema, table],
    queryFn: async () => {
      const response = await fetch("/api/relationships/outgoing", {
        method: "POST",
        body: JSON.stringify({ url, schema, table }),
      });
      return response.json() as Promise<RelationshipMetadata[]>;
    },
    enabled: enabled && !!url && !!schema && !!table,
    staleTime: 5 * 60 * 1000,
  });

  return {
    incomingReferences: incomingQuery.data ?? [],
    outgoingForeignKeys: outgoingQuery.data ?? [],
    isLoading: incomingQuery.isLoading || outgoingQuery.isLoading,
    isError: incomingQuery.isError || outgoingQuery.isError,
    error: incomingQuery.error || outgoingQuery.error || null,
  };
};
```

## Hook: useRelationshipExpansionState

```typescript
// src/hooks/use-relationship-expansion-state.ts

import { useCallback, useState } from "react";

interface UseRelationshipExpansionStateResult {
  expandedState: RowRelationshipExpansionState;
  toggleExpansion: (rowId: string, relationshipId: string) => void;
  isExpanded: (rowId: string, relationshipId: string) => boolean;
  expandRelationship: (rowId: string, relationshipId: string) => void;
  collapseRelationship: (rowId: string, relationshipId: string) => void;
  collapseAllForRow: (rowId: string) => void;
}

export const useRelationshipExpansionState = (): UseRelationshipExpansionStateResult => {
  const [expandedState, setExpandedState] = useState<RowRelationshipExpansionState>({});

  const toggleExpansion = useCallback(
    (rowId: string, relationshipId: string) => {
      setExpandedState((prev) => {
        const rowExpanded = prev[rowId] ?? new Set();
        const newSet = new Set(rowExpanded);

        if (newSet.has(relationshipId)) {
          newSet.delete(relationshipId);
        } else {
          newSet.add(relationshipId);
        }

        return {
          ...prev,
          [rowId]: newSet,
        };
      });
    },
    []
  );

  const isExpanded = useCallback(
    (rowId: string, relationshipId: string): boolean => {
      return expandedState[rowId]?.has(relationshipId) ?? false;
    },
    [expandedState]
  );

  const expandRelationship = useCallback(
    (rowId: string, relationshipId: string) => {
      setExpandedState((prev) => {
        const rowExpanded = prev[rowId] ?? new Set();
        if (!rowExpanded.has(relationshipId)) {
          return {
            ...prev,
            [rowId]: new Set([...rowExpanded, relationshipId]),
          };
        }
        return prev;
      });
    },
    []
  );

  const collapseRelationship = useCallback(
    (rowId: string, relationshipId: string) => {
      setExpandedState((prev) => {
        const rowExpanded = prev[rowId] ?? new Set();
        const newSet = new Set(rowExpanded);
        newSet.delete(relationshipId);
        return {
          ...prev,
          [rowId]: newSet.size === 0 ? undefined : newSet,
        };
      });
    },
    []
  );

  const collapseAllForRow = useCallback((rowId: string) => {
    setExpandedState((prev) => {
      const { [rowId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  return {
    expandedState,
    toggleExpansion,
    isExpanded,
    expandRelationship,
    collapseRelationship,
    collapseAllForRow,
  };
};
```

## Component: RelationshipCell

```typescript
// src/components/relationship-cell.tsx

import { ChevronDown, AlertCircle, Loader2 } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";
import type { RelationshipMetadata } from "../types";

interface RelationshipCellProps {
  relationship: RelationshipMetadata;
  parentRowValue: unknown;
  isExpanded: boolean;
  matchingRowCount: number | null;
  isLoadingCount?: boolean;
  onToggleExpand: () => void;
  error?: Error | null;
}

export const RelationshipCell = memo(function RelationshipCell({
  relationship,
  isExpanded,
  matchingRowCount,
  isLoadingCount = false,
  onToggleExpand,
  error,
}: RelationshipCellProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      onToggleExpand();
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <Tooltip title={error.message}>
        <div className="flex items-center gap-2 text-destructive px-2 py-1">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Error</span>
        </div>
      </Tooltip>
    );
  }

  const isLoaded = matchingRowCount !== null && !isLoadingCount;
  const countText = isLoaded ? `${matchingRowCount} rows` : "...";

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      size="sm"
      className={`flex items-center gap-2 transition-all ${
        isExpanded ? "bg-primary text-primary-foreground border-primary" : ""
      }`}
      disabled={isLoading || !isLoaded}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ChevronDown
          className={`h-3 w-3 transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      )}
      <span className="text-xs font-medium">{relationship.displayLabel}</span>
      {isLoaded && (
        <span className="text-xs bg-muted px-2 py-0.5 rounded">
          {countText}
        </span>
      )}
    </Button>
  );
});
```

## Component: RelationshipSubrowTable

```typescript
// src/components/relationship-subrow-table.tsx

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getErrorMessage } from "../lib/get-error-message";
import { DataTable } from "./data-table";
import { useDataTable } from "./use-data-table";
import type { RelationshipMetadata } from "../types";
import type { DbConnection } from "./pages/connection.types";
import { Spinner } from "./ui/spinner";

interface RelationshipSubrowTableProps {
  relationship: RelationshipMetadata;
  parentRowValue: unknown;
  connection: DbConnection;
  allTableMetadata: Array<{
    table: string;
    columns: Array<{
      name: string;
      dataType: string;
      nullable: boolean;
    }>;
  }>;
}

export const RelationshipSubrowTable = ({
  relationship,
  parentRowValue,
  connection,
  allTableMetadata,
}: RelationshipSubrowTableProps) => {
  const { referencingSchema, referencingTable, referencingColumn } = relationship;

  // Fetch rows from the referencing table filtered by parent value
  const rowsQuery = useQuery({
    queryKey: [
      "relationship-subrow-data",
      connection.url,
      referencingSchema,
      referencingTable,
      referencingColumn,
      parentRowValue,
    ],
    queryFn: async () => {
      const response = await fetch("/api/table/query-relationship", {
        method: "POST",
        body: JSON.stringify({
          url: connection.url,
          schema: referencingSchema,
          table: referencingTable,
          filterColumn: referencingColumn,
          filterValue: parentRowValue,
          limit: 50, // Show first 50 related rows
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
  });

  // Get column metadata for the referencing table
  const referencingTableMetadata = useMemo(() => {
    return allTableMetadata.find((t) => t.table === referencingTable);
  }, [allTableMetadata, referencingTable]);

  // Create data table instance
  const table = useDataTable({
    data: rowsQuery.data?.rows ?? [],
    columns: referencingTableMetadata?.columns ?? [],
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 20, // Smaller page size for nested table
      },
    },
  });

  if (rowsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-8 gap-2">
        <Spinner />
        <span className="text-sm text-muted-foreground">
          Loading {relationship.displayLabel}...
        </span>
      </div>
    );
  }

  if (rowsQuery.isError) {
    return (
      <div className="p-4 bg-destructive/5 rounded border border-destructive/20">
        <p className="text-sm text-destructive">
          Failed to load {relationship.displayLabel}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {getErrorMessage(rowsQuery.error)}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 rounded border border-border/50">
      <div className="px-4 py-2 bg-muted/40 border-b">
        <h4 className="text-sm font-medium text-foreground">
          {relationship.displayLabel} (
          {rowsQuery.data?.rowCount ?? rowsQuery.data?.rows?.length ?? 0} rows)
        </h4>
      </div>
      <div className="overflow-hidden">
        <DataTable
          table={table}
          size="compact"
          striped
          stickyHeader={false}
          isLoading={rowsQuery.isLoading}
          hasError={rowsQuery.isError}
        />
      </div>
    </div>
  );
};
```

## Modified DataTableRow

```typescript
// src/components/data-table.row.tsx (MODIFICATIONS)

import { Fragment, memo } from "react";
import type { Row } from "@tanstack/react-table";
import type { RelationshipMetadata } from "../types";
import { DataTableCell } from "./data-table.cell";
import { RowContextMenu } from "./row-context-menu";

interface DataTableRowProps {
  index: number;
  getRow: () => Row<any>;
  onRowClick?: (row: Row<any>) => void;
  size: DataTableSize;
  striped: boolean;
  interactive: boolean;
  showColumnBorder: boolean;
  withContextMenu: boolean;
  enableColumnOrdering: boolean;
  columnOrder?: string[];
  ExpandedRow?: (props: { row: Row<any> }) => ReactNode;
  onExpandRowJson?: (row: Record<string, unknown>) => void;
  // NEW PROPS:
  expandedRelationships?: Set<string>; // Constraint IDs that are expanded
  relationships?: RelationshipMetadata[];
}

export const DataTableRow = memo(function TableRow({
  index,
  getRow,
  // ... existing props
  expandedRelationships,
  relationships,
}: DataTableRowProps) {
  const row = getRow();
  const visibleCells = row.getVisibleCells();
  const isSelected = row.getIsSelected();

  // ... existing code ...

  return (
    <Fragment>
      <ContextMenu {...}>
        <tr {...}>
          {/* Existing cells */}
          {/* Relationship cells rendered here too */}
        </tr>
      </ContextMenu>

      {/* Generic expanded row (existing) */}
      {row.getIsExpanded() && ExpandedRow && (
        <tr {...}>
          <td colSpan={visibleCells.length}>
            <ErrorBoundary>
              <ExpandedRow row={row} />
            </ErrorBoundary>
          </td>
        </tr>
      )}

      {/* NEW: Relationship subrows */}
      {expandedRelationships &&
        relationships?.map((rel) => {
          if (!expandedRelationships.has(rel.constraintName)) {
            return null;
          }

          return (
            <tr
              key={`${row.id}_rel_${rel.constraintName}`}
              className="relationship-subrow bg-muted/20 border-b border-border"
              data-relationship-id={rel.constraintName}
            >
              <td
                colSpan={visibleCells.length}
                className="p-0"
              >
                <ErrorBoundary fallbackRender={() => "Error loading relationship"}>
                  <RelationshipSubrowTable
                    relationship={rel}
                    parentRowValue={row.original[rel.referencedColumn]}
                    connection={connection} // passed from parent
                    allTableMetadata={allTableMetadata} // passed from parent
                  />
                </ErrorBoundary>
              </td>
            </tr>
          );
        })}
    </Fragment>
  );
});
```

## Connection Page Integration

```typescript
// src/components/pages/connection.page.tsx (MODIFICATIONS)

import { useTableRelationships } from "../hooks/use-table-relationships";
import { useRelationshipExpansionState } from "../hooks/use-relationship-expansion-state";
import { RelationshipCell } from "../components/relationship-cell";

const ConnectionPageInner = ({ connection }: { connection: DbConnection }) => {
  // ... existing hooks ...

  const { incomingReferences } = useTableRelationships({
    url: activeConnectionUrl,
    schema: search.schema!,
    table: search.table!,
    enabled: !!search.schema && !!search.table,
  });

  const {
    expandedState,
    toggleExpansion,
    isExpanded,
  } = useRelationshipExpansionState();

  // Build relationship columns
  const relationshipColumns = useMemo(() => {
    return incomingReferences.map((rel) => ({
      id: `rel_${rel.constraintName}`,
      header: () => (
        <div className="flex items-center gap-1">
          <span>↳</span>
          <span>{rel.displayLabel}</span>
        </div>
      ),
      cell: ({ row }: any) => (
        <RelationshipCell
          relationship={rel}
          parentRowValue={row.original[pkColumnName]}
          isExpanded={isExpanded(row.id, rel.constraintName)}
          matchingRowCount={rowCountCache[rel.constraintName]?.[row.original[pkColumnName]]}
          onToggleExpand={() =>
            toggleExpansion(row.id, rel.constraintName)
          }
        />
      ),
      meta: {
        type: "relationship",
        enableColumnOrdering: false,
        enableSorting: false,
        enableFiltering: false,
      },
      size: 140,
    }));
  }, [incomingReferences, pkColumnName, isExpanded, toggleExpansion]);

  // Combine all columns
  const allColumns = useMemo(
    () => [...rowsColumns, ...relationshipColumns],
    [rowsColumns, relationshipColumns]
  );

  // Update table to include relationship columns
  const table = useDataTable({
    data: queryResponse.rows,
    columns: allColumns,
    // ... other options ...
  });

  // Pass relationship state to DataTable
  return (
    <DataTable
      table={table}
      expandedRelationships={expandedState[/* current row id */]}
      relationships={incomingReferences}
      // ... other props ...
    />
  );
};
```

## Server Function: Query Relationship Rows

```typescript
// src/server/pg/start-fns/get-relationship-subrow-data.start.ts

import { queryTableDataQueryOptions } from "./query-table-data.start";

interface QueryRelationshipSubrowInput {
  url: string;
  schema: string;
  table: string;
  column: string;
  parentValue: unknown;
  limit?: number;
  offset?: number;
}

export const queryRelationshipSubrowQueryOptions = (
  input: QueryRelationshipSubrowInput
) => {
  const { url, schema, table, column, parentValue, limit = 50, offset = 0 } = input;

  return queryTableDataQueryOptions({
    url,
    schema,
    table,
    filters: {
      conditions: [
        {
          column,
          operator: "equals",
          value: String(parentValue),
        },
      ],
      logicalOperator: "and",
    },
    limit,
    offset,
    orderBy: [],
  });
};
```

## State Management (Optional: Zustand Store)

```typescript
// src/store/relationship-expansion.store.ts

import { create } from "zustand";

interface RelationshipExpansionStore {
  expandedState: RowRelationshipExpansionState;
  toggleExpansion: (rowId: string, relationshipId: string) => void;
  isExpanded: (rowId: string, relationshipId: string) => boolean;
  resetForTable: (tableKey: string) => void;
}

/**
 * Optional: Use global Zustand store instead of local state
 * Useful if you want to preserve expansion state during navigation
 */
export const useRelationshipExpansionStore = create<RelationshipExpansionStore>(
  (set, get) => ({
    expandedState: {},
    toggleExpansion: (rowId, relationshipId) => {
      set((state) => {
        const rowExpanded = state.expandedState[rowId] ?? new Set();
        const newSet = new Set(rowExpanded);

        if (newSet.has(relationshipId)) {
          newSet.delete(relationshipId);
        } else {
          newSet.add(relationshipId);
        }

        return {
          expandedState: {
            ...state.expandedState,
            [rowId]: newSet,
          },
        };
      });
    },
    isExpanded: (rowId, relationshipId) => {
      return get().expandedState[rowId]?.has(relationshipId) ?? false;
    },
    resetForTable: (tableKey) => {
      // Could scope state by table key in the future
      set({ expandedState: {} });
    },
  })
);
```

## Testing Examples

```typescript
// src/components/__tests__/relationship-cell.test.tsx

import { render, screen, fireEvent } from "@testing-library/react";
import { RelationshipCell } from "../relationship-cell";

describe("RelationshipCell", () => {
  const mockRelationship = {
    referencingColumn: "user_id",
    referencingTable: "orders",
    referencingSchema: "public",
    referencedColumn: "id",
    referencedTable: "users",
    referencedSchema: "public",
    constraintName: "orders_user_id_fk",
    displayLabel: "orders",
  };

  it("renders expand button with row count", () => {
    const onClick = jest.fn();

    render(
      <RelationshipCell
        relationship={mockRelationship}
        parentRowValue={123}
        isExpanded={false}
        matchingRowCount={5}
        onToggleExpand={onClick}
      />
    );

    expect(screen.getByText("orders")).toBeInTheDocument();
    expect(screen.getByText("5 rows")).toBeInTheDocument();
  });

  it("toggles expanded state on click", () => {
    const onClick = jest.fn();

    const { rerender } = render(
      <RelationshipCell
        relationship={mockRelationship}
        parentRowValue={123}
        isExpanded={false}
        matchingRowCount={5}
        onToggleExpand={onClick}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();

    rerender(
      <RelationshipCell
        relationship={mockRelationship}
        parentRowValue={123}
        isExpanded={true}
        matchingRowCount={5}
        onToggleExpand={onClick}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-primary");
  });

  it("shows error state when error prop is provided", () => {
    const error = new Error("Failed to load");

    render(
      <RelationshipCell
        relationship={mockRelationship}
        parentRowValue={123}
        isExpanded={false}
        matchingRowCount={null}
        onToggleExpand={jest.fn()}
        error={error}
      />
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
```

## CSS Styling

```css
/* Add to your global styles or create relationship.styles.ts */

.relationship-subrow {
  background-color: rgba(0, 0, 0, 0.02);
  transition: background-color 200ms;
}

.relationship-subrow:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.relationship-subrow-content {
  padding: 12px 16px;
  padding-left: 32px; /* Indentation to show nesting */
}

.relationship-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.875em;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.relationship-cell:hover:not(:disabled) {
  background-color: var(--muted);
}

.relationship-cell[aria-pressed="true"] {
  background-color: var(--primary);
  color: var(--primary-foreground);
  border-color: var(--primary);
}

.relationship-cell-icon {
  display: inline-flex;
  transition: transform 200ms;
}

.relationship-cell[aria-pressed="true"] .relationship-cell-icon {
  transform: rotate(90deg);
}

.relationship-cell-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 4px;
  border-radius: 3px;
  background-color: var(--muted);
  font-size: 0.75em;
  font-weight: 600;
}

.relationship-cell[aria-pressed="true"] .relationship-cell-badge {
  background-color: rgba(0, 0, 0, 0.2);
}
```
