# JSON Cell UI Improvements - v2 Update

## Changes Made

### 1. **Smart JSON Previews in Table Cells**
**File**: `src/components/ui/json-cell.tsx`

#### Before:
```
[Object]              [Array: 5 items]
```

#### After:
```
{"name": "John", "age": 30, "active": true…
[{"id": 1}, {"id": 2}, {"id": 3}, {"id": 4…
```

**Implementation**:
- New `generatePreview()` function converts JSON to compact string representation
- Automatically truncates to 60 characters with ellipsis
- Removes extra whitespace for compact display
- Hover shows full preview via `title` tooltip

### 2. **Much Larger Dialog**

#### Before:
```
max-w-2xl (32rem / 512px max width)
```

#### After:
```
max-w-6xl h-[90vh] (80% of viewport)
- Width: 64rem (1024px) - almost full width
- Height: 90% of viewport height
- Flex layout allows content to scroll naturally
```

**Styling Changes**:
```tsx
// Before
<DialogContent className="max-w-2xl">
  <div className="mt-4">
    <JsonViewerModal data={value} />
  </div>
</DialogContent>

// After
<DialogContent className="max-w-6xl h-[90vh] flex flex-col">
  <DialogHeader>
    <DialogTitle>JSON Data</DialogTitle>
  </DialogHeader>
  <div className="mt-4 flex-1 overflow-auto">
    <JsonViewerModal data={value} />
  </div>
</DialogContent>
```

**Benefits**:
- `flex flex-col` - Proper layout structure
- `flex-1 overflow-auto` - Content area grows and scrolls
- `h-[90vh]` - Takes up most of the screen
- Better for viewing large, complex JSON structures

### 3. **Cell Button Improvements**

```tsx
className={cn("h-6 text-xs px-2 truncate max-w-xs", className)}
title={preview}
```

**Features**:
- `truncate` - Prevents text overflow, adds ellipsis
- `max-w-xs` - Limits width to ~20rem
- `title={preview}` - Full preview on hover
- Maintains consistent button styling

## Visual Comparison

### Table View

**Before:**
```
┌────┬─────────────┬──────────────────┐
│ id │ metadata    │ config           │
├────┼─────────────┼──────────────────┤
│ 1  │ [Object]    │ [Array: 3 items] │
│ 2  │ [Object]    │ [Object]         │
└────┴─────────────┴──────────────────┘
```

**After:**
```
┌────┬──────────────────────────────────┬──────────────────────────┐
│ id │ metadata                         │ config                   │
├────┼──────────────────────────────────┼──────────────────────────┤
│ 1  │ {"name": "John", "age": 30, …   │ [{"id": 1}, {"id": 2},… │
│ 2  │ {"user": {"id": "123", "role"…  │ {"debug": true, "port"…  │
└────┴──────────────────────────────────┴──────────────────────────┘
```

### Dialog View

**Before:**
```
┌─────────────────────────────────────┐
│ JSON Data                        [X] │
├─────────────────────────────────────┤
│ {                                   │
│   "key": "value"                    │
│   "nested": {                       │
│ ...                                 │
│ (limited space)                     │
└─────────────────────────────────────┘
(max ~512px wide)
```

**After:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ JSON Data                                                                [X] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ {                                                                             │
│   "key": "value"                                                              │
│   "nested": {                                                                 │
│     "deep": {                                                                 │
│       "veryDeep": [1, 2, 3]                                                   │
│     }                                                                         │
│   }                                                                           │
│   ... (lots of room for complex structures)                                   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
(~1024px wide, 90vh height)
```

## Technical Details

### Preview Generation Algorithm

```tsx
function generatePreview(value: unknown): string {
  try {
    // 1. Convert to JSON string
    const str = JSON.stringify(value);

    // 2. Truncate if too long
    if (str.length > 60) {
      return str.substring(0, 60).replace(/\s+/g, " ") + "…";
    }

    // 3. Normalize whitespace
    return str.replace(/\s+/g, " ");
  } catch {
    // Fallback to string conversion
    return String(value);
  }
}
```

## Benefits

✅ **Better Preview** - See actual data in table instead of generic labels
✅ **More Information** - Get hints about JSON content without opening dialog
✅ **Larger Dialog** - Comfortably view and edit large/complex JSON
✅ **Better UX** - Tooltips on hover, proper scrolling
✅ **Responsive** - Works well with different screen sizes

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- Uses standard `vh` units for viewport height
- Flexbox layout for proper scrolling

## Performance

- Preview generation is synchronous (fast JSON.stringify)
- Memoization in JsonViewer prevents re-renders
- Dialog content only renders when opened
- No additional dependencies
