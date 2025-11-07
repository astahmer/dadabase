import { cva } from "class-variance-authority";

export const toastVariants = cva(
	"group z-[--z-index] flex h-[--height] w-full scale-[--scale] items-center justify-between space-x-4 rounded-md border bg-background p-3 pr-8 opacity-[--opacity] shadow-lg transition-all will-change-[translate,opacity,scale] [translate:var(--x)_var(--y)_0] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
	{
		variants: {
			variant: {
				default: "border bg-background text-foreground",
				destructive:
					"destructive group border-destructive bg-destructive text-destructive-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);
