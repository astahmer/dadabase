import { Loader } from "lucide-react";

import { HStack, Stack } from "../ui/layout.tsx";

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
  const spinnerSize = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-6 w-6",
  }[size];

  const textSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  const Container = layout === "horizontal" ? HStack : Stack;

  return (
    <Container className={`items-center justify-center gap-2 ${className || ""}`}>
      <Loader className={`${spinnerSize} text-muted-foreground animate-spin`} />
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
