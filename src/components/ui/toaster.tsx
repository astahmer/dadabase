import {
  createToaster,
  Toast,
  ToastActionTrigger,
  ToastCloseTrigger,
  ToastDescription,
  Toaster,
  ToastTitle,
} from "#src/components/ui/toast";

export const toaster = createToaster({
  placement: "bottom-end",
  // overlap: true,
  // max: 3,
});

export function ToasterProvider() {
  return (
    <Toaster toaster={toaster}>
      {(toast) => {
        const closable = toast.closable ?? true;
        return (
          <Toast key={toast.id} className="min-w-max">
            <div className="grid gap-1">
              {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
              {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
            </div>
            {toast.action && (
              <ToastActionTrigger onClick={toast.action.onClick}>
                {toast.action.label}
              </ToastActionTrigger>
            )}
            {closable && <ToastCloseTrigger />}
          </Toast>
        );
      }}
    </Toaster>
  );
}
