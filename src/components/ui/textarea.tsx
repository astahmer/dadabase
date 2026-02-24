import { cn } from "#src/lib/utils";

import type { ExposedTextareaProps } from "./component-props.ts";

const Textarea = ({ className, ...props }: ExposedTextareaProps) => {
  return (
    <textarea
      className={cn(
        "border-input placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex min-h-19.5 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
};
Textarea.displayName = "Textarea";

export { Textarea };
