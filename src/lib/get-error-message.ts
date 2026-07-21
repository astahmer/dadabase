const FIBER_FAILURE_CAUSE = Symbol.for("effect/Runtime/FiberFailure/Cause");

function isGenericSqlWrapper(message: string): boolean {
  return (
    message === "Failed to execute statement" ||
    message === "An error has occurred" ||
    message === "PgClient: Failed to connect" ||
    message === "MysqlClient: Failed to connect" ||
    message.startsWith("(FiberFailure)") ||
    /^SqlError:\s*Failed to execute statement/i.test(message) ||
    /^SqlError:\s*PgClient: Failed to connect/i.test(message) ||
    /^SqlError:\s*MysqlClient: Failed to connect/i.test(message)
  );
}

function messageFromUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "object" && value !== null) {
    const obj = value as { message?: unknown; code?: unknown; errors?: unknown };
    // AggregateError (e.g. pg connection attempts) nests the real driver error —
    // prefer nested entries over the outer summary message.
    if (Array.isArray(obj.errors)) {
      for (const nested of obj.errors) {
        const fromNested = messageFromUnknown(nested);
        if (fromNested && !isGenericSqlWrapper(fromNested)) return fromNested;
      }
    }
    // Node system errors often put the useful bit in `code` + message.
    if (
      typeof obj.code === "string" &&
      /^(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET)$/.test(obj.code)
    ) {
      const base =
        typeof obj.message === "string" && obj.message.length > 0 ? obj.message : obj.code;
      return base.includes(obj.code) ? base : `${obj.code}: ${base}`;
    }
  }
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

  // Dig live structure first — AggregateError.errors / SqlError.cause beat
  // FiberFailure toString summaries like "Failed to connect".
  if (typeof error === "object" && error !== null) {
    const fromSelf = messageFromUnknown(error);
    if (fromSelf && !isGenericSqlWrapper(fromSelf)) {
      // Prefer nested driver detail when present (already handled inside messageFromUnknown).
      const annotated = messageFromCauseAnnotation(error);
      if (
        !annotated ||
        annotated === fromSelf ||
        fromSelf.includes("ECONN") ||
        fromSelf.length >= annotated.length
      ) {
        return fromSelf;
      }
    }

    const fiberCause = (error as Record<symbol, unknown>)[FIBER_FAILURE_CAUSE];
    if (fiberCause && typeof fiberCause === "object") {
      // Effect Cause.Fail stores the value as `.error` (pretty-printed as `failure`).
      const maybeFailure =
        (fiberCause as { failure?: unknown; error?: unknown }).failure ??
        (fiberCause as { error?: unknown }).error;
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

  const annotated = messageFromCauseAnnotation(error);
  if (annotated && !isGenericSqlWrapper(annotated)) {
    return annotated;
  }

  const own = messageFromUnknown(error);
  if (own && !isGenericSqlWrapper(own)) return own;
  return own;
}

export const getErrorMessage = (error: unknown): string => {
  if (!error) return "Unknown error occurred";
  return collectMessages(error) || String(error);
};
