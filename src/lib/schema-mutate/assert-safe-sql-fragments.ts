/**
 * Allowlist-style validation for DDL fragments that must not be free-form SQL.
 * Identifiers are quoted separately via `quoteIdent`; these helpers cover TYPE and DEFAULT.
 */

const TYPE_RE =
  /^(?:[A-Za-z_][\w\s]*(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?|[A-Za-z_][\w]*(\s+[A-Za-z_][\w]*)*)$/;

/** Rejects anything that looks like statement separators or comments in a type name. */
export function assertSafeSqlDataType(dataType: string): string {
  const trimmed = dataType.trim();
  if (!trimmed) throw new Error("Data type is required");
  if (/[;'"\\`]|--|\/\*|\*\//.test(trimmed)) {
    throw new Error(`Unsafe or invalid data type: ${trimmed}`);
  }
  // Collapse internal whitespace for matching, keep original spacing for emission
  const normalized = trimmed.replace(/\s+/g, " ");
  if (!TYPE_RE.test(normalized) || normalized.length > 128) {
    throw new Error(`Unsupported data type: ${trimmed}`);
  }
  return trimmed;
}

const SAFE_DEFAULT_RE =
  /^(?:NULL|TRUE|FALSE|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|now\(\)|-?\d+(?:\.\d+)?|'([^']|'')*')$/i;

/**
 * Accepts NULL / booleans / simple numerics / single-quoted literals / a few known
 * keyword defaults. Rejects bare identifiers that could be subqueries or function calls
 * beyond the allowlist.
 */
export function assertSafeSqlDefault(defaultValue: string): string {
  const trimmed = defaultValue.trim();
  if (!trimmed) throw new Error("Default value is empty");
  if (/[;\\`]|--|\/\*|\*\//.test(trimmed)) {
    throw new Error(`Unsafe default value: ${trimmed}`);
  }
  if (!SAFE_DEFAULT_RE.test(trimmed) || trimmed.length > 256) {
    throw new Error(
      `Unsupported default value (use NULL, a number, a 'quoted' literal, or CURRENT_TIMESTAMP): ${trimmed}`,
    );
  }
  return trimmed;
}
