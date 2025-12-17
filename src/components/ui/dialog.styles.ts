import { cva } from "class-variance-authority";

export const dialogContentVariants = cva(
	"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 -translate-x-1/2 -translate-y-1/2 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-150 grid max-h-[calc(100%-2rem)] w-full max-w-[calc(100%-2rem)] gap-4 overflow-hidden rounded-xl border bg-background p-6 shadow-lg data-[state=closed]:animate-out data-[state=open]:animate-in isolate",
	{
		variants: {
			size: {
				sm: "sm:max-w-sm",
				md: "sm:max-w-md",
				lg: "sm:max-w-lg",
				xl: "sm:max-w-xl",
				"2xl": "sm:max-w-2xl",
				"3xl": "sm:max-w-3xl",
				"4xl": "sm:max-w-4xl",
				"5xl": "sm:max-w-5xl",
				"6xl": "sm:max-w-6xl",
				"7xl": "sm:max-w-7xl",
				full: "sm:max-w-full",
			},
		},
		defaultVariants: {
			size: "2xl",
		},
	},
);

export const dialogBackdropVariants = cva(
	"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-140 bg-black/80 data-[state=closed]:animate-out data-[state=open]:animate-in",
);
