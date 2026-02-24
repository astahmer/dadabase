import { cn } from "#src/lib/utils";
import {
  createToaster,
  Toaster as ToasterPrimitive,
  Toast as ToastPrimitive,
} from "@ark-ui/react/toast";
import { type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import type { ExposedComponentProps } from "./component-props.ts";

import { toastVariants } from "./toast.styles";

const Toaster = ({ ...props }: React.ComponentPropsWithoutRef<typeof ToasterPrimitive>) => (
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
  <ToastPrimitive.Root className={cn(toastVariants({ variant }), className)} {...props} />
);
Toast.displayName = "Toast";

const ToastTitle = ({ className, ...props }: ToastPrimitive.TitleProps) => (
  <ToastPrimitive.Title className={cn("text-sm font-semibold", className)} {...props} />
);
ToastTitle.displayName = "ToastTitle";

const ToastDescription = ({ className, ...props }: ToastPrimitive.DescriptionProps) => (
  <ToastPrimitive.Description className={cn("text-sm opacity-90", className)} {...props} />
);
ToastDescription.displayName = "ToastDescription";

const ToastActionTrigger = ({ className, ...props }: ToastPrimitive.ActionTriggerProps) => (
  <ToastPrimitive.ActionTrigger
    className={cn(
      "ring-offset-background hover:bg-secondary focus:ring-ring group-[.destructive]:border-muted/40 group-[.destructive]:focus:ring-destructive group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
);
ToastActionTrigger.displayName = "ToastActionTrigger";

const ToastCloseTrigger = ({ className, ...props }: ToastPrimitive.CloseTriggerProps) => (
  <ToastPrimitive.CloseTrigger
    className={cn(
      "text-foreground/50 hover:text-foreground absolute top-2 right-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 focus:opacity-100 focus:ring-2 focus:outline-none group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
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
