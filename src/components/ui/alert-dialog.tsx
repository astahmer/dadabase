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
					<div className="flex gap-3 justify-end">
						<DialogCloseTrigger asChild>
							<button
								className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
								onClick={props.onCancel}
							>
								Cancel
							</button>
						</DialogCloseTrigger>
						<DialogCloseTrigger asChild onClick={props.onConfirm}>
							<button className="px-4 py-2 text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center">
								Confirm
							</button>
						</DialogCloseTrigger>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
