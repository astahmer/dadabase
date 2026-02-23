
---
name: cva-styling-pattern
description: Using class-variance-authority (CVA) for type-safe, composable component styling. Only use if necessary (rarely needed in app; can make sense in ui kit components that have variants).
---

# CVA Styling Pattern

Define component variants with `cva()` for type-safe conditional styling without string concatenation.

## Quick Template

```typescript
// button.styles.ts
import { cva, type VariantProps } from "class-variance-authority";

export const buttonStyles = cva(
	// Base classes (always applied)
	"px-4 py-2 rounded font-medium transition-colors",
	{
		variants: {
			variant: {
				primary: "bg-blue-600 text-white hover:bg-blue-700",
				secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
				danger: "bg-red-600 text-white hover:bg-red-700",
			},
			size: {
				sm: "text-sm px-2 py-1",
				md: "text-base px-4 py-2",
				lg: "text-lg px-6 py-3",
			},
			disabled: {
				true: "opacity-50 cursor-not-allowed",
			},
		},
		defaultVariants: {
			variant: "primary",
			size: "md",
		},
		compoundVariants: [
			{
				variant: "danger",
				size: "lg",
				className: "uppercase",
			},
		],
	},
);

export type ButtonVariants = VariantProps<typeof buttonStyles>;
```

```typescript
// button.tsx
import { buttonStyles, type ButtonVariants } from "./button.styles.ts";
import { cn } from "#src/lib/utils.ts";

interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
	ButtonVariants {}

export function Button({
	variant,
	size,
	disabled,
	className,
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(
				buttonStyles({ variant, size, disabled }),
				className, // Allow className override
			)}
			disabled={disabled}
			{...props}
		/>
	);
}
```

**Rules:**
- Define styles in `.styles.ts` file
- Export `cva()` result and variant types
- First array is base classes
- `variants` object contains variant groups
- `defaultVariants` specify fallback values
- `compoundVariants` for conditional combinations
- Use `cn()` helper to merge classes
- Import variant types for component props

## Variant Groups

```typescript
const cardStyles = cva("rounded border", {
	variants: {
		// Variant group: mutually exclusive options
		variant: {
			elevated: "shadow-lg",
			outlined: "border-2 border-gray-300",
			flat: "bg-gray-100",
		},
		// Another variant group
		padding: {
			compact: "p-2",
			normal: "p-4",
			spacious: "p-8",
		},
		// Boolean variant
		highlighted: {
			true: "ring-2 ring-yellow-400",
			false: "",
		},
	},
	defaultVariants: {
		variant: "elevated",
		padding: "normal",
		highlighted: false,
	},
});
```

## Compound Variants

Apply multiple classes when specific variant combinations occur:

```typescript
const styles = cva("...", {
	variants: {
		variant: { primary: "...", secondary: "..." },
		size: { sm: "...", lg: "..." },
	},
	compoundVariants: [
		{
			variant: "primary",
			size: "lg",
			className: "uppercase bold", // Only when both conditions met
		},
		{
			variant: "secondary",
			size: "sm",
			className: "text-xs",
		},
	],
});
```

## Real Examples

- [Data table styles](../../../../src/components/data-table/data-table.styles.ts)
- [Form input styles](../../../../src/components/form/form-input.styles.ts)
- [UI components](../../../../src/components/ui/) - All use CVA

## Usage in Component

```typescript
import { cardStyles, type CardVariants } from "./card.styles.ts";

interface CardProps extends CardVariants {
	children: React.ReactNode;
	className?: string;
}

export function Card({
	variant = "elevated",
	padding = "normal",
	highlighted = false,
	className,
	children,
}: CardProps) {
	return (
		<div className={cn(
			cardStyles({ variant, padding, highlighted }),
			className,
		)}>
			{children}
		</div>
	);
}

// Usage
<Card variant="flat" padding="spacious" highlighted>
	Content
</Card>
```

## Getting Variant Type

```typescript
import { type VariantProps } from "class-variance-authority";

// Extract all possible variant combinations
export type CardVariants = VariantProps<typeof cardStyles>;

// Now you can use in component props
interface CardProps extends CardVariants {
	// ...type safe variants here
}
```

## Avoiding Common Pitfalls

❌ **Bad: String concatenation**
```typescript
const className = `px-4 ${isLarge ? "px-8" : ""} ${isDanger ? "bg-red" : "bg-blue"}`;
```

✅ **Good: CVA**
```typescript
const className = buttonStyles({ size: isLarge ? "lg" : "sm", variant: isDanger ? "danger" : "primary" });
```


