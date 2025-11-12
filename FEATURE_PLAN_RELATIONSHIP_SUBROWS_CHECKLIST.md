# Relationship Subrows - Implementation Checklist

## Pre-Implementation

### Planning & Review
- [ ] Review all feature plan documents with team
- [ ] Get feedback on scope and priorities
- [ ] Confirm Phase 1 scope (incoming references only)
- [ ] Identify any blockers or dependencies
- [ ] Create task tickets in your issue tracker

### Environment Setup
- [ ] Ensure all dependencies are installed
- [ ] Verify test framework is working
- [ ] Check linting/formatting tools are configured
- [ ] Ensure database with relationships available for testing

---

## Phase 1: Infrastructure (4-5 hours)

### 1.1 Type Definitions

- [ ] Create `src/types/relationships.ts` or add to `src/types.ts`
  - [ ] `RelationshipMetadata` interface
  - [ ] `RelationshipSubrowQuery` interface
  - [ ] `RowRelationshipExpansionState` type
  - [ ] Export types from main types file

- [ ] Review and document ForeignKeyMetadata (existing)
  - [ ] Located in `src/server/pg/fns/get-table-foreign-keys.kysely.ts`
  - [ ] Ensure it matches RelationshipMetadata structure
  - [ ] Add mapping logic if needed

### 1.2 Utility Functions

- [ ] Create `src/lib/relationship-utils.ts`
  - [ ] `formatRelationshipDisplayLabel()` - Convert table name to label (orders → "↳ orders")
  - [ ] `createRelationshipFilterCondition()` - Build filter for subrow query
  - [ ] `groupRelationshipsByType()` - Separate incoming/outgoing
  - [ ] `isValidRelationship()` - Validate relationship metadata

- [ ] Add tests for utility functions

### 1.3 Relationship Metadata Hook

- [ ] Create `src/hooks/use-table-relationships.ts`
  - [ ] Fetch incoming references using `findColumnReferences()`
  - [ ] Fetch outgoing FKs using `getTableForeignKeys()`
  - [ ] Return both with proper typing
  - [ ] Handle loading/error states
  - [ ] Cache results (5 minute stale time)
  - [ ] Proper error handling

- [ ] Add unit tests
  - [ ] Test with valid table
  - [ ] Test with no relationships
  - [ ] Test error handling
  - [ ] Test cache behavior

### 1.4 Expansion State Hook

- [ ] Create `src/hooks/use-relationship-expansion-state.ts`
  - [ ] `expandedState: RowRelationshipExpansionState` - State object
  - [ ] `toggleExpansion(rowId, relationshipId)` - Toggle a relationship
  - [ ] `isExpanded(rowId, relationshipId)` - Check if expanded
  - [ ] `expandRelationship()` - Expand without toggle
  - [ ] `collapseRelationship()` - Collapse without toggle
  - [ ] `collapseAllForRow()` - Collapse all relationships for a row
  - [ ] Proper TypeScript typing throughout

- [ ] Add unit tests
  - [ ] Test toggle functionality
  - [ ] Test multiple expansions per row
  - [ ] Test multiple rows with different states
  - [ ] Test collapse operations

### 1.5 Type & Infrastructure Review

- [ ] Run TypeScript compiler (pnpm typecheck)
- [ ] Fix any type errors
- [ ] Review imports/exports
- [ ] Add JSDoc comments to main types
- [ ] Commit: "feat: add relationship subrows type definitions and utilities"

---

## Phase 2: UI Components (4-5 hours)

### 2.1 RelationshipCell Component

- [ ] Create `src/components/relationship-cell.tsx`
  - [ ] Props interface with proper typing
  - [ ] Render button with chevron icon
  - [ ] Show relationship label (displayLabel)
  - [ ] Show row count badge
  - [ ] Handle loading state
  - [ ] Handle error state with tooltip
  - [ ] Disabled state when no count loaded
  - [ ] Click handler calls onToggleExpand
  - [ ] Visual feedback for expanded state (background color, rotated icon)
  - [ ] Memoize component to prevent unnecessary re-renders
  - [ ] Keyboard accessible (proper button semantics)
  - [ ] Proper ARIA attributes

- [ ] Add component tests
  - [ ] Renders button correctly
  - [ ] Shows row count
  - [ ] Handles click events
  - [ ] Shows loading state
  - [ ] Shows error state
  - [ ] Visual state changes when expanded
  - [ ] Disabled when appropriate

- [ ] Add to Storybook if available

### 2.2 RelationshipSubrowTable Component

- [ ] Create `src/components/relationship-subrow-table.tsx`
  - [ ] Props interface with proper typing
  - [ ] Query fetching for related rows using React Query
  - [ ] Get column metadata for referencing table
  - [ ] Create data table instance with useDataTable
  - [ ] Render nested DataTable with compact sizing
  - [ ] Show loading spinner while fetching
  - [ ] Show error state with message
  - [ ] Add header with relationship label and row count
  - [ ] Optional: Add pagination controls for many rows
  - [ ] Memoize component

- [ ] Add component tests
  - [ ] Renders loading state
  - [ ] Fetches and displays data
  - [ ] Handles errors gracefully
  - [ ] Shows correct row count in header
  - [ ] Nested table is fully functional

### 2.3 DataTableRow Modifications

- [ ] Modify `src/components/data-table.row.tsx`
  - [ ] Add new props:
    - [ ] `expandedRelationships?: Set<string>`
    - [ ] `relationships?: RelationshipMetadata[]`
  - [ ] Import RelationshipSubrowTable component
  - [ ] After the main row render, add relationship subrow rendering
  - [ ] Iterate over expanded relationships for the row
  - [ ] Render <tr class="relationship-subrow"> for each
  - [ ] Use colSpan to span all visible cells
  - [ ] Wrap in ErrorBoundary
  - [ ] Pass connection and metadata to subrow component
  - [ ] Proper DOM structure (parent row → subrow, not nested)

- [ ] Test modifications
  - [ ] Regular rows render correctly (without relationships)
  - [ ] Relationships render when expanded
  - [ ] Multiple relationships render in order
  - [ ] ErrorBoundary catches errors in subrows
  - [ ] No visual regression in existing functionality

### 2.4 Styling

- [ ] Create `src/components/relationship.styles.ts` or add to existing styles
  - [ ] `.relationship-subrow` - Distinct background color
  - [ ] `.relationship-subrow-content` - Proper padding/indentation
  - [ ] `.relationship-cell` - Button styling
  - [ ] `.relationship-cell-icon` - Icon rotation animation
  - [ ] `.relationship-cell-badge` - Row count badge styling
  - [ ] Hover states
  - [ ] Active/expanded states
  - [ ] Loading states
  - [ ] Error states
  - [ ] Responsive design
  - [ ] Dark mode support

- [ ] Test styling
  - [ ] Visual hierarchy is clear
  - [ ] Indentation shows nesting
  - [ ] Animations are smooth
  - [ ] Colors meet accessibility contrast requirements

### 2.5 Component Integration Review

- [ ] Run linter (pnpm lint)
- [ ] Run TypeScript compiler
- [ ] Build project (pnpm build)
- [ ] Check for console errors/warnings
- [ ] Commit: "feat: add relationship cell and subrow table components"

---

## Phase 3: Server Functions & Integration (3-4 hours)

### 3.1 Server-Side Query Function

- [ ] Create `src/server/pg/start-fns/get-relationship-subrow-data.start.ts`
  - [ ] Create query function to fetch related rows
  - [ ] Build filter: WHERE {referencingColumn} = {parentValue}
  - [ ] Apply limit (50 by default)
  - [ ] Create React Query options factory
  - [ ] Proper error handling and typing
  - [ ] Document function usage

- [ ] Test server function
  - [ ] Verify correct SQL is generated
  - [ ] Test with valid data
  - [ ] Test with invalid filters
  - [ ] Test with empty results

### 3.2 Connection Page Integration

- [ ] Modify `src/components/pages/connection.page.tsx`
  - [ ] Import hooks:
    - [ ] `useTableRelationships`
    - [ ] `useRelationshipExpansionState`
  - [ ] Import components:
    - [ ] `RelationshipCell`

  - [ ] Call hooks in component
    - [ ] Get relationships for current table
    - [ ] Initialize expansion state

  - [ ] Build relationship columns
    - [ ] Map incomingReferences to column definitions
    - [ ] Set proper column meta (no ordering, sorting, filtering)
    - [ ] Create cell render with RelationshipCell
    - [ ] Set appropriate column ID and size

  - [ ] Combine columns
    - [ ] Merge regular columns with relationship columns
    - [ ] Pass to useDataTable

  - [ ] Pass to DataTable
    - [ ] Pass expandedRelationships state
    - [ ] Pass relationships array

  - [ ] Wire row click handlers if needed
    - [ ] Integrate expansion toggle with RelationshipCell

- [ ] Test integration end-to-end
  - [ ] Relationships appear as columns
  - [ ] Column headers show labels correctly
  - [ ] Buttons show row counts
  - [ ] Clicking expands/collapses
  - [ ] Data loads and displays correctly

### 3.3 Type Safety & Compilation

- [ ] Run typecheck
  - [ ] Fix any type errors
  - [ ] Verify imports are correct
  - [ ] Check for any `any` types that should be stricter

- [ ] Run linter
  - [ ] Fix formatting
  - [ ] Fix any warnings

- [ ] Build project
  - [ ] Ensure builds successfully
  - [ ] No build warnings

- [ ] Commit: "feat: integrate relationship subrows into connection page"

---

## Phase 4: Polish & Optimization (2-3 hours)

### 4.1 Loading & Error States

- [ ] Add loading indicators
  - [ ] Spinner in RelationshipCell during expand
  - [ ] Loading skeleton in RelationshipSubrowTable
  - [ ] Proper disabled states

- [ ] Add error handling
  - [ ] Error messages in subrows
  - [ ] Retry buttons
  - [ ] Error tooltips in cells
  - [ ] Graceful fallbacks

- [ ] Test all states
  - [ ] Slow network simulation
  - [ ] Error scenarios
  - [ ] Edge cases (0 rows, 1000+ rows)

### 4.2 Performance Optimization

- [ ] Memoization
  - [ ] Wrap RelationshipCell in React.memo
  - [ ] Wrap RelationshipSubrowTable in React.memo
  - [ ] Optimize column definition building with useMemo

- [ ] Query optimization
  - [ ] Set appropriate staleTime values
  - [ ] Configure gcTime for cache
  - [ ] Consider pagination for large result sets

- [ ] Test performance
  - [ ] React DevTools Profiler - check for unnecessary renders
  - [ ] Chrome DevTools Network - verify query efficiency
  - [ ] Test with tables with many relationships
  - [ ] Test with large result sets

### 4.3 Accessibility

- [ ] Keyboard navigation
  - [ ] Tab order is logical
  - [ ] Buttons are keyboard accessible
  - [ ] Enter/Space activates buttons

- [ ] Screen reader support
  - [ ] Proper ARIA labels
  - [ ] aria-pressed for button state
  - [ ] aria-expanded for expandable sections
  - [ ] Test with screen reader (NVDA, JAWS, VoiceOver)

- [ ] Color contrast
  - [ ] Verify all text meets WCAG AA standards
  - [ ] Test with contrast checker

### 4.4 Unit Tests

- [ ] Add comprehensive tests
  - [ ] `relationship-cell.test.tsx`
  - [ ] `relationship-subrow-table.test.tsx`
  - [ ] `use-relationship-expansion-state.test.ts`
  - [ ] `use-table-relationships.test.ts`

- [ ] Test coverage
  - [ ] Aim for >80% coverage
  - [ ] Cover happy paths
  - [ ] Cover error cases
  - [ ] Cover edge cases

### 4.5 Integration Tests

- [ ] E2E scenarios
  - [ ] Open connection page
  - [ ] Verify relationships appear
  - [ ] Click relationship cell
  - [ ] Verify subrow expands
  - [ ] Verify data loads correctly
  - [ ] Click again to collapse
  - [ ] Verify subrow disappears

- [ ] Multi-row scenarios
  - [ ] Expand relationships on multiple rows
  - [ ] Verify each row has correct data
  - [ ] Collapse different subrows
  - [ ] Verify state management is correct

### 4.6 Documentation

- [ ] Add JSDoc comments
  - [ ] Document all components
  - [ ] Document all hooks
  - [ ] Add usage examples

- [ ] Update type documentation
  - [ ] Comment complex types
  - [ ] Add examples for interfaces

- [ ] Create developer guide
  - [ ] How to use the components
  - [ ] How to extend/customize
  - [ ] Common patterns

### 4.7 Visual Polish

- [ ] Review styling
  - [ ] Visual hierarchy is clear
  - [ ] Spacing is consistent
  - [ ] Animations are smooth
  - [ ] Loading states are clear
  - [ ] Error states are distinct

- [ ] Test in different browsers
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge

- [ ] Test responsiveness
  - [ ] Desktop (1920px)
  - [ ] Tablet (768px)
  - [ ] Mobile (375px)
  - [ ] Subrows scroll properly on small screens

### 4.8 Final Review

- [ ] Code review
  - [ ] Request review from team members
  - [ ] Address feedback
  - [ ] Ensure code follows project standards

- [ ] Testing review
  - [ ] Verify test coverage
  - [ ] All tests passing
  - [ ] No test warnings

- [ ] Documentation review
  - [ ] All features documented
  - [ ] Examples are accurate
  - [ ] No typos or unclear sections

- [ ] Commit: "feat: optimize and polish relationship subrows feature"

---

## Phase 5: Future Enhancements (Post-MVP)

### 5.1 Configuration Panel
- [ ] Allow users to enable/disable specific relationships
- [ ] Save preferences to local storage
- [ ] UI to customize nested table columns

### 5.2 Outgoing Foreign Keys (Phase 2)
- [ ] Display tables that this table references
- [ ] Different visual treatment (linked icon vs nested table)
- [ ] Inline display of referenced record

### 5.3 Advanced Features
- [ ] Pagination in subrows for large result sets
- [ ] Filtering within subrows
- [ ] Relationship aggregations (counts, sums)
- [ ] Relationship search/filtering
- [ ] Batch operations in subrows

### 5.4 Performance
- [ ] Virtualization for deeply nested tables
- [ ] Query optimization for many relationships
- [ ] Relationship count caching strategy

### 5.5 UX Improvements
- [ ] Keyboard shortcuts for expand/collapse
- [ ] Visual indicators for "has children"
- [ ] Smart depth limiting
- [ ] Relationship grouping/categorization

---

## Testing Checklist

### Unit Tests
- [ ] All hooks have tests
- [ ] All components have tests
- [ ] All utilities have tests
- [ ] Tests cover happy path
- [ ] Tests cover error cases
- [ ] Tests cover edge cases

### Integration Tests
- [ ] Feature works end-to-end
- [ ] State management is correct
- [ ] Queries execute properly
- [ ] Multiple rows/relationships work together

### Visual Tests
- [ ] Component styling is correct
- [ ] Loading states visible
- [ ] Error states visible
- [ ] Animations smooth
- [ ] Responsive on all sizes
- [ ] Dark mode works
- [ ] Accessible color contrast

### Browser Tests
- [ ] Chrome latest
- [ ] Firefox latest
- [ ] Safari latest
- [ ] Edge latest

### Accessibility Tests
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast sufficient
- [ ] ARIA attributes correct

---

## Definition of Done

The feature is complete when:

- ✅ All code written with proper types
- ✅ All tests passing (>80% coverage)
- ✅ All linting passes (no warnings)
- ✅ TypeScript compiles successfully
- ✅ Project builds successfully
- ✅ End-to-end feature works in dev/test environment
- ✅ Code is documented with JSDoc
- ✅ Tests are documented
- ✅ Feature is reviewed and approved by team
- ✅ No console errors/warnings
- ✅ Performance is optimized
- ✅ Accessibility requirements met
- ✅ All browsers tested and working
- ✅ Feature plan documents updated if needed

---

## Helpful Tips

### During Implementation
- Build incrementally, test frequently
- Create feature branch for each phase
- Get code review at end of each phase
- Test with real database connections
- Use browser DevTools for debugging
- Check component in Storybook if available
- Review React Query docs for optimization

### Testing Effectively
- Use test database with relationships
- Test with empty relationships
- Test with 1000+ related rows
- Simulate slow network
- Simulate errors
- Test keyboard navigation
- Test with screen reader

### Common Issues to Watch For
- Incorrect filter column name
- Missing error handling
- Subrows not inserting in correct DOM location
- Expansion state not resetting
- Memory leaks in queries
- Type mismatches between hook and component

---

## Time Estimates by Phase

| Phase | Task Count | Hours | Status |
|-------|-----------|-------|--------|
| 1: Infrastructure | 5 tasks | 4-5h | Not Started |
| 2: UI Components | 5 tasks | 4-5h | Not Started |
| 3: Server & Integration | 3 tasks | 3-4h | Not Started |
| 4: Polish & Optimization | 8 tasks | 2-3h | Not Started |
| **Total** | **21 tasks** | **13-17h** | Not Started |

---

## Quick Links

- Feature Plan: `FEATURE_PLAN_RELATIONSHIP_SUBROWS.md`
- Visual Guide: `FEATURE_PLAN_RELATIONSHIP_SUBROWS_VISUAL.md`
- Code Examples: `FEATURE_PLAN_RELATIONSHIP_SUBROWS_CODE.md`
- Quick Ref: `FEATURE_PLAN_RELATIONSHIP_SUBROWS_QUICKREF.md`
