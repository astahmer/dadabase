import { cn } from "#src/lib/utils.ts";
import { Popover as PopoverPrimitive, type PopoverRootProps } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import * as React from "react";

const Popover = (props: PopoverRootProps) => <PopoverPrimitive.Root {...props} />;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  PopoverPrimitive.ContentProps & {
    sideOffset?: number;
  }
>(({ className, sideOffset = 4, ...props }, ref) => (
  <Portal>
    <PopoverPrimitive.Positioner>
      <PopoverPrimitive.Content
        ref={ref}
        className={cn(
          "border-border bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 rounded-md border p-4 shadow-md outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Positioner>
  </Portal>
));
PopoverContent.displayName = "PopoverContent";

const PopoverClose = PopoverPrimitive.CloseTrigger;

export { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger };
