import { cn } from "#src/lib/utils";
import { Popover as ArkPopover } from "@ark-ui/react/popover";

import type { ExposedComponentProps } from "./component-props";

import { actionBarVariants } from "./action-bar.styles";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarRootProps extends ArkPopover.RootBaseProps, ExposedComponentProps<"div"> {
  children: React.ReactNode;
}

export const ActionBarRoot = (props: ActionBarRootProps) => (
  <ArkPopover.Root lazyMount unmountOnExit {...props} />
);
ActionBarRoot.displayName = "ActionBarRoot";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarRootProviderProps
  extends ArkPopover.RootProviderBaseProps, ExposedComponentProps<"div"> {}

export const ActionBarRootProvider = (props: ActionBarRootProviderProps) => (
  <ArkPopover.RootProvider lazyMount unmountOnExit {...props} />
);
ActionBarRootProvider.displayName = "ActionBarRootProvider";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarPositionerProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ActionBarPositioner = ({ className, ...props }: ActionBarPositionerProps) => (
  <div className={cn(actionBarVariants.positioner(), className)} {...props} />
);
ActionBarPositioner.displayName = "ActionBarPositioner";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarContentProps
  extends ArkPopover.ContentBaseProps, React.HTMLAttributes<HTMLDivElement> {
  state?: "open" | "closed";
  variant?: "default";
}

export const ActionBarContent = ({
  className,
  state,
  variant = "default",
  ...props
}: ActionBarContentProps) => (
  <ArkPopover.Content
    className={cn(
      actionBarVariants.content({ state, variant }),
      actionBarVariants.contentOffset(),
      className,
    )}
    {...props}
  />
);
ActionBarContent.displayName = "ActionBarContent";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ActionBarSeparator = ({ className, ...props }: ActionBarSeparatorProps) => (
  <div className={cn(actionBarVariants.separator(), className)} {...props} />
);
ActionBarSeparator.displayName = "ActionBarSeparator";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarSelectionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const ActionBarSelectionTrigger = ({
  className,
  ...props
}: ActionBarSelectionTriggerProps) => (
  <ArkPopover.Trigger asChild>
    <button className={cn(actionBarVariants.selectionTrigger(), className)} {...props} />
  </ArkPopover.Trigger>
);
ActionBarSelectionTrigger.displayName = "ActionBarSelectionTrigger";

////////////////////////////////////////////////////////////////////////////////////

export interface ActionBarCloseTriggerProps
  extends ArkPopover.CloseTriggerProps, React.HTMLAttributes<HTMLButtonElement> {}

export const ActionBarCloseTrigger = ({ className, ...props }: ActionBarCloseTriggerProps) => (
  <ArkPopover.CloseTrigger className={cn(actionBarVariants.closeTrigger(), className)} {...props} />
);
ActionBarCloseTrigger.displayName = "ActionBarCloseTrigger";

////////////////////////////////////////////////////////////////////////////////////

export const ActionBarContext = ArkPopover.Context;

export interface ActionBarOpenChangeDetails extends ArkPopover.OpenChangeDetails {}
