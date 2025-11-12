# Quick Reference Guide - Relationship Subrows Feature

## Executive Summary

Add expandable "relationship columns" to data tables. Each relationship gets a column with a button that, when clicked, expands a subrow containing a nested DataTable of related rows.

**Example:** In a Users table, show an "↳ orders" column with a button "[► 5 rows]". Click it to expand and see all 5 orders for that user in a nested table.

## Files to Create (9 files)

| File | Purpose |
|------|---------|
| `src/hooks/use-table-relationships.ts` | Fetch relationship metadata for a table |
| `src/hooks/use-relationship-expansion-state.ts` | Manage which relationships are expanded per row |
| `src/components/relationship-cell.tsx` | Button/badge component for relationship column |
| `src/components/relationship-subrow-table.tsx` | Renders nested DataTable in subrow |
| `src/server/pg/start-fns/get-relationship-subrow-data.start.ts` | Server function to fetch related rows |
| `src/lib/relationship-utils.ts` | (Optional) Helper functions for relationship formatting |
| `src/store/relationship-expansion.store.ts` | (Optional) Global state management with Zustand |
| `src/components/__tests__/relationship-cell.test.tsx` | Unit tests |
| `src/components/relationship.styles.ts` | (Optional) Dedicated styling |

## Files to Modify (2 files)

| File | Changes |
|------|---------|
| `src/components/data-table.row.tsx` | Add relationship subrow rendering after parent row |
| `src/components/pages/connection.page.tsx` | Build relationship columns, integrate hooks |

## Key Types

```typescript
// Primary relationship metadata
interface RelationshipMetadata {
  referencingSchema: string;
  referencingTable: string;
  referencingColumn: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName: string;
  displayLabel: string;
}

// Track which relationships are expanded per row
type RowRelationshipExpansionState = {
  [rowId: string]: Set<string>; // Set of constraintNames
};
```

## Component Props

### RelationshipCell
```typescript
{
  relationship: RelationshipMetadata;
  parentRowValue: unknown;
  isExpanded: boolean;
  matchingRowCount: number | null;
  isLoadingCount?: boolean;
  onToggleExpand: () => void;
  error?: Error | null;
}
```

### RelationshipSubrowTable
```typescript
{
  relationship: RelationshipMetadata;
  parentRowValue: unknown;
  connection: DbConnection;
  allTableMetadata: TableMetadata[];
}
```

## Hook Usage

```typescript
// In connection page component
const { incomingReferences } = useTableRelationships({
  url: connectionUrl,
  schema,
  table,
  enabled: !!schema && !!table,
});

const { expandedState, toggleExpansion, isExpanded } = useRelationshipExpansionState();
```

## Data Flow

```
1. User clicks RelationshipCell button
   ↓
2. RelationshipCell calls onToggleExpand()
   ↓
3. useRelationshipExpansionState.toggleExpansion() updates state
   ↓
4. DataTableRow re-renders, sees isExpanded = true
   ↓
5. RelationshipSubrowTable mounts
   ↓
6. Fetches: SELECT * FROM {table} WHERE {column} = {parentValue}
   ↓
7. Renders nested DataTable with results
   ↓
8. Inserts <tr> with <td colSpan={allColumns}> after parent row
```

## Column Definition Pattern

```typescript
const relationshipColumns = incomingReferences.map(rel => ({
  id: `rel_${rel.constraintName}`,
  header: () => `↳ ${rel.displayLabel}`,
  cell: ({ row }) => (
    <RelationshipCell
      relationship={rel}
      parentRowValue={row.original[primaryKeyColumn]}
      isExpanded={isExpanded(row.id, rel.constraintName)}
      matchingRowCount={/* from cache */}
      onToggleExpand={() => toggleExpansion(row.id, rel.constraintName)}
    />
  ),
  meta: {
    type: 'relationship',
    enableColumnOrdering: false,
    enableSorting: false,
    enableFiltering: false,
  },
}));

const allColumns = [...regularColumns, ...relationshipColumns];
```

## Phase Breakdown

### Phase 1: Infrastructure (Estimated: 4-5 hours)
- [ ] Create type definitions
- [ ] Create useTableRelationships hook
- [ ] Create useRelationshipExpansionState hook
- [ ] Create relationship-utils helpers

### Phase 2: UI Components (Estimated: 4-5 hours)
- [ ] Create RelationshipCell component
- [ ] Create RelationshipSubrowTable component
- [ ] Modify DataTableRow to support subrows
- [ ] Add styling

### Phase 3: Integration (Estimated: 3-4 hours)
- [ ] Create server function for fetching subrow data
- [ ] Integrate into connection page
- [ ] Wire up all hooks and state
- [ ] Build relationship columns

### Phase 4: Polish (Estimated: 2-3 hours)
- [ ] Add loading/error states
- [ ] Performance optimization
- [ ] Add tests
- [ ] Documentation

**Total: 13-17 hours**

## Leverage Existing Code

✅ **Already exists and can be reused:**
- `getTableForeignKeys()` - Get outgoing FKs
- `findColumnReferences()` - Get incoming FKs
- `findColumnReferencesWithCounts()` - Get incoming FKs with counts
- `DataTable` component for nested rendering
- `useDataTable` hook for nested tables
- Query filter infrastructure

❌ **Doesn't exist, needs to be created:**
- Relationship metadata fetching hook
- Relationship expansion state management
- Relationship cell component
- Subrow rendering component
- Integration in connection page

## Common Patterns

### Check if relationship is expanded
```typescript
if (expandedState[rowId]?.has(constraintName)) {
  // Render subrow
}
```

### Toggle expansion
```typescript
toggleExpansion(rowId, constraintName);
```

### Build filter for subrow query
```typescript
WHERE {referencingColumn} = {parentRowValue}
```

### Handle loading state
```typescript
if (isLoading) return <Spinner />;
if (isError) return <ErrorMessage />;
return <DataTable ... />;
```

## Styling Conventions

```css
/* Subrow uses slightly different background */
.relationship-subrow {
  background-color: rgba(0, 0, 0, 0.02);
}

/* Expanded button changes style */
.relationship-cell[aria-pressed="true"] {
  background-color: var(--primary);
  color: var(--primary-foreground);
}

/* Arrow rotates 90 degrees when expanded */
.relationship-cell-icon[data-expanded="true"] {
  transform: rotate(90deg);
}

/* Nested table slightly smaller font */
.relationship-subrow-table {
  font-size: 0.9em;
}
```

## Error Scenarios & Handling

| Scenario | Handling |
|----------|----------|
| FK constraint invalid | Show error icon in cell, disable button |
| Permission denied | Error message in subrow, show retry option |
| Too many rows (1000+) | Paginate, show "Showing 1-20 of 1,234 rows" |
| Relationship deleted | Show warning badge, disable button |
| Network error | Show error state, allow retry |
| Empty results | Show empty state in subrow |

## Performance Tips

1. **Lazy load** - Only query when expanded, not on mount
2. **Limit rows** - Show first 50 by default, paginate for more
3. **Cache counts** - Batch fetch row counts for all relationships
4. **Memoize cells** - Use memo() to prevent unnecessary re-renders
5. **Pagination** - Use small page sizes (10-20) in nested tables
6. **Virtualization** - Consider if deeply nested tables needed

## Testing Checklist

- [ ] RelationshipCell renders button correctly
- [ ] RelationshipCell toggles expanded state
- [ ] RelationshipCell shows loading/error states
- [ ] RelationshipSubrowTable fetches data on mount
- [ ] RelationshipSubrowTable handles errors gracefully
- [ ] DataTableRow renders subrow after parent row
- [ ] Connection page builds relationship columns
- [ ] Multiple relationships can be expanded per row
- [ ] Expansion state persists during navigation (if using Zustand)
- [ ] Nested DataTable is fully functional

## Browser DevTools Tips

When debugging:

```javascript
// In console, check expansion state
window.__relationshipExpansionState

// Check cached relationship metadata
window.__tableRelationships

// Verify subrow DOM structure
document.querySelectorAll('.relationship-subrow')

// Check column definitions
table.getAllColumns().filter(c => c.columnDef.meta?.type === 'relationship')
```

## FAQ

**Q: Can I expand multiple relationships for one row?**
A: Yes! Each relationship tracks expansion independently. Use Set<string> for constraint IDs.

**Q: What if a relationship has thousands of rows?**
A: Paginate in the nested table. Show first 50 by default with pagination controls.

**Q: Can I expand the same relationship in multiple rows at once?**
A: Yes. expandedState is keyed by rowId, so each row has independent state.

**Q: Should I preserve expansion state on page navigation?**
A: Optional. Use React Query cache (local) or Zustand store (global) based on UX preference.

**Q: How do I style the nested table differently?**
A: Use a "compact" or "minimal" size prop on the nested DataTable.

**Q: What about circular relationships?**
A: Plan to limit nesting depth (max 2-3 levels) in future enhancement.

**Q: Can I add actions in the nested table?**
A: Yes! Nested DataTable is a full DataTable, supports all features.

**Q: How do I handle many relationships for one table?**
A: Could add "favorite" relationships, collapsible groups, or a configuration panel.

## Next Steps

1. Review this plan with team
2. Create an issue/ticket for implementation
3. Break into smaller PRs by phase
4. Start with Phase 1 (types & hooks)
5. Get initial feedback before full implementation
