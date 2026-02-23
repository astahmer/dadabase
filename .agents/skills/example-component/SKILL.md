---
name: example-component
description: Creating focused example components that demonstrate UI components in action. Use this for showcasing component functionality without unnecessary boilerplate—similar to Storybook stories but straight to the point.
---

# Example Components Skill

## Overview

Example components are minimal, interactive demonstrations of UI components. They showcase the component's typical usage patterns, state management, and user interactions in a self-contained demo that can be run in the sandbox.

**Use this skill when:**
- You've created or modified a UI component and want to demonstrate its functionality
- You need to show how to use a component with realistic data and interactions
- You want quick visual feedback on component behavior during development

## File Structure & Naming

```
src/components/ui/
├── your-component.tsx          # The actual component
├── your-component.styles.ts    # Optional: styling utilities (CVA)
├── your-component.export.ts    # Optional: public API export
└── your-component.example.tsx  # ← The example component
```

**Naming Convention:**
- Example files end with `.example.tsx`
- Export a named function: `export function YourComponentExample() { ... }`
- File name and function name should match: `button.example.tsx` → `ButtonExample`

## Structure Template

```tsx
import { YourComponent } from "#src/components/ui/your-component.tsx";
import { useState } from "react";

export function YourComponentExample() {
	// 1. Minimal state needed to demonstrate functionality
	const [state, setState] = useState("");

	// 2. Optional: dummy data or configuration
	const items = ["Item 1", "Item 2", "Item 3"];

	// 3. Render: wrap everything in a single container div
	return (
		<div className="p-4">
			<YourComponent
				value={state}
				onChange={setState}
				items={items}
			/>
		</div>
	);
}
```

## Real Example: ListboxMenuExample

See [listbox-menu.example.tsx](../../src/components/ui/listbox-menu.example.tsx) for a complete example:

```tsx
import { Button } from "#src/components/ui/button.tsx";
import { ListboxMenu } from "#src/components/ui/listbox-menu.export.ts";
import { createListCollection, useFilter } from "@ark-ui/react";
import { useState } from "react";

export function ListboxMenuExample() {
	const [isOpen, setIsOpen] = useState(false);
	const [filterValue, setFilterValue] = useState("");
	const { contains } = useFilter({ sensitivity: "base" });

	const columnCollection = createListCollection({
		items: ["users.id", "users.name", "users.email"].map((colId) => ({
			label: colId,
			value: colId,
		})),
	});

	const filteredColumns = columnCollection.items.filter((item) =>
		contains(item.value, filterValue)
	);

	return (
		<div>
			<ListboxMenu.ListboxMenuRoot open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
				{/* Trigger, content, filtering logic... */}
			</ListboxMenu.ListboxMenuRoot>
		</div>
	);
}
```

**Key points:**
- Minimal state: only what's needed to show the component working
- Realistic data: column names, meaningful filter values
- Interactive: users can test all major features (open/close, search, select)
- Self-contained: no external hooks or complex logic

## Adding to Sandbox

Once you've created an example component, display it in the sandbox:

1. **Open** [src/routes/sandbox.tsx](../../src/routes/sandbox.tsx)
2. **Import** the example:
   ```tsx
   import { YourComponentExample } from "#src/components/ui/your-component.example.tsx";
   ```
3. **Add to JSX:**
   ```tsx
   function RouteComponent() {
   	return (
   		<Stack w="full" h="full" align="center" justify="center">
   			<YourComponentExample />
   		</Stack>
   	);
   }
   ```

The sandbox route (`/sandbox`) will automatically display your example component centered on the page.

## Best Practices

| Do | Don't |
|---|---|
| Keep it simple—show one clear use case | Don't create overly complex examples |
| Use realistic, human-readable data | Don't use lorem ipsum or meaningless values |
| Demonstrate actual user interactions | Don't make it just a static render |
| Include minimal imports needed | Don't import unnecessary utilities |
| Export as a named function | Don't use default exports |
| Test the example by viewing in `/sandbox` | Don't skip manual verification |

## Workflow

1. **Build component** → `src/components/ui/my-component.tsx`
2. **Create example** → `src/components/ui/my-component.example.tsx`
3. **Verify in sandbox** → Import in `src/routes/sandbox.tsx` and test at `/sandbox`
4. **Iterate** → Make changes to component, see live updates in sandbox
5. **Commit** → Both component and example files go to the same commit

## Troubleshooting

**Example not showing in sandbox?**
- Check the import path uses `#src/` alias
- Verify function is exported as a named export
- Ensure you've added it to `sandbox.tsx`

**Component not updating when I make changes?**
- The dev server should hot-reload automatically
- If not, check for TypeScript errors with `pnpm typecheck`

**Styling looks off?**
- Examples inherit Tailwind styles from the main app
- Wrap content in appropriate spacing classes (`p-4`, margin, etc.)
- Check that the component uses the correct CSS module or Tailwind classes
