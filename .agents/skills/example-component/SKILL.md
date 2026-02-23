---
name: example-component
description: Creating focused example components that demonstrate UI components in action. Use this for showcasing component functionality without unnecessary boilerplate—similar to Storybook stories but straight to the point.
---

# Example Components Skill

## Quick Template

```tsx
import { YourComponent } from "#src/components/ui/your-component.tsx";
import { useState } from "react";

export function YourComponentExample() {
	const [state, setState] = useState("");

	return (
		<div className="p-4">
			<YourComponent value={state} onChange={setState} />
		</div>
	);
}
```

**Rules:**
- File: `your-component.example.tsx` → Function: `YourComponentExample`
- Use `#src/` import alias
- Keep state minimal (only what's needed)
- Use realistic, human-readable data
- Export as named function

## Add to Sandbox

1. Open [src/routes/sandbox.tsx](../../src/routes/sandbox.tsx)
2. Import: `import { YourComponentExample } from "#src/components/ui/your-component.example.tsx";`
3. Render in JSX
4. View result at `/sandbox`

## Example

See [listbox-menu.example.tsx](../../src/components/ui/listbox-menu.example.tsx) for a complete real-world example.
