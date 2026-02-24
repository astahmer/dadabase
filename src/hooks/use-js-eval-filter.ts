import { useMemo } from "react";

interface UseJsEvalFilterOptions {
	/**
	 * The parameter name(s) to pass to the Function constructor
	 * Examples: "r" for single row, ["row", "idx"] for multiple params
	 * For row vs rows distinction, use "row" or "rows" based on your needs
	 */
	paramName: string | string[];
	/**
	 * Optional sample data to validate against
	 * If provided, will attempt to run the function on it to catch runtime errors
	 */
	sampleData?: unknown;
}

interface UseJsEvalFilterResult {
	/** The compiled function, or null if there was an error */
	fn: ((data: unknown) => unknown) | null;
	/** Error message if compilation or validation failed */
	error: string | null;
	/** Whether the filter is valid and ready to use */
	isValid: boolean;
}

/**
 * Hook for parsing and validating user-provided JavaScript filter expressions
 * Handles compilation errors and runtime validation against sample data
 *
 * @param filterExpression - The JavaScript expression (e.g., "r.name.includes('test')")
 * @param options - Configuration for parameter names and optional validation data
 * @returns Object with compiled function, error message, and validity flag
 *
 * @example
 * const { fn, error } = useJsEvalFilter("r.age > 18", { paramName: "r" });
 * if (fn && !error) {
 *   const filtered = data.filter(row => fn(row));
 * }
 */
export const useJsEvalFilter = (
	filterExpression: string | null | undefined,
	options: UseJsEvalFilterOptions,
): UseJsEvalFilterResult => {
	return useMemo(() => {
		// No filter provided
		if (!filterExpression?.trim()) {
			return { fn: null, error: null, isValid: true };
		}

		try {
			// Construct the parameter list
			const params = Array.isArray(options.paramName)
				? options.paramName
				: [options.paramName];

			// Compile the function
			const fn = new Function(...params, `return ${filterExpression}`) as (
				data: unknown,
			) => unknown;

			// Validate against sample data if provided
			if (options.sampleData !== undefined) {
				const sampleParams = Array.isArray(options.paramName)
					? [options.sampleData, 0] // Add index for multi-param case
					: [options.sampleData];
				(fn as any)(...sampleParams);
			}

			return { fn, error: null, isValid: true };
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return { fn: null, error, isValid: false };
		}
	}, [filterExpression, options.paramName, options.sampleData]);
};
