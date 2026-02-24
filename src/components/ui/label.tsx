import { cn } from "#src/lib/utils";
import * as React from "react";

import type { ExposedComponentProps } from "./component-props.ts";

const Label = ({
  className,
  htmlFor,
  children,
  ...props
}: ExposedComponentProps<"label"> &
  Pick<React.LabelHTMLAttributes<HTMLLabelElement>, "htmlFor">) => (
  <label
    htmlFor={htmlFor}
    className={cn(
      "text-foreground text-sm leading-4 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </label>
);
Label.displayName = "Label";

export { Label };
