import { cva } from "class-variance-authority";

export const tableStyles = cva("w-full border-collapse", {
	variants: {
		variant: {
			line: "",
			outline: "border border-gray-200 rounded",
		},
	},
	defaultVariants: {
		variant: "line",
	},
});

export const tableHeaderStyles = cva("", {
	variants: {
		stickyHeader: {
			true: "sticky top-0 z-0 bg-white",
			false: "",
		},
		variant: {
			line: "border-b border-gray-200",
			outline: "border-b border-gray-200 bg-gray-50",
		},
	},
	defaultVariants: {
		stickyHeader: true,
		variant: "line",
	},
});

export const tableHeaderCellStyles = cva(
	"text-left font-medium text-gray-900 align-top",
	{
		variants: {
			size: {
				sm: "px-2 py-2 text-xs",
				md: "px-3 py-3 text-sm",
				lg: "px-4 py-3 text-base",
			},
			showColumnBorder: {
				true: "border-r border-gray-200 last:border-r-0",
				false: "",
			},
		},
		defaultVariants: {
			size: "md",
		},
	},
);

export const tableBodyStyles = cva("", {
	variants: {
		interactive: {
			true: "[&_tr:hover]:bg-gray-50",
			false: "",
		},
	},
});

export const tableRowStyles = cva("border-b border-gray-200", {
	variants: {
		striped: {
			true: "odd:bg-white even:bg-gray-50",
			false: "bg-white",
		},
		selected: {
			true: "bg-blue-50",
			false: "",
		},
		interactive: {
			true: "hover:bg-gray-50 cursor-pointer",
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

export const tableCellStyles = cva("text-left align-middle", {
	variants: {
		size: {
			sm: "px-2 py-2 text-xs",
			md: "px-3 py-3 text-sm",
			lg: "px-4 py-3 text-base",
		},
		showColumnBorder: {
			true: "border-r border-gray-200 last:border-r-0",
			false: "",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

export const tableSortButtonStyles = cva(
	"inline-flex items-center gap-2 transition-opacity hover:opacity-100 opacity-60",
);

export const tableEmptyStateStyles = cva(
	"flex flex-col gap-4 justify-center items-center text-center py-8",
);
