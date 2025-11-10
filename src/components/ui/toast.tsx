import {
	Toast as ToastPrimitive,
	Toaster as ToasterPrimitive,
	createToaster,
} from "@ark-ui/react/toast";
import { type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "#src/lib/utils";
import type { ExposedComponentProps } from "./component-props.ts";
import { toastVariants } from "./toast.styles";

const Toaster = ({
	...props
}: React.ComponentPropsWithoutRef<typeof ToasterPrimitive>) => (
	<ToasterPrimitive
		className="max-h-screen w-[calc(100%-var(--gap)*4)] flex-col-reverse p-4 sm:flex-col md:max-w-[420px]"
		{...props}
	/>
);
Toaster.displayName = "Toaster";

const Toast = ({
	className,
	variant,
	...props
}: ToastPrimitive.RootBaseProps &
	VariantProps<typeof toastVariants> &
	ExposedComponentProps<"div">) => (
	<ToastPrimitive.Root
		className={cn(toastVariants({ variant }), className)}
		{...props}
	/>
);
Toast.displayName = "Toast";

const ToastTitle = ({ className, ...props }: ToastPrimitive.TitleProps) => (
	<ToastPrimitive.Title
		className={cn("font-semibold text-sm", className)}
		{...props}
	/>
);
ToastTitle.displayName = "ToastTitle";

const ToastDescription = ({
	className,
	...props
}: ToastPrimitive.DescriptionProps) => (
	<ToastPrimitive.Description
		className={cn("text-sm opacity-90", className)}
		{...props}
	/>
);
ToastDescription.displayName = "ToastDescription";

const ToastActionTrigger = ({
	className,
	...props
}: ToastPrimitive.ActionTriggerProps) => (
	<ToastPrimitive.ActionTrigger
		className={cn(
			"inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 font-medium text-sm ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:focus:ring-destructive group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground",
			className,
		)}
		{...props}
	/>
);
ToastActionTrigger.displayName = "ToastActionTrigger";

const ToastCloseTrigger = ({
	className,
	...props
}: ToastPrimitive.CloseTriggerProps) => (
	<ToastPrimitive.CloseTrigger
		className={cn(
			"absolute top-2 right-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600 group-[.destructive]:hover:text-red-50",
			className,
		)}
		{...props}
	>
		<X className="h-4 w-4" />
	</ToastPrimitive.CloseTrigger>
);
ToastCloseTrigger.displayName = "ToastCloseTrigger";

export {
	createToaster,
	Toast,
	ToastActionTrigger,
	ToastCloseTrigger,
	ToastDescription,
	Toaster,
	ToastTitle,
	toastVariants,
};
