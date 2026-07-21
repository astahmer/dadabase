/**
 * Escape SQL string values
 */
export const escapeValue = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  // Escape single quotes by doubling them
  return String(value).replace(/'/g, "''");
};

/**
 * Escape SQL identifiers (table/column names). Default: PostgreSQL/SQLite double quotes.
 */
export const escapeIdentifier = (identifier: string): string => {
  if (!identifier) return '""';
  if (identifier.includes(".")) {
    const parts = identifier.split(".");
    return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
  }
  return `"${identifier.replace(/"/g, '""')}"`;
};

/** Escape SQL identifiers with MySQL backticks. */
export const escapeMysqlIdentifier = (identifier: string): string => {
  if (!identifier) return "``";
  if (identifier.includes(".")) {
    const parts = identifier.split(".");
    return parts.map((p) => `\`${p.replace(/`/g, "``")}\``).join(".");
  }
  return `\`${identifier.replace(/`/g, "``")}\``;
};
