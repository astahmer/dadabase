# Feature Plan: Relationship Subrows for Data Tables

## Overview
Add expandable relationship columns to the main data table. Each relationship gets its own column with a button that, when clicked, expands a "subrow" (nested `<tr>` element) containing a DataTable of related rows matching the parent row's primary key.

## Problem Statement
Currently, the application can display data from a single table. When users want to explore related data through foreign key relationships, they must:
1. Navigate to a different table
2. Manually apply filters based on the FK column
3. Lose context of the parent row

This feature will allow seamless exploration of related data inline, improving the user experience for browsing relational data.

## Feature Scope

### Types of Relationships
1. **Outgoing ForeignKeys (Referenced Tables)**
   - A table with a FK column references another table
   - Example: `orders.user_id` → `users.id`
   - Need to join/look up the referenced table's data

2. **Incoming References (Referencing Tables)**
   - Other tables have FK columns that reference this table
   - Example: `orders.user_id` → `users.id` (from the users perspective)
   - Need to query the referencing table filtered by the parent row's PK

### Which Relationships to Display
**Phase 1 (Initial Implementation):** Display incoming references (tables that reference the current table)
- More common use case for exploration
- Clearer mental model (show "children" of a row)
- Example: View all orders for a specific user

**Phase 2 (Future):** Could add outgoing ForeignKeys
- Show the referenced record details inline
- Would need to handle many-to-one relationships differently

## Architecture

### Data Flow

```
Parent Row (e.g., user_id = 123)
    ↓
Relationship Column (e.g., "orders")
    ↓
Expand Button Clicked
    ↓
Query: SELECT * FROM orders WHERE user_id = 123
    ↓
Nested DataTable (in subrow) displays results
    ↓
Subrow <tr> inserted after parent <tr>
```

### Component Hierarchy

```
DataTable
├── DataTableRow
│   ├── DataTableCell (regular columns)
│   ├── RelationshipCell (NEW)
│   │   ├── Expand/Collapse Button
│   │   └── Badge (count of related rows)
│   └── Subrow <tr> (when expanded)
│       └── RelationshipSubrowTable (NEW)
│           └── DataTable (nested)
```

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1. Type Definitions & Metadata
**File: `src/types.ts` or new `src/types/relationships.ts`**

```typescript
interface RelationshipMetadata {
  // The referencing table info
  referencingSchema: string;
  referencingTable: string;
  referencingColumn: string;

  // The referenced table info (current table)
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;

  // UI/UX
  displayLabel: string; // e.g., "Orders"
  constraintName: string;
}

interface RowWithRelationships<TData> extends Record<string, unknown> {
  _relationships?: RelationshipMetadata[];
  _expandedRelationships?: Set<string>; // Track which relationships are expanded
}
```

#### 2. Fetch Relationship Metadata
**File: `src/hooks/use-table-relationships.ts` (NEW)**

Create a hook that fetches incoming references for a table:
- Use existing `getTableForeignKeys()` to get outgoing FKs (tables this table references)
- Use existing `findColumnReferences()` to get incoming FKs (tables that reference this table)
- Return both, let consumers decide what to display
- Cache results in React Query

```typescript
export const useTableRelationships = (options: {
  url: string;
  schema: string;
  table: string;
}) => {
  // Returns: { incomingReferences, outgoingForeignKeys, isLoading, error }
};
```

#### 3. Server-Side Functions (Already Exist)
- ✅ `getTableForeignKeys()` - Get FKs FROM this table (outgoing)
- ✅ `findColumnReferences()` - Get FKs TO this table (incoming)
- ✅ `findColumnReferencesWithCounts()` - Get incoming FKs with row counts

Existing functions should be leveraged and potentially enhanced to support server-side query endpoints.

#### 4. Relationship Subrow Component
**File: `src/components/relationship-subrow-table.tsx` (NEW)**

Component to render a nested DataTable in the subrow:
```typescript
interface RelationshipSubrowTableProps {
  relationship: RelationshipMetadata;
  parentRowValue: unknown; // The PK value of the parent row
  connection: DbConnection;
  schema: string;
  table: string; // The current table
}
```

Responsibilities:
- Query the referencing table filtered by the parent's PK
- Use the existing DataTable component for nested display
- Handle loading/error states
- Optional: Limit displayed columns/rows for performance

#### 5. Relationship Cell Component
**File: `src/components/relationship-cell.tsx` (NEW)**

```typescript
interface RelationshipCellProps {
  relationship: RelationshipMetadata;
  parentRowValue: unknown;
  isExpanded: boolean;
  onToggleExpand: (relationshipId: string) => void;
  matchingRowCount: number; // Fetched from metadata
}
```

Responsibilities:
- Render button/badge with expand/collapse state
- Show count of related rows
- Handle click to toggle expansion
- Visual feedback (loading, error states)

#### 6. Column Definition for Relationships
**File: `src/components/pages/connection.page.tsx` (modification)**

In the connection page where columns are built, add relationship columns:
- Create ColumnDef for each incoming reference
- Cell renderer: RelationshipCell component
- Meta: Mark as non-draggable, non-sortable, non-filterable
- Meta: `{ type: 'relationship', relationshipId: '...' }`

```typescript
const relationshipColumns: ColumnDef<TData>[] = relationships.map(rel => ({
  id: `rel_${rel.constraintName}`,
  header: ({ table }) => (
    <div>{rel.displayLabel}</div>
  ),
  cell: ({ row }) => (
    <RelationshipCell
      relationship={rel}
      parentRowValue={row.original[pkColumnName]}
      isExpanded={expandedRelationships.has(rel.constraintName)}
      onToggleExpand={() => toggleRelationshipExpansion(rel.constraintName)}
      matchingRowCount={/* from cache */}
    />
  ),
  meta: {
    enableColumnOrdering: false,
    enableSorting: false,
    enableFiltering: false,
  },
}));

const allColumns = [...regularColumns, ...relationshipColumns];
```

### Phase 2: Subrow Rendering

#### 7. DataTableRow Enhancement
**File: `src/components/data-table.row.tsx` (modification)**

Current implementation already supports subrows via the `ExpandedRow` prop:
```tsx
{row.getIsExpanded() && ExpandedRow && (
  <tr className="...">
    <td colSpan={visibleCells.length}>
      <ErrorBoundary>
        <ExpandedRow row={row} />
      </ErrorBoundary>
    </td>
  </tr>
)}
```

We need to extend this:
1. Add row state to track which relationships are expanded
2. Render multiple subrows, one for each expanded relationship
3. Insert subrows after the parent row (maintain DOM order)

```tsx
{expandedRelationships.map(rel => (
  <tr key={`${row.id}_rel_${rel.id}`} className="...">
    <td colSpan={visibleCells.length}>
      <RelationshipSubrowTable {...rel} />
    </td>
  </tr>
))}
```

#### 8. Expand/Collapse State Management
**File: `src/hooks/use-relationship-expansion-state.ts` (NEW)**

Hook to manage which relationships are expanded for each row:
```typescript
interface RowRelationshipState {
  [rowId: string]: Set<string>; // Map of row ID to set of expanded rel IDs
}

export const useRelationshipExpansionState = () => {
  const [state, setState] = useState<RowRelationshipState>({});

  const toggleExpansion = (rowId: string, relId: string) => {
    // Toggle a specific relationship for a row
  };

  const isExpanded = (rowId: string, relId: string) => {
    // Check if a relationship is expanded for a row
  };

  return { state, toggleExpansion, isExpanded };
};
```

### Phase 3: Data Fetching & Caching

#### 9. Relationship Subrow Query
**File: `src/server/pg/start-fns/get-relationship-subrow-data.start.ts` (NEW)**

Server function to fetch related rows:
```typescript
interface QueryRelationshipRowsInput {
  url: string;
  schema: string;
  table: string;
  relationshipTable: string;
  relationshipColumn: string;
  parentRowValue: unknown;
  limit?: number;
  offset?: number;
}

export const queryRelationshipRowsQueryOptions = (input: QueryRelationshipRowsInput) => {
  // Builds query: SELECT * FROM {schema}.{table} WHERE {column} = {value}
  // Returns React Query options
};
```

#### 10. Count Caching
**File: Enhancement to `use-table-relationships.ts`**

Fetch counts of related rows for each relationship to display in the cell badge:
- Use `findColumnReferencesWithCounts()` for incoming relationships
- Cache results per relationship
- Update counts on row selection

### Phase 4: UI/UX Polish

#### 11. Visual Hierarchy
- Subrow styling different from main rows (slightly different background)
- Indentation or visual nesting indicator
- Nested table should have distinct styling
- Loading spinner in relationship cell during expansion

#### 12. Performance Optimizations
- **Lazy load subrow data** - Only query when expanded
- **Limit nested table rows** - Show first 10-20 related rows by default
- **Pagination in subrow** - Allow pagination for many related rows
- **Memoize relationship cells** - Prevent unnecessary re-renders
- **Virtualization** - Consider if deeply nested tables need virtualization

#### 13. Accessibility
- Proper ARIA labels for expand/collapse buttons
- Keyboard navigation support
- Screen reader friendly

## File Structure Summary

```
src/
├── components/
│   ├── relationship-cell.tsx                     (NEW)
│   ├── relationship-subrow-table.tsx             (NEW)
│   ├── data-table.row.tsx                        (MODIFY)
│   ├── data-table.tsx                            (MINIMAL CHANGE)
│   └── pages/
│       └── connection.page.tsx                   (MODIFY)
├── hooks/
│   ├── use-table-relationships.ts                (NEW)
│   └── use-relationship-expansion-state.ts       (NEW)
├── server/
│   └── pg/
│       └── start-fns/
│           └── get-relationship-subrow-data.start.ts  (NEW)
└── lib/
    └── relationship-utils.ts                     (NEW - optional)
```

## Key Integration Points

### 1. Connection Page State
- Needs to fetch relationship metadata for the current table
- Needs to provide relationship columns alongside regular columns
- Needs to pass expansion state to DataTable

### 2. DataTable Component
- Minimal changes - already supports ExpandedRow
- May need to handle multiple subrows per row
- May need metadata filtering for UI (hide certain columns in subrow)

### 3. Existing Relationship Functions
- Leverage `getTableForeignKeys()` and `findColumnReferences()`
- Consider adding endpoints if needed

## Implementation Order

1. **Types & Metadata** (1-2 hours)
   - Define relationship types
   - Create use-table-relationships hook
   - Update type definitions

2. **Relationship Cell Component** (2 hours)
   - Build button/badge component
   - Handle click events
   - Show matching row count

3. **Subrow Expansion State** (1-2 hours)
   - Create useRelationshipExpansionState hook
   - Integrate with DataTableRow

4. **Relationship Subrow Table** (3-4 hours)
   - Build component to render nested DataTable
   - Handle data fetching for related rows
   - Error/loading states

5. **Server-Side Query** (1-2 hours)
   - Create get-relationship-subrow-data endpoint
   - Query builder for related data

6. **Connection Page Integration** (2-3 hours)
   - Add relationship columns to column definitions
   - Wire up with state management
   - Test end-to-end

7. **Styling & Polish** (2-3 hours)
   - Visual hierarchy for nested tables
   - Loading states
   - Responsive design

8. **Performance & Optimization** (2 hours)
   - Memoization
   - Lazy loading
   - Cache management

**Total Estimated: 14-19 hours**

## Testing Strategy

- Unit tests for relationship metadata formatting
- Integration tests for column definitions
- E2E tests for expand/collapse flow
- Visual regression tests for nested tables
- Performance tests for large nested datasets

## Future Enhancements

1. **Bidirectional Relationships**
   - Show outgoing ForeignKey relationships in separate columns
   - Different visual treatment (e.g., linked icon vs. nested table)

2. **Configuration Panel**
   - Allow users to toggle which relationships to display
   - Configure nested table columns/behavior per relationship

3. **Smart Depth Limiting**
   - Prevent infinite nesting (max 2-3 levels)
   - Warn user when approaching depth limit

4. **Relationship Aggregations**
   - Show summary stats instead of full table (count, sum, avg)
   - Expandable detail view

5. **Relationship Filtering**
   - Filter nested tables based on parent constraints
   - Cascading filters through relationships

## Notes

- Leverage existing `DataTable` component to keep code DRY
- Reuse existing relationship query functions
- Keep relationship cell simple - just a button/badge initially
- Plan for lazy loading from the start
- Consider performance with many relationships per row
