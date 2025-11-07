# ListboxMenu Component Documentation

The `ListboxMenu` component is a reusable, composable UI component that combines a Popover with a Listbox to create a dropdown menu with filtering capabilities. It abstracts the complexity of managing popover state and listbox interactions while allowing full customization through composition.

## Features

- **Composable**: Built using the same composition pattern as Select and Combobox
- **Filterable**: Built-in support for filtering list items
- **Customizable**: Supports size variants and custom classNames
- **Accessible**: Built on Ark UI primitives with proper ARIA attributes
- **Type-safe**: Full TypeScript support

## Components

### `ListboxMenu`
Root component that manages the popover state.

```tsx
<ListboxMenu open={open} onOpenChange={(e) => setOpen(e.open)}>
  {children}
</ListboxMenu>
```

**Props**: Extends `PopoverPrimitive.RootProps`

---

### `ListboxMenuTrigger`
The trigger button that opens/closes the menu.

**Size variants**: `sm`, `md`, `lg` (default: `md`)

```tsx
<ListboxMenuTrigger asChild size="sm" className="custom-class">
  <Button variant="outline">Open Menu</Button>
</ListboxMenuTrigger>
```

---

### `ListboxMenuContent`
The container that holds the listbox and filter content.

```tsx
<ListboxMenuContent>
  {children}
</ListboxMenuContent>
```

---

### `ListboxMenuRoot`
The Listbox root component that manages the list state.

```tsx
<ListboxMenuRoot collection={listCollection}>
  {children}
</ListboxMenuRoot>
```

**Props**: Requires `collection` prop from `createListCollection()`

---

### `ListboxMenuList`
The scrollable container for list items.

```tsx
<ListboxMenuList>
  <ListboxMenuItemGroup>
    {items.map(item => (
      <ListboxMenuItem key={item.value} item={item}>
        {item.label}
      </ListboxMenuItem>
    ))}
  </ListboxMenuItemGroup>
</ListboxMenuList>
```

---

### `ListboxMenuItem`
Individual list item component.

**Props**:
- `showIndicator?: boolean` - Shows a checkmark when true (default: `true`)
- `item` - The collection item object
- `onClick` - Handler when item is selected

```tsx
<ListboxMenuItem item={item} onClick={handleSelect} showIndicator={isSelected}>
  {item.label}
</ListboxMenuItem>
```

---

### `ListboxMenuItemGroup`
Container for grouping list items.

```tsx
<ListboxMenuItemGroup>
  {items.map(item => (
    <ListboxMenuItem key={item.value} item={item}>
      {item.label}
    </ListboxMenuItem>
  ))}
</ListboxMenuItemGroup>
```

---

### `ListboxMenuItemGroupLabel`
Optional label for item groups.

```tsx
<ListboxMenuItemGroupLabel>
  Group Title
</ListboxMenuItemGroupLabel>
```

---

### `ListboxMenuFilterContainer`
Container for the filter input.

```tsx
<ListboxMenuFilterContainer>
  <ListboxMenuFilterInput
    placeholder="Filter..."
    value={filterValue}
    onChange={(e) => handleFilter(e.target.value)}
    autoFocus
  />
</ListboxMenuFilterContainer>
```

---

### `ListboxMenuFilterInput`
Pre-styled input for filtering list items.

```tsx
<ListboxMenuFilterInput
  placeholder="Search..."
  autoFocus
  onChange={(e) => {
    setFilterValue(e.target.value);
    list.filter(e.target.value);
  }}
/>
```

---

### `ListboxMenuEmpty`
Component displayed when no items match the filter.

```tsx
<ListboxMenuEmpty>
  No items found
</ListboxMenuEmpty>
```

---

## Complete Example

Here's a complete example implementing a "Rows per page" selector:

```tsx
import { useFilter } from "@ark-ui/react/locale";
import { useListCollection } from "@ark-ui/react";
import { useState } from "react";
import * as ListboxMenu from "../ui/listbox-menu";
import { Button } from "../ui/button";

interface RowsPerPageSelectorProps {
  value: number;
  onValueChange: (newLimit: number) => void;
}

export function RowsPerPageSelector({
  value,
  onValueChange,
}: RowsPerPageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [filterValue, setFilterValue] = useState("");

  const items = [
    { label: "50", value: 50 },
    { label: "100", value: 100 },
    { label: "250", value: 250 },
    { label: "500", value: 500 },
  ];

  const filters = useFilter({ sensitivity: "base" });
  const list = useListCollection({
    initialItems: items,
    filter: filters.contains,
  });

  const filteredItems = list.collection.items;

  const handleSelect = (newValue: number) => {
    onValueChange(newValue);
    setOpen(false);
    setFilterValue("");
  };

  return (
    <ListboxMenu.ListboxMenu open={open} onOpenChange={(e: any) => setOpen(e.open)}>
      <ListboxMenu.ListboxMenuTrigger asChild size="sm">
        <Button variant="outline" size="sm" className="h-8 px-2 gap-1 w-16">
          <span className="text-xs font-medium">{value}</span>
        </Button>
      </ListboxMenu.ListboxMenuTrigger>

      <ListboxMenu.ListboxMenuContent>
        <ListboxMenu.ListboxMenuRoot collection={list.collection}>
          <ListboxMenu.ListboxMenuFilterContainer>
            <ListboxMenu.ListboxMenuFilterInput
              placeholder="Filter..."
              autoFocus
              value={filterValue}
              onChange={(e) => {
                setFilterValue(e.target.value);
                list.filter(e.target.value);
              }}
            />
          </ListboxMenu.ListboxMenuFilterContainer>

          <ListboxMenu.ListboxMenuList>
            {filteredItems.length > 0 ? (
              <ListboxMenu.ListboxMenuItemGroup>
                {filteredItems.map((item: { label: string; value: number }) => (
                  <ListboxMenu.ListboxMenuItem
                    key={item.value}
                    item={item}
                    onClick={() => handleSelect(item.value)}
                    showIndicator={item.value === value}
                  >
                    {item.label}
                  </ListboxMenu.ListboxMenuItem>
                ))}
              </ListboxMenu.ListboxMenuItemGroup>
            ) : (
              <ListboxMenu.ListboxMenuEmpty>
                No items found
              </ListboxMenu.ListboxMenuEmpty>
            )}
          </ListboxMenu.ListboxMenuList>
        </ListboxMenu.ListboxMenuRoot>
      </ListboxMenu.ListboxMenuContent>
    </ListboxMenu.ListboxMenu>
  );
}
```

## Helper Utilities

The component also exports utilities from `@ark-ui/react`:

```tsx
import {
  createListCollection,
  useListCollection,
  type CollectionItem,
  type ListCollection,
} from "../ui/listbox-menu";
```

### `createListCollection`
Creates a static collection for the listbox.

```tsx
const collection = createListCollection({
  items: [
    { label: "Option 1", value: 1 },
    { label: "Option 2", value: 2 },
  ],
});
```

### `useListCollection`
Hook for managing a collection with filtering capability.

```tsx
const filters = useFilter({ sensitivity: "base" });
const list = useListCollection({
  initialItems: items,
  filter: filters.contains,
});

// Filter items
list.filter(searchTerm);

// Access filtered items
const filteredItems = list.collection.items;
```

## Styling & Variants

### Size Variants

The `ListboxMenuTrigger` supports three size variants:

- `sm`: Compact size (32px height, small text)
- `md`: Default size (38px height, normal text)
- `lg`: Large size (44px height, large text)

```tsx
<ListboxMenuTrigger size="sm">Small</ListboxMenuTrigger>
<ListboxMenuTrigger size="md">Normal</ListboxMenuTrigger>
<ListboxMenuTrigger size="lg">Large</ListboxMenuTrigger>
```

### Custom Classes

All components accept custom className props:

```tsx
<ListboxMenuTrigger className="custom-trigger-class">
  <Button>Open</Button>
</ListboxMenuTrigger>

<ListboxMenuContent className="custom-content-class">
  {/* content */}
</ListboxMenuContent>

<ListboxMenuItem className="custom-item-class">
  {/* item */}
</ListboxMenuItem>
```

## Best Practices

1. **Always use `useListCollection` with filtering** for better UX when you have more than a few items:
   ```tsx
   const filters = useFilter({ sensitivity: "base" });
   const list = useListCollection({
     initialItems: items,
     filter: filters.contains,
   });
   ```

2. **Set `autoFocus` on the filter input** for better accessibility:
   ```tsx
   <ListboxMenuFilterInput autoFocus placeholder="Filter..." />
   ```

3. **Always provide `showIndicator` value** based on selection state:
   ```tsx
   <ListboxMenuItem
     showIndicator={item.value === selectedValue}
     item={item}
   >
     {item.label}
   </ListboxMenuItem>
   ```

4. **Reset filter state when closing the menu**:
   ```tsx
   const handleSelect = (value) => {
     onValueChange(value);
     setOpen(false);
     setFilterValue(""); // Reset filter
   };
   ```

5. **Use the composition pattern** for maximum flexibility instead of creating wrapper components.
