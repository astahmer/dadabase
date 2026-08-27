import { Button } from "#src/components/ui/button.tsx";
import { formatDbError } from "#src/lib/format-db-error.ts";
import { getErrorMessage } from "#src/lib/get-error-message.ts";

export interface ErrorBoundaryCardProps {
  error: unknown;
  title: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBoundaryCard({ error, title, onRetry, className }: ErrorBoundaryCardProps) {
  const safeMessage = formatDbError(error);
  const technicalMessage = getErrorMessage(error);
  return (
    <div
      className={`border-destructive/30 bg-destructive/10 rounded-md border p-3 ${className || ""}`}
    >
      <div className="text-destructive mb-1 text-xs font-semibold">{title}</div>
      <div className="text-destructive/80 mb-2 max-h-24 overflow-y-auto text-xs wrap-break-word">
        {safeMessage}
      </div>
      {import.meta.env.DEV && technicalMessage !== safeMessage ? (
        <details className="text-muted-foreground mb-2 text-[11px]">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap">{technicalMessage}</pre>
        </details>
      ) : null}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="h-7 w-full text-xs">
          Retry
        </Button>
      )}
    </div>
  );
}
