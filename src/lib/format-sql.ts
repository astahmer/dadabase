import { type FormatOptionsWithLanguage, format } from "sql-formatter";

/**
 * Format SQL query with proper indentation and spacing
 */
export function formatSQL(
  sql: string,
  options?: FormatOptionsWithLanguage & { onError?: (error: Error) => void },
): string {
  try {
    return format(sql, {
      language: "sql",
      keywordCase: "preserve",
      dataTypeCase: "preserve",
      functionCase: "preserve",
      identifierCase: "preserve",
      indentStyle: "standard",
      logicalOperatorNewline: "before",
      expressionWidth: 50,
      linesBetweenQueries: 1,
      denseOperators: false,
      ...options,
    });
  } catch (error) {
    console.error("Failed to format SQL:", error);
    if (options?.onError) {
      options?.onError(error as Error);
    }
    return sql; // Return original if formatting fails
  }
}
