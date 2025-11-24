# Dadabase Code Cleanup Analysis

## Overview
Comprehensive analysis of the `src` folder identifying opportunities for code cleaning and maintainability improvements.

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

### Issue 5: Performance: Unnecessary Memo/useMemo
Many components use `memo` but may not need it. Need profiling to identify real bottlenecks.

**Example:** `DataTableRow` is memoized but receives `getRow` callback which changes on every render

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
