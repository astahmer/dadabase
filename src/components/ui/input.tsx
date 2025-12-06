import { type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "#src/lib/utils";
import type { ExposedInputProps } from "./component-props.ts";
import { inputVariants } from "./input.styles";

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

export { inputVariants } from "./input.styles";
