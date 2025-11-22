# Relationship Explorer - Integration Guide

## Quick Start

The Relationship Explorer is ready to use! Here's how to enable it in different contexts.

## Option 1: Row Context Menu (Recommended First Integration)

In your row action handler where you show row data:

```tsx
import { RowJsonViewer } from "#src/components/row-json-viewer";

// In your component state or handler:
const [selectedRowData, setSelectedRowData] = useState<{
  row: Record<string, unknown> | null;
  schema: string;
  table: string;
  connectionUrl: string;
}>(null);

// When user clicks "View Row" button:
const handleViewRowData = (row: Record<string, unknown>) => {
  setSelectedRowData({
    row,
    schema: selectedSchema,
    table: selectedTable,
    connectionUrl: activeConnectionUrl,
  });
};

// In your popover/modal:
{selectedRowData && (
  <RowJsonViewer
    row={selectedRowData.row}
    schema={selectedRowData.schema}
    table={selectedRowData.table}
    connectionUrl={selectedRowData.connectionUrl}
    showRelationships={true}  // ← Enable the explorer
    onClose={() => setSelectedRowData(null)}
  />
)}
```

## Option 2: Inline JSON Popover

If you use `InlineJsonPopover` in your cells:

```tsx
import { InlineJsonPopover } from "#src/components/inline-json-popover";

<InlineJsonPopover
  value={cellData}
  schema={selectedSchema}
  table={selectedTable}
  connectionUrl={activeConnectionUrl}
  showRelationships={true}  // ← Enable the explorer
  onClose={() => setShowPopover(false)}
/>
```

## Option 3: Expanded Full Dialog

For a full-screen view with relationship explorer:

```tsx
import { EnhancedJsonViewer } from "#src/components/ui/enhanced-json-viewer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent side="right" className="w-full h-screen flex flex-col">
    <SheetHeader>
      <SheetTitle>Row Details with Relationships</SheetTitle>
    </SheetHeader>
    <div className="flex-1 overflow-auto p-4">
      <EnhancedJsonViewer
        data={selectedRow}
        schema={selectedSchema}
        table={selectedTable}
        connectionUrl={activeConnectionUrl}
        showRelationships={true}  // ← Enable the explorer
        maxDepth={5}
      />
    </div>
  </SheetContent>
</Sheet>
```

## Migration Path

### Before (Basic JSON View)
```tsx
<RowJsonViewer row={rowData} />
```

### After (With Relationship Explorer)
```tsx
<RowJsonViewer
  row={rowData}
  schema={currentSchema}
  table={currentTable}
  connectionUrl={connectionUrl}
  showRelationships={true}
/>
```

✅ Backward compatible - old code still works!

## Feature Checklist

- [x] Displays row data as formatted JSON
- [x] Shows relationships as collapsible keys
- [x] Displays row counts immediately (no loading needed)
- [x] Lazy-loads related data on expand
- [x] Shows compact preview (first 5 rows + count)
- [x] Handles empty relationships gracefully
- [x] Error handling for fetch failures
- [x] Loading spinners during data fetch
- [x] Keyboard accessible
- [x] Mobile responsive
- [x] Dark/light mode support

## Customization

### Control Relationship Display

```tsx
// Enable relationships
<RowJsonViewer
  row={data}
  schema={schema}
  table={table}
  connectionUrl={url}
  showRelationships={true}
/>

// Disable relationships (falls back to basic JSON)
<RowJsonViewer
  row={data}
  showRelationships={false}
/>

// Only show JSON (no relationships at all)
<RowJsonViewer row={data} />
```

### Adjust JSON Depth

```tsx
// Deeper exploration (for expanded view)
<EnhancedJsonViewer
  data={data}
  showRelationships={true}
  maxDepth={10}
/>

// Shallower (for inline view)
<EnhancedJsonViewer
  data={data}
  showRelationships={true}
  maxDepth={2}
/>
```

## Props Reference

### RowJsonViewer

```typescript
interface RowJsonViewerProps {
  row: Record<string, unknown>;
  onExpandToDialog?: () => void;
  onClose?: () => void;
  showRelationships?: boolean;        // NEW
  schema?: string;                    // NEW
  table?: string;                     // NEW
  connectionUrl?: string;             // NEW
}
```

### InlineJsonPopover

```typescript
interface InlineJsonPopoverProps {
  value: unknown;
  onExpandToDialog?: () => void;
  onClose?: () => void;
  showRelationships?: boolean;        // NEW
  schema?: string;                    // NEW
  table?: string;                     // NEW
  connectionUrl?: string;             // NEW
}
```

### EnhancedJsonViewer

```typescript
interface EnhancedJsonViewerProps {
  data: unknown;
  showRelationships?: boolean;
  schema?: string;
  table?: string;
  connectionUrl?: string;
  className?: string;
  defaultExpanded?: boolean;
  maxDepth?: number;
}
```

## Common Use Cases

### 1. View Row with All Relations
```tsx
<RowJsonViewer
  row={selectedRow}
  schema="public"
  table="orders"
  connectionUrl={dbUrl}
  showRelationships={true}
/>
```

### 2. Quick Peek (Inline)
```tsx
<InlineJsonPopover
  value={cellData}
  schema="public"
  table="products"
  connectionUrl={dbUrl}
  showRelationships={true}
/>
```

### 3. Full Modal View
```tsx
<Sheet open={open}>
  <SheetContent>
    <EnhancedJsonViewer
      data={selectedRow}
      schema="public"
      table="users"
      connectionUrl={dbUrl}
      showRelationships={true}
      maxDepth={8}
    />
  </SheetContent>
</Sheet>
```

## Troubleshooting

### Relationships not showing
- ✅ Ensure `showRelationships={true}`
- ✅ Verify `schema`, `table`, and `connectionUrl` are provided
- ✅ Check that related data actually exists (counts would be 0)

### Data takes long to load
- ✅ This is normal for first time (counts query fetches)
- ✅ Subsequent opens use cached data (TanStack Query)
- ✅ Related rows only load on expand (lazy-loading)

### Empty relationship sections
- ✅ This means there are no related records for this row
- ✅ FK column value is null or no matching records found

### Type errors
- ✅ Ensure `showRelationships` prop is boolean
- ✅ Verify `schema` and `table` are strings
- ✅ Check `connectionUrl` format (e.g., `postgresql://...`)

## Performance Tips

1. **Use in modals/popovers** (not in table rows by default)
   - Expensive for large tables with many relationships
   - Perfect for "view details" dialogs

2. **Lazy-load the explorer** (show basic JSON first)
   - Add a toggle: "View with relationships"
   - Reduces initial render time

3. **Limit max depth** for large objects
   ```tsx
   <EnhancedJsonViewer maxDepth={3} />
   ```

4. **Cache connection info** to avoid recalculation
   - Store `schema`, `table`, `connectionUrl` at container level
   - Pass down to child components

## Accessibility

The explorer supports:
- ✅ Keyboard navigation (Tab, Enter, Arrow keys)
- ✅ Screen reader announcements for states
- ✅ Loading indicators for async operations
- ✅ Disabled states for empty relationships
- ✅ Tooltip hints on hover

## Examples by Feature

### Row Context Menu
See: `src/components/row-context-menu.tsx`
- Add "View with Relations" menu item
- Pass `showRelationships={true}` to viewer

### Cell Popover
See: `src/components/inline-json-button.tsx`
- Update `InlineJsonPopover` to support relationships
- Pass context props from parent table

### Row Detail Modal
See: `src/components/data-table.tsx`
- Replace or enhance existing "View Row" dialog
- Use `EnhancedJsonViewer` for full view

## Next Steps

1. **Try it out** - Start with row context menu integration
2. **Get feedback** - See how users interact with it
3. **Enhance** - Add relationship navigation/filtering as needed
4. **Scale** - Consider performance for large datasets

## Support & Questions

For implementation questions:
- Check `RELATIONSHIP_EXPLORER.md` for detailed docs
- Review component TypeScript interfaces for prop types
- Look at inline comments in component code

For bugs/improvements:
- Test in dev environment first
- Capture error messages/screenshots
- Note which relationships fail to load

---

**Status**: Ready for integration! 🚀

Start small with row context menus and expand from there.
