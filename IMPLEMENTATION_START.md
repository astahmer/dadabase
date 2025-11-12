# Relationship Subrows - Implementation Start

## TL;DR

Add expandable relationship columns to data tables. Click `[► 5 orders]` to show related records in a nested table subrow.

### Files to Create (9)
1. `src/hooks/use-table-relationships.ts` - Fetch relationship metadata
2. `src/hooks/use-relationship-expansion-state.ts` - Manage expansion state
3. `src/components/relationship-cell.tsx` - Button/badge component
4. `src/components/relationship-subrow-table.tsx` - Nested table container
5. `src/server/pg/start-fns/get-relationship-subrow-data.start.ts` - Server function
6. `src/lib/relationship-utils.ts` - Helpers
7. `src/components/__tests__/relationship-cell.test.tsx` - Tests
8. `src/components/relationship.styles.ts` - Styling
9. `src/store/relationship-expansion.store.ts` - (optional) Global state

### Files to Modify (2)
1. `src/components/data-table.row.tsx` - Add subrow rendering
2. `src/components/pages/connection.page.tsx` - Integrate feature

### Effort: 13-17 hours

### Phases
1. **Phase 1 (4-5h):** Types, hooks, utilities
2. **Phase 2 (4-5h):** Components & styling
3. **Phase 3 (3-4h):** Server function & integration
4. **Phase 4 (2-3h):** Polish, tests, optimization

## Key Types

```typescript
interface RelationshipMetadata {
  referencingColumn: string;
  referencingTable: string;
  referencingSchema: string;
  referencedColumn: string;
  referencedTable: string;
  referencedSchema: string;
  constraintName: string;
  displayLabel: string;
}

type RowRelationshipExpansionState = {
  [rowId: string]: Set<string>; // Set of constraintNames
};
```

## Architecture

```
DataTable
└── Relationship Columns (NEW)
    ├── RelationshipCell (button)
    │   └── onClick → toggleExpansion()
    └── RelationshipSubrowTable (when expanded)
        └── Nested DataTable with filtered data
```

## Ready to start? Choose Phase 1 task:

- [ ] Create `use-table-relationships` hook
- [ ] Create `use-relationship-expansion-state` hook
- [ ] Create type definitions
- [ ] Create utility functions

Let me know which to start with!
