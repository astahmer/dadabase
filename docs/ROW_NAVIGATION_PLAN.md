# Row Navigation & Cross-Table Discovery Plan

## Overview
Enable users to navigate easily from one row to another using foreign keys, and discover where specific IDs are used across the database. This system takes inspiration from VSCode's quick references/implementations on cmd+click while developing its own interaction patterns.

## Current State Assessment

Your app already has:
- ✅ Column metadata tracking (primary keys, unique constraints, data types)
- ✅ Foreign key constraint detection infrastructure (PostgreSQL `information_schema`)
- ✅ Tab-based navigation system
- ✅ Row context menu (currently basic: log & copy)
- ✅ Query filtering & navigation capabilities

**What's missing:** Reverse FK lookups and pattern discovery mechanisms.

---

## Proposed Feature Set

### 1. Foreign Key Detection & Visualization (Foundation)
- **Extract FK metadata** from PostgreSQL (column name patterns + constraint info)
- **Display FK indicators** in column headers (similar to PK & Unique icons)
- **Tooltip showing:** Referenced table/column + reverse references count
- **Implementation:**
  - Extend `ColumnMetadata` to include FK information
  - Update SQL queries to fetch FK constraints
  - Add `ForeignKeyIcon` component

### 2. Quick References Panel (VSCode-inspired)
When clicking a cell value (especially FK references), show a **popover/panel** with:
- **Direct FK navigation:** "Jump to related row in referenced table"
- **Reverse FK references:** "This ID is referenced in X, Y, Z tables" with counts
- **Quick actions:**
  - 🔗 Jump to referenced row (filter to show that specific row)
  - 🔄 Jump to referencing rows (filter current table to rows using this ID)
  - 📋 Show all relationships (graph/tree view)

### 3. Smart Cell Context Menu Enhancements
Upgrade the current context menu to:
```
├─ Copy as JSON
├─ Log to console
├─ [NEW] Follow FK to → orders table
├─ [NEW] Find references in → payments, invoices, subscriptions (3 places)
├─ [NEW] View related records (in a modal/side-panel)
└─ [NEW] Copy as filter clause
```

### 4. Pattern Discovery Features (Separate Plan)
- **By Enum/Constant:** "Show all rows where status = 'active'"
  - Right-click badge → "Find all matches"
  - Especially useful for enums, booleans, status fields
- **By Data Type:** "Find all rows with this format/pattern"
- **Cross-table Pattern Matching:** Navigate to other tables with similar values

### 5. Relationship Explorer (Optional but cool)
- Side panel showing FK graph for current row:
  ```
  User (id=5)
  ├── → organizations (org_id=2)
  │   ├── → subscriptions (3 records)
  │   └── → team_members (5 records)
  └── ← orders (10 records referencing user 5)
      └── → order_items (42 records)
  ```
- Click any node to navigate/filter

### 6. Keyboard Shortcuts & Navigation
- `Cmd+K` or similar: Open "Go to Row" dialog by FK reference
- `Cmd+Shift+K`: Show all references for selected cell
- Click with modifier key: Open in new tab instead of switching

---

## Design Decisions

### Reverse FK Lookups
- **Strategy:** Lazy loading with caching
- **Rationale:** Query all tables on every cell click could be slow, so we fetch references on-demand and cache results
- **Implementation:** Create a query service that builds queries dynamically to find references

### UI Strategy
- Implement both **Quick References Panel** and **Row Details Modal**
- Panel for quick lookups, modal for deep inspection
- Start simple, iterate based on usage

### Scope for Phase 1
- Focus on **FK-only** navigation
- Enum/pattern discovery deferred to separate plan
- Keep codebase focused and maintainable

---

## Implementation Roadmap

### Phase 1: Foundation - Foreign Key Detection (1-2 days)
**Goal:** Detect FK relationships and display them in the UI

- [ ] Fetch FK metadata from PostgreSQL
  - Query `information_schema.table_constraints` for FK constraints
  - Query `information_schema.key_column_usage` for constraint details
  - Query `information_schema.referential_constraints` for referenced tables
- [ ] Extend `ColumnMetadata` interface with FK information
  - Add `foreignKey?: { referencedTable: string; referencedColumn: string }`
  - Add `isForeignKey: boolean` flag
- [ ] Update SQL queries to include FK detection
- [ ] Add `ForeignKeyIcon` component (link icon with visual indicator)
- [ ] Display FK info in column header tooltips
- [ ] Test with sample PostgreSQL schema

### Phase 2: Quick Navigation - Cell Actions (1-2 days)
**Goal:** Enable jumping between related rows

- [ ] Create reverse FK lookup service
  - Query to find all tables/columns referencing a specific column
  - Implement lazy loading + caching
- [ ] Enhance row context menu with FK actions
  - "Follow FK to [table]" for outbound FKs
  - "Find references in [table1, table2, ...]" for inbound FKs
- [ ] Implement filter generation for FK navigation
  - Generate appropriate WHERE clauses
  - Handle type conversions (UUID, INT, TEXT, etc.)
- [ ] Implement navigation handler
  - Switch table & apply filter
  - Maintain navigation history
- [ ] Test with various FK scenarios

### Phase 3: Quick References Panel (1 day)
**Goal:** Show FK relationships in an accessible panel

- [ ] Create `QuickReferencesPanel` component
  - Display both FK targets and reverse references
  - Show counts and quick actions
- [ ] Add modal trigger button/menu option
- [ ] Implement panel interactions
  - Click to navigate
  - Expand/collapse relationship trees
- [ ] Polish UI and interactions

### Phase 4: Polish & Advanced Features (Optional)
- [ ] Relationship explorer side panel (graph view)
- [ ] Breadcrumb navigation trail
- [ ] Keyboard shortcuts (Cmd+K, Cmd+Shift+K)
- [ ] Performance optimization for large datasets
- [ ] Graph visualization (if useful)

---

## Technical Architecture

### New Files to Create
1. `src/server/pg/fns/get-table-foreign-keys.kysely.ts` - FK metadata query
2. `src/server/pg/fns/find-column-references.kysely.ts` - Reverse FK lookups
3. `src/server/pg/start-fns/get-table-foreign-keys.start.ts` - Server function
4. `src/server/pg/start-fns/find-column-references.start.ts` - Server function
5. `src/components/ui/foreign-key-icon.tsx` - FK visual indicator
6. `src/components/quick-references-panel.tsx` - References panel component
7. `src/lib/fk-navigation.ts` - Navigation helpers

### Files to Modify
1. `src/server/pg/fns/get-all-tables-columns.kysely.ts` - Add FK info to response
2. `src/server/pg/start-fns/get-all-tables-columns.start.ts` - Update server function
3. `src/components/pages/connection.page.tsx` - Use FK metadata
4. `src/components/ui/column-header-with-info.tsx` - Display FK icon
5. `src/components/row-context-menu.tsx` - Add FK actions

### Data Structures

```typescript
// Extended ColumnMetadata
interface ColumnMetadata {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string | null;

  // New fields
  isForeignKey?: boolean;
  foreignKey?: {
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
  };
}

// Reverse references
interface ColumnReference {
  schema: string;
  table: string;
  column: string;
  constraintName: string;
}

interface ColumnReferences {
  column: string;
  references: ColumnReference[];
}
```

---

## Success Criteria

### Phase 1
- [ ] FK metadata displays correctly in column headers
- [ ] FK tooltips show referenced table/column
- [ ] FK detection works across multiple schemas
- [ ] No performance degradation on large tables

### Phase 2
- [ ] Users can jump to referenced rows
- [ ] Reverse FK lookups load on demand
- [ ] Filters are applied correctly
- [ ] Navigation doesn't break existing functionality

### Phase 3
- [ ] Quick references panel is intuitive
- [ ] Panel shows all relationships clearly
- [ ] Click-to-navigate works smoothly
- [ ] Panel closes gracefully

### Overall
- [ ] Feature works with existing tab system
- [ ] Works with existing filter/sort functionality
- [ ] Doesn't break existing UI components
- [ ] Performance acceptable for typical database sizes

---

## Future Enhancements (Not in scope)

### Pattern Discovery Plan
- Enum/constant value matching
- Cross-table pattern detection
- Data lineage tracking
- Value-based filtering

### Advanced Features
- Relationship graph visualization
- Bidirectional highlighting on hover
- Compare multiple rows' relationships
- Export relationship diagrams
- Query history breadcrumb

---

## Notes

- Always lazy-load reverse FK lookups to avoid N+1 query problems
- Cache FK metadata at the component level to avoid redundant queries
- Consider pagination for tables with many references
- Test with circular FK references (users → organizations ↔ subscriptions)
- Support both UUID and integer primary keys
