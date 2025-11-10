import { Fragment } from "react";
import { Tooltip as TooltipPrimitive } from "@ark-ui/react/tooltip";

import { cn } from "#src/lib/utils";
import type { ExposedComponentProps } from "./component-props.ts";
import { Portal } from "@ark-ui/react";

export interface TooltipProps
	extends TooltipPrimitive.RootBaseProps,
		ExposedComponentProps<"div"> {
	showArrow?: boolean;
	content: React.ReactNode;
	contentProps?: React.ComponentProps<typeof TooltipPrimitive.Content>;
	disabled?: boolean;
	portalled?: boolean;
}

export const Tooltip = (props: TooltipProps) => {
	const { showArrow, children, disabled, content, contentProps, ...rest } =
		props;

	if (disabled || !content) return children;

	const Portallish = props.portalled ? Portal : Fragment;

	return (
		<TooltipPrimitive.Root openDelay={0} closeDelay={0} lazyMount {...rest}>
			<TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
			<Portallish>
				<TooltipPrimitive.Positioner>
					<TooltipPrimitive.Content
						className={cn(
							"fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50  animate-in rounded-md border bg-popover px-3 py-1.5 text-popover-foreground text-sm data-[state=closed]:animate-out",
							contentProps?.className,
						)}
						{...contentProps}
					>
						{showArrow && (
							<TooltipPrimitive.Arrow
								className={cn(
									"[--arrow-background:var(--popover)] [--arrow-size:calc(var(--spacing)*2)]",
								)}
							>
								<TooltipPrimitive.ArrowTip className="border-t border-l" />
							</TooltipPrimitive.Arrow>
						)}
						{content}
					</TooltipPrimitive.Content>
				</TooltipPrimitive.Positioner>
			</Portallish>
		</TooltipPrimitive.Root>
	);
};

Tooltip.displayName = "Tooltip";

// Export primitive subcomponents for advanced use cases
export const TooltipContext = TooltipPrimitive.Context;
export const TooltipRootProvider = TooltipPrimitive.RootProvider;

export {
	useTooltip,
	useTooltipContext,
	type TooltipOpenChangeDetails,
} from "@ark-ui/react/tooltip";
