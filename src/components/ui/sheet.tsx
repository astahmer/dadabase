import { dialogAnatomy, Dialog as SheetPrimitive } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "#src/lib/utils";
import type { ExposedComponentProps } from "./component-props.ts";

const sheetAnatomy = dialogAnatomy.rename("sheet");
const parts = sheetAnatomy.extendWith("header", "footer").build();

const Sheet = (
	props: SheetPrimitive.RootBaseProps &
		React.RefAttributes<React.ElementRef<typeof SheetPrimitive.Root>> &
		ExposedComponentProps<"div">,
) => <SheetPrimitive.Root lazyMount {...props} />;
Sheet.displayName = "Sheet";

const SheetBackdrop = ({
	className,
	...props
}: SheetPrimitive.BackdropProps) => (
	<SheetPrimitive.Backdrop
		{...parts.backdrop.attrs}
		className={cn(
			"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-(--z-index) bg-black/80 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:pointer-events-none",
			className,
		)}
		{...props}
	/>
);
SheetBackdrop.displayName = "SheetBackdrop";

const SheetCloseTrigger = ({
	className,
	...props
}: SheetPrimitive.CloseTriggerProps) => (
	<SheetPrimitive.CloseTrigger
		{...parts.closeTrigger.attrs}
		className={cn(className)}
		{...props}
	/>
);
SheetCloseTrigger.displayName = "SheetCloseTrigger";

const SheetContent = ({
	className,
	children,
	side = "right",
	positionerProps,
	...props
}: SheetPrimitive.ContentProps & {
	side?: "top" | "right" | "bottom" | "left";
	positionerProps?: SheetPrimitive.PositionerProps;
}) => (
	<Portal>
		<SheetBackdrop {...parts.backdrop.attrs} />
		<SheetPrimitive.Positioner {...parts.positioner.attrs} {...positionerProps}>
			<SheetPrimitive.Content
				{...parts.content.attrs}
				className={cn(
					"fixed z-(--z-index) z-100 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-300 data-[state=open]:duration-500",
					side === "right" &&
						"data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
					side === "left" &&
						"data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
					side === "top" &&
						"data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
					side === "bottom" &&
						"data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
					className,
				)}
				{...props}
			>
				{children}
				<SheetPrimitive.CloseTrigger
					{...parts.closeTrigger.attrs}
					className="group absolute top-3 right-3 flex size-7 items-center justify-center rounded outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none"
				>
					<XIcon className="size-4 opacity-60 transition-opacity group-hover:opacity-100" />
					<span className="sr-only">Close</span>
				</SheetPrimitive.CloseTrigger>
			</SheetPrimitive.Content>
		</SheetPrimitive.Positioner>
	</Portal>
);
SheetContent.displayName = "SheetContent";

const SheetContext = SheetPrimitive.Context;

const SheetDescription = ({
	className,
	...props
}: SheetPrimitive.DescriptionProps) => (
	<SheetPrimitive.Description
		{...parts.description.attrs}
		className={cn("text-muted-foreground text-sm", className)}
		{...props}
	/>
);
SheetDescription.displayName = "SheetDescription";

const SheetFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		{...parts.footer.attrs}
		className={cn("mt-auto flex flex-col gap-2 p-4", className)}
		{...props}
	/>
);
SheetFooter.displayName = "SheetFooter";

const SheetHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		{...parts.header.attrs}
		className={cn("flex flex-col gap-1.5 p-4", className)}
		{...props}
	/>
);
SheetHeader.displayName = "SheetHeader";

const SheetTitle = ({ className, ...props }: SheetPrimitive.TitleProps) => (
	<SheetPrimitive.Title
		{...parts.title.attrs}
		className={cn("font-semibold text-foreground", className)}
		{...props}
	/>
);
SheetTitle.displayName = "SheetTitle";

const SheetTrigger = ({ className, ...props }: SheetPrimitive.TriggerProps) => (
	<SheetPrimitive.Trigger
		{...parts.trigger.attrs}
		className={cn(className)}
		{...props}
	/>
);
SheetTrigger.displayName = "SheetTrigger";

export {
	Sheet,
	SheetBackdrop,
	SheetCloseTrigger,
	SheetContent,
	SheetContext,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
};
