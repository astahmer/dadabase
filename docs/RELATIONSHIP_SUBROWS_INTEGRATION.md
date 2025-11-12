# Relationship Subrows Integration Guide

This guide explains how to integrate the relationship subrows feature into the connection page.

## Architecture Overview

The relationship subrows feature consists of these key parts:

1. **Type Definitions** (`src/types/relationships.ts`)
   - `RelationshipMetadata`: Describes a relationship between two tables
   - `RowRelationshipExpansionState`: Tracks which relationships are expanded per row

2. **Hooks**
   - `useRelationshipExpansionState()`: Manages expand/collapse state per row
   - `useTableRelationships()`: Fetches relationship metadata for a table

3. **Components**
   - `RelationshipCell`: Button showing relationship name and row count
   - `RelationshipSubrowTable`: Nested DataTable for displaying related rows
   - `buildRelationshipColumns()`: Factory for creating relationship column definitions

4. **Server**
   - `queryRelationshipSubrowDataQueryOptions()`: Fetches filtered rows from related table

## Integration Steps

### Step 1: Update `use-connection-page-state.tsx`

Add the relationship hooks and state management:

```tsx
import { useRelationshipExpansionState } from "../hooks/use-relationship-expansion-state";
import { useTableRelationships } from "../hooks/use-table-relationships";
import { buildRelationshipColumns, createRelationshipSubrowComponent } from "../components/relationship-column";

// Inside ConnectionPageInner component:

// Get relationships for the current table
const relationshipsQuery = useTableRelationships({
  url: activeConnectionUrl,
  schema: search.schema || "",
  table: search.table || "",
});

// Manage expansion state
const {
  expandedRelationships,
  toggleExpansion,
} = useRelationshipExpansionState();

// Build relationship columns
const relationshipColumns = useMemo(() => {
  if (!relationshipsQuery.data?.length) return [];

  return buildRelationshipColumns(
    relationshipsQuery.data,
    expandedRelationships,
    (rowId, constraintName) => toggleExpansion(rowId, constraintName),
  );
}, [relationshipsQuery.data, expandedRelationships, toggleExpansion]);

// Update rowsColumns to include relationship columns
const rowsColumns = useMemo(
  () => {
    const allDataColumns = [...dataColumns, ...relationshipColumns];
    return dataColumns.length
      ? [...staticColumns, ...allDataColumns]
      : [...staticColumns, ...skeletonColumns];
  },
  [staticColumns, dataColumns, relationshipColumns],
);

// Create the relationship subrow component
const RelationshipSubrowComponent = useMemo(
  () => createRelationshipSubrowComponent({ url: activeConnectionUrl }),
  [activeConnectionUrl],
);
```

### Step 2: Update DataTable Props

Pass the relationship props to the DataTable component:

```tsx
<DataTable
  table={rowsDataTable}
  // ... other props ...
  expandedRelationships={expandedRelationships}
  relationships={relationshipsQuery.data ?? []}
  RelationshipSubrowComponent={RelationshipSubrowComponent}
/>
```

### Step 3: Add to Return Value

Update the return value of `useConnectionPageState` to include:

```tsx
return {
  // ... existing returns ...
  expandedRelationships,
  relationships: relationshipsQuery.data ?? [],
  RelationshipSubrowComponent,
};
```

### Step 4: Update Connection Page

In `connection.page.tsx`, extract and pass the relationship props:

```tsx
const {
  activeConnectionUrl,
  queryBuilder,
  rowsQuery,
  columnMetadata,
  columnList,
  isColumnMetadataLoading,
  queryResponse,
  totalRowCount,
  rowsDataTable,
  rowsColumns,
  hasUuid,
  expandedRelationships,      // NEW
  relationships,              // NEW
  RelationshipSubrowComponent, // NEW
} = pageState;

// Pass to DataTable
<DataTable
  virtualized
  enableColumnOrdering
  table={rowsDataTable}
  getTableContainer={setTableContainer}
  isLoading={rowsQuery.isLoading || isColumnMetadataLoading}
  size={search.tableSize}
  withContextMenu
  expandedRelationships={expandedRelationships}      // NEW
  relationships={relationships}                      // NEW
  RelationshipSubrowComponent={RelationshipSubrowComponent} // NEW
  // ... other props ...
/>
```

## Complete Example

Here's a minimal complete integration:

```tsx
// In use-connection-page-state.tsx

export const useConnectionPageState = ({
  connection,
}: UseConnectionPageStateProps) => {
  // ... existing code ...

  // NEW: Relationship state management
  const relationshipsQuery = useTableRelationships({
    url: activeConnectionUrl,
    schema: search.schema || "",
    table: search.table || "",
  });

  const {
    expandedRelationships,
    toggleExpansion,
  } = useRelationshipExpansionState();

  const relationshipColumns = useMemo(() => {
    if (!relationshipsQuery.data?.length) return [];

    return buildRelationshipColumns(
      relationshipsQuery.data,
      expandedRelationships,
      (rowId, constraintName) => toggleExpansion(rowId, constraintName),
    );
  }, [relationshipsQuery.data, expandedRelationships, toggleExpansion]);

  // Update rowsColumns to include relationships
  const rowsColumns = useMemo(
    () => {
      const allDataColumns = [...dataColumns, ...relationshipColumns];
      return dataColumns.length
        ? [...staticColumns, ...allDataColumns]
        : [...staticColumns, ...skeletonColumns];
    },
    [staticColumns, dataColumns, relationshipColumns],
  );

  const RelationshipSubrowComponent = useMemo(
    () => createRelationshipSubrowComponent({ url: activeConnectionUrl }),
    [activeConnectionUrl],
  );

  // ... rest of existing code ...

  return {
    activeConnectionUrl,
    queryBuilder,
    rowsQuery,
    columnMetadata,
    columnList,
    isColumnMetadataLoading,
    queryResponse,
    totalRowCount,
    rowsDataTable,
    rowsColumns,
    hasUuid,
    expandedRelationships,      // NEW
    relationships: relationshipsQuery.data ?? [],
    RelationshipSubrowComponent, // NEW
  };
};
```

```tsx
// In connection.page.tsx

const pageState = useConnectionPageState({ connection });
const {
  activeConnectionUrl,
  queryBuilder,
  rowsQuery,
  columnMetadata,
  columnList,
  isColumnMetadataLoading,
  queryResponse,
  totalRowCount,
  rowsDataTable,
  rowsColumns,
  hasUuid,
  expandedRelationships,      // NEW
  relationships,              // NEW
  RelationshipSubrowComponent, // NEW
} = pageState;

// ... in JSX ...

<DataTable
  virtualized
  enableColumnOrdering
  table={rowsDataTable}
  // ... other props ...
  expandedRelationships={expandedRelationships}
  relationships={relationships}
  RelationshipSubrowComponent={RelationshipSubrowComponent}
/>
```

## Row Identification

The system needs to identify rows to track which relationships are expanded. By default, it uses:

```tsx
const rowId = String(ctx.row.original.id ?? ctx.row.index);
```

If your tables don't have an `id` field, update `buildRelationshipColumns()` to use the appropriate primary key field:

```tsx
// In relationship-column.tsx, cell function:
const primaryKeyValue = ctx.row.original[primaryKeyField];
const rowId = String(primaryKeyValue ?? ctx.row.index);
```

## Error Handling

Both `RelationshipCell` and `RelationshipSubrowTable` have built-in error handling:

- Missing data shows a loading spinner
- Failed queries show error message with details
- Malformed relationships fail gracefully with error tooltip

## Performance Considerations

1. **Lazy Loading**: Related rows are only fetched when a relationship is expanded
2. **Query Caching**: React Query caches results by relationship metadata
3. **Column Size**: Relationship columns default to 120px width
4. **Nested Pagination**: Nested tables use 20-row page size by default

## Customization

### Adjust Nested Table Size
Edit `src/components/relationship-subrow-table.tsx`:
```tsx
pageSize: 20, // Change this number
```

### Customize Column Width
Edit `src/components/relationship-column.tsx`:
```tsx
size: 120,        // Default width
minSize: 100,     // Minimum width
maxSize: 150,     // Maximum width
```

### Change Row Identification
Edit `src/components/relationship-column.tsx` cell function to use different primary key.

## Testing

To test the integration:

1. Navigate to any table with foreign keys
2. Verify relationship columns appear
3. Click expand button on a row
4. Verify nested table appears with correct filtered data
5. Verify expand/collapse toggles properly
6. Test with multiple rows expanded simultaneously

## Troubleshooting

**Relationship columns don't appear**
- Ensure `useTableRelationships()` is implemented and returns data
- Check console for errors from server query

**Subrows don't load**
- Verify `queryRelationshipSubrowDataQueryOptions()` is working
- Check Network tab for API calls
- Verify relationship metadata is correct (schema, table, column names)

**Wrong data shows in subrows**
- Verify `parentRowValue` is being passed correctly
- Check filter column name in relationship metadata
- Ensure `filterValue` matches the actual column value

**Performance issues**
- Limit number of relationships displayed
- Reduce page size in nested tables
- Implement pagination in parent table
