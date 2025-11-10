"use client";

import * as React from "react";

import { Menu as MenuPrimitive, menuAnatomy } from "@ark-ui/react/menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";

import { cn } from "#src/lib/utils";

const parts = menuAnatomy.extendWith("shortcut").build();

const Menu = MenuPrimitive.Root;

const MenuArrow = ({ className, ...props }: MenuPrimitive.ArrowProps) => (
	<MenuPrimitive.Arrow
		className={cn(
			"[--arrow-background:var(--popover)] [--arrow-size:calc(var(--spacing)*2)]",
			className,
		)}
		{...props}
	>
		<MenuPrimitive.ArrowTip className="border-t border-l" />
	</MenuPrimitive.Arrow>
);
MenuArrow.displayName = "MenuArrow";

const MenuCheckboxItem = ({
	className,
	children,
	...props
}: MenuPrimitive.CheckboxItemProps) => (
	<MenuPrimitive.CheckboxItem
		className={cn(
			"relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
			className,
		)}
		{...props}
	>
		<span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
			<MenuPrimitive.ItemIndicator>
				<CheckIcon className="size-4" />
			</MenuPrimitive.ItemIndicator>
		</span>
		<MenuPrimitive.ItemText>{children}</MenuPrimitive.ItemText>
	</MenuPrimitive.CheckboxItem>
);
MenuCheckboxItem.displayName = "MenuCheckboxItem";

const MenuContent = ({ className, ...props }: MenuPrimitive.ContentProps) => (
	<MenuPrimitive.Positioner>
		<MenuPrimitive.Content
			className={cn(
				"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 max-h-(--available-height) min-w-[8rem] max-w-(--available-width) origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
				className,
			)}
			{...props}
		/>
	</MenuPrimitive.Positioner>
);
MenuContent.displayName = "MenuContent";

const MenuContextTrigger = MenuPrimitive.ContextTrigger;

const MenuIndicator = MenuPrimitive.Indicator;

const MenuItem = ({
	className,
	inset,
	...props
}: MenuPrimitive.ItemProps & {
	inset?: boolean;
}) => (
	<MenuPrimitive.Item
		data-inset={inset}
		className={cn(
			"relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[inset]:pl-8 data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
			className,
		)}
		{...props}
	/>
);
MenuItem.displayName = "MenuItem";

const MenuItemGroup = MenuPrimitive.ItemGroup;

const MenuItemGroupLabel = ({
	className,
	inset,
	...props
}: MenuPrimitive.ItemGroupLabelProps & {
	inset?: boolean;
}) => (
	<MenuPrimitive.ItemGroupLabel
		data-inset={inset}
		className={cn(
			"px-2 py-1.5 font-medium text-sm data-[inset]:pl-8",
			className,
		)}
		{...props}
	/>
);
MenuItemGroupLabel.displayName = "MenuItemGroupLabel";

const MenuItemText = MenuPrimitive.ItemText;

const MenuRadioItem = ({
	className,
	children,
	...props
}: MenuPrimitive.RadioItemProps) => (
	<MenuPrimitive.RadioItem
		className={cn(
			"relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
			className,
		)}
		{...props}
	>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			<MenuPrimitive.ItemIndicator>
				<CircleIcon className="size-2 fill-current" />
			</MenuPrimitive.ItemIndicator>
		</span>
		<MenuPrimitive.ItemText>{children}</MenuPrimitive.ItemText>
	</MenuPrimitive.RadioItem>
);
MenuRadioItem.displayName = "MenuRadioItem";

MenuRadioItem.displayName = "MenuRadioItem";

const MenuRadioItemGroup = MenuPrimitive.RadioItemGroup;

const MenuSeparator = ({
	className,
	...props
}: MenuPrimitive.SeparatorProps) => (
	<MenuPrimitive.Separator
		className={cn("-mx-1 my-1 h-px bg-border", className)}
		{...props}
	/>
);
MenuSeparator.displayName = "MenuSeparator";

const MenuShortcut = ({
	className,
	...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
	return (
		<span
			{...parts.shortcut.attrs}
			className={cn(
				"ml-auto text-muted-foreground text-xs tracking-widest",
				className,
			)}
			{...props}
		/>
	);
};
MenuShortcut.displayName = "MenuShortcut";

const MenuTrigger = MenuPrimitive.Trigger;

const MenuTriggerItem = ({
	className,
	inset,
	children,
	...props
}: MenuPrimitive.TriggerItemProps & {
	inset?: boolean;
}) => (
	<MenuPrimitive.TriggerItem
		data-inset={inset}
		className={cn(
			"relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[inset]:pl-8 data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
			className,
		)}
		{...props}
	>
		{children}
		<ChevronRightIcon className="ml-auto size-4 text-muted-foreground/80" />
	</MenuPrimitive.TriggerItem>
);
MenuTriggerItem.displayName = "MenuTriggerItem";

export {
	Menu,
	MenuArrow,
	MenuCheckboxItem,
	MenuContent,
	MenuContextTrigger,
	MenuIndicator,
	MenuItem,
	MenuItemGroup,
	MenuItemGroupLabel,
	MenuItemText,
	MenuRadioItem,
	MenuRadioItemGroup,
	MenuSeparator,
	MenuShortcut,
	MenuTrigger,
	MenuTriggerItem,
};
