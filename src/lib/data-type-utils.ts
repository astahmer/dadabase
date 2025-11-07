/**
 * Determines if a data type should be right-aligned (typically numeric types)
 */
export function isNumericDataType(dataType: string): boolean {
	const normalized = dataType.toLowerCase().trim();

	const numericTypes = [
		"int2",
		"int4",
		"int8",
		"integer",
		"smallint",
		"bigint",
		"numeric",
		"decimal",
		"real",
		"double precision",
		"double",
		"float",
		"money",
	];

	return numericTypes.some((type) => normalized === type || normalized.includes(type));
}

/**
 * Determines the text alignment for a column based on its data type
 */
export function getColumnTextAlignment(dataType: string): "left" | "right" {
	return isNumericDataType(dataType) ? "right" : "left";
}
