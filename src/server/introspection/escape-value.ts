/**
 * Escape SQL string values
 */
export const escapeValue = (value: any): string => {
	if (value === null || value === undefined) return "";
	if (typeof value === "boolean") return value ? "true" : "false";
	return String(value).replace(/'/g, "''");
};

/**
 * Escape SQL identifiers (table/column names)
 */
export const escapeIdentifier = (identifier: string): string => {
	if (!identifier) return '""';
	if (identifier.includes(".")) {
		const parts = identifier.split(".");
		return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
	}
	return `"${identifier.replace(/"/g, '""')}"`;
};
