import {
	type CollectionItem,
	Listbox as ListboxPrimitive,
	type ListboxRootBaseProps,
} from "@ark-ui/react/listbox";
import { Popover as PopoverPrimitive } from "@ark-ui/react/popover";
import { type VariantProps } from "class-variance-authority";
import { CheckIcon } from "lucide-react";
import { type JSX } from "react";
import { cn } from "#src/lib/utils";
import type { ExposedComponentProps } from "./component-props.ts";
import { listboxMenuVariants } from "./listbox-menu.styles";

type ListboxMenuProps = PopoverPrimitive.RootProps &
	ExposedComponentProps<"div"> & {
		children?: React.ReactNode;
	};

const ListboxMenuRoot = (props: ListboxMenuProps) => (
	<PopoverPrimitive.Root lazyMount {...props} />
);
ListboxMenuRoot.displayName = "ListboxMenuRoot";

const ListboxMenuTrigger = ({
	className,
	size,
	variant,
	...props
}: PopoverPrimitive.TriggerProps &
	VariantProps<typeof listboxMenuVariants> & {
		className?: string;
	}) => (
	<PopoverPrimitive.Trigger
		className={cn(listboxMenuVariants({ variant, size }), className)}
		{...props}
	/>
);
ListboxMenuTrigger.displayName = "ListboxMenuTrigger";

const ListboxMenuContent = ({
	className,
	...props
}: PopoverPrimitive.ContentProps) => {
	return (
		<PopoverPrimitive.Positioner>
			<PopoverPrimitive.Content
				className={cn(
					"bg-card border border-border rounded-md shadow-lg z-50",
					className,
				)}
				{...props}
			/>
		</PopoverPrimitive.Positioner>
	);
};
ListboxMenuContent.displayName = "ListboxMenuContent";

type ListboxRootMenuRootComponent = <T extends CollectionItem>(
	props: ListboxRootBaseProps<T> &
		ExposedComponentProps<"div"> & {
			children?: React.ReactNode;
		},
) => JSX.Element;

const ListboxRoot = ((props) => (
	<ListboxPrimitive.Root {...props} />
)) as ListboxRootMenuRootComponent;
(ListboxRoot as any).displayName = "ListboxRoot";

const ListboxMenuList = ({
	className,
	...props
}: ListboxPrimitive.ContentProps) => (
	<ListboxPrimitive.Content
		className={cn("max-h-64 overflow-y-auto", className)}
		{...props}
	/>
);
ListboxMenuList.displayName = "ListboxMenuList";

const ListboxMenuItem = ({
	className,
	showIndicator = true,
	children,
	...props
}: ListboxPrimitive.ItemProps & {
	showIndicator?: boolean;
}) => (
	<ListboxPrimitive.Item
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
);
ListboxMenuItem.displayName = "ListboxMenuItem";

const ListboxMenuItemGroup = ({
	className,
	...props
}: ListboxPrimitive.ItemGroupProps) => (
	<ListboxPrimitive.ItemGroup
		className={cn("overflow-hidden", className)}
		{...props}
	/>
);
ListboxMenuItemGroup.displayName = "ListboxMenuItemGroup";

const ListboxMenuItemText = ListboxPrimitive.ItemText;

const ListboxMenuItemGroupLabel = ({
	className,
	...props
}: ListboxPrimitive.ItemGroupLabelProps) => (
	<ListboxPrimitive.ItemGroupLabel
		className={cn(
			"px-2 py-1.5 font-medium text-muted-foreground text-xs",
			className,
		)}
		{...props}
	/>
);
ListboxMenuItemGroupLabel.displayName = "ListboxMenuItemGroupLabel";

const ListboxMenuFilterInput = ({
	className,
	...props
}: React.InputHTMLAttributes<HTMLInputElement>) => (
	<ListboxPrimitive.Input
		className={cn(
			"flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full",
			className,
		)}
		{...props}
	/>
);
ListboxMenuFilterInput.displayName = "ListboxMenuFilterInput";

const ListboxMenuFilterContainer = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("p-2 border-b border-border", className)} {...props} />
);
ListboxMenuFilterContainer.displayName = "ListboxMenuFilterContainer";

const ListboxMenuEmpty = ({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"px-2 py-2 text-xs text-muted-foreground text-center",
			className,
		)}
		{...props}
	>
		{children}
	</div>
);
ListboxMenuEmpty.displayName = "ListboxMenuEmpty";

export {
	ListboxMenuContent,
	ListboxMenuEmpty,
	ListboxMenuFilterContainer,
	ListboxMenuFilterInput,
	ListboxMenuItem,
	ListboxMenuItemGroup,
	ListboxMenuItemGroupLabel,
	ListboxMenuItemText,
	ListboxMenuList,
	ListboxMenuRoot,
	ListboxMenuTrigger,
	ListboxRoot,
};

export {
	type CollectionItem,
	createListCollection,
	type ListCollection,
	useListCollection,
} from "@ark-ui/react";
export {
	Popover,
	type PopoverOpenChangeDetails,
} from "@ark-ui/react/popover";
export { listboxMenuVariants } from "./listbox-menu.styles";
