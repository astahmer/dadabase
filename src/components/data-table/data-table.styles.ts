import { cva, type VariantProps } from "class-variance-authority";

export const tableStyles = cva("w-full border-collapse table-fixed", {
	variants: {
		variant: {
			line: "",
			outline: "border border-border rounded",
		},
	},
	defaultVariants: {
		variant: "line",
	},
});

export const tableHeaderStyles = cva("", {
	variants: {
		stickyHeader: {
			true: "sticky top-0 bg-card z-2",
			false: "",
		},
		variant: {
			line: "border-b border-border",
			outline: "border-b border-border bg-muted/50",
		},
	},
	defaultVariants: {
		stickyHeader: true,
		variant: "line",
	},
});

export const tableHeaderCellStyles = cva(
	"font-medium text-foreground align-top relative",
	{
		variants: {
			size: {
				excel: "px-0.5 text-2xs",
				minimal: "px-1 py-0.25 text-xs",
				compact: "px-1.5 py-0.5 text-xs",
				cozy: "px-2 py-1 text-xs",
				comfortable: "px-3 py-1.5 text-sm",
			},
			showColumnBorder: {
				true: "border-r border-border last:border-r-0",
				false: "",
			},
			textAlign: {
				left: "text-left",
				right: "text-right",
				center: "text-center",
			},
		},
		defaultVariants: {
			size: "cozy",
			textAlign: "left",
		},
	},
);
export type DataTableSize = NonNullable<
	VariantProps<typeof tableCellStyles>["size"]
>;

export const tableBodyStyles = cva("", {
	variants: {
		interactive: {
			true: "[&_tr:hover]:bg-muted/50",
			false: "",
		},
	},
});

export const tableRowStyles = cva("border-b border-border", {
	variants: {
		striped: {
			true: "odd:bg-background even:bg-card/50",
			false: "bg-background",
		},
		selected: {
			true: "bg-primary/10",
			false: "",
		},
		interactive: {
			true: "hover:bg-muted/50 cursor-pointer",
			false: "",
		},
		variant: {
			line: "",
			outline: "last:border-b-0",
		},
	},
	defaultVariants: {
		striped: false,
	},
});

export const tableCellStyles = cva(
	"align-middle text-foreground truncate relative",
	{
		variants: {
			size: {
				excel: "px-0.5 text-2xs",
				minimal: "px-1 py-0.25 text-2xs",
				compact: "px-1.5 py-0.5 text-xs",
				cozy: "px-2 py-1 text-xs",
				comfortable: "px-3 py-1.5 text-sm",
			},
			showColumnBorder: {
				true: "border-r border-border last:border-r-0",
				false: "",
			},
			textAlign: {
				left: "text-left",
				right: "text-right",
				center: "text-center",
			},
		},
		defaultVariants: {
			size: "cozy",
			textAlign: "left",
		},
	},
);

export const tableSortButtonStyles = cva(
	"inline-flex items-center gap-2 transition-opacity hover:opacity-100 opacity-60",
);

export const tableEmptyStateStyles = cva(
	"flex flex-col gap-4 justify-center items-center text-center py-8",
);
