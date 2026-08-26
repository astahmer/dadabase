/**
 * Redacts literal values from recorded SQL before persisting to query_logs:
 * string literals ('…' with '' escapes), numeric literals, and quoted
 * identifiers stay readable while user data (predicates, inserted values)
 * is replaced by placeholders. Keywords and identifiers are untouched.
 */
const STRING_LITERAL = /'(?:[^']|'')*'/g;
// Numbers not adjacent to an identifier character (skips col names like col1).
const NUMERIC_LITERAL = /(?<![\w$])(?:\d+\.\d+|\d+)(?![\w$])/g;

export const REDACTION_PLACEHOLDER = "?";

export function redactSqlLiterals(sql: string): string {
  if (!sql) return sql;
  return sql
    .replace(STRING_LITERAL, () => REDACTION_PLACEHOLDER)
    .replace(NUMERIC_LITERAL, (match, offset: number, full: string) => {
      // Keep LIMIT/OFFSET-style structural numbers readable enough for
      // debugging by leaving them; they are rarely sensitive. Detect by
      // looking back for LIMIT/OFFSET/FETCH keyword right before the number.
      const before = full.slice(Math.max(0, offset - 8), offset).toUpperCase();
      if (/(LIMIT|OFFSET|FETCH)\s*$/.test(before)) return match;
      return REDACTION_PLACEHOLDER;
    });
}
