import { cva } from "class-variance-authority";

export const selectVariants = cva(
  "relative flex rounded-md border border-input outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
  {
    variants: {
      size: {
        sm: "min-h-[32px] text-xs",
        md: "min-h-[38px] text-sm",
        lg: "min-h-[44px] text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);
