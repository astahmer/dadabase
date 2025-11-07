import * as React from "react";
import { Popover as ArkPopover } from "@ark-ui/react/popover";
import { cn } from "#src/lib/utils";
import { actionBarVariants } from "./action-bar.styles";
import type { ExposedComponentProps } from "./component-props";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarRootProps
	extends ArkPopover.RootBaseProps,
		ExposedComponentProps<"div"> {
	children: React.ReactNode;
}

export const ActionBarRoot = (props: ActionBarRootProps) => (
	<ArkPopover.Root lazyMount unmountOnExit {...props} />
);
ActionBarRoot.displayName = "ActionBarRoot";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarRootProviderProps
	extends ArkPopover.RootProviderBaseProps,
		ExposedComponentProps<"div"> {}

export const ActionBarRootProvider = (props: ActionBarRootProviderProps) => (
	<ArkPopover.RootProvider lazyMount unmountOnExit {...props} />
);
ActionBarRootProvider.displayName = "ActionBarRootProvider";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarPositionerProps
	extends React.HTMLAttributes<HTMLDivElement> {}

export const ActionBarPositioner = React.forwardRef<
	HTMLDivElement,
	ActionBarPositionerProps
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(actionBarVariants.positioner(), className)}
		{...props}
	/>
));
ActionBarPositioner.displayName = "ActionBarPositioner";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarContentProps
	extends ArkPopover.ContentBaseProps,
		React.HTMLAttributes<HTMLDivElement> {
	state?: "open" | "closed";
}

export const ActionBarContent = React.forwardRef<
	HTMLDivElement,
	ActionBarContentProps
>(({ className, state, ...props }, ref) => (
	<ArkPopover.Content
		ref={ref}
		className={cn(
			actionBarVariants.content({ state }),
			actionBarVariants.contentOffset(),
			className,
		)}
		{...props}
	/>
));
ActionBarContent.displayName = "ActionBarContent";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarSeparatorProps
	extends React.HTMLAttributes<HTMLDivElement> {}

export const ActionBarSeparator = React.forwardRef<
	HTMLDivElement,
	ActionBarSeparatorProps
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(actionBarVariants.separator(), className)}
		{...props}
	/>
));
ActionBarSeparator.displayName = "ActionBarSeparator";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarSelectionTriggerProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const ActionBarSelectionTrigger = React.forwardRef<
	HTMLButtonElement,
	ActionBarSelectionTriggerProps
>(({ className, ...props }, ref) => (
	<button
		ref={ref}
		className={cn(actionBarVariants.selectionTrigger(), className)}
		{...props}
	/>
));
ActionBarSelectionTrigger.displayName = "ActionBarSelectionTrigger";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarCloseTriggerProps
	extends ArkPopover.CloseTriggerProps,
		React.HTMLAttributes<HTMLButtonElement> {}

export const ActionBarCloseTrigger = React.forwardRef<
	HTMLButtonElement,
	ActionBarCloseTriggerProps
>(({ className, ...props }, ref) => (
	<ArkPopover.CloseTrigger
		ref={ref}
		className={cn(actionBarVariants.closeTrigger(), className)}
		{...props}
	/>
));
ActionBarCloseTrigger.displayName = "ActionBarCloseTrigger";

////////////////////////////////////////////////////////////////////////////////////

export const ActionBarContext = ArkPopover.Context;

export interface ActionBarOpenChangeDetails
	extends ArkPopover.OpenChangeDetails {}
