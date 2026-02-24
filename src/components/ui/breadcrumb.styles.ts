import { cva } from "class-variance-authority";

export const breadcrumbVariants = {
  root: cva(""),

  list: cva("flex items-center flex-wrap text-muted-foreground list-none", {
    variants: {
      variant: {
        plain: "",
        underline: "",
      },
      size: {
        sm: "gap-1 text-xs",
        md: "gap-1.5 text-sm",
        lg: "gap-2 text-base",
      },
    },
    defaultVariants: {
      variant: "plain",
      size: "md",
    },
  }),

  item: cva("inline-flex items-center"),

  link: cva(
    "inline-flex items-center gap-2 outline-0 no-underline rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    {
      variants: {
        variant: {
          plain: "text-muted-foreground hover:text-foreground",
          underline:
            "text-foreground underline decoration-muted underline-offset-2 hover:decoration-foreground",
        },
      },
      defaultVariants: {
        variant: "plain",
      },
    },
  ),

  currentLink: cva(
    "inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    {
      variants: {
        variant: {
          plain: "text-foreground",
          underline: "text-foreground",
        },
      },
      defaultVariants: {
        variant: "plain",
      },
    },
  ),

  separator: cva(
    "inline-flex items-center text-muted-foreground/80 [&_svg]:size-4 [&_svg]:shrink-0",
  ),

  ellipsis: cva("inline-flex items-center justify-center [&_svg]:size-4 [&_svg]:shrink-0"),
};
