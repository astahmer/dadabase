import { format } from "sql-formatter";

/**
 * Format SQL query with proper indentation and spacing
 */
export function formatSQL(sql: string): string {
    try {
        return format(sql, {
            language: "postgresql",
            keywordCase: "upper",
        });
    } catch (error) {
        console.error("Failed to format SQL:", error);
        return sql; // Return original if formatting fails
    }
}
