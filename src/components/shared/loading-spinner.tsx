import { HStack, Stack } from "../ui/layout.tsx";
import { Spinner } from "../ui/spinner.tsx";

export interface LoadingSpinnerProps {
  label?: string;
  failureCount?: number;
  layout?: "horizontal" | "vertical";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({
  label,
  failureCount = 0,
  layout = "horizontal",
  className,
  size = "md",
}: LoadingSpinnerProps) {
  const spinnerSize = { sm: "xs", md: "sm", lg: "md" }[size] as "xs" | "sm" | "md";

  const textSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  const Container = layout === "horizontal" ? HStack : Stack;

  return (
    <Container className={`items-center justify-center gap-2 ${className || ""}`}>
      <Spinner size={spinnerSize} colorPalette="muted" label="Loading" />
      {label && (
        <div className={`${textSize} text-muted-foreground`}>
          {failureCount > 0 ? (
            <>
              Failed {failureCount} time
              {failureCount > 1 ? "s" : ""}, retrying...
            </>
          ) : (
            label
          )}
        </div>
      )}
    </Container>
  );
}
