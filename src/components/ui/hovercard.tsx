import {
	HoverCard as HoverCardPrimitive,
	type HoverCardRootProps,
} from "@ark-ui/react/hover-card";
import { Portal } from "@ark-ui/react/portal";
import * as React from "react";

import { cn } from "#src/lib/utils.ts";

const HoverCard = (props: HoverCardRootProps) => (
	<HoverCardPrimitive.Root lazyMount openDelay={0} {...props} />
);

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
	HTMLDivElement,
	HoverCardPrimitive.ContentProps & {
		sideOffset?: number;
	}
>(({ className, sideOffset = 4, ...props }, ref) => (
	<Portal>
		<HoverCardPrimitive.Positioner>
			<HoverCardPrimitive.Content
				ref={ref}
				className={cn(
					"z-50 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
					className,
				)}
				{...props}
			/>
		</HoverCardPrimitive.Positioner>
	</Portal>
));
HoverCardContent.displayName = "HoverCardContent";

export { HoverCard, HoverCardContent, HoverCardTrigger };
