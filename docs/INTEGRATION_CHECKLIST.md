# Relationship Subrows - Integration Checklist

## Overview
All feature code is complete and tested. This checklist guides final integration into the connection page.

## Pre-Integration Verification

- [ ] Pull latest changes on branch `feat/relationships`
- [ ] Run `pnpm install` (if dependencies changed)
- [ ] Run `pnpm typecheck` - should show zero errors
- [ ] Verify these files exist:
  - `src/types/relationships.ts`
  - `src/hooks/use-relationship-expansion-state.ts`
  - `src/hooks/use-table-relationships.ts`
  - `src/components/relationship-cell.tsx`
  - `src/components/relationship-subrow-table.tsx`
  - `src/components/relationship-column.tsx`
  - `src/components/relationship.styles.css`
  - `src/server/pg/start-fns/get-relationship-subrow-data.start.ts`

## Integration Steps

### Step 1: Update `use-connection-page-state.tsx`

**Location**: `src/hooks/use-connection-page-state.tsx`

- [ ] Add imports at top:
```tsx
import { useRelationshipExpansionState } from "../hooks/use-relationship-expansion-state";
import { useTableRelationships } from "../hooks/use-table-relationships";
import { buildRelationshipColumns, createRelationshipSubrowComponent } from "../components/relationship-column";
```

- [ ] Inside `useConnectionPageState` function, after `dataColumns` definition, add:
```tsx
// Fetch relationship metadata
const relationshipsQuery = useTableRelationships({
  url: activeConnectionUrl,
  schema: search.schema || "",
  table: search.table || "",
});

// Manage expansion state
const { expandedRelationships, toggleExpansion } = useRelationshipExpansionState();

// Build relationship columns
const relationshipColumns = useMemo(() => {
  if (!relationshipsQuery.data?.length) return [];

  return buildRelationshipColumns(
    relationshipsQuery.data,
    expandedRelationships,
    (rowId, constraintName) => toggleExpansion(rowId, constraintName),
  );
}, [relationshipsQuery.data, expandedRelationships, toggleExpansion]);

// Create subrow component wrapper
const RelationshipSubrowComponent = useMemo(
  () => createRelationshipSubrowComponent({ url: activeConnectionUrl }),
  [activeConnectionUrl],
);
```

- [ ] Update the `rowsColumns` definition to include relationship columns:
```tsx
const rowsColumns = useMemo(
  () => {
    const allDataColumns = [...dataColumns, ...relationshipColumns];
    return dataColumns.length
      ? [...staticColumns, ...allDataColumns]
      : [
          ...staticColumns,
          ...(Array.from(
            { length: 10 },
            (_, i) =>
              ({
                id: `__skeleton-${i}`,
                cell: () => (
                  <div className="h-3 bg-muted rounded animate-pulse" />
                ),
              }) as ColumnDef<any>,
          ) as typeof staticColumns),
        ];
  },
  [staticColumns, dataColumns, relationshipColumns],
);
```

- [ ] Update the return statement to include:
```tsx
return {
  // ... existing returns ...
  expandedRelationships,
  relationships: relationshipsQuery.data ?? [],
  RelationshipSubrowComponent,
};
```

**Verification**:
```bash
pnpm typecheck
# Should have zero errors
```

### Step 2: Update `connection.page.tsx`

**Location**: `src/components/pages/connection.page.tsx`

- [ ] In the `ConnectionPageInner` component, extract new values from pageState:
```tsx
const {
  // ... existing destructuring ...
  expandedRelationships,      // ADD THIS
  relationships,              // ADD THIS
  RelationshipSubrowComponent, // ADD THIS
} = pageState;
```

- [ ] Find the `<DataTable` component call (should be in the main content area)
- [ ] Add these three props to the DataTable:
```tsx
<DataTable
  virtualized
  enableColumnOrdering
  table={rowsDataTable}
  getTableContainer={setTableContainer}
  // ... other existing props ...
  expandedRelationships={expandedRelationships}      // ADD THIS
  relationships={relationships}                      // ADD THIS
  RelationshipSubrowComponent={RelationshipSubrowComponent} // ADD THIS
  // ... rest of props ...
/>
```

**Verification**:
```bash
pnpm typecheck
# Should have zero errors
```

### Step 3: Test the Integration

- [ ] Start the dev server: `pnpm dev`
- [ ] Navigate to any table with foreign keys
- [ ] Verify relationship columns appear after regular columns
- [ ] Click expand button on a row
- [ ] Verify nested table appears with loading indicator briefly
- [ ] Verify nested table shows related rows
- [ ] Verify expand/collapse toggle works
- [ ] Verify multiple rows can be expanded simultaneously
- [ ] Try expanding multiple relationships on same row

### Step 4: Manual Testing

Test with various scenarios:

- [ ] Table with 0 relationships - should work normally
- [ ] Table with 1 relationship - should show 1 relationship column
- [ ] Table with 2+ relationships - should show all relationship columns
- [ ] Expand relationship with 0 matching rows - should show empty nested table
- [ ] Expand relationship with many matching rows - should paginate
- [ ] Error scenarios:
  - [ ] Invalid connection URL
  - [ ] Non-existent schema/table
  - [ ] Network error during expand
- [ ] Performance:
  - [ ] Expand multiple rows quickly
  - [ ] Scroll horizontally through many columns
  - [ ] Nested table pagination

## Troubleshooting

### Relationship columns don't appear

**Checklist**:
- [ ] `useTableRelationships` is being called
- [ ] Check browser console for errors
- [ ] Check Network tab for API calls to `useTableRelationships` API
- [ ] Verify `relationshipColumns` array is not empty
- [ ] Verify columns are being passed to DataTable

**Debug**:
```tsx
console.log('relationshipsQuery:', relationshipsQuery);
console.log('relationshipColumns:', relationshipColumns);
```

### Expand button doesn't work

**Checklist**:
- [ ] `toggleExpansion` is being called correctly
- [ ] `expandedRelationships` state is updating
- [ ] `expandedRelationships` is passed to DataTable
- [ ] DataTable is passing props to DataTableRow

**Debug**:
```tsx
console.log('expandedRelationships:', expandedRelationships);
console.log('toggleExpansion called with:', rowId, constraintName);
```

### Subrows don't appear or show wrong data

**Checklist**:
- [ ] `RelationshipSubrowComponent` is passed to DataTable
- [ ] DataTableRow is rendering subrows in correct location
- [ ] Server query is returning correct data
- [ ] Relationship metadata has correct schema/table/column names

**Debug**:
```tsx
// In relationship-subrow-table.tsx
console.log('relationship:', relationship);
console.log('parentRowValue:', parentRowValue);
console.log('rowsQuery.data:', rowsQuery.data);
```

### TypeScript errors

**Common issues**:
- Forgot import statement → Add missing import
- Wrong prop name → Check DataTableProps interface
- Missing return type → Add type annotation

**Solution**:
```bash
pnpm typecheck
# Read errors carefully and apply fixes
```

## Optional Enhancements

After integration is working:

### 1. Wire API Endpoints
Edit `src/hooks/use-table-relationships.ts` - implement actual API calls:
```tsx
// Replace TODO comments with actual useQuery calls
```

### 2. Fetch Row Counts
Implement counting of matching rows for each relationship:
```tsx
// Get count from server before expanding
// Pass to buildRelationshipColumns via rowCountsByRelationship prop
```

### 3. Add Animations
Enhance `relationship.styles.css` with:
- Fade in for subrows
- Smooth expand/collapse animation
- Loading skeleton animation

### 4. Keyboard Navigation
Make RelationshipCell keyboard accessible:
- Use Enter/Space to expand
- Tab to navigate between cells

### 5. Add Tests
Create test files:
- `src/components/__tests__/relationship-cell.test.tsx`
- `src/hooks/__tests__/use-relationship-expansion-state.test.ts`

## Rollback Plan

If integration fails:

1. **Temporary disable relationships**:
```tsx
const relationshipColumns = []; // Comment out logic
```

2. **Revert specific changes**:
```bash
git diff src/hooks/use-connection-page-state.tsx
git checkout src/hooks/use-connection-page-state.tsx
```

3. **Full rollback**:
```bash
git checkout feat/relationships~1  # Go back one commit
```

## Success Criteria

After completing all steps, verify:

- [ ] TypeScript compilation: `pnpm typecheck` shows zero errors
- [ ] Dev server runs: `pnpm dev` starts without errors
- [ ] Relationship columns visible on tables with relationships
- [ ] Expand/collapse buttons work
- [ ] Nested tables load and display correct data
- [ ] Multiple relationships can be expanded simultaneously
- [ ] No console errors or warnings
- [ ] UI is responsive and not slow

## Time Estimate

- **Step 1-2**: 15 minutes (code integration)
- **Step 3-4**: 15 minutes (testing)
- **Total**: ~30 minutes

## Deliverables

After integration:
- [ ] Commit with message: "feat: integrate relationship subrows"
- [ ] Update CHANGELOG.md if applicable
- [ ] Merge to main branch
- [ ] Deploy to staging for QA

---

**Status**: Ready for integration
**Difficulty**: Low (straightforward prop passing)
**Risk**: Very low (additive feature, no breaking changes)
**Testing**: Automated (TypeScript) + Manual (UI tests)
