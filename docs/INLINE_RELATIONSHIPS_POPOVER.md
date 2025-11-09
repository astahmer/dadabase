# Inline Relationships Popover UI

## Overview
Implement a VSCode quick-refs style inline popover for displaying relationships without opening a drawer/sheet. This provides quick access to relationship data while keeping the full sheet available for detailed exploration.

## Design

### Visual Flow
1. **FK Column Cells**: Cells in FK columns show a subtle FK icon button (already exists in headers)
2. **Hover/Click Activation**: On hover or click on an FK cell:
   - An inline popover appears near the cell
   - Shows forward FK reference (where this value points to)
   - Shows reverse references (tables that reference this value)
3. **Compact Display**:
   - Forward FK: Single line with table.column and "Go" button
   - Reverse FKs: List with table.column, row count, and navigation
4. **Full Sheet**: Click "View all" in popover → opens existing Sheet

### Trigger Options
We'll implement **on-hover activation**:
- FK button appears on cell hover (or is always visible but inactive)
- Clicking FK button or hovering shows popover
- Popover stays visible while hovering over it
- Clicking outside closes popover

### Implementation Strategy

#### 1. Create InlineRelationshipsPopover Component
- Use Ark UI's Popover component for positioning/styling
- Compact version of QuickReferencesPanel
- Shows same data but in a more condensed format
- Has "View all" button to expand to full sheet

#### 2. Create RelationshipsQuickButton Component
- Small button component that appears in FK cells
- On hover/click triggers popover
- Shows FK icon with subtle styling
- Positioned at the end of the cell content

#### 3. Update Cell Rendering
- Wrap cell content in a container that can show the FK button
- FK button appears on cell hover (or click-to-show)
- Button triggers popover with relationship data

#### 4. Data Flow
- Prefetch happens when menu opens (existing behavior)
- Popover uses same prefetched data
- No additional queries if sheet was opened first
- Separate prefetch if popover opened directly

### User Workflows

**Workflow 1: Quick Peek at Relationships**
1. User hovers over FK cell value
2. FK button becomes visible/active
3. User clicks FK button or hovers on it
4. Popover shows inline relationships
5. User can click "Go" to navigate or "View all" to expand sheet

**Workflow 2: Direct Navigation from Popover**
1. From popover, user clicks "Go" button next to forward FK
2. Navigates to referenced row immediately
3. Or clicks reverse reference to navigate there

**Workflow 3: Full Sheet View**
1. User clicks "View all relationships" in popover
2. Existing sheet opens with full details
3. User can still see table data behind sheet

## Components to Create/Modify

### New Files
- `src/components/inline-relationships-popover.tsx` - Main popover component
- `src/components/relationships-quick-button.tsx` - FK button in cells

### Modified Files
- `src/components/pages/connection.page.tsx` - Cell rendering logic
- `src/components/cell-context-menu.tsx` - Optional: add popover trigger
- `src/components/quick-references-panel.tsx` - Optional: extract shared logic

## Implementation Steps

### Phase 1: Create InlineRelationshipsPopover Component
- Compact version showing only essential info
- Use existing QuickReferencesPanel logic but simplified
- Show forward FK + list of reverse references
- Include "View all" button

### Phase 2: Create RelationshipsQuickButton
- Small icon button component
- Appears in FK cells on hover
- Manages popover visibility state
- Communicates with parent for navigation

### Phase 3: Update Cell Rendering
- Detect FK columns
- Wrap content with RelationshipsQuickButton
- Pass necessary callbacks and data

### Phase 4: Connect Prefetching
- Use existing prefetch on cell click
- Extend to prefetch for inline popover
- Maintain cache between popover and sheet

## Styling Notes
- Keep popover width similar to VSCode (~300px)
- Use subtle backgrounds to not distract from table
- Ensure good readability with dark/light modes
- Use existing Ark UI components for consistency
- Make FK button icon size small (~16-18px)

## Performance Considerations
- Prefetch data as early as possible
- Reuse query cache between popover and sheet
- Lazy-load relationship data only when popover opens
- Consider memoizing popover content to prevent re-renders
