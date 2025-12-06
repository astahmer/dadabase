/**
 * Replaces SQL parameter placeholders with their actual values
 * Handles both positional ($1, $2, etc.) and named parameters
 */
export function replaceSqlParameters(
	sql: string,
	params?: Record<string, any> | ReadonlyArray<any>,
): string {
	if (!params) return normalizeSql(sql);

	let result = sql;

	// Handle array parameters (positional)
	if (Array.isArray(params)) {
		for (let i = 0; i < params.length; i++) {
			const value = params[i];
			const placeholder = `$${i + 1}`;
			const formattedValue = formatParamValue(value);
			result = result.replaceAll(placeholder, formattedValue);
		}
	} else {
		// Handle object parameters (named)
		for (const [key, value] of Object.entries(params)) {
			const placeholders = [`:${key}`, `$${key}`];
			const formattedValue = formatParamValue(value);
			for (const placeholder of placeholders) {
				result = result.replaceAll(placeholder, formattedValue);
			}
		}
	}

	return normalizeSql(result);
}

/**
 * Normalizes SQL by collapsing multiple spaces into single spaces
 * and preserving meaningful line breaks
 */
export function normalizeSql(sql: string): string {
	return sql
		.split("\n")
		.map((line) => line.replace(/\s+/g, " ").trim())
		.filter((line) => line.length > 0)
		.join("\n");
}

function formatParamValue(value: unknown): string {
	if (value === null) return "NULL";
	if (value === undefined) return "NULL";
	if (typeof value === "string") return `'${escapeString(value)}'`;
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	if (Array.isArray(value)) {
		const formatted = value.map(formatParamValue).join(", ");
		return `(${formatted})`;
	}
	return String(value);
}

function escapeString(str: string): string {
	return str.replaceAll("'", "''");
}
