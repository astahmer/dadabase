import { Combobox as ComboboxPrimitive } from "@ark-ui/react/combobox";
import { Portal } from "@ark-ui/react/portal";
import { type VariantProps } from "class-variance-authority";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "#src/lib/utils";
import { comboboxVariants } from "./combobox.styles";
import type { ExposedComponentProps } from "./component-props.ts";

const Combobox = <T extends ComboboxPrimitive.CollectionItem>(
	props: ComboboxPrimitive.RootBaseProps<T> &
		React.RefAttributes<React.ElementRef<typeof ComboboxPrimitive.Root>> &
		ExposedComponentProps<"div">,
) => <ComboboxPrimitive.Root lazyMount {...props} />;
Combobox.displayName = "Combobox";

const ComboboxClearTrigger = ({
	className,
	...props
}: ComboboxPrimitive.ClearTriggerProps) => (
	<ComboboxPrimitive.ClearTrigger
		className={cn(
			"absolute end-0 top-0 flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
			className,
		)}
		{...props}
	/>
);
ComboboxClearTrigger.displayName = "ComboboxClearTrigger";

const ComboboxContent = ({
	className,
	...props
}: ComboboxPrimitive.ContentProps) => (
	<Portal>
		<ComboboxPrimitive.Positioner>
			<ComboboxPrimitive.Content
				className={cn(
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 data-[placement=left]:-translate-x-1 data-[placement=top]:-translate-y-1 relative z-150 max-h-[min(24rem,var(--available-height))] w-full min-w-32 overflow-auto rounded-md border border-input bg-popover text-popover-foreground shadow-lg data-[placement=right]:translate-x-1 data-[placement=bottom]:translate-y-1 data-[state=closed]:animate-out data-[state=open]:animate-in",
					className,
				)}
				{...props}
			/>
		</ComboboxPrimitive.Positioner>
	</Portal>
);
ComboboxContent.displayName = "ComboboxContent";

const ComboboxContext = ComboboxPrimitive.Context;

const ComboboxControl = ({
	className,
	size,
	...props
}: ComboboxPrimitive.ControlProps & VariantProps<typeof comboboxVariants>) => (
	<ComboboxPrimitive.Control
		className={cn(comboboxVariants({ size }), className)}
		{...props}
	/>
);
ComboboxControl.displayName = "ComboboxControl";

const ComboboxInput = ({
	className,
	...props
}: ComboboxPrimitive.InputProps) => (
	<ComboboxPrimitive.Input
		className={cn(
			"flex-1 bg-transparent outline-none outline-hidden placeholder:text-muted-foreground/70 disabled:cursor-not-allowed",
			className,
		)}
		{...props}
	/>
);
ComboboxInput.displayName = "ComboboxInput";

const ComboboxItem = ({
	className,
	children,
	...props
}: ComboboxPrimitive.ItemProps) => (
	<ComboboxPrimitive.Item
		className={cn(
			"relative flex w-full cursor-default select-none items-center rounded py-1.5 ps-8 pe-2 text-sm outline-hidden data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50",
			className,
		)}
		{...props}
	>
		<span className="absolute start-2 flex size-3.5 items-center justify-center">
			<ComboboxPrimitive.ItemIndicator>
				<CheckIcon size={16} />
			</ComboboxPrimitive.ItemIndicator>
		</span>
		<ComboboxPrimitive.ItemText className="w-full">
			{children}
		</ComboboxPrimitive.ItemText>
	</ComboboxPrimitive.Item>
);
ComboboxItem.displayName = "ComboboxItem";

const ComboboxItemContext = ComboboxPrimitive.ItemContext;

const ComboboxItemGroup = ({
	className,
	...props
}: ComboboxPrimitive.ItemGroupProps) => (
	<ComboboxPrimitive.ItemGroup
		className={cn("overflow-hidden p-1 text-foreground", className)}
		{...props}
	/>
);
ComboboxItemGroup.displayName = "ComboboxItemGroup";

const ComboboxItemGroupLabel = ({
	className,
	...props
}: ComboboxPrimitive.ItemGroupLabelProps) => (
	<ComboboxPrimitive.ItemGroupLabel
		className={cn(
			"px-2 py-1.5 font-medium text-muted-foreground text-xs",
			className,
		)}
		{...props}
	/>
);
ComboboxItemGroupLabel.displayName = "ComboboxItemGroupLabel";

const ComboboxItemText = ComboboxPrimitive.ItemText;

const ComboboxLabel = ({
	className,
	...props
}: ComboboxPrimitive.LabelProps) => (
	<ComboboxPrimitive.Label
		className={cn(
			"select-none font-medium text-foreground text-sm leading-4 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
			className,
		)}
		{...props}
	/>
);
ComboboxLabel.displayName = "ComboboxLabel";

const ComboboxList = ComboboxPrimitive.List;

const ComboboxTrigger = ({
	className,
	...props
}: ComboboxPrimitive.TriggerProps) => (
	<ComboboxPrimitive.Trigger className={cn(className)} {...props}>
		<ChevronsUpDownIcon className="size-4 shrink-0 in-aria-invalid:text-destructive/80 text-muted-foreground/80" />
	</ComboboxPrimitive.Trigger>
);
ComboboxTrigger.displayName = "ComboboxTrigger";

export {
	Combobox,
	ComboboxClearTrigger,
	ComboboxContent,
	ComboboxContext,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemContext,
	ComboboxItemGroup,
	ComboboxItemGroupLabel,
	ComboboxItemText,
	ComboboxLabel,
	ComboboxList,
	ComboboxTrigger,
};

export {
	type CollectionItem,
	type ComboboxHighlightChangeDetails,
	type ComboboxInputValueChangeDetails,
	type ComboboxOpenChangeDetails,
	type ComboboxValueChangeDetails,
	createListCollection,
	type ListCollection,
	useCombobox,
} from "@ark-ui/react/combobox";

export { comboboxVariants } from "./combobox.styles";
