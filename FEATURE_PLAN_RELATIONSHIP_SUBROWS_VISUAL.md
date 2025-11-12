# Visual Architecture & UI Mockup

## UI Mockup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ USERS TABLE                                                                  │
├────────────┬──────────────┬─────────────┬──────────────┬─────────────────────┤
│ id         │ name         │ email       │ ↳ orders     │ ↳ payments          │
├────────────┼──────────────┼─────────────┼──────────────┼─────────────────────┤
│ 123        │ John Doe     │ john@ex...  │ [► 5 rows]   │ [► 12 rows]         │
└────────────┴──────────────┴─────────────┴──────────────┴─────────────────────┘
│ EXPANDED ROW - ORDERS SUBROW (clicked "↳ orders")
├──────────────────────────────────────────────────────────────────────────────┤
│  Nested ORDERS Table (filtered: orders.user_id = 123)                        │
│  ┌─────────┬──────────────┬───────────────┬─────────────┬──────────────────┐ │
│  │ id      │ user_id      │ created_at    │ total_amount│ status           │ │
│  ├─────────┼──────────────┼───────────────┼─────────────┼──────────────────┤ │
│  │ ord-001 │ 123          │ 2025-01-01    │ $99.99      │ completed        │ │
│  │ ord-002 │ 123          │ 2025-01-05    │ $45.50      │ pending          │ │
│  │ ord-003 │ 123          │ 2025-01-10    │ $200.00     │ completed        │ │
│  │ ord-004 │ 123          │ 2025-01-12    │ $75.25      │ shipped          │ │
│  │ ord-005 │ 123          │ 2025-01-15    │ $180.00     │ completed        │ │
│  └─────────┴──────────────┴───────────────┴─────────────┴──────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
│ 456        │ Jane Smith   │ jane@ex...   │ [► 8 rows]   │ [► 3 rows]          │
└────────────┴──────────────┴─────────────┴──────────────┴─────────────────────┘
│ 789        │ Bob Johnson  │ bob@ex...    │ [► 2 rows]   │ [► 0 rows]          │
└────────────┴──────────────┴─────────────┴──────────────┴─────────────────────┘
```

## Component Interaction Flow

```
DataTable
  │
  ├─ header columns (id, name, email)
  └─ relationship columns (↳ orders, ↳ payments)
       │
       └─ DataTableRow (for each user)
            │
            ├─ DataTableCell (regular columns)
            │  └─ renders: id, name, email values
            │
            ├─ RelationshipCell (for each relationship)
            │  ├─ Expand button [► 5 rows]
            │  └─ onclick: toggle expansion state
            │
            └─ RelationshipSubrowTable (when expanded)
               │
               ├─ loads data: SELECT * FROM orders WHERE user_id = ?
               │
               └─ nested DataTable
                  ├─ header: id, user_id, created_at, total_amount, status
                  └─ rows: 5 order records
```

## State Management Flow

```
User clicks relationship cell button
    │
    ├─ RelationshipCell onClick handler
    │  └─ calls: toggleExpansion(rowId, relationshipId)
    │
    ├─ useRelationshipExpansionState updates
    │  └─ state[rowId] = new Set([relationshipId])
    │
    ├─ DataTableRow re-renders with new expansion state
    │  └─ checks: isExpanded(rowId, relationshipId)
    │
    └─ RelationshipSubrowTable mounts
       ├─ useQuery fetches data: "SELECT * FROM orders WHERE user_id = 123"
       ├─ shows loading spinner
       └─ renders nested DataTable with results
```

## Data Flow Example

```
USER ROW: { id: 123, name: "John Doe", email: "john@example.com" }

RELATIONSHIP DEFINITION:
{
  referencingSchema: "public"
  referencingTable: "orders"
  referencingColumn: "user_id"
  referencedSchema: "public"
  referencedTable: "users"
  referencedColumn: "id"
  displayLabel: "orders"
  constraintName: "orders_user_id_fk"
}

WHEN USER CLICKS EXPAND [► 5 rows]:

1. Query executed:
   SELECT * FROM public.orders
   WHERE user_id = 123
   LIMIT 20

2. Results: 5 orders with user_id = 123

3. RelationshipSubrowTable renders nested DataTable
   with these 5 order records

4. Subrow <tr> inserted after parent <tr> in DOM:
   <tr class="data-table-row">...</tr>         ← User row
   <tr class="relationship-subrow">            ← INSERTED
     <td colSpan="6">                          ← spans all columns
       <RelationshipSubrowTable ... />         ← nested table
     </td>
   </tr>
   <tr class="data-table-row">...</tr>         ← Next user row
```

## Column Definition Example

```typescript
// Regular columns
const regularColumns = [
  {
    id: 'id',
    header: 'ID',
    cell: (info) => info.getValue(),
  },
  {
    id: 'name',
    header: 'Name',
    cell: (info) => info.getValue(),
  },
  {
    id: 'email',
    header: 'Email',
    cell: (info) => info.getValue(),
  },
];

// Relationship columns
const relationshipColumns = [
  {
    id: 'rel_orders_user_id_fk',
    header: '↳ orders',
    cell: ({ row }) => (
      <RelationshipCell
        relationship={{
          referencingTable: 'orders',
          referencingColumn: 'user_id',
          referencedColumn: 'id',
          displayLabel: 'orders',
          constraintName: 'orders_user_id_fk',
        }}
        parentRowValue={row.original.id}
        isExpanded={expandedState.isExpanded(row.id, 'orders_user_id_fk')}
        onToggleExpand={() => expandedState.toggleExpansion(row.id, 'orders_user_id_fk')}
        matchingRowCount={5}
      />
    ),
    meta: {
      type: 'relationship',
      enableColumnOrdering: false,
      enableSorting: false,
      enableFiltering: false,
    },
  },
  // ... more relationship columns
];

// Combine
const allColumns = [...regularColumns, ...relationshipColumns];
```

## Nested Table Styling Example

```css
/* Parent row - normal styling */
.data-table-row {
  background: white;
  border-bottom: 1px solid var(--border);
}

/* Subrow - distinct styling */
.relationship-subrow {
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid var(--border);
}

.relationship-subrow-content {
  padding: 12px;
  padding-left: 24px; /* Indentation */
}

/* Nested table - subtle styling */
.relationship-subrow-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.9em;
}

.relationship-subrow-table th {
  background: rgba(0, 0, 0, 0.05);
  padding: 8px;
  font-weight: 500;
}

.relationship-subrow-table td {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

/* Relationship cell - button styling */
.relationship-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  background: var(--background);
  transition: background 200ms;
}

.relationship-cell:hover {
  background: var(--muted);
}

.relationship-cell.expanded {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.relationship-cell-icon {
  transition: transform 200ms;
}

.relationship-cell.expanded .relationship-cell-icon {
  transform: rotate(90deg);
}

.relationship-cell-badge {
  background: var(--muted);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.85em;
  font-weight: 500;
}
```

## Loading States

```
Relation cell BEFORE expand:
┌─────────────────┐
│ [► 5 rows]      │
└─────────────────┘

Relationship cell LOADING (user clicked):
┌─────────────────┐
│ [⟳ Loading...]  │
└─────────────────┘

Relationship cell EXPANDED (data loaded):
┌─────────────────┐
│ [▼ 5 rows]      │  ← arrow rotated, clickable to collapse
└─────────────────┘

Relationship cell ERROR:
┌─────────────────┐
│ [✕ Error]       │  ← red styling, error tooltip
└─────────────────┘
```

## Performance Optimization Visualization

### Lazy Loading Strategy

```
Initial Load:
┌──────────────┐
│ Fetch table  │
│ with ALL     │  ← Get row data
│ row data     │
└──────────────┘
        │
        ├─ Fetch relationship counts in background
        │  (how many related rows per relationship)
        │
        └─ Render RelationshipCell with [► N rows]
           (ready to expand, but no nested data loaded yet)

User clicks expand:
┌──────────────┐
│ Fetch only   │
│ that specific│  ← Query only: SELECT * FROM orders WHERE user_id = ?
│ relationship │
│ data         │
└──────────────┘
        │
        └─ Render RelationshipSubrowTable
           (inserts subrow into DOM)
```

### Multiple Relationships - Expansion State Example

```
Row 123 (John Doe):
  - orders: NOT expanded
  - payments: EXPANDED
  - invoices: NOT expanded

Rendered as:
<tr>...</tr>                                 ← John Doe row
<tr class="relationship-subrow">             ← payments subrow (visible)
  <td colSpan="6">
    <DataTable data={payments} />
  </td>
</tr>

Row 456 (Jane Smith):
  - orders: EXPANDED
  - payments: EXPANDED
  - invoices: NOT expanded

Rendered as:
<tr>...</tr>                                 ← Jane Smith row
<tr class="relationship-subrow">             ← orders subrow (visible)
  <td colSpan="6">
    <DataTable data={orders} />
  </td>
</tr>
<tr class="relationship-subrow">             ← payments subrow (visible)
  <td colSpan="6">
    <DataTable data={payments} />
  </td>
</tr>

Note: Multiple subrows for one row, each for a different relationship
```

## Error Handling Scenarios

```
Scenario 1: FK Constraint Invalid
├─ RelationshipCell renders with error state
├─ "✕ Invalid relationship"
└─ tooltip shows error message

Scenario 2: Permission Denied
├─ RelationshipSubrowTable fails to load
├─ Shows error message: "Permission denied"
└─ Button remains clickable to retry

Scenario 3: Too Many Related Rows
├─ RelationshipSubrowTable loads first 20 rows
├─ Shows pagination at bottom
├─ "Showing 1-20 of 1,245 rows"
└─ User can navigate pages

Scenario 4: Relationship Deleted
├─ Metadata includes deleted FK
├─ RelationshipCell shows: "⚠ Relationship no longer exists"
└─ Button disabled/hidden
```
