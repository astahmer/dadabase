# Row JSON Viewer - Design Document

## Overview
Add a full-row JSON viewer accessible from the data table, following the same UX patterns as the existing `InlineJsonButton` and `InlineReferencesButton` components.

## Goal
Users should be able to easily view the complete JSON representation of any table row with:
1. Quick preview via inline popover
2. Full expansion to a sheet/dialog
3. Copy functionality
4. Consistent UI with existing inline viewers

## Proposed Solution

### Access Methods (Choose Primary + Optional Secondary)

#### Option A: **Context Menu** (Recommended Primary)
- Right-click on a row → "View JSON" option
- Pros: Non-intrusive, discoverable, follows existing pattern in `RowContextMenu`
- Cons: Requires right-click

#### Option B: **Keyboard Shortcut** (Optional Secondary)
- `Cmd+J` / `Ctrl+J` on focused row
- Pros: Fast for power users
- Cons: Needs row focus management

#### Option C: **Action Column Button** (Optional)
- Menu icon in last column (same place as row context menu trigger)
- Pros: Immediately visible
- Cons: Takes up space, visual clutter

#### Option D: **Hover Tooltip** (Not Recommended)
- Shows JSON preview on row hover
- Cons: Can clutter table, interferes with scrolling

### Recommended Implementation Strategy
**Primary: Context Menu option** (leverage existing `RowContextMenu`)
**Optional Secondary: Keyboard shortcut** (when row is focused/selected)

## Implementation Plan

### 1. Create New Components

#### `src/components/row-json-viewer.tsx`
New inline popover component similar to `InlineJsonPopover`:
- Displays entire row as JSON
- Shows preview of JSON (first 100 chars)
- Copy button with feedback
- Expand to Sheet button
- Close button

```tsx
interface RowJsonViewerProps {
  row: Record<string, unknown>;
  onExpandToDialog?: () => void;
  onClose?: () => void;
}
```

#### `src/components/ui/sheet-json-viewer.tsx` (if needed)
Modal/sheet component for full JSON viewer:
- Full JSON with syntax highlighting
- Search/filter capability
- Copy functionality
- Code folding

### 2. Update Existing Components

#### `src/components/row-context-menu.tsx`
Add menu item:
```tsx
<MenuItem value="view-json" onClick={handleViewJson}>
  <Code className="size-4" />
  <MenuItemText>View JSON</MenuItemText>
</MenuItem>
```

Implement `handleViewJson` to trigger popover state management

#### `src/components/data-table.tsx`
- Add state management for row JSON viewer (which row, which popover state)
- Pass handler functions to `RowContextMenu`
- Render the popover/sheet components

### 3. State Management Pattern

Use local component state similar to existing inline viewers:
```tsx
const [viewingRowJson, setViewingRowJson] = useState<{
  row: Record<string, unknown>;
  rowIndex: number;
} | null>(null);

const [expandedRowJsonSheet, setExpandedRowJsonSheet] = useState(false);
```

### 4. Styling & UX Consistency

Match existing inline popover patterns:
- Same dimensions: `min-w-96 max-w-2xl`
- Same header styling with icon + label
- Same action buttons (Copy, Close, Expand)
- Same footer with expand button
- Reuse `JsonViewerModal` component for rendering

## File Structure

```
src/components/
├── row-context-menu.tsx (updated)
├── row-json-viewer.tsx (new)
├── data-table.tsx (updated)
└── pages/
    └── connection.page.tsx (updated if needed)
```

## User Experience Flow

1. User right-clicks on a table row
2. Context menu appears with "View JSON" option
3. Click "View JSON"
4. Inline popover appears showing:
   - Row JSON preview (100 char truncated)
   - Syntax-highlighted JSON viewer
   - Copy button
   - Expand button
5. User can:
   - Copy entire row JSON
   - Expand to full sheet view (similar to JsonViewerModal)
   - Close popover (ESC key or close button)

## Alternative Access Methods (Future Enhancements)

- Keyboard shortcut `Cmd+J` on selected row
- Row hover state (show JSON button on hover)
- Expandable row detail view
- Column context menu "View as JSON"

## Related Patterns

This implementation leverages existing code:
- `InlineJsonButton` - Popover trigger pattern
- `InlineJsonPopover` - Inline viewer styling
- `InlineReferencesButton` - Similar access pattern
- `RowContextMenu` - Right-click menu
- `JsonViewerModal` - JSON rendering with syntax highlighting

## Acceptance Criteria

- [ ] Right-click on any table row shows "View JSON" option
- [ ] Clicking "View JSON" opens inline popover with row data
- [ ] Popover shows JSON preview (100 char truncated)
- [ ] Full JSON viewer renders with syntax highlighting
- [ ] Copy button copies row JSON to clipboard
- [ ] Expand button opens full sheet view
- [ ] Close button (X) and ESC key close popover
- [ ] Styling matches existing inline popovers
- [ ] No console errors or warnings
- [ ] Works with all column types
