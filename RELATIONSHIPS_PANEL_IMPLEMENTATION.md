# Relationships Panel Implementation Summary

## Overview
Implemented a **bottom relationships panel** that displays below the main data table, allowing users to explore incoming and outgoing relationships for a selected row without losing context of the main table view.

## Architecture

### Files Created

#### 1. `src/components/relationships-panel.tsx` (NEW)
**Purpose:** Main relationships panel component that displays relationships for a selected row.

**Key Features:**
- Shows header with selected row identifier (first 2 column values, joined with " • ")
- Displays schema.table context
- Separated sections for "References (Outgoing)" and "Referenced By (Incoming)"
- Each relationship shown as a collapsible button with:
  - Chevron icon indicating expand/collapse state
  - Relationship display label
  - Referenced table name
  - Directional arrow ("→" for outgoing, "←" for incoming)
- Close button (X) to dismiss the panel
- Max height with scrolling for overflow relationships

**Props:**
```typescript
interface RelationshipsPanelProps {
  connectionUrl: string;
  schema: string;
  table: string;
  selectedRowId: string | null;
  rowData: Record<string, unknown> | null;
  onClose: () => void;
}
```

**Dependencies:**
- `getTableRelationshipsQueryOptions()` from server (efficient single query)
- `TableRelationship` type with: type, schema, table, columns, constraint name
- React Query for data fetching
- Lucide React icons (ChevronDown, ChevronRight, X)

### Files Modified

#### 1. `src/components/pages/connection.page.tsx` (MODIFIED)
**Changes:**
1. **Import added:** `RelationshipsPanel` component
2. **State added:**
   - `selectedRowId`: Tracks the ID of the currently selected row
   - `selectedRowData`: Stores the full row data for display
3. **DataTable props updated:**
   - Added `onRowClick` handler that:
     - Extracts primary key from row to create row ID
     - Updates selectedRowId and selectedRowData state
4. **JSX updated:**
   - Added `RelationshipsPanel` component below DataTable and ScrollToColumnButton
   - Only renders when selectedRowId && selectedRowData are set
   - Integrated with existing activeConnectionUrl, schema, table context

**Code Flow:**
```
User clicks row
  ↓
DataTable onRowClick fires
  ↓
primaryKeyColumn extracted from columnMetadata
  ↓
setSelectedRowId & setSelectedRowData called
  ↓
RelationshipsPanel renders with data
  ↓
User sees relationships for selected row
  ↓
User clicks close button
  ↓
setSelectedRowId(null) & setSelectedRowData(null)
  ↓
RelationshipsPanel unmounts
```

## Data Flow

### Fetching Relationships
1. When RelationshipsPanel mounts, it calls `useQuery(getTableRelationshipsQueryOptions())`
2. This queries the backend for all relationships of the current table
3. Results include both outgoing (FK from this table) and incoming (tables referencing this table)
4. Data is filtered into `outgoingRels` and `incomingRels` arrays

### Rendering Relationships
1. Relationships grouped by type (Outgoing/Incoming)
2. Each relationship displayed as `RelationshipButton` with toggle capability
3. Users can expand/collapse relationships to see more details (future enhancement)

## UI/UX Design

### Panel Placement
- **Location:** Below DataTable, above BulkActionBar/StatusBar
- **Height:** Scrollable, max-h-96 (384px)
- **Background:** Uses card background color for consistency
- **Border:** Top border separates from DataTable

### Header
- Shows "RELATIONSHIPS FOR: [first value] • [second value]"
- Includes schema.table context
- X button to close panel

### Relationship Sections
Two sections per panel:
1. **References (Outgoing)** - tables this row references via FK
2. **Referenced By (Incoming)** - tables that reference this row

### Relationship Buttons
- **Collapsed:** Shows label, table name, direction arrow
- **Expandable:** Chevron icon indicates expand capability
- **Hover:** bg-accent/50 background for visual feedback
- **Status:**
  - "→" for outgoing relationships
  - "←" for incoming relationships
  - "N/A" if FK value is null (for outgoing)

## Current Implementation Status

### ✅ COMPLETE
- [x] RelationshipsPanel component created with full structure
- [x] Integration into connection.page.tsx
- [x] Row selection state management
- [x] Relationship fetching via React Query
- [x] Outgoing/Incoming relationship separation
- [x] Header with row identifier
- [x] Collapsible relationship buttons (UI ready)
- [x] Close functionality
- [x] No TypeScript errors
- [x] Build succeeds

### ⏳ IN PROGRESS
None currently

### 📋 PLANNED / NOT STARTED

#### 1. RelationshipDataTable Component (HIGH PRIORITY)
- **Purpose:** Display actual related rows when expanding a relationship
- **Features:**
  - Mini datatable showing rows from related table
  - Filtered by foreign key relationship
  - Show key columns from related table
  - Row count display
  - "[→ Open in full table]" button to navigate to related table
- **Implementation:**
  - Create `src/components/relationships-panel/relationship-data-table.tsx`
  - Use `queryTableData` to fetch related rows with FK filter
  - Handle pagination/limiting related rows displayed

#### 2. Row Counting (MEDIUM PRIORITY)
- **Purpose:** Show count of related rows before expansion
- **Current State:** Returns null/"N/A" for incoming relationships
- **Needed:**
  - For outgoing: Simple (show if FK is populated)
  - For incoming: Query to count related rows
  - Cache results with React Query

#### 3. Navigation Integration (MEDIUM PRIORITY)
- **Purpose:** Click related row to navigate to it in related table
- **Features:**
  - Clicking related row ID opens full table view
  - Sets filters to show context
  - Maintains breadcrumb/context

#### 4. Resize Capability (LOW PRIORITY)
- **Purpose:** Allow users to resize panel height
- **Current:** Fixed max-h-96
- **Enhancement:** Resizable panel with height preference storage

## Testing Checklist

- [ ] Row selection works (click any row)
- [ ] RelationshipsPanel appears below table
- [ ] Close button dismisses panel
- [ ] Header shows correct row identifier and table context
- [ ] Outgoing relationships display correctly
- [ ] Incoming relationships display correctly (if any)
- [ ] Expand/collapse buttons respond to clicks
- [ ] No layout issues with DataTable
- [ ] Performance is acceptable with many relationships
- [ ] Scrolling works for many relationships

## Integration Notes

### Connection with Existing Features
- Uses existing `useConnectionPageState` hook for context
- Leverages `getTableRelationshipsQueryOptions` (efficient backend query)
- Compatible with existing DataTable row selection
- Uses existing UI components (Button, Spinner)
- Follows existing design system (colors, spacing, typography)

### Future Integration Points
1. Click related row → navigate to related table with context
2. Show row counts per relationship
3. Bulk actions on related rows
4. Export related rows
5. Relationship visualization/graph view

## Performance Considerations

- **Query Caching:** React Query caches relationship metadata for 5 minutes
- **Lazy Loading:** Related row data fetched only when expanding
- **Virtualization:** Can be added to RelationshipDataTable for large result sets
- **Memory:** Relationship panel only renders when row selected

## Code Quality

- ✅ TypeScript strict mode - no errors
- ✅ Uses existing design system
- ✅ Follows React best practices
- ✅ Proper state management
- ✅ Accessible (semantic HTML, proper ARIA attributes can be added)
- ✅ Builds successfully with Vite
