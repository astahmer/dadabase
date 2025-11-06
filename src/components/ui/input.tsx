import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "#src/lib/utils";
import type { ExposedInputProps } from "./component-props.ts";
import type { ComponentProps } from "react";

const inputVariants = cva(
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

interface InputProps
	extends Omit<ExposedInputProps, "type">,
		VariantProps<typeof inputVariants> {
	type?: ComponentProps<"input">["type"];
}

export const Input = ({
	className,
	type,
	size,
	variant,
	...props
}: InputProps) => {
	return (
		<input
			type={type}
			className={cn(
				inputVariants({ size, variant }),
				type === "search" &&
					"[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
				type === "file" &&
					"p-0 pr-3 text-muted-foreground/70 italic file:me-3 file:h-full file:border-0 file:border-input file:border-r file:border-solid file:bg-transparent file:px-3 file:font-medium file:text-foreground file:text-sm file:not-italic",
				className,
			)}
			{...props}
		/>
	);
};
Input.displayName = "Input";

export { inputVariants };
