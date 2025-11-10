"use client";

import { TagsInput as TagsInputPrimitive } from "@ark-ui/react/tags-input";
import { XIcon } from "lucide-react";

import { cn } from "#src/lib/utils";

const TagsInput = TagsInputPrimitive.Root;

const TagsInputClearTrigger = ({
	className,
	...props
}: TagsInputPrimitive.ClearTriggerProps) => (
	<TagsInputPrimitive.ClearTrigger
		className={cn(
			"absolute end-0 top-0 flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
			className,
		)}
		{...props}
	>
		<XIcon size={14} aria-hidden="true" />
	</TagsInputPrimitive.ClearTrigger>
);
TagsInputClearTrigger.displayName = "TagsInputClearTrigger";

const TagsInputContext = TagsInputPrimitive.Context;

const TagsInputControl = ({
	className,
	children,
	...props
}: TagsInputPrimitive.ControlProps) => (
	<TagsInputContext>
		{(context) => (
			<TagsInputPrimitive.Control
				className={cn(
					"relative min-h-[38px] rounded-md border border-input text-sm outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-aria-invalid:border-destructive has-data-[part=clear-trigger]:pe-9 has-disabled:opacity-50 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
					{
						"p-1": !context.empty,
					},
					className,
				)}
				{...props}
			>
				<div className="flex flex-wrap gap-1">{children}</div>
				<TagsInputPrimitive.HiddenInput />
			</TagsInputPrimitive.Control>
		)}
	</TagsInputContext>
);
TagsInputControl.displayName = "TagsInputControl";

const TagsInputInput = ({
	className,
	...props
}: TagsInputPrimitive.InputProps) => (
	<TagsInputContext>
		{(context) => (
			<TagsInputPrimitive.Input
				className={cn(
					"flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground/70 disabled:cursor-not-allowed",
					{
						"px-3 py-2": context.empty,
						"ml-1 h-7": !context.empty,
					},
					className,
				)}
				{...props}
			/>
		)}
	</TagsInputContext>
);
TagsInputInput.displayName = "TagsInputInput";

const TagsInputItem = TagsInputPrimitive.Item;

const TagsInputItemDeleteTrigger = ({
	className,
	...props
}: TagsInputPrimitive.ItemDeleteTriggerProps) => (
	<TagsInputPrimitive.ItemDeleteTrigger
		className={cn(
			"-inset-y-px -end-px absolute flex size-7 items-center justify-center rounded-e-md border border-transparent p-0 text-muted-foreground/80 outline-none outline-hidden transition-[color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
			className,
		)}
		{...props}
	>
		<XIcon size={14} aria-hidden="true" />
	</TagsInputPrimitive.ItemDeleteTrigger>
);
TagsInputItemDeleteTrigger.displayName = "TagsInputItemDeleteTrigger";

const TagsInputItemInput = ({
	className,
	...props
}: TagsInputPrimitive.ItemInputProps) => (
	<TagsInputPrimitive.ItemInput
		className={cn(
			"h-7 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground/70 disabled:cursor-not-allowed",
			className,
		)}
		{...props}
	/>
);
TagsInputItemInput.displayName = "TagsInputItemInput";

const TagsInputItemPreview = ({
	className,
	...props
}: TagsInputPrimitive.ItemPreviewProps) => (
	<TagsInputPrimitive.ItemPreview
		className={cn(
			"relative inline-flex h-7 animate-fadeIn cursor-default items-center rounded-md border bg-background ps-2 pe-7 pl-2 font-medium text-secondary-foreground text-xs transition-all hover:bg-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-fixed:pe-2",
			className,
		)}
		{...props}
	/>
);
TagsInputItemPreview.displayName = "TagsInputItemPreview";

const TagsInputItemText = TagsInputPrimitive.ItemText;

const TagsInputLabel = ({
	className,
	...props
}: TagsInputPrimitive.LabelProps) => (
	<TagsInputPrimitive.Label
		className={cn(
			"select-none font-medium text-foreground text-sm leading-4 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
			className,
		)}
		{...props}
	/>
);
TagsInputLabel.displayName = "TagsInputLabel";

export {
	TagsInput,
	TagsInputClearTrigger,
	TagsInputContext,
	TagsInputControl,
	TagsInputInput,
	TagsInputItem,
	TagsInputItemDeleteTrigger,
	TagsInputItemInput,
	TagsInputItemPreview,
	TagsInputItemText,
	TagsInputLabel,
};

export {
	useTagsInput,
	useTagsInputContext,
	useTagsInputItemContext,
	type TagsInputHighlightChangeDetails,
	type TagsInputValidityChangeDetails,
	type TagsInputValueChangeDetails,
} from "@ark-ui/react/tags-input";
