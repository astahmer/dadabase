/**
 * Extract rows-affected count from dialect-specific raw execute results.
 */
export function extractRowsAffected(result: unknown): number {
  if (result == null || typeof result !== "object") {
    return 0;
  }

  const record = result as Record<string, unknown>;
  const candidates = [record.rowCount, record.rowsAffected, record.affectedRows, record.changes];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return 0;
}

/**
 * Validate that a SQL identifier is a simple unquoted name (letters, digits, underscore).
 * Prevents injection when identifiers come from client input.
 */
export function assertSafeIdentifier(name: string, kind: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid ${kind} identifier: ${name}`);
  }
}

export function assertSafeIdentifiers(names: ReadonlyArray<string>, kind: string): void {
  for (const name of names) {
    assertSafeIdentifier(name, kind);
  }
}
