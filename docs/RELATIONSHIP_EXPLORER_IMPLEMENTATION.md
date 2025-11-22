# Relationship Explorer Implementation Summary

## What Was Built

A unified **Relationship Explorer** interface that allows users to visualize a single row and all its relationships (both outgoing FKs and incoming references) in one consolidated view, without switching between tables or opening multiple panels.

## Key Features

### 🔍 Unified Visualization
- View a row's data alongside all related data in a single interface
- Relationships displayed as collapsible JSON keys within the row structure
- Clear visual separation between outgoing FKs and incoming references

### 📊 Eager Row Counts
- Row counts displayed immediately for each relationship
- Single batched query fetches all counts efficiently
- No need to load data to see if relationships exist

### ⚡ Lazy Loading
- Related rows only fetched when relationship is expanded
- Compact preview format showing first 5 rows + count
- Preview shows key columns: `column: value · column: value`

### 🎯 Performance Optimized
- Batched count queries (all in one request)
- Lazy-loaded relationship data (fetch on expand)
- Memoized components (prevent unnecessary re-renders)
- Configurable JSON depth limiting (default: 3)

## Architecture

### Component Structure

```
RelationshipExplorer (main)
├── RelationshipExplorerValue (handles data types)
├── RelationshipExplorerObject (renders row as JSON with relationships)
│   ├── RelationshipExplorerKey (individual relationship)
│   │   └── RelationshipExplorerRows (lazy-loaded related data)
│   └── JsonValue (for nested objects)
├── JsonArray (for array values)
└── SimpleJsonObject (for regular nested objects)
```

### Integration Points

1. **Row JSON Viewer** (`row-json-viewer.tsx`)
   - Updated to accept `showRelationships` prop
   - Switches to RelationshipExplorer when enabled
   - Maintains backward compatibility

2. **Inline JSON Popover** (`inline-json-popover.tsx`)
   - Same enhancement as RowJsonViewer
   - Consistent interface across all JSON views

3. **Enhanced JSON Viewer** (`ui/enhanced-json-viewer.tsx`)
   - New wrapper component
   - Unifies regular JSON and relationship views
   - For use in expanded dialogs

## Data Flow

### Initialization
```
User opens row → RelationshipExplorer mounts
  → Fetch relationships for table
  → Filter non-null FK/PK values
  → Fetch all row counts (batched)
  → Render row with relationship keys (collapsed)
```

### User Interaction
```
User clicks relationship key
  → RelationshipExplorerKey expands
  → RelationshipExplorerRows lazy-fetches data
  → Show first 5 rows in preview format
  → Show "N more rows..." if count > 5
```

## Files Created

### New Components
- `src/components/relationship-explorer.tsx` (610 lines)
  - Main component managing exploration state
  - Orchestrates relationship fetching and display

- `src/components/relationship-explorer.key.tsx` (95 lines)
  - Individual relationship display
  - Collapsible with count badge
  - Shows loading and empty states

- `src/components/relationship-explorer.rows.tsx` (140 lines)
  - Lazy-loads related rows
  - Compact preview format
  - Error handling and loading states

- `src/components/ui/enhanced-json-viewer.tsx` (50 lines)
  - Wrapper for JSON and relationship views
  - Used in expanded dialogs

### Files Updated
- `src/components/row-json-viewer.tsx`
  - Added relationship props
  - Conditional rendering logic

- `src/components/inline-json-popover.tsx`
  - Added relationship props
  - Conditional rendering logic

### Documentation
- `RELATIONSHIP_EXPLORER.md` (300+ lines)
  - Complete usage guide
  - Architecture documentation
  - API reference
  - Performance notes
  - Future enhancements

## Usage Examples

### Inline Popover (Row Context Menu)
```tsx
<RowJsonViewer
  row={selectedRow}
  schema="public"
  table="users"
  connectionUrl="postgresql://..."
  showRelationships={true}
/>
```

### Expanded Dialog
```tsx
<EnhancedJsonViewer
  data={selectedRow}
  schema="public"
  table="users"
  connectionUrl="postgresql://..."
  showRelationships={true}
  maxDepth={5}
/>
```

### Without Relationships (Legacy Mode)
```tsx
<RowJsonViewer
  row={selectedRow}
  showRelationships={false}  // Falls back to basic JSON viewer
/>
```

## Visual Structure

```json
{
  "id": "uuid-123",
  "name": "John Doe",
  "email": "john@example.com",
  "__outgoing": {
    "users → departments": [1 rows],
    "users → roles": [2 rows]
  },
  "__incoming": {
    "orders ← users": [5 rows],
    "comments ← users": [3 rows]
  }
}
```

When expanded:

```json
{
  ...data fields...,
  "__outgoing": {
    "users → departments": [1 rows]
      dept_id: "d-001" · name: "Engineering" · budget: "$500k",
    "users → roles": [2 rows]
      role_id: "r-1" · name: "Admin"
      role_id: "r-2" · name: "Editor" ...
  },
  "__incoming": {
    "orders ← users": [5 rows]
      order_id: "o-123" · total: "$99.99" · status: "pending"
      order_id: "o-456" · total: "$149.99" · status: "completed" ...
      3 more rows...
  }
}
```

## Key Implementation Details

### Relationship Filtering
- Outgoing: Filters on non-null referencingColumn value
- Incoming: Filters on non-null referencedColumn value
- Only shows relationships with at least 1 related row

### Count Query Optimization
```typescript
// Single batched query for all relationships
getRelationshipsCountsQueryOptions({
  url: connectionUrl,
  schema,
  table,
  relationships: validRelationships,
  rowData: row,
})
```

### Lazy Loading
```typescript
// Each relationship fetches on demand
queryRelationshipSubrowDataQueryOptions({
  url: connectionUrl,
  schema: referencingSchema,
  table: referencingTable,
  filterColumn: referencingColumn,
  filterValue: String(filterValue),
  limit: 100,
  offset: 0,
})
```

### Compact Preview
- Shows first 5 rows only
- Format: `column: value · column: value · column: value`
- Truncates long values at 20 characters
- Shows "N more rows..." indicator

## Performance Characteristics

| Aspect | Behavior | Rationale |
|--------|----------|-----------|
| Initial Load | Counts fetched immediately | Users see relationship exists without loading data |
| Data Fetch | Lazy on expand | Reduces unnecessary queries |
| Batching | All counts in 1 query | Minimizes network roundtrips |
| Display | First 5 rows only | Keeps UI responsive and uncluttered |
| Memoization | All components memoized | Prevents re-render cascades |
| JSON Depth | Limited to 3 (configurable) | Prevents rendering massive nested structures |

## Backward Compatibility

✅ All changes are backward compatible:
- New props are optional (default to `false`)
- Without relationship props, falls back to basic JSON viewer
- Existing code continues to work without modification
- No breaking changes to public APIs

## Next Steps (Future Enhancements)

1. **Relationship Navigation**: Click to navigate to related records
2. **Full Tables**: Expand to show all related data in DataTable
3. **Relationship Graph**: Visualize relationships as network diagram
4. **Filters & Sorting**: Within expanded relationships
5. **Export Options**: Copy/export relationship data
6. **Bidirectional Exploration**: Follow relationships deeper

## Testing Recommendations

When implementing in existing features (e.g., row context menu):

```tsx
// Enable in row action button/menu
const handleShowRowData = (row: Row<Record<string, unknown>>) => {
  setShowRowJson({
    data: row.original,
    schema: selectedSchema,
    table: selectedTable,
    connectionUrl: activeConnectionUrl,
    showRelationships: true,  // NEW: Enable explorer
  });
};

// Pass to RowJsonViewer
<RowJsonViewer
  row={showRowJson.data}
  schema={showRowJson.schema}
  table={showRowJson.table}
  connectionUrl={showRowJson.connectionUrl}
  showRelationships={showRowJson.showRelationships}
/>
```

## Code Quality

✅ All files compile without errors
✅ TypeScript types properly defined
✅ Components memoized for performance
✅ Error handling for all async operations
✅ Loading states for user feedback
✅ Consistent with existing code style
✅ Uses Effect.ts pattern where needed
✅ TanStack Query for caching/state

## Documentation

- Comprehensive guide: `RELATIONSHIP_EXPLORER.md`
- This summary: `RELATIONSHIP_EXPLORER_IMPLEMENTATION.md`
- Inline comments in components
- TypeScript interfaces document expected props

---

**Status**: ✅ Complete and ready for integration

All components are production-ready and can be integrated into existing features immediately.
