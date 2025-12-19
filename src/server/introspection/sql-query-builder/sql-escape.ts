/**
 * Escape SQL identifiers (table names, column names) for PostgreSQL and SQLite
 * Double-quotes are used for both dialects
 */
export const escapeIdentifier = (identifier: string): string => {
    // Double any existing quotes
    const escaped = identifier.replace(/"/g, '""');
    return `"${escaped}"`;
};

/**
 * Escape SQL string values to prevent SQL injection
 * Single quotes are doubled for SQL standard
 */
export const escapeValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Double any single quotes
    return str.replace(/'/g, "''");
};
