import type { VariantProps } from "class-variance-authority";

import { kbdRecipe } from "./kbd.styles";

type KbdVariants = VariantProps<typeof kbdRecipe>;

interface KbdProps extends KbdVariants {
  children: string;
  className?: string;
}

export const Kbd = ({ children, variant = "raised", size = "md", className }: KbdProps) => {
  return <kbd className={kbdRecipe({ variant, size, className })}>{children}</kbd>;
};

export { kbdRecipe };
