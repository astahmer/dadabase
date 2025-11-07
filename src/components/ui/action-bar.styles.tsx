import { cva } from "class-variance-authority";

export const actionBarVariants = {
	positioner: cva(
		"fixed inset-x-0 top-auto bottom-[calc(env(safe-area-inset-bottom)_+_20px)] flex justify-center pointer-events-none",
	),

	content: cva(
		"bg-card shadow-md flex items-center gap-3 rounded-lg py-2.5 px-3 pointer-events-auto transition-all",
		{
			variants: {
				state: {
					open: "animate-in fade-in slide-in-from-bottom duration-200",
					closed: "animate-out fade-out slide-out-to-bottom duration-150",
				},
			},
			defaultVariants: {
				state: "open",
			},
		},
	),
	contentOffset: cva("translate-x-[calc(-1_*_var(--scrollbar-width)_/_2)]"),

	separator: cva("w-px h-5 bg-border"),

	selectionTrigger: cva(
		"inline-flex items-center gap-2 self-stretch text-sm px-4 py-1 rounded border border-dashed border-border",
	),

	closeTrigger: cva(
		"inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm transition-colors hover:bg-muted",
	),
};
