# JSON Viewer Components

This document explains how to use the JSON viewer components to display JSON data in a beautiful, interactive way.

## Components

### 1. `JsonViewer`
A recursive component that displays JSON data with syntax highlighting and collapsible nodes.

**Features:**
- Syntax highlighting for different data types (strings, numbers, booleans, null)
- Collapsible/expandable nodes for objects and arrays
- Dark mode support
- Monospace font for better readability
- Customizable max depth to prevent infinite expansion

**Usage:**
```tsx
import { JsonViewer } from "@/components/ui/json-viewer";

const data = {
  name: "John",
  age: 30,
  items: [1, 2, 3],
  nested: {
    key: "value"
  }
};

export function Example() {
  return <JsonViewer data={data} defaultExpanded={true} maxDepth={5} />;
}
```

**Props:**
- `data`: The data to display (any type)
- `defaultExpanded`: Whether to expand by default (default: false)
- `maxDepth`: Maximum nesting depth before collapsing (default: 10)
- `className`: Additional CSS classes

### 2. `JsonViewerModal`
A modal/dialog version of the JSON viewer with a copy-to-clipboard button.

**Features:**
- Everything from JsonViewer
- Copy button to copy JSON as formatted string
- "Copied!" feedback message
- Scrollable container for large objects

**Usage:**
```tsx
import { JsonViewerModal } from "@/components/ui/json-viewer";

export function Example() {
  return <JsonViewerModal data={complexData} />;
}
```

**Props:**
- `data`: The data to display
- `className`: Additional CSS classes

### 3. `JsonCell`
A table cell component that displays JSON data with a button to open the full viewer in a modal.

**Features:**
- **Smart preview**: Shows actual JSON content (up to 60 characters) instead of generic labels
- **Truncated display**: Long content automatically truncates with ellipsis
- **Hover tooltip**: Full preview visible on hover
- **Large dialog**: Opens in 90vh fullscreen-optimized modal for comfortable viewing
- **Clickable button**: Expand in a scrollable dialog
- **Handles simple values gracefully**: Non-complex values display as-is
- **Perfect for use in data tables**: Designed specifically for table cell rendering

**Usage:**
```tsx
import { JsonCell } from "@/components/ui/json-cell";

// In your table column definition:
{
  accessorKey: "schema",
  header: "Schema",
  cell: ({ row }) => <JsonCell value={row.original.schema} />
}
```

**Props:**
- `value`: The data to display
- `className`: Additional CSS classes

**Example previews in table:**
- `{"name": "John", "age": 30, "roles": ["admin"…`
- `[{"id": 1, "active": true}, {"id": 2, "ac…`
- `{"key": "value"}`

**Dialog:** Opens at `max-w-6xl h-[90vh]` for maximum viewing area

## Integration with Data Tables

### Using JsonCell in React Table

```tsx
import { createColumnHelper } from "@tanstack/react-table";
import { JsonCell } from "@/components/ui/json-cell";

const columnHelper = createColumnHelper<DatabaseRow>();

const columns = [
  columnHelper.accessor("id", {
    header: "ID",
  }),
  columnHelper.accessor("schema", {
    header: "Schema",
    cell: ({ row }) => <JsonCell value={row.original.schema} />,
  }),
  columnHelper.accessor("metadata", {
    header: "Metadata",
    cell: ({ row }) => <JsonCell value={row.original.metadata} />,
  }),
];
```

## Styling

### Color scheme
- **Strings**: Green (`text-green-600` / `dark:text-green-400`)
- **Numbers**: Cyan (`text-cyan-600` / `dark:text-cyan-400`)
- **Booleans/null**: Yellow (`text-yellow-600` / `dark:text-yellow-500`)
- **Keys**: Blue (`text-blue-600` / `dark:text-blue-400`)
- **Braces/Brackets**: Gray (`text-gray-800` / `dark:text-gray-200`)

### Dark mode
All components have built-in dark mode support using Tailwind's dark: prefix.

## Performance Considerations

- Components are memoized with `React.memo` to prevent unnecessary re-renders
- Collapsing deeply nested structures prevents rendering large DOM trees
- Use `maxDepth` prop to limit expansion depth for very large objects

## Accessibility

- Expand/collapse buttons are keyboard accessible
- Semantic HTML structure with proper labels
- ARIA attributes for screen readers
