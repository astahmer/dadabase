import {
  Dialog,
  DialogCloseTrigger,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog.tsx";

export function AlertDialog(props: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {props.title}
            </DialogTitle>
            {props.description && (
              <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                {props.description}
              </DialogDescription>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <DialogCloseTrigger asChild>
              <button
                className="inline-flex cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                onClick={props.onCancel}
              >
                Cancel
              </button>
            </DialogCloseTrigger>
            <DialogCloseTrigger asChild onClick={props.onConfirm}>
              <button className="inline-flex cursor-pointer items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                Confirm
              </button>
            </DialogCloseTrigger>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
