import { type VariantProps } from "class-variance-authority";

import { cn } from "#src/lib/utils";
import { buttonVariants } from "./button.styles";
import type { ExposedComponentProps } from "./component-props.ts";
import type { ComponentProps } from "react";

interface ButtonProps
	extends ExposedComponentProps<"button">,
		Pick<ComponentProps<"button">, "type" | "disabled">,
		VariantProps<typeof buttonVariants> {}

const Button = ({
	className,
	variant,
	size,
	withIcon,
	...props
}: ButtonProps) => {
	return (
		<button
			{...props}
			className={cn(buttonVariants({ variant, size, withIcon, className }))}
		/>
	);
};
Button.displayName = "Button";

export { Button, buttonVariants };
