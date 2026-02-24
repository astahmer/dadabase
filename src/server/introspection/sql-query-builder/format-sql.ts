/**
 * Format SQL string for display with syntax highlighting support
 * Pretty-prints with proper indentation
 */
export const formatSqlForDisplay = (sql: string): string => {
	return sql
		.replace(/\n\s+/g, "\n")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.join("\n");
};

/**
 * Syntax highlight SQL keywords for console/terminal display
 * This is a basic implementation; Monaco handles real highlighting in the UI
 */
export const getSqlKeywords = (): Set<string> => {
	return new Set([
		"SELECT",
		"FROM",
		"WHERE",
		"JOIN",
		"LEFT",
		"INNER",
		"ON",
		"AND",
		"OR",
		"ORDER",
		"BY",
		"LIMIT",
		"OFFSET",
		"NULLS",
		"FIRST",
		"LAST",
		"ASC",
		"DESC",
		"AS",
		"IS",
		"NULL",
		"NOT",
	]);
};
