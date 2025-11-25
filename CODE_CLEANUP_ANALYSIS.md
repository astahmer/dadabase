# Dadabase Code Cleanup Analysis

## Overview
Comprehensive analysis of the `src` folder identifying opportunities for code cleaning and maintainability improvements.

### Issue 2: RelationshipsPanel Component (relationships-panel.tsx)
**File Size:** ~800 lines

**Responsibilities:**
1. Relationship fetching & caching
2. Relationship filtering (null values)
3. Count batching & fetching
4. Sticky relationship tracking
5. View mode switching (RelatedData vs RelationshipSubrow)
6. Rendering multiple relationship cards
7. Pagination within relationships
8. Data fetching state management
9. UI interactions (collapse/expand, selection)

**Problems:**
- Multiple `useState` calls (selectedRelationships, displayedRelationships, relationshipViewMode, stickyRelationship, etc.)
- Complex `useEffect` for sticky tracking
- Too much business logic mixed with UI logic
- Over 250+ lines of just rendering

**Recommendation:**
Split into:
```
components/
├── relationships-panel.tsx               (container/orchestrator ~200 lines)
├── relationship-card.tsx                 (single relationship UI)
├── relationship-explorer.tsx             (refactor existing one)
└── hooks/
    └── use-relationships-panel-state.ts  (extract all state management)
```

---

### Issue 3: QuickReferencesPanel Component (quick-references-panel.tsx)
**File Size:** ~450 lines

**Problems:**
- Manages multiple sections expansion state
- Handles sort state
- Complex filtering logic
- Renders multiple reference types
- Mixing data fetching with UI rendering

**Recommendation:**
Extract hooks and sub-components

## 9. OTHER CODE QUALITY ISSUES

### Issue 1: Inline Component Definitions
**Problem:** Components defined inline in render functions (ConnectionPageInner, StructureTable, etc.)

Creates new component instances on each render - potential performance/key issues

### Issue 2: Mixed Concerns in Hooks
**Example:** `use-connection-page-state.tsx` (~450 lines)
- Fetches data
- Formats data
- Creates columns
- Manages row selection
- Manages column pinning
- Manages sorting
- Manages pagination
- Manages visibility

**Should split into:**
- `useRowsData` - data fetching
- `useTableColumns` - column definitions
- `useTableState` - table state management

### Issue 5: Performance: Unnecessary Memo/useMemo
Many components use `memo` but may not need it. Need profiling to identify real bottlenecks.

**Example:** `DataTableRow` is memoized but receives `getRow` callback which changes on every render
