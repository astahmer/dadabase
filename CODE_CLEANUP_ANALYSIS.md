# Dadabase Code Cleanup Analysis

## Overview
Comprehensive analysis of the `src` folder identifying opportunities for code cleaning and maintainability improvements without making changes.

**Statistics:**
- Total server-side files: 43
- Test files: 11 (mostly server-side only)
- Hook files: 12 (all generic hooks mixed together)
- Component files: 100+ across folders

---

## 1. GENERIC COMPONENTS POLLUTED WITH APP-SPECIFIC CODE

### Issue: DataTable Component
**File:** `src/components/data-table.tsx` (line count: ~430)

**Problem:**
- Props `tableMetadata` and `connectionUrl` are app-specific (connection context)
- These are passed through to child components (`DataTableRow`, `VirtualizedTableBody`)
- DataTable should be completely generic and agnostic of connection/schema/table context
- Currently leaks implementation details that make it non-reusable

**Impact:**
- Cannot reuse DataTable for other data sources
- Hard to test in isolation
- Violates single responsibility principle

**Affected Props:**
```tsx
tableMetadata?: { schema: string; table: string };
connectionUrl?: string;
```

**Child Components Also Polluted:**
- `DataTableRow` - accepts same metadata props
- `VirtualizedTableBody` - accepts same metadata props
- `RowContextMenu` - uses connection-specific logic

**Recommendation:**
- Remove `tableMetadata` and `connectionUrl` from DataTable/DataTableRow/VirtualizedTableBody
- Pass these only through context (create DataTableContext) if needed
- Use callback props for row-level actions that need context
- Move connection-aware logic to wrapper component

---

## 2. FOLDER ORGANIZATION ISSUES

### Problem: Hooks Folder is Anti-Pattern
**Location:** `src/hooks/` (12 files)

**Current Structure:**
```
hooks/
├── use-connection-page-state.tsx        (app-specific)
├── use-connection-storage.ts             (app-specific)
├── use-debounced-search-param.ts         (generic)
├── use-local-storage.ts                  (generic)
├── use-natural-language-search.ts        (app-specific)
├── use-open-tabs.ts                      (app-specific)
├── use-query-builder.ts                  (generic)
├── use-rows-columns.actions.ts           (app-specific)
├── use-rows-columns.tsx                  (app-specific)
├── use-table-column-metadata.ts          (app-specific)
├── use-table-relationships.ts            (app-specific)
└── use-theme.ts                          (generic)
```

**Problem:**
- All hooks lumped together regardless of scope/purpose
- Mixing generic utilities with feature-specific hooks
- Hard to understand dependencies
- Difficult to track what's connection-specific vs. generic

**Recommendation - Reorganize to:**

```
hooks/
├── generic/                    (reusable hooks)
│   ├── use-debounced-search-param.ts
│   ├── use-local-storage.ts
│   └── use-theme.ts
│
components/
├── pages/connection/           (connection-page specific)
│   ├── hooks/
│   │   ├── use-connection-page-state.tsx
│   │   ├── use-connection-storage.ts
│   │   ├── use-natural-language-search.ts
│   │   ├── use-open-tabs.ts
│   │   ├── use-rows-columns.tsx
│   │   ├── use-rows-columns.actions.ts
│   │   ├── use-query-builder.ts
│   │   ├── use-table-column-metadata.ts
│   │   └── use-table-relationships.ts
│   ├── connection.page.tsx
│   ├── connection-page/        (sub-components for connection page)
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   ├── tabs.tsx
│   │   ├── filters.tsx
│   │   ├── status-bar.tsx
│   │   └── [other specific components]
│   └── connection.form.tsx
```

---

## 3. GOD COMPONENTS - NEEDS SPLITTING

### Issue 1: ConnectionPage Component (connection.page.tsx)
**File Size:** ~1,400 lines

**Responsibilities (Too Many):**
1. Page layout & orchestration
2. Database connection selection & switching
3. Schema & table selection
4. Query building & filtering
5. View mode toggling (rows vs. structure)
6. Table data display with virtualization
7. Column visibility management
8. Pagination & sorting
9. Relationships panel management
10. Row JSON viewer management
11. Quick references panel management
12. Tab management for multiple tables
13. Error state handling
14. Loading states
15. Data refresh & reset

**Sub-components Embedded:**
- `ConnectionPageInner` (wrapper)
- `ConnectionPageHeader` (~200 lines)
- `ConnectionPageSidebar` (~300 lines)
- `ConnectionPageTabs` (~200 lines)
- `ConnectionPageFilters` (~200 lines)
- `ConnectionPageStatusBar` (~250 lines)
- `StructureTable` (~100 lines)
- `RowsTableErrorState` (~50 lines)
- Plus custom hooks for panel sizing

**Impact:**
- Extremely hard to test
- Difficult to maintain changes
- Hard to refactor individual features
- Reusability: 0
- Cognitive load: Very high

**Recommendation:**
Already has sub-components defined but embedded in same file. **Immediate Action:**
1. Extract each sub-component to separate file:
   ```
   components/pages/connection/
   ├── connection.page.tsx                 (main orchestrator only)
   ├── connection-header.tsx
   ├── connection-sidebar.tsx
   ├── connection-tabs.tsx
   ├── connection-filters.tsx
   ├── connection-status-bar.tsx
   ├── structure-table.tsx
   └── rows-table-error-state.tsx
   ```

2. Create a page state container hook to manage all page-level state
3. Split business logic from presentation

---

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

---

## 4. UNNECESSARY & UNHEALTHY useEffect/useState

### Problem 1: useSplitterPanelPercentSize Hook (connection.page.tsx, ~10 lines)

```tsx
const useSplitterPanelPercentSize = (fromPixels: number) => {
	const [size, setSize] = useState(fromPixelToPercentage(fromPixels));

	useEffect(() => {
		const handleResize = () => {
			setSize(fromPixelToPercentage(50));  // ⚠️ Hardcoded 50
		};
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return size;
};
```

**Issues:**
- Parameter `fromPixels` ignored after initial state
- Resize handler always uses hardcoded `50`
- Could be simplified to just compute value on demand
- Listener never cleaned up properly (event target not captured)

**Recommendation:**
Remove and use direct calculation or move to dedicated hook with proper dependency management.

---

### Problem 2: Sidebar Width State (collapsible-sidebar.tsx)
**Multiple useState calls:**
```tsx
const [internalIsOpen, setInternalIsOpen] = useState(true);
const [width, setWidth] = useState(224);
const [isResizing, setIsResizing] = useState(false);
```

**useEffect:** Listen to window resize

**Issues:**
- 3 separate state updates that could be combined
- useEffect for window resize without proper cleanup
- Could use useReducer for width + resizing state
- Width change could be handled without state

**Recommendation:**
Consolidate to single `useReducer` for sidebar state

---

### Problem 3: Multiple useState in RelationshipsPanel
```tsx
const [selectedRelationships, setSelectedRelationships] = useState<Set<string>>(new Set());
const [displayedRelationships, setDisplayedRelationships] = useState<Set<string>>(new Set());
const [relationshipViewMode, setRelationshipViewMode] = useState<Record<string, RelationshipViewMode>>({});
const [stickyRelationship, setStickyRelationship] = useState<string | null>(null);
const [cardRefs, setCardRefs] = useState<Record<string, HTMLDivElement | null>>({});
```

**useEffect:** Sticky relationship tracking

**Issues:**
- 5 separate state variables (7+ with derived states)
- Tight coupling between states
- Complex useEffect for sticky tracking
- Difficult to reason about state transitions

**Recommendation:**
- Use `useReducer` for relationship panel state
- Extract sticky tracking to custom hook
- Extract view mode management to separate concern

---

### Problem 4: QueryFilterBuilder useEffect
**File:** `src/components/query-filter-builder.tsx`

```tsx
useEffect(() => {
	// Some side effect logic
}, []);  // Empty dependency array
```

**Issues:**
- Hard to see what this does without reading full component
- Need to verify if dependencies are correct

**Recommendation:**
Review and document purpose of all useEffect calls

---

## 5. CODE DUPLICATION

### Issue 4: Duplicate Selection/Filtering Logic
**ConnectionPageSidebar:**
- Database selection + filtering
- Schema selection (static)
- Tables selection + filtering with search

**Recommendation:**
Create generic selector component that handles:
```tsx
<GenericSelector<T>
	items={items}
	selectedValue={selected}
	onSelect={onSelect}
	searchable
	searchPlaceholder="Filter..."
	renderItem={(item) => item.name}
	getLabel={(item) => `${item.name} (${item.count})`}
	error={error}
	isLoading={isLoading}
	onRetry={refetch}
/>
```

---

## 6. LACK OF UNIT TESTS (SERVER-SIDE)

**Current State:**
- 11 test files total
- Only 4 test files in `/src/server/pg/fns/`:
  - `get-table-columns.kysely.test.ts`
  - `get-relationship-cardinality.kysely.test.ts`
  - `get-relationships-counts.kysely.test.ts`
  - `query-table-data.kysely.test.ts`

**Server Functions WITHOUT Tests (43 files, ~26 untested):**

**PostgreSQL introspection functions (no tests):**
- `test-pg-connection.ts`
- `get-available-database-list.kysely.ts` (has .start.ts wrapper)
- `get-table-foreign-keys.kysely.ts`
- `get-table-relationships.kysely.ts`
- `get-available-schemas.kysely.ts`
- `get-available-tables.kysely.ts`
- `get-all-tables-columns.kysely.ts`

**Database connection management (no tests):**
- `create-db-connection.ts`
- `update-db-connection.ts`
- `delete-db-connection.ts`

**Utility functions (no tests):**
- `build-where-expression.ts`

**Result queries (no tests):**
- `get-relationship-subrow-data.start.ts`
- `get-fk-target-data.start.ts`
- `find-column-references.start.ts`

**Recommendation - Priority:**
1. **High:** `build-where-expression.ts` - Core logic for query building
2. **High:** `get-table-foreign-keys.kysely.ts` - Critical for relationships
3. **High:** `create/update/delete-db-connection.ts` - Data integrity
4. **Medium:** `get-available-*.kysely.ts` - Introspection logic
5. **Medium:** `get-table-relationships.kysely.ts` - Relationship logic

**Missing test coverage for:**
- Error scenarios
- Edge cases
- Integration between services
- Query result validation

---

## 7. NAMING ISSUES

### Poor Naming Examples:

1. **`withRowContextMenu` vs `withContextMenu`**
   - `DataTable` prop: `withContextMenu`
   - `DataTableRow` prop: `withRowContextMenu`
   - Inconsistent naming for same concept

2. **`getTableContainer` vs `containerRef`**
   - Callback that returns HTMLDivElement
   - Could be clearer: `onTableContainerReady`

3. **`renderSubrows` - Ambiguous**
   - Could be: `renderRowSubcomponents`, `renderExpandedRowContent`

4. **`onExpandRowJson` - Naming is backwards**
   - Suggests it expands JSON
   - Actually: "on expand row to view JSON"
   - Better: `onViewRowJson` or `onOpenRowJsonViewer`

5. **`DataTableRowSubrow` interface**
   - "Subrow" is vague: `ExpandableRowContent` or `RowSubcomponent`

6. **File naming in hooks**
   - `use-rows-columns.actions.ts`
   - Why `.actions`? Should describe what it does: `use-row-context-menu-actions.ts`

7. **`TableMetadata` type**
   - Confusing: Only contains `schema` and `table` strings
   - Better: `TableIdentifier` or `TableReference`

8. **`connectionUrl` prop naming**
   - Leaks implementation detail
   - Generic component shouldn't know about "connection"
   - Better: pass through context or parent-specific prop

9. **`RelationshipViewMode` enum**
   - Where's the enum? `src/types/relationship-view-mode.ts`
   - Values: Unclear from name, should be at that file

10. **`findColumnReferencesWithCountsQueryOptions`**
    - Verbose function name
    - Consider: `getColumnReferencesQuery` (QueryOptions suffix is obvious from usage)

---

## 8. COMPONENT ORGANIZATION ISSUES

### Current Structure:
```
components/
├── ui/                         (generic UI primitives) ✓
├── pages/
│   ├── connection.page.tsx
│   ├── connection.form.tsx
│   └── connection-page/        (sub-components)
├── [mix of generic + specific] (PROBLEM)
├── data-table.tsx
├── data-table.row.tsx
├── data-table.cell.tsx
├── ...
└── use-data-table.ts           (WRONG: should be in components not root)
```

**Problem:**
- Non-reusable, app-specific components mixed with generic ones
- Makes it hard to tell what's reusable
- `use-data-table.ts` is in components root (should be generic hook)

**Recommendation - Reorganize:**
```
components/
├── ui/                         (generic primitives, 100% reusable)
│   ├── button.tsx
│   ├── dialog.tsx
│   └── ...
│
├── data-table/                 (generic data table, 90% reusable)
│   ├── data-table.tsx          (remove app-specific props)
│   ├── data-table.row.tsx
│   ├── data-table.cell.tsx
│   ├── data-table.virtualized-table-body.tsx
│   ├── data-table.styles.ts
│   └── use-data-table.ts
│
├── tables/                      (app-specific table components)
│   ├── database-table.tsx       (tables with database connections)
│   ├── relationship-table.tsx
│   ├── structure-table.tsx
│   └── rows-table.tsx           (wrapper around DataTable with connection context)
│
├── pages/
│   └── connection/
│       ├── connection.page.tsx  (orchestrator only ~100 lines)
│       ├── connection.form.tsx
│       ├── components/
│       │   ├── header.tsx
│       │   ├── sidebar.tsx
│       │   ├── tabs.tsx
│       │   ├── filters.tsx
│       │   ├── status-bar.tsx
│       │   └── error-state.tsx
│       ├── hooks/
│       │   ├── use-connection-page-state.tsx
│       │   ├── use-query-builder.tsx
│       │   ├── use-table-column-metadata.tsx
│       │   ├── use-table-relationships.tsx
│       │   └── ...
│       └── types.ts
│
├── sidebars/
│   └── collapsible-sidebar.tsx
│
├── panels/
│   ├── relationships-panel.tsx
│   ├── quick-references-panel.tsx
│   └── (other panels)
│
├── menus/
│   ├── row-context-menu.tsx
│   ├── column-header-context-menu.tsx
│   └── ...
│
└── shared/                      (cross-feature components)
    ├── error-boundary-card.tsx
    ├── loading-spinner.tsx
    ├── status-bar.tsx
    └── ...
```

---

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

### Issue 3: Missing Type Safety in Router Search Params
**Problem:** Many `useSearch()` calls with manual selection functions
- Prone to typos
- No compile-time checking
- Duplicated across components

**Recommendation:**
Create typed search param hooks in connection page folder

### Issue 4: Inconsistent Error Handling
- Some components use `getErrorMessage()` utility
- Some render errors directly
- No consistent error boundary strategy

**Recommendation:**
- Create `<ErrorDisplay error={error} />` component
- Use consistent error message formatting

### Issue 5: Performance: Unnecessary Memo/useMemo
Many components use `memo` but may not need it. Need profiling to identify real bottlenecks.

**Example:** `DataTableRow` is memoized but receives `getRow` callback which changes on every render

### Issue 6: Magic Numbers/Strings
**Examples:**
- `224` - sidebar default width (where is this constant?)
- `30` - overscan default in virtualization
- `"cozy"` - default table size
- `50` - hardcoded pixel size in `useSplitterPanelPercentSize`

**Recommendation:**
Create constants file:
```ts
// src/constants/ui.ts
export const SIDEBAR_DEFAULT_WIDTH = 224;
export const TABLE_VIRTUALIZATION_OVERSCAN = 30;
export const DEFAULT_TABLE_SIZE = "cozy" as const;
```

### Issue 7: Commented Code
**In DataTableRow:** Large commented section for `__actions` column
**In relationship-panel:** Multiple commented debug statements

**Recommendation:** Remove all commented code

### Issue 8: Missing JSDoc Documentation
No documentation on:
- Public hook APIs
- Complex component props
- Utility functions
- Type definitions

---

## 10. SUMMARY TABLE

| Category | Severity | Count | Status |
|----------|----------|-------|--------|
| Generic components with app-specific props | HIGH | 3 | Critical |
| God components (>500 LOC) | HIGH | 3+ | Critical |
| Hook folder anti-pattern | HIGH | 12 | Immediate |
| Unnecessary useState/useEffect | MEDIUM | 10+ | Soon |
| Code duplication (state update patterns) | MEDIUM | 10+ | Soon |
| Lack of server-side unit tests | MEDIUM | 26 | Ongoing |
| Poor naming (confusing names) | LOW | 10+ | Nice-to-have |
| Folder organization issues | MEDIUM | Multiple | Soon |
| Inline component definitions | LOW | 5+ | Nice-to-have |
| Inconsistent error handling | MEDIUM | Multiple | Soon |

---

## 11. RECOMMENDED CLEANUP ORDER

### Phase 1 (Critical - Foundation)
1. Remove app-specific props from DataTable, DataTableRow
2. Extract DataTable sub-components to separate files
3. Reorganize hooks folder by feature/scope
4. Extract ConnectionPage sub-components to separate files

### Phase 2 (High Priority - Structure)
1. Split RelationshipsPanel into smaller components
2. Extract tab state update logic to utility
3. Create reusable error/loading UI components
4. Move connection-specific UI logic to wrapper components

### Phase 3 (Medium Priority - Quality)
1. Consolidate useState in complex components to useReducer
2. Add server-side unit tests (high-impact functions first)
3. Create connection page typed hooks for router search params
4. Extract sticky relationship tracking to custom hook

### Phase 4 (Nice-to-Have - Polish)
1. Fix naming inconsistencies
2. Remove commented code
3. Add JSDoc documentation
4. Extract magic numbers to constants
5. Performance profiling and optimization

---

## 12. ESTIMATED EFFORT

- **Phase 1:** 3-4 days
- **Phase 2:** 2-3 days
- **Phase 3:** 3-5 days
- **Phase 4:** 2-3 days

**Total:** ~10-15 days of focused refactoring work

---

## Conclusion

The codebase has solid foundational structure but suffers from:
1. **Architecture issues** (generic components polluted)
2. **Organization issues** (hooks folder anti-pattern)
3. **Scale issues** (god components too large)
4. **Testing gaps** (server-side untested)

Most critical is separating concerns between generic, reusable components and app-specific implementations. This will significantly improve maintainability, testability, and reusability.
