import * as React from "react";

import { cn } from "#src/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
	({ className, htmlFor, children, ...props }, ref) => (
		<label
			ref={ref}
			htmlFor={htmlFor}
			className={cn(
				"select-none font-medium text-foreground text-sm leading-4 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				className,
			)}
			{...props}
		>
			{children}
		</label>
	),
);
Label.displayName = "Label";

export { Label };
