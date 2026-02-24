import type { ComponentProps } from "react";

import { cn } from "#src/lib/utils";
import { type VariantProps } from "class-variance-authority";

import type { ExposedComponentProps } from "./component-props.ts";

import { buttonVariants } from "./button.styles";

interface ButtonProps
  extends
    ExposedComponentProps<"button">,
    Pick<ComponentProps<"button">, "type" | "disabled">,
    VariantProps<typeof buttonVariants> {}

const Button = ({ className, variant, size, withIcon, ...props }: ButtonProps) => {
  return (
    <button {...props} className={cn(buttonVariants({ variant, size, withIcon, className }))} />
  );
};
Button.displayName = "Button";

export { Button, buttonVariants };
