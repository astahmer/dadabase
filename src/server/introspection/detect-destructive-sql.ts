/**
 * Detects if a SQL query contains destructive operations (DELETE, DROP, ALTER)
 * Returns true if the query should trigger a confirmation dialog
 */
export function isDestructiveQuery(sql: string): boolean {
  if (!sql || typeof sql !== "string") {
    return false;
  }

  const code = getSqlCode(sql);
  // Unknown syntax must still ask for confirmation rather than bypassing it.
  return code === null || /\b(DELETE|DROP|ALTER|TRUNCATE)\b/.test(code);
}

/**
 * Extracts a human-readable summary of what the query does
 */
export function getDestructiveQuerySummary(sql: string): string {
  const normalized = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .toUpperCase()
    .trim();

  if (normalized.match(/^\s*DELETE\s+FROM/)) {
    return "DELETE rows from a table";
  }
  if (normalized.match(/^\s*DROP\s+TABLE/)) {
    return "DROP an entire table";
  }
  if (normalized.match(/^\s*DROP\s+DATABASE/)) {
    return "DROP an entire database";
  }
  if (normalized.match(/^\s*DROP\s+SCHEMA/)) {
    return "DROP an entire schema";
  }
  if (normalized.match(/^\s*ALTER\s+TABLE/)) {
    return "ALTER table structure";
  }
  if (normalized.match(/^\s*ALTER\s+DATABASE/)) {
    return "ALTER database";
  }

  return "Execute a destructive operation";
}

/**
 * Detects if a SQL query is a SELECT statement
 * Returns true if the query primarily returns rows
 */
export function isSelectQuery(sql: string): boolean {
  if (!sql || typeof sql !== "string") {
    return false;
  }

  // Normalize: remove comments, convert to uppercase, trim whitespace
  const normalized = sql
    .replace(/--.*$/gm, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
    .toUpperCase()
    .trim();

  // Check if it starts with SELECT or WITH (for CTEs)
  return /^\s*(SELECT|WITH)\s+/.test(normalized);
}

/**
 * Conservative approval classifier for a single SELECT (including read-only CTEs).
 * Returning rows is not proof that a statement is read-only. Keep this separate
 * from isSelectQuery, which only chooses how execution results are displayed.
 * Database permissions remain necessary: arbitrary functions can have side effects.
 */
export function isReadOnlyQuery(sql: string): boolean {
  if (!sql || typeof sql !== "string") return false;
  const code = getSqlCode(sql);
  if (code === null) return false;
  const statement = code.trim().replace(/;+\s*$/, "").trim();
  if (!/^(SELECT|WITH)\b/.test(statement) || statement.includes(";")) return false;
  return !/\b(INSERT|UPDATE|DELETE|MERGE|REPLACE|UPSERT|CREATE|DROP|ALTER|TRUNCATE|INTO|COPY|CALL|EXEC|EXECUTE|GRANT|REVOKE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|SET|RESET|LOCK|UNLOCK|NEXTVAL|SETVAL|SET_CONFIG|LO_IMPORT|LO_EXPORT|DBLINK_EXEC)\b/.test(
    statement,
  );
}

/** Mask literals, identifiers, and comments without merging neighboring tokens. */
function getSqlCode(sql: string): string | null {
  let code = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i + 2);
      i = end === -1 ? sql.length : end + 1;
      code += " ";
    } else if (sql.startsWith("/*", i)) {
      // MySQL/MariaDB executable comments are SQL, not harmless comments.
      if (/^\/\*(?:!|M!)/i.test(sql.slice(i))) return null;
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql.startsWith("/*", i)) {
          depth += 1;
          i += 2;
        } else if (sql.startsWith("*/", i)) {
          depth -= 1;
          i += 2;
        } else i += 1;
      }
      if (depth > 0) return null;
      code += " ";
    } else if (ch === "'" || ch === '"' || ch === "`" || ch === "[") {
      const close = ch === "[" ? "]" : ch;
      let closed = false;
      i += 1;
      while (i < sql.length) {
        // Backslash escaping depends on dialect/session settings: ask for approval.
        if (sql[i] === "\\") return null;
        if (sql[i] === close) {
          if (sql[i + 1] === close) {
            i += 2;
            continue;
          }
          closed = true;
          i += 1;
          break;
        }
        i += 1;
      }
      if (!closed) return null;
      code += " ? ";
    } else if (ch === "$" && /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(sql.slice(i))) {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))![0];
      const end = sql.indexOf(tag, i + tag.length);
      if (end === -1) return null;
      i = end + tag.length;
      code += " ? ";
    } else {
      code += ch;
      i += 1;
    }
  }
  return code.toUpperCase();
}
