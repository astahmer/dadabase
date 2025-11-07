import { cva } from "class-variance-authority";

export const inputVariants = cva(
	"flex w-full min-w-0 rounded-md border border-input bg-transparent shadow-xs outline-none transition-[color,box-shadow] file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground/70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
	{
		variants: {
			size: {
				sm: "h-8 px-2 py-0 text-xs",
				md: "h-9 px-3 py-1 text-sm",
				lg: "h-10 px-4 py-2 text-base",
			},
			variant: {
				default:
					"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
				ghost:
					"border-transparent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
			},
		},
		defaultVariants: {
			size: "md",
			variant: "default",
		},
	},
);
