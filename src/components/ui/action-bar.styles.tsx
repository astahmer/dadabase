import { cva } from "class-variance-authority";

export const actionBarVariants = {
  positioner: cva(
    "absolute inset-x-0 top-auto bottom-4 flex justify-center pointer-events-none z-40",
  ),

  content: cva(
    "shadow-md flex items-center gap-3 rounded-lg py-2.5 px-3 pointer-events-auto transition-all",
    {
      variants: {
        variant: {
          default: "bg-card text-card-foreground",
        },
        state: {
          open: "animate-in fade-in slide-in-from-bottom duration-200",
          closed: "animate-out fade-out slide-out-to-bottom duration-150",
        },
      },
      defaultVariants: {
        variant: "default",
        state: "open",
      },
    },
  ),
  contentOffset: cva("translate-x-[calc(-1*var(--scrollbar-width)/2)]"),

  separator: cva("w-px h-5 bg-border"),

  selectionTrigger: cva(
    "inline-flex items-center gap-2 self-stretch text-sm px-4 py-1 rounded border border-dashed border-border",
  ),

  closeTrigger: cva(
    "inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm transition-colors hover:bg-muted",
  ),
};
