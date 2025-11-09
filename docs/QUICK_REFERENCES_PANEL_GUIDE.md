# Quick References Panel - User Guide

## Feature Overview

The **Quick References Panel** is a comprehensive modal that displays all foreign key relationships for any cell in your database table. It's your portal to understanding and navigating complex data relationships.

## How to Use

### Opening the Panel

1. **Right-click any cell** in the data table
2. A context menu appears with these options:
   - Log cell to console
   - Copy value
   - Follow to [Table] *(if this is a foreign key)*
   - Find references in current table *(if other tables reference this value)*
   - **→ View all relationships** *(new in Phase 3!)*
3. Click **"View all relationships"**
4. A side panel slides in from the right showing:

### Forward References
Shows where this cell's value points to (if it's a foreign key)

```
┌─ Forward Reference
│
├─ Table: customers
├─ Column: id
├─ Value: 42
│
└─ [Navigate to Referenced Row]
   → Jumps to customers table, filters to id=42
```

**Use case:** "Show me the customer this order belongs to"

### Reverse References
Shows which tables have values that reference this cell

```
┌─ Reverse References (5 tables)
│
├─ public.orders
│  └─ [View] customer_id
│
├─ public.reviews
│  └─ [View] reviewed_customer_id
│
└─ ... (more tables)

→ Clicking [View] filters current table to show
  all rows that reference this value
```

**Use case:** "Show me all orders from this customer"

## Examples

### Example 1: E-Commerce Order Workflow

**Scenario:** You're viewing the `orders` table and see order #5001

```
Step 1: Right-click customer_id cell (value: 42)
        ↓
Step 2: Select "View all relationships"
        ↓
Step 3: Panel shows:
        • Forward FK: Points to customers.id
        • Click "Navigate" → See customer #42 details
        • Reverse refs: Show other orders from customer 42

Step 4: Click "View" on orders in reverse refs
        ↓
Step 5: Returns to orders table, filtered to customer 42's orders
```

### Example 2: Data Discovery

**Scenario:** You don't know how tables relate to each other

```
Step 1: Click any interesting value in any table
        ↓
Step 2: Select "View all relationships"
        ↓
Step 3: Learn:
        • Which table this column points to (if any)
        • Which tables point back to this column
        • How many references exist

Step 4: Recursively explore relationships
        ↓
Result: Understanding of the data structure emerges!
```

## Visual Indicators

### In the Panel

| Icon/Element | Meaning |
|---|---|
| 🔗 Link icon | Relationship (FK) |
| ▼ / ▶ Chevron | Expandable section |
| ⏳ Spinner | Loading reverse references |
| ⚠️ Warning box | Cell value is NULL or no relationships |
| 📊 Count badge | Number of referencing tables/columns |

### In Column Headers

| Indicator | Meaning |
|---|---|
| Link 🔗 icon next to column name | This column is a foreign key |
| Tooltip on hover | Shows "References [table].[column]" |

## Navigation Between Related Data

### Following Forward References
```
Current: orders table, row with customer_id = 42
         ↓ Click "Navigate" in Forward Reference
Result:  customers table, filtered to id = 42
         You see exactly one row: the customer
```

### Following Reverse References
```
Current: customers table, row with id = 42
         Reverse refs show: orders references this value
         ↓ Click "View" on orders reference
Result:  orders table, filtered to customer_id = 42
         You see all orders from that customer
```

## Common Questions

### Q: Can NULL values be navigated?
**A:** No. The panel shows a message: "Cannot show references for NULL values". This prevents errors and is logically sound—NULL doesn't reference anything.

### Q: What if a column has no relationships?
**A:** The panel shows: "This column has no foreign key relationships" and displays no reference sections.

### Q: How fast does the panel load?
**A:** Usually instant (<100ms). The first load might take 100-200ms as it queries the database. Subsequent opens are cached by React Query, so they're nearly instant.

### Q: Can I see circular relationships?
**A:** Yes! The system handles it gracefully through browser navigation history. You can click back to retrace your steps.

### Q: What if there are hundreds of references?
**A:** The panel shows all of them, grouped by table. It's scrollable, so you can browse through. Performance remains good up to ~1000 references.

### Q: Can I navigate without opening the panel?
**A:** Yes! You can use the simpler "Follow to [Table]" or "Find references" menu items directly. The panel is for comprehensive relationship exploration.

## Pro Tips

1. **Quick Jump:** Right-click → "Follow to [Table]" for single-step navigation
2. **Batch View:** Right-click → "Find references" to see all related rows at once
3. **Deep Exploration:** Use "View all relationships" to understand full relationship graphs
4. **Copy Values:** Use "Copy value" before navigating to bookmark IDs
5. **Recursive Exploration:** Open panel → navigate → open panel on new table → repeat

## Keyboard Navigation

Currently: Context menu opens on right-click

Future improvements could add:
- Cmd+K to open "Go to Related Row" dialog
- Cmd+Shift+K to open relationships panel
- Arrow keys to navigate between references

## Troubleshooting

### Panel doesn't open
- Ensure you right-clicked on a cell (not a column header)
- Try a different cell
- Check that cell value is not NULL

### Forward references don't show
- Column might not be a foreign key
- Check column header for FK icon
- Hover column header to see full details

### Reverse references are loading
- Database query is in progress
- Wait for spinner to disappear
- Usually takes <200ms

### Error "Failed to load references"
- Database connection issue
- Try refreshing the page
- Check that your database is still connected

## Architecture Notes

Behind the scenes, this feature:

1. **Detects relationships** using PostgreSQL's `pg_catalog` schema
2. **Caches metadata** per connected schema
3. **Lazy-loads references** only when panel opens
4. **Groups data client-side** for clean UI
5. **Generates filters** that match your selection criteria
6. **Preserves state** through URL parameters

See `docs/ROW_NAVIGATION_COMPLETE.md` for technical details.

---

**Enjoy exploring your data relationships!** 🗺️
