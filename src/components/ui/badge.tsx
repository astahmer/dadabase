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
				default: "bg-primary/10 text-primary dark:text-primary",
				secondary: "bg-secondary/10 text-secondary dark:text-secondary",
				destructive: "bg-destructive/10 text-destructive dark:text-destructive",
				success:
					"bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
				error: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
				warning:
					"bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200",
				info: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200",
				muted: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
			},
			size: {
				"2xs": "px-1 py-0.25 text-2xs",
				xs: "px-1.5 py-0.5 text-xs",
				sm: "px-2 py-1 text-xs",
				md: "px-3 py-1.5 text-sm",
				lg: "px-4 py-2 text-base",
			},
			// Data type specific colors - colorful backgrounds
			dataType: {
				id: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200",
				timestamp:
					"bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200",
				numeric:
					"bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200",
				text: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200",
				boolean:
					"bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200",
				json: "bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-200",
				other: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200",
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

const Badge = ({
	className,
	variant: display,
	colorPalette: color,
	size,
	dataType,
	...props
}: BadgeProps) => (
	<span
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
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
