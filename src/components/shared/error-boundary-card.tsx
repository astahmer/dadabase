import { Button } from "#src/components/ui/button.tsx";
import { getErrorMessage } from "#src/lib/get-error-message.ts";

export interface ErrorBoundaryCardProps {
  error: unknown;
  title: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBoundaryCard({ error, title, onRetry, className }: ErrorBoundaryCardProps) {
  return (
    <div
      className={`border-destructive/30 bg-destructive/10 rounded-md border p-3 ${className || ""}`}
    >
      <div className="text-destructive mb-1 text-xs font-semibold">{title}</div>
      <div className="text-destructive/80 mb-2 max-h-24 overflow-y-auto font-mono text-xs wrap-break-word">
        {getErrorMessage(error)}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="h-7 w-full text-xs">
          Retry
        </Button>
      )}
    </div>
  );
}
