/**
 * Detects if a SQL query contains destructive operations (DELETE, DROP, ALTER)
 * Returns true if the query should trigger a confirmation dialog
 */
export function isDestructiveQuery(sql: string): boolean {
	if (!sql || typeof sql !== "string") {
		return false;
	}

	// Normalize: remove comments, convert to uppercase, trim whitespace
	const normalized = sql
		.replace(/--.*$/gm, "") // Remove single-line comments
		.replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
		.toUpperCase()
		.trim();

	// Check for destructive keywords at the start or after semicolons
	const destructivePatterns = [
		/^\s*(DELETE|DROP|ALTER)\s+/,
		/;\s*(DELETE|DROP|ALTER)\s+/,
	];

	return destructivePatterns.some((pattern) => pattern.test(normalized));
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
