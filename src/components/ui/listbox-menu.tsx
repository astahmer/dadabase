import * as React from "react";

import {
	Listbox as ListboxPrimitive,
	type CollectionItem,
	type ListboxRootBaseProps,
} from "@ark-ui/react/listbox";
import { Popover as PopoverPrimitive } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { CheckIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#src/lib/utils";
import type { ExposedComponentProps } from "./component-props.ts";
import type { JSX } from "react";

const listboxMenuVariants = cva(
	"relative inline-flex rounded-md border border-input outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-aria-invalid:border-destructive has-disabled:opacity-50 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
	{
		variants: {
			size: {
				sm: "min-h-[32px] px-2 py-1 text-xs",
				md: "min-h-[38px] px-3 py-2 text-sm",
				lg: "min-h-[44px] px-4 py-2 text-base",
			},
		},
		defaultVariants: {
			size: "md",
		},
	},
);

type ListboxMenuProps = PopoverPrimitive.RootProps &
	ExposedComponentProps<"div"> & {
		children?: React.ReactNode;
	};

const ListboxMenuRoot = React.forwardRef<HTMLDivElement, ListboxMenuProps>(
	(props) => <PopoverPrimitive.Root {...props} />,
);
ListboxMenuRoot.displayName = "ListboxMenuRoot";

const ListboxMenuTrigger = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Trigger>,
	PopoverPrimitive.TriggerProps &
		VariantProps<typeof listboxMenuVariants> & {
			className?: string;
		}
>(({ className, size, ...props }, ref) => (
	<PopoverPrimitive.Trigger
		ref={ref}
		className={cn(listboxMenuVariants({ size }), className)}
		{...props}
	/>
));
ListboxMenuTrigger.displayName = "ListboxMenuTrigger";

const ListboxMenuContent = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Content>,
	PopoverPrimitive.ContentProps
>(({ className, ...props }, ref) => (
	<Portal>
		<PopoverPrimitive.Positioner>
			<PopoverPrimitive.Content
				ref={ref}
				className={cn(
					"bg-card border border-border rounded-md shadow-lg z-50",
					className,
				)}
				{...props}
			/>
		</PopoverPrimitive.Positioner>
	</Portal>
));
ListboxMenuContent.displayName = "ListboxMenuContent";

type ListboxRootMenuRootComponent = <T extends CollectionItem>(
	props: ListboxRootBaseProps<T> &
		ExposedComponentProps<"div"> & {
			children?: React.ReactNode;
		},
) => JSX.Element;

const ListboxRoot = React.forwardRef<HTMLDivElement, any>((props: any) => (
	<ListboxPrimitive.Root {...props} />
)) as ListboxRootMenuRootComponent;
(ListboxRoot as any).displayName = "ListboxRoot";

const ListboxMenuList = React.forwardRef<
	React.ElementRef<typeof ListboxPrimitive.Content>,
	ListboxPrimitive.ContentProps
>(({ className, ...props }, ref) => (
	<ListboxPrimitive.Content
		ref={ref}
		className={cn("max-h-64 overflow-y-auto", className)}
		{...props}
	/>
));
ListboxMenuList.displayName = "ListboxMenuList";

const ListboxMenuItem = React.forwardRef<
	React.ElementRef<typeof ListboxPrimitive.Item>,
	ListboxPrimitive.ItemProps & {
		showIndicator?: boolean;
	}
>(({ className, showIndicator = true, children, ...props }, ref) => (
	<ListboxPrimitive.Item
		ref={ref}
		className={cn(
			"flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted data-highlighted:bg-accent transition-colors relative",
			className,
		)}
		{...props}
	>
		<ListboxPrimitive.ItemText className="flex-1">
			{children}
		</ListboxPrimitive.ItemText>
		{showIndicator && (
			<ListboxPrimitive.ItemIndicator>
				<CheckIcon className="h-4 w-4" />
			</ListboxPrimitive.ItemIndicator>
		)}
	</ListboxPrimitive.Item>
));
ListboxMenuItem.displayName = "ListboxMenuItem";

const ListboxMenuItemGroup = React.forwardRef<
	React.ElementRef<typeof ListboxPrimitive.ItemGroup>,
	ListboxPrimitive.ItemGroupProps
>(({ className, ...props }, ref) => (
	<ListboxPrimitive.ItemGroup
		ref={ref}
		className={cn("overflow-hidden", className)}
		{...props}
	/>
));
ListboxMenuItemGroup.displayName = "ListboxMenuItemGroup";

const ListboxMenuItemText = ListboxPrimitive.ItemText;

const ListboxMenuItemGroupLabel = React.forwardRef<
	React.ElementRef<typeof ListboxPrimitive.ItemGroupLabel>,
	ListboxPrimitive.ItemGroupLabelProps
>(({ className, ...props }, ref) => (
	<ListboxPrimitive.ItemGroupLabel
		ref={ref}
		className={cn(
			"px-2 py-1.5 font-medium text-muted-foreground text-xs",
			className,
		)}
		{...props}
	/>
));
ListboxMenuItemGroupLabel.displayName = "ListboxMenuItemGroupLabel";

const ListboxMenuFilterInput = React.forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
	<ListboxPrimitive.Input
		ref={ref}
		className={cn(
			"flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full",
			className,
		)}
		{...props}
	/>
));
ListboxMenuFilterInput.displayName = "ListboxMenuFilterInput";

const ListboxMenuFilterContainer = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("p-2 border-b border-border", className)}
		{...props}
	/>
));
ListboxMenuFilterContainer.displayName = "ListboxMenuFilterContainer";

const ListboxMenuEmpty = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"px-2 py-2 text-xs text-muted-foreground text-center",
			className,
		)}
		{...props}
	>
		{children}
	</div>
));
ListboxMenuEmpty.displayName = "ListboxMenuEmpty";

export {
	ListboxMenuRoot,
	ListboxMenuTrigger,
	ListboxMenuContent,
	ListboxRoot,
	ListboxMenuList,
	ListboxMenuItem,
	ListboxMenuItemGroup,
	ListboxMenuItemGroupLabel,
	ListboxMenuItemText,
	ListboxMenuFilterInput,
	ListboxMenuFilterContainer,
	ListboxMenuEmpty,
	listboxMenuVariants,
};

export {
	createListCollection,
	useListCollection,
	type CollectionItem,
	type ListCollection,
} from "@ark-ui/react";

export {
	Popover,
	type PopoverOpenChangeDetails,
} from "@ark-ui/react/popover";
