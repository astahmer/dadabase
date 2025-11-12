# Relationship Subrows Feature Plan - Summary

## 📋 Overview

A comprehensive plan to add expandable relationship columns to the data table interface. Users will be able to click a button in a relationship column to expand a subrow containing a nested DataTable of all related records.

## 🎯 Feature Goal

Transform this:
```
User clicking on a related table → Manual table navigation + manual filtering
```

Into this:
```
User clicks [► 5 orders] in the users table → Sees all 5 related orders in an inline subrow
```

## 📦 Deliverables

Created 5 comprehensive planning documents:

1. **FEATURE_PLAN_RELATIONSHIP_SUBROWS.md** (Main Plan)
   - Complete feature specification
   - Architecture overview
   - Data flow diagrams
   - Implementation phases
   - File structure
   - Integration points

2. **FEATURE_PLAN_RELATIONSHIP_SUBROWS_VISUAL.md** (Visual Guide)
   - UI mockups and ASCII diagrams
   - Component interaction flows
   - Data flow examples
   - Styling concepts
   - Loading/error state visualizations

3. **FEATURE_PLAN_RELATIONSHIP_SUBROWS_CODE.md** (Code Examples)
   - Complete TypeScript type definitions
   - Full hook implementations
   - Component code samples
   - Server function examples
   - Test examples
   - CSS styling code

4. **FEATURE_PLAN_RELATIONSHIP_SUBROWS_QUICKREF.md** (Quick Reference)
   - Executive summary
   - File structure table
   - Key types
   - Component props
   - Data flow summary
   - Phase breakdown with hours
   - Common patterns & FAQ

5. **FEATURE_PLAN_RELATIONSHIP_SUBROWS_CHECKLIST.md** (Implementation Checklist)
   - Detailed task checklist for all 4 phases
   - Sub-tasks for each major component
   - Testing requirements
   - Definition of done
   - Time estimates

## 🏗️ Architecture at a Glance

```
DataTable
├── Regular Columns (existing)
└── Relationship Columns (NEW)
    ├── RelationshipCell (button/badge)
    │   └── onClick → toggleExpansion()
    └── RelationshipSubrowTable (when expanded)
        └── Nested DataTable with filtered results

State Management:
├── useTableRelationships() → Fetch metadata
├── useRelationshipExpansionState() → Track which are expanded
└── React Query → Cache related data
```

## 📊 Implementation Breakdown

### Phase 1: Infrastructure (4-5 hours)
- Type definitions for relationships
- Hook to fetch relationship metadata
- Hook to manage expansion state
- Utility functions for formatting

### Phase 2: UI Components (4-5 hours)
- RelationshipCell component
- RelationshipSubrowTable component
- Modify DataTableRow for subrow rendering
- Add styling

### Phase 3: Server & Integration (3-4 hours)
- Server function to query related rows
- Integrate into connection page
- Build relationship columns
- Wire up all pieces

### Phase 4: Polish (2-3 hours)
- Loading/error states
- Performance optimization
- Accessibility features
- Tests and documentation

**Total: 13-17 hours estimated**

## 🎯 Key Design Decisions

✅ **What's Included (Phase 1)**
- Incoming references only (tables that reference this table)
- Single-level nesting (no circular relationships)
- Lazy loading of subrow data
- Expandable subrows in DOM (not modal/drawer)
- Per-row expansion state management

❌ **Intentionally Out of Scope (Future)**
- Outgoing foreign key relationships
- Multi-level nesting
- Global expansion state preservation
- Bulk operations in subrows
- Relationship configuration UI

## 🔄 Data Flow

```
1. User clicks relationship cell button
   ↓
2. RelationshipCell → onToggleExpand callback
   ↓
3. useRelationshipExpansionState → Toggle state
   ↓
4. DataTableRow re-renders with expanded = true
   ↓
5. RelationshipSubrowTable mounts
   ↓
6. Query: SELECT * FROM {table} WHERE {fk_column} = {parent_id}
   ↓
7. RelationshipSubrowTable renders nested DataTable
   ↓
8. New <tr> inserted after parent row with subrow content
```

## 📁 Files to Create

1. `src/hooks/use-table-relationships.ts` - Fetch relationship metadata
2. `src/hooks/use-relationship-expansion-state.ts` - Manage expansion state
3. `src/components/relationship-cell.tsx` - Button/badge component
4. `src/components/relationship-subrow-table.tsx` - Nested table container
5. `src/server/pg/start-fns/get-relationship-subrow-data.start.ts` - Server function
6. `src/lib/relationship-utils.ts` - (Optional) Helper functions
7. `src/components/__tests__/relationship-cell.test.tsx` - Tests
8. `src/components/relationship.styles.ts` - (Optional) Dedicated styles
9. `src/store/relationship-expansion.store.ts` - (Optional) Global state

## 📝 Files to Modify

1. `src/components/data-table.row.tsx` - Add subrow rendering
2. `src/components/pages/connection.page.tsx` - Integrate feature

## 💡 Key Decisions Made

### Relationship Type: Incoming References (Phase 1)
- More common use case
- Better UX (see "children" of a row)
- Example: Show all orders for a user

### Expansion State: Local Per-Row
- Track with `RowRelationshipExpansionState` type
- `{ [rowId]: Set<constraintId> }`
- Can extend to global store later if needed

### Subrow Rendering: After Parent Row
- Insert new `<tr>` after parent row
- Span all columns with single `<td>`
- Maintains DOM order and accessibility

### Data Fetching: Lazy Load
- Only query when user clicks expand
- Not fetched on page load
- Improves initial page load performance

### Nesting Level: Single
- No circular/recursive relationships
- Nested table is fully featured
- Plan for depth limiting in future

## 🎨 Visual Hierarchy

```
┌─ Parent Row ────────────────────────────────┐
│ [PK] [Column] [Column] [↳ orders: ► 5]    │
└─────────────────────────────────────────────┘
┌─ Subrow (when expanded) ────────────────────┐
│ └─ Nested Table                             │
│    ├─ [order_id] [amount] [status]         │
│    ├─ [ord-001] [$99.99] [completed]       │
│    └─ [ord-002] [$45.50] [pending]         │
└─────────────────────────────────────────────┘
```

## 🚀 Getting Started

1. **Read the docs in order:**
   - Start with this summary (you are here)
   - Read FEATURE_PLAN_RELATIONSHIP_SUBROWS.md for complete spec
   - Review FEATURE_PLAN_RELATIONSHIP_SUBROWS_VISUAL.md for UI
   - Use FEATURE_PLAN_RELATIONSHIP_SUBROWS_CODE.md for code samples
   - Reference FEATURE_PLAN_RELATIONSHIP_SUBROWS_QUICKREF.md while coding

2. **Use the checklist:**
   - Open FEATURE_PLAN_RELATIONSHIP_SUBROWS_CHECKLIST.md
   - Work through phases in order
   - Check off tasks as completed
   - Don't skip Phase 1 (it's foundation for all others)

3. **Implementation order:**
   - Phase 1: Types & Hooks
   - Phase 2: Components
   - Phase 3: Integration
   - Phase 4: Polish

4. **Testing strategy:**
   - Unit test each hook and component
   - Integration test the full flow
   - Visual regression test styling
   - E2E test in dev environment

## ✨ Key Features

- ✅ Expandable relationship columns
- ✅ Nested DataTable with full functionality
- ✅ Lazy loading of related data
- ✅ Independent expansion per row
- ✅ Multiple relationships per table
- ✅ Loading/error states
- ✅ Keyboard accessible
- ✅ Responsive design
- ✅ Performance optimized

## 🔍 Existing Infrastructure to Leverage

The app already has:
- `getTableForeignKeys()` - Get FKs from table
- `findColumnReferences()` - Get tables referencing this table
- `findColumnReferencesWithCounts()` - Get references with row counts
- `DataTable` component - Reuse for nested tables
- `useDataTable` hook - Create nested table instances
- React Query - Cache management
- TanStack Table - Column definitions

## 📈 Estimated Effort

| Phase | Hours | Days (8h/day) |
|-------|-------|---------------|
| 1: Infrastructure | 4-5h | ~1 day |
| 2: Components | 4-5h | ~1 day |
| 3: Integration | 3-4h | ~0.5 day |
| 4: Polish | 2-3h | ~0.5 day |
| **Total** | **13-17h** | **~3 days** |

## 🎓 Learning Resources

The code examples include:
- Full TypeScript implementations
- Component patterns
- Hook patterns
- Server function patterns
- Test examples
- CSS styling examples
- Error handling examples

## 🚦 Next Steps

1. Review all planning documents as a team
2. Get feedback and approval
3. Create issue/epic in your tracker
4. Assign team member to lead implementation
5. Use checklist to track progress
6. Have code review at end of each phase
7. Deploy and celebrate! 🎉

## 📞 Questions to Consider

**Before starting:**
- Should we also add outgoing FKs in Phase 1? (Probably no, keep Phase 1 small)
- Do we want to preserve expansion state on navigation? (Not needed for Phase 1)
- Should there be a limit to how many rows to show? (Default 50, paginate for more)
- Do we need relationship configuration UI? (No, Phase 2 enhancement)

**During implementation:**
- How many relationships do your typical tables have? (Affects performance)
- Will you need bidirectional relationships? (Plan for Phase 2)
- Do you want to hide certain relationships from users? (Phase 2 feature)

## 📚 Documentation References

Within this workspace:
- `src/server/pg/fns/get-table-foreign-keys.kysely.ts` - FK query examples
- `src/lib/fk-navigation.ts` - FK filtering examples
- `src/components/data-table.tsx` - DataTable component reference
- `src/components/data-table.row.tsx` - Row component to modify
- `src/hooks/use-table-column-metadata.ts` - Metadata hook pattern

External references:
- TanStack Table docs: https://tanstack.com/table/v8
- React Query docs: https://tanstack.com/query/latest
- Effect.ts docs: https://effect.website/ (used in server functions)

---

## Summary Table

| Aspect | Detail |
|--------|--------|
| **Feature** | Expandable relationship columns with nested DataTables |
| **Scope** | Incoming references only (Phase 1) |
| **Architecture** | Hooks + Components + Server functions |
| **Effort** | 13-17 hours |
| **Files to Create** | 9 files |
| **Files to Modify** | 2 files |
| **Phases** | 4 phases (Infrastructure → Components → Integration → Polish) |
| **Testing** | Unit + Integration + E2E |
| **Documentation** | 5 comprehensive docs included |
| **Ready to Start** | Yes! Use checklist to begin |

---

**Created:** November 12, 2025
**Status:** Ready for Implementation
**Approval:** [Team Review Pending]
