import { cva } from "class-variance-authority";

export const listboxMenuVariants = cva("", {
  variants: {
    variant: {
      default:
        "relative inline-flex rounded-md border border-input outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-aria-invalid:border-destructive has-disabled:opacity-50 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
      unstyled: "",
    },
    size: {
      unstyled: "",
      xs: "min-h-[24px] px-2 py-1 text-2xs",
      sm: "min-h-[32px] px-2 py-1 text-xs",
      md: "min-h-[38px] px-3 py-2 text-sm",
      lg: "min-h-[44px] px-4 py-2 text-base",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});
