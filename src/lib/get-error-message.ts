const FIBER_FAILURE_CAUSE = Symbol.for("effect/Runtime/FiberFailure/Cause");

function isGenericSqlWrapper(message: string): boolean {
  return (
    message === "Failed to execute statement" ||
    message.startsWith("(FiberFailure)") ||
    /^SqlError:\s*Failed to execute statement/i.test(message)
  );
}

function messageFromUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === "object" && value !== null) {
    const obj = value as { message?: unknown };
    if (typeof obj.message === "string" && obj.message.length > 0) {
      return obj.message;
    }
  }
  return null;
}

function messageFromCauseAnnotation(value: unknown): string | null {
  if (value == null) return null;
  const asString = String(value);
  const match = asString.match(/\[cause\]:\s*(?:[\w.]*Error:\s*)?([^\n{]+)/);
  if (!match?.[1]) return null;
  const msg = match[1].trim();
  return msg.length > 0 ? msg : null;
}

function readLiveCause(value: unknown): unknown | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as { cause?: unknown };
  return obj.cause ?? null;
}

function collectMessages(error: unknown, depth = 0): string | null {
  if (!error || depth > 10) return null;

  // Prefer annotated/driver cause text from FiberFailure/SqlError toString
  const annotated = messageFromCauseAnnotation(error);
  if (annotated && !isGenericSqlWrapper(annotated)) {
    return annotated;
  }

  if (typeof error === "object" && error !== null) {
    const fiberCause = (error as Record<symbol, unknown>)[FIBER_FAILURE_CAUSE];
    if (fiberCause && typeof fiberCause === "object") {
      // Effect Cause keeps Fail.failure opaque; squash via toString annotation above.
      // Also try live `.cause` on any failure-like values we can reach.
      const maybeFailure = (fiberCause as { failure?: unknown }).failure;
      if (maybeFailure) {
        const nested = collectMessages(maybeFailure, depth + 1);
        if (nested) return nested;
      }
    }

    const cause = readLiveCause(error);
    if (cause != null) {
      const fromCause = collectMessages(cause, depth + 1) || messageFromUnknown(cause);
      if (fromCause && !isGenericSqlWrapper(fromCause)) {
        return fromCause;
      }
    }
  }

  const own = messageFromUnknown(error);
  if (own && !isGenericSqlWrapper(own)) return own;
  return own;
}

export const getErrorMessage = (error: unknown): string => {
  if (!error) return "Unknown error occurred";
  return collectMessages(error) || String(error);
};
