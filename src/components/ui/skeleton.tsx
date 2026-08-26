import { cn } from "#src/lib/utils";

/**
 * Audit G5: shared skeleton token for initial-load placeholders.
 * Purely decorative (aria-hidden) — pair with a visually-hidden loading
 * announcement or an aria-live region when the wait can be long.
 */
export function Skeleton({ className }: { className?: string | undefined }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Row-shaped skeleton stack used by list placeholders. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}
