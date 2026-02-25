/**
 * Renders primitive JSON values with appropriate styling
 */
export function renderPrimitiveValue(value: unknown): React.ReactNode | null {
  if (value === null) {
    return <span className="text-yellow-600 dark:text-yellow-500">null</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-yellow-600 dark:text-yellow-500">{String(value)}</span>;
  }

  if (typeof value === "number") {
    return <span className="text-cyan-600 dark:text-cyan-400">{value}</span>;
  }

  if (typeof value === "string") {
    return <span className="text-green-600 dark:text-green-400">"{value}"</span>;
  }

  // Handle Date objects - display as ISO string
  if (value instanceof Date) {
    return <span className="text-green-600 dark:text-green-400">"{value.toISOString()}"</span>;
  }

  return null;
}

/**
 * Checks if a value is a primitive (non-container) type
 */
export function isPrimitiveValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string" ||
    value instanceof Date
  );
}
