import { Portal } from "@ark-ui/react/portal";
import { Select as SelectPrimitive, selectAnatomy } from "@ark-ui/react/select";
import { type VariantProps } from "class-variance-authority";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "#src/lib/utils.ts";
import type { ExposedComponentProps } from "./component-props.ts";
import { selectVariants } from "./select.styles";

const parts = selectAnatomy.extendWith("separator").build();

const SelectComponent = <T extends SelectPrimitive.CollectionItem>(
	props: SelectPrimitive.RootBaseProps<T> & ExposedComponentProps<"div">,
) => <SelectPrimitive.Root {...props} />;
SelectComponent.displayName = "Select";
const Select = SelectComponent as <T extends SelectPrimitive.CollectionItem>(
	props: SelectPrimitive.RootBaseProps<T> &
		React.RefAttributes<React.ElementRef<typeof SelectPrimitive.Root>> &
		ExposedComponentProps<"div">,
) => React.JSX.Element;

const SelectClearTrigger = ({
	className,
	...props
}: SelectPrimitive.ClearTriggerProps) => (
	<SelectPrimitive.ClearTrigger
		className={cn(
			"absolute end-0 top-0 flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
			className,
		)}
		{...props}
	/>
);
SelectClearTrigger.displayName = "SelectClearTrigger";

const SelectContent = ({
	className,
	portalled = true,
	...props
}: SelectPrimitive.ContentProps & {
	portalled?: boolean;
}) => {
	return (
		<Portal disabled={!portalled}>
			<SelectPrimitive.Positioner>
				<SelectPrimitive.Content
					className={cn(
						"relative w-full min-w-32 overflow-hidden rounded-md border border-input bg-popover p-1 text-popover-foreground shadow-lg z-1",
						"data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=open]:animate-in",
						"data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=left]:-translate-x-1 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 data-[placement=top]:-translate-y-1 data-[placement=right]:translate-x-1 data-[placement=bottom]:translate-y-1",
						className,
					)}
					{...props}
				/>
			</SelectPrimitive.Positioner>
		</Portal>
	);
};
SelectContent.displayName = "SelectContent";

const SelectContext = SelectPrimitive.Context;

const SelectControl = ({
	className,
	size,
	...props
}: SelectPrimitive.ControlBaseProps &
	VariantProps<typeof selectVariants> &
	ExposedComponentProps<"div">) => (
	<SelectPrimitive.Control
		className={cn(selectVariants({ size }), className)}
		{...props}
	/>
);
SelectControl.displayName = "SelectControl";

const SelectIndicator = (props: SelectPrimitive.IndicatorBaseProps) => (
	<SelectPrimitive.Indicator {...props}>
		<ChevronDownIcon className="size-4 shrink-0 in-aria-invalid:text-destructive/80 text-muted-foreground/80" />
	</SelectPrimitive.Indicator>
);
SelectIndicator.displayName = "SelectIndicator";

const SelectItem = ({
	className,
	children,
	...props
}: SelectPrimitive.ItemBaseProps & ExposedComponentProps<"div">) => (
	<SelectPrimitive.Item
		className={cn(
			"relative flex w-full cursor-default select-none items-center rounded py-1.5 ps-8 pe-2 text-sm outline-hidden data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50",
			className,
		)}
		{...props}
	>
		<span className="absolute start-2 flex size-3.5 items-center justify-center">
			<SelectPrimitive.ItemIndicator>
				<CheckIcon size={16} />
			</SelectPrimitive.ItemIndicator>
		</span>
		<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
	</SelectPrimitive.Item>
);
SelectItem.displayName = "SelectItem";

const SelectItemContext = SelectPrimitive.ItemContext;

const SelectItemGroup = SelectPrimitive.ItemGroup;

const SelectItemGroupLabel = ({
	className,
	...props
}: SelectPrimitive.ItemGroupLabelBaseProps & ExposedComponentProps<"div">) => (
	<SelectPrimitive.ItemGroupLabel
		className={cn(
			"py-1.5 ps-8 pe-2 font-medium text-muted-foreground text-xs",
			className,
		)}
		{...props}
	/>
);
SelectItemGroupLabel.displayName = "SelectItemGroupLabel";

const SelectItemText = SelectPrimitive.ItemText;

const SelectLabel = ({
	className,
	...props
}: SelectPrimitive.LabelBaseProps & ExposedComponentProps<"label">) => (
	<SelectPrimitive.Label
		className={cn(
			"select-none font-medium text-foreground text-sm leading-4 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
			className,
		)}
		{...props}
	/>
);
SelectLabel.displayName = "SelectLabel";

const SelectList = ({
	className,
	...props
}: SelectPrimitive.ListBaseProps & ExposedComponentProps<"div">) => (
	<SelectPrimitive.List
		className={cn(
			"max-h-[min(24rem,var(--available-height))] overflow-y-auto",
			className,
		)}
		{...props}
	/>
);
SelectList.displayName = "SelectList";

const SelectRootProvider = SelectPrimitive.RootProvider;

const SelectSeparator = ({
	className,
	...props
}: React.HTMLAttributes<HTMLHRElement>) => (
	<hr
		{...parts.separator.attrs}
		className={cn("-mx-1 my-1 h-px bg-border", className)}
		{...props}
	/>
);
SelectSeparator.displayName = "SelectSeparator";

const SelectTrigger = ({
	className,
	...props
}: SelectPrimitive.TriggerBaseProps & ExposedComponentProps<"button">) => (
	<SelectPrimitive.Trigger
		className={cn(
			"flex flex-1 items-center justify-between gap-1 bg-transparent px-3 py-2 outline-none outline-hidden placeholder:text-muted-foreground/70 has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 data-[placeholder-shown]:text-muted-foreground",
			className,
		)}
		{...props}
	/>
);
SelectTrigger.displayName = "SelectTrigger";

const SelectValueText = SelectPrimitive.ValueText;
const SelectRoot = SelectComponent;

export {
	Select,
	SelectRoot,
	SelectClearTrigger,
	SelectContent,
	SelectContext,
	SelectControl,
	SelectIndicator,
	SelectItem,
	SelectItemContext,
	SelectItemGroup,
	SelectItemGroupLabel,
	SelectItemText,
	SelectLabel,
	SelectList,
	SelectRootProvider,
	SelectSeparator,
	SelectTrigger,
	SelectValueText,
};

export {
	type CollectionItem,
	createListCollection,
	type ListCollection,
	type SelectHighlightChangeDetails,
	type SelectOpenChangeDetails,
	type SelectValueChangeDetails,
	useSelect,
} from "@ark-ui/react/select";

export { selectVariants } from "./select.styles";
