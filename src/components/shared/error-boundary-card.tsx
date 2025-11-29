import { Button } from "#src/components/ui/button.tsx";
import { getErrorMessage } from "#src/lib/get-error-message.ts";

export interface ErrorBoundaryCardProps {
	error: unknown;
	title: string;
	onRetry?: () => void;
	className?: string;
}

export function ErrorBoundaryCard({
	error,
	title,
	onRetry,
	className,
}: ErrorBoundaryCardProps) {
	return (
		<div
			className={`rounded-md border border-destructive/30 bg-destructive/10 p-3 ${className || ""}`}
		>
			<div className="text-xs font-semibold text-destructive mb-1">{title}</div>
			<div className="text-xs text-destructive/80 font-mono wrap-break-word mb-2 max-h-24 overflow-y-auto">
				{getErrorMessage(error)}
			</div>
			{onRetry && (
				<Button
					variant="outline"
					size="sm"
					onClick={onRetry}
					className="w-full text-xs h-7"
				>
					Retry
				</Button>
			)}
		</div>
	);
}
