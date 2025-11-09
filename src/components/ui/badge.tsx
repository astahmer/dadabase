import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { cn } from "#src/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded font-semibold whitespace-nowrap",
	{
		variants: {
			// Visual style: how the badge is displayed
			variant: {
				subtle: "bg-current/10 text-current",
				solid: "bg-current text-white dark:text-black",
				outline: "border border-current text-current bg-transparent",
			},
			// Color scheme
			colorPalette: {
				default: "text-primary",
				secondary: "text-secondary",
				destructive: "text-destructive",
				success: "text-green-700 dark:text-green-300",
				error: "text-red-700 dark:text-red-300",
				warning: "text-amber-700 dark:text-amber-300",
				info: "text-blue-700 dark:text-blue-300",
				muted: "text-gray-600 dark:text-gray-400",
			},
			size: {
				xs: "px-1.5 py-0.5 text-xs",
				sm: "px-2 py-1 text-xs",
				md: "px-3 py-1.5 text-sm",
				lg: "px-4 py-2 text-base",
			},
			// Data type specific colors
			dataType: {
				id: "text-purple-700 dark:text-purple-300",
				timestamp: "text-blue-700 dark:text-blue-300",
				numeric: "text-green-700 dark:text-green-300",
				text: "text-slate-700 dark:text-slate-300",
				boolean: "text-amber-700 dark:text-amber-300",
				json: "text-pink-700 dark:text-pink-300",
				other: "text-gray-700 dark:text-gray-300",
			},
		},
		defaultVariants: {
			variant: "subtle",
			colorPalette: "default",
			size: "sm",
		},
	},
);

export interface BadgeProps
	extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
		VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
	(
		{
			className,
			variant: display,
			colorPalette: color,
			size,
			dataType,
			...props
		},
		ref,
	) => (
		<span
			ref={ref}
			className={cn(
				badgeVariants({
					variant: display,
					colorPalette: dataType ? undefined : color,
					size,
					dataType,
				}),
				className,
			)}
			{...props}
		/>
	),
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
