import * as React from "react";

import { Dialog as DialogPrimitive, dialogAnatomy } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import { XIcon } from "lucide-react";

import { cn } from "#src/lib/utils";
import { dialogContentVariants, dialogBackdropVariants } from "./dialog.styles";

const parts = dialogAnatomy.extendWith("header").build();

const Dialog = DialogPrimitive.Root;

const DialogBackdrop = ({
	className,
	...props
}: DialogPrimitive.BackdropProps) => (
	<DialogPrimitive.Backdrop
		className={cn(dialogBackdropVariants(), className)}
		{...props}
	/>
);
DialogBackdrop.displayName = "DialogBackdrop";

const DialogCloseTrigger = DialogPrimitive.CloseTrigger;

const DialogContent = ({
	className,
	children,
	size,
	...props
}: DialogPrimitive.ContentProps & {
	size?:
		| "sm"
		| "md"
		| "lg"
		| "xl"
		| "2xl"
		| "3xl"
		| "4xl"
		| "5xl"
		| "6xl"
		| "7xl"
		| "full";
}) => (
	<Portal>
		<DialogBackdrop />
		<DialogPrimitive.Positioner className="overflow-hidden">
			<DialogPrimitive.Content
				className={cn(dialogContentVariants({ size }), className)}
				{...props}
			>
				{children}
				<DialogPrimitive.CloseTrigger className="group absolute top-3 right-3 flex size-7 items-center justify-center rounded outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none">
					<XIcon className="size-4 opacity-60 transition-opacity group-hover:opacity-100" />
					<span className="sr-only">Close</span>
				</DialogPrimitive.CloseTrigger>
			</DialogPrimitive.Content>
		</DialogPrimitive.Positioner>
	</Portal>
);
DialogContent.displayName = "DialogContent";

const DialogContext = DialogPrimitive.Context;

const DialogDescription = ({
	className,
	...props
}: DialogPrimitive.DescriptionProps) => (
	<DialogPrimitive.Description
		className={cn("text-muted-foreground text-sm", className)}
		{...props}
	/>
);
DialogDescription.displayName = "DialogDescription";

const DialogFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
			className,
		)}
		{...props}
	/>
);
const DialogHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		{...parts.header.attrs}
		className={cn("flex flex-col gap-1 text-center sm:text-left", className)}
		{...props}
	/>
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = ({ className, ...props }: DialogPrimitive.TitleProps) => (
	<DialogPrimitive.Title
		className={cn("font-semibold text-lg leading-none", className)}
		{...props}
	/>
);
DialogTitle.displayName = "DialogTitle";

const DialogTrigger = DialogPrimitive.Trigger;

export {
	Dialog,
	DialogBackdrop,
	DialogCloseTrigger,
	DialogContent,
	DialogContext,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
};
