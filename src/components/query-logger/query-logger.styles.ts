import { cva } from "class-variance-authority";

export const queryLoggerPanelStyles = cva(
	"border-t bg-background transition-all duration-300",
	{
		variants: {
			isOpen: {
				true: "h-64",
				false: "h-12",
			},
		},
		defaultVariants: {
			isOpen: false,
		},
	},
);

export const queryLogEntryStatusStyles = cva(
	"h-4 w-4 rounded-full flex-shrink-0",
	{
		variants: {
			status: {
				pending: "bg-yellow-500 animate-pulse",
				success: "bg-green-500",
				error: "bg-red-500",
			},
		},
		defaultVariants: {
			status: "pending",
		},
	},
);

export const queryLogEntryTypeStyles = cva(
	"px-2 py-1 rounded text-xs font-medium",
	{
		variants: {
			type: {
				table: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
				schema:
					"bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200",
				enum: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
				constraint:
					"bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200",
				total: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200",
				columns:
					"bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200",
			},
		},
		defaultVariants: {
			type: "table",
		},
	},
);
