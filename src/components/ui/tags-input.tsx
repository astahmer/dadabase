"use client";

import { cn } from "#src/lib/utils";
import { TagsInput as TagsInputPrimitive } from "@ark-ui/react/tags-input";
import { XIcon } from "lucide-react";

const TagsInput = TagsInputPrimitive.Root;

const TagsInputClearTrigger = ({ className, ...props }: TagsInputPrimitive.ClearTriggerProps) => (
  <TagsInputPrimitive.ClearTrigger
    className={cn(
      "text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute end-0 top-0 flex size-9 items-center justify-center rounded-md border border-transparent transition-[color,box-shadow] outline-none focus-visible:ring-[3px]",
      className,
    )}
    {...props}
  >
    <XIcon size={14} aria-hidden="true" />
  </TagsInputPrimitive.ClearTrigger>
);
TagsInputClearTrigger.displayName = "TagsInputClearTrigger";

const TagsInputContext = TagsInputPrimitive.Context;

const TagsInputControl = ({ className, children, ...props }: TagsInputPrimitive.ControlProps) => (
  <TagsInputContext>
    {(context) => (
      <TagsInputPrimitive.Control
        className={cn(
          "border-input focus-within:border-ring focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 relative min-h-[38px] rounded-md border text-sm transition-[color,box-shadow] outline-none focus-within:ring-[3px] has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[part=clear-trigger]:pe-9",
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

const TagsInputInput = ({ className, ...props }: TagsInputPrimitive.InputProps) => (
  <TagsInputContext>
    {(context) => (
      <TagsInputPrimitive.Input
        className={cn(
          "placeholder:text-muted-foreground/70 flex-1 bg-transparent outline-hidden disabled:cursor-not-allowed",
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
      "text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute -inset-y-px -end-px flex size-7 items-center justify-center rounded-e-md border border-transparent p-0 outline-hidden transition-[color,box-shadow] outline-none focus-visible:ring-[3px]",
      className,
    )}
    {...props}
  >
    <XIcon size={14} aria-hidden="true" />
  </TagsInputPrimitive.ItemDeleteTrigger>
);
TagsInputItemDeleteTrigger.displayName = "TagsInputItemDeleteTrigger";

const TagsInputItemInput = ({ className, ...props }: TagsInputPrimitive.ItemInputProps) => (
  <TagsInputPrimitive.ItemInput
    className={cn(
      "placeholder:text-muted-foreground/70 h-7 flex-1 bg-transparent outline-hidden disabled:cursor-not-allowed",
      className,
    )}
    {...props}
  />
);
TagsInputItemInput.displayName = "TagsInputItemInput";

const TagsInputItemPreview = ({ className, ...props }: TagsInputPrimitive.ItemPreviewProps) => (
  <TagsInputPrimitive.ItemPreview
    className={cn(
      "animate-fadeIn bg-background text-secondary-foreground hover:bg-background relative inline-flex h-7 cursor-default items-center rounded-md border ps-2 pe-7 pl-2 text-xs font-medium transition-all disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-fixed:pe-2",
      className,
    )}
    {...props}
  />
);
TagsInputItemPreview.displayName = "TagsInputItemPreview";

const TagsInputItemText = TagsInputPrimitive.ItemText;

const TagsInputLabel = ({ className, ...props }: TagsInputPrimitive.LabelProps) => (
  <TagsInputPrimitive.Label
    className={cn(
      "text-foreground text-sm leading-4 font-medium select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
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
  type TagsInputHighlightChangeDetails,
  type TagsInputValidityChangeDetails,
  type TagsInputValueChangeDetails,
  useTagsInput,
  useTagsInputContext,
  useTagsInputItemContext,
} from "@ark-ui/react/tags-input";
