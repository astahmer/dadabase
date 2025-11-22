# Relationship Explorer

## Overview

The Relationship Explorer is a unified interface for visualizing a single row of data and its relationships without having to switch between tables or open multiple relationship panels. It displays the row as JSON with collapsible relationship keys that show:

- **Relationship count badges** (always visible when collapsed)
- **Lazy-loaded related data** (fetched on expand)
- **Compact row previews** (showing key columns)
- **Relationship type indicators** (outgoing FKs vs incoming references)

## Architecture

The feature consists of three main components:

### 1. `RelationshipExplorer` (Main Component)
- **File**: `src/components/relationship-explorer.tsx`
- **Purpose**: Orchestrates the relationship exploration interface
- **Responsibilities**:
  - Fetches all relationships for the current table
  - Fetches row counts for each relationship (batched query)
  - Manages expanded/collapsed state for each relationship
  - Renders the row data as JSON with relationship keys integrated

**Key Props**:
```typescript
interface RelationshipExplorerProps {
  row: Record<string, unknown>;      // The row to explore
  schema: string;                     // Current schema
  table: string;                      // Current table
  connectionUrl: string;              // Database connection URL
  className?: string;
  maxDepth?: number;                  // JSON depth limit (default: 3)
  showRelationships?: boolean;        // Enable/disable relationships (default: true)
}
```

### 2. `RelationshipExplorerKey` (Individual Relationship)
- **File**: `src/components/relationship-explorer.key.tsx`
- **Purpose**: Displays a single relationship as a collapsible JSON key
- **Features**:
  - Shows relationship label with arrow indicator (→ for outgoing, ← for incoming)
  - Displays row count in a badge
  - Shows loading spinner while fetching
  - Handles expand/collapse toggle
  - Disabled when no related data exists

**Visual Format**:
```
"referencingTable → referencedTable": [3 rows]
```

### 3. `RelationshipExplorerRows` (Related Data Display)
- **File**: `src/components/relationship-explorer.rows.tsx`
- **Purpose**: Lazy-loads and displays related rows
- **Features**:
  - Fetches data on expand (lazy-loading)
  - Shows first 5 rows in compact preview format
  - Displays "N more rows..." indicator
  - Compact preview shows key columns: `column: value · column: value · column: value`

## Integration Points

### 1. Row JSON Viewer (Inline Popover)
- **File**: `src/components/row-json-viewer.tsx`
- **Updated to accept**:
  - `showRelationships?: boolean` - Enable relationship mode
  - `schema?: string` - Current schema
  - `table?: string` - Current table
  - `connectionUrl?: string` - Connection URL

**Usage**:
```tsx
<RowJsonViewer
  row={rowData}
  schema="public"
  table="my_table"
  connectionUrl="postgresql://..."
  showRelationships={true}
  onExpandToDialog={() => {}}
  onClose={() => {}}
/>
```

### 2. Inline JSON Popover
- **File**: `src/components/inline-json-popover.tsx`
- **Updated with same props** for consistency across interfaces

### 3. Enhanced JSON Viewer
- **File**: `src/components/ui/enhanced-json-viewer.tsx`
- **Purpose**: Wrapper component for expanded dialogs
- **Provides**: Unified interface supporting both regular JSON and relationship exploration

**Usage**:
```tsx
<EnhancedJsonViewer
  data={rowData}
  schema="public"
  table="my_table"
  connectionUrl="postgresql://..."
  showRelationships={true}
  maxDepth={10}
/>
```

## Data Flow

### Initialization
1. User clicks to view row data (opens inline popover)
2. `RelationshipExplorer` is mounted with row data
3. Fetches all relationships for the table (via `getTableRelationshipsQueryOptions`)
4. Filters relationships where FK/PK value is non-null
5. Fetches row counts in a single batch query (via `getRelationshipsCountsQueryOptions`)
6. Renders row with relationship keys (all collapsed by default)

### Expansion Flow
1. User clicks relationship key chevron
2. `RelationshipExplorerKey` toggles expanded state
3. `RelationshipExplorerRows` fetches related data (lazy-load)
4. Shows first 5 rows in compact preview
5. Loading spinner shown during fetch
6. Error handling displays error message inline

### Optimization Strategies
- **Batched counts**: All relationship counts fetched in single query
- **Lazy-loading**: Related rows only fetched on expand
- **Memoization**: Components memoized to prevent unnecessary re-renders
- **Compact display**: Shows preview format instead of full tables
- **Depth limiting**: JSON expansion limited to configurable depth (default 3)

## Relationship Type Indicators

### Outgoing Relationships (Foreign Keys)
- **Display**: `"tableName → referencedTable"`
- **Section**: `"__outgoing"` in JSON
- **Meaning**: This row references another table

### Incoming Relationships (Referenced By)
- **Display**: `"referencingTable ← tableName"`
- **Section**: `"__incoming"` in JSON
- **Meaning**: Other rows reference this row

## Visual Structure

```
{
  "id": "abc-123",
  "name": "John",
  "email": "john@example.com",
  "__outgoing": {
    "users → departments": [1 rows]
    "users → roles": [2 rows]
  },
  "__incoming": {
    "orders ← users": [5 rows]
    "comments ← users": [3 rows]
  }
}
```

When expanded:

```
{
  "id": "abc-123",
  "name": "John",
  "email": "john@example.com",
  "__outgoing": {
    "users → departments": [1 rows]
      dept_id: "dept-001" · name: "Engineering"
    "users → roles": [2 rows]
      role_id: "role-1" · name: "Admin"
      role_id: "role-2" · name: "Editor" ...
  },
  "__incoming": {
    "orders ← users": [5 rows]
      order_id: "ord-123" · total: 99.99 · status: "pending"
      order_id: "ord-456" · total: 149.99 · status: "completed" ...
      3 more rows...
    "comments ← users": [3 rows]
      ...
  }
}
```

## Usage Examples

### Basic Usage in Inline Popover

```tsx
import { RowJsonViewer } from "#src/components/row-json-viewer";

<RowJsonViewer
  row={selectedRow}
  schema={currentSchema}
  table={currentTable}
  connectionUrl={connectionUrl}
  showRelationships={true}
/>
```

### In Expanded Dialog

```tsx
import { EnhancedJsonViewer } from "#src/components/ui/enhanced-json-viewer";

<EnhancedJsonViewer
  data={selectedRow}
  schema={currentSchema}
  table={currentTable}
  connectionUrl={connectionUrl}
  showRelationships={true}
  maxDepth={5}
/>
```

### Without Relationships (Fallback)

```tsx
<RowJsonViewer
  row={selectedRow}
  showRelationships={false}  // Falls back to regular JSON viewer
/>
```

## Performance Considerations

1. **Count Query**: Single batched query for all relationships
   - Runs once when component mounts
   - Stale time: determined by query options
   - Cached by TanStack Query

2. **Related Rows**: Lazy-loaded per relationship on expand
   - Fetches limit of 100 rows
   - Displays first 5 + "N more..." indicator
   - Each fetch cached independently

3. **Memoization**: All sub-components memoized
   - Prevents re-renders on parent state changes
   - Improves performance with large row counts

4. **JSON Depth**: Limited to configurable depth
   - Default: 3 levels
   - Prevents rendering very deep nested structures
   - Can be customized per use case

## Error Handling

- **Relationship fetch error**: Shows error message inline in relationship section
- **Counts fetch error**: Still shows relationship keys with "..." placeholder
- **Related rows fetch error**: Shows red error box with error message
- **Network errors**: Graceful degradation with error messages

## Future Enhancements

1. **Full Relationship Panel**: Expand to show all related data in a DataTable
2. **Relationship Graph**: Visualize relationships as a network diagram
3. **Related Data Navigation**: Click to navigate to related records
4. **Bi-directional Exploration**: Follow relationships deeper
5. **Export/Copy**: Copy relationship data in various formats
6. **Filters**: Add filters within expanded relationships
7. **Sorting**: Sort relationship data by columns

## Accessibility

- Keyboard navigation: Tab through collapsible sections
- Arrow keys: Expand/collapse relationships
- Loading states: Screen reader announcements
- Disabled state: Visually indicated for relationships with no data
- Tooltips: Hover for full relationship details

## Browser Compatibility

- All modern browsers (Chrome, Firefox, Safari, Edge)
- Requires support for:
  - ES6+ (arrow functions, destructuring)
  - React 18+ with hooks
  - TanStack Query v5+

## Testing

When testing components that use RelationshipExplorer:

```tsx
// Mock the relationship queries
vi.mock("#src/server/pg/start-fns/get-table-relationships.start.ts");
vi.mock("#src/server/pg/start-fns/get-relationships-counts.start.ts");

// Provide mock data in test setup
const mockRelationships: TableRelationship[] = [
  {
    type: "outgoing",
    referencingTable: "users",
    referencingColumn: "dept_id",
    referencedTable: "departments",
    referencedColumn: "id",
    // ... other fields
  },
];
```

## Files Modified

1. `src/components/relationship-explorer.tsx` - **NEW**
2. `src/components/relationship-explorer.key.tsx` - **NEW**
3. `src/components/relationship-explorer.rows.tsx` - **NEW**
4. `src/components/ui/enhanced-json-viewer.tsx` - **NEW**
5. `src/components/row-json-viewer.tsx` - **UPDATED**
6. `src/components/inline-json-popover.tsx` - **UPDATED**

## Related Files

- `src/types/relationships.ts` - Relationship type definitions
- `src/server/pg/start-fns/get-table-relationships.start.ts` - Fetch relationships
- `src/server/pg/start-fns/get-relationships-counts.start.ts` - Batch fetch counts
- `src/server/pg/start-fns/get-relationship-subrow-data.start.ts` - Fetch related rows
